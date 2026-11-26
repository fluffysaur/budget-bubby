/** Supabase queries for the recurring domain. */

import type {
    CreateRecurringItemInput,
    RecurringItem,
} from "../../types/finance";
import {
    isSpendType,
    resolveDueDay,
    resolveGoalLinkedStartDate,
} from "../../lib/recurringItems";
import { isValidUuid } from "../../lib/uuid";
import { isMissingColumnError } from "./shared";

import type { SupabaseContext, StorePeers } from "./context";

type WriteResult = {
    data: unknown;
    error: { code?: string; message?: string } | null;
};

/**
 * Compat for databases without the recurring goal link migration: an unlinked
 * item is retried without the goal columns. A linked one fails loudly, so the
 * link is never silently dropped.
 */
async function writeWithGoalLinkFallback<
    T extends Pick<RecurringItem, "goal_id" | "goal_offset_months">,
>(
    payload: T,
    write: (body: T) => PromiseLike<WriteResult>,
): Promise<RecurringItem> {
    let { data, error } = await write(payload);
    if (isMissingColumnError(error) && "goal_id" in payload) {
        if (payload.goal_id) {
            throw new Error(
                "Goal linking isn't available yet. Remove the linked goal and save again.",
            );
        }
        const body = { ...payload };
        delete body.goal_id;
        delete body.goal_offset_months;
        ({ data, error } = await write(body));
    }
    if (error) throw error;
    return data as RecurringItem;
}

export class RecurringStore {
    constructor(
        private readonly ctx: SupabaseContext,
        private readonly peers: () => StorePeers,
    ) {}

    async getRecurringItems(): Promise<RecurringItem[]> {
        const client = this.ctx.getClient();
        const { data, error } = await client
            .from("recurring_items")
            .select("*");
        if (error) throw error;
        return (data || []) as RecurringItem[];
    }

    async addRecurringItem(
        input: CreateRecurringItemInput,
    ): Promise<RecurringItem> {
        const client = this.ctx.getClient();
        const householdId = isValidUuid(input.household_id)
            ? input.household_id
            : await this.ctx.getHouseholdId();
        const monthlyAmortized =
            input.frequency === "annually"
                ? Math.round((input.amount / 12) * 100) / 100
                : Math.round(input.amount * 100) / 100;

        const goalId = input.goal_id || null;
        const goalOffsetMonths = goalId
            ? (input.goal_offset_months ?? 0)
            : null;
        let derivedStartDate = input.start_date || null;
        if (goalId) {
            const linkedGoal = await this.peers().service.getGoal(goalId);
            if (linkedGoal?.target_date) {
                derivedStartDate = resolveGoalLinkedStartDate(
                    linkedGoal.target_date,
                    goalOffsetMonths,
                );
            }
        }

        const insertPayload = {
            household_id: householdId,
            owner_id:
                input.owner_id === "joint" || !input.owner_id
                    ? null
                    : input.owner_id,
            type: input.type,
            name: input.name,
            amount: input.amount,
            frequency: input.frequency,
            payment_month: input.payment_month ?? null,
            start_date: derivedStartDate,
            end_date: input.end_date || null,
            notes: input.notes || null,
            monthly_amortized_amount: monthlyAmortized,
            due_day: resolveDueDay(input.frequency, input.due_day),
            category_id: isSpendType(input.type)
                ? (input.category_id ?? null)
                : null,
            paid_from_cpf_oa:
                isSpendType(input.type) && !!input.paid_from_cpf_oa,
            goal_id: goalId,
            goal_offset_months: goalOffsetMonths,
        };
        return writeWithGoalLinkFallback(insertPayload, (body) =>
            client.from("recurring_items").insert(body).select().single(),
        );
    }

    async updateRecurringItem(
        id: string,
        updates: Partial<RecurringItem>,
    ): Promise<RecurringItem> {
        const client = this.ctx.getClient();

        const finalUpdates: Partial<RecurringItem> = { ...updates };
        delete finalUpdates.id;
        // Insurance/tax reduce take-home pay and never count toward a spend category
        if (updates.type && !isSpendType(updates.type)) {
            finalUpdates.category_id = null;
            finalUpdates.paid_from_cpf_oa = false;
        }
        const needsExisting =
            updates.amount !== undefined ||
            updates.frequency !== undefined ||
            updates.goal_id !== undefined ||
            updates.goal_offset_months !== undefined;
        let existing: RecurringItem | null = null;
        if (needsExisting) {
            const { data: fetched, error: fetchErr } = await client
                .from("recurring_items")
                .select("*")
                .eq("id", id)
                .single();
            if (fetchErr) throw fetchErr;
            existing = fetched as RecurringItem;
        }
        if (
            existing &&
            (updates.amount !== undefined || updates.frequency !== undefined)
        ) {
            const newAmount =
                updates.amount !== undefined ? updates.amount : existing.amount;
            const newFrequency =
                updates.frequency !== undefined
                    ? updates.frequency
                    : existing.frequency;
            const monthlyAmortized =
                newFrequency === "annually"
                    ? Math.round((newAmount / 12) * 100) / 100
                    : Math.round(newAmount * 100) / 100;

            finalUpdates.monthly_amortized_amount = monthlyAmortized;
        }
        if (
            existing &&
            (updates.goal_id !== undefined ||
                updates.goal_offset_months !== undefined)
        ) {
            const nextGoalId =
                updates.goal_id !== undefined
                    ? updates.goal_id || null
                    : (existing.goal_id ?? null);
            if (!nextGoalId) {
                finalUpdates.goal_id = null;
                finalUpdates.goal_offset_months = null;
            } else {
                const nextOffset =
                    updates.goal_offset_months !== undefined
                        ? (updates.goal_offset_months ?? 0)
                        : (existing.goal_offset_months ?? 0);
                finalUpdates.goal_id = nextGoalId;
                finalUpdates.goal_offset_months = nextOffset;
                const linkedGoal =
                    await this.peers().service.getGoal(nextGoalId);
                if (linkedGoal?.target_date) {
                    finalUpdates.start_date = resolveGoalLinkedStartDate(
                        linkedGoal.target_date,
                        nextOffset,
                    );
                }
            }
        }

        return writeWithGoalLinkFallback(finalUpdates, (body) =>
            client
                .from("recurring_items")
                .update(body)
                .eq("id", id)
                .select()
                .single(),
        );
    }

    async deleteRecurringItem(id: string): Promise<void> {
        const client = this.ctx.getClient();
        const { error } = await client
            .from("recurring_items")
            .delete()
            .eq("id", id);
        if (error) throw error;
    }
}
