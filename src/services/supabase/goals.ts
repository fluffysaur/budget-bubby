/** Supabase queries for the goals domain. */

import {
    normalizeGoalTags,
    sortGoalsByDate,
} from "../../lib/roadmap/goalSettings";
import type { CreateGoalInput, SavingsGoal } from "../../types/finance";
import { normalizeGoalStatus } from "../../lib/financialFormulas";
import { resolveGoalLinkedStartDate } from "../../lib/recurringItems";
import { isValidUuid } from "../../lib/uuid";
import { roundCpfCap } from "./shared";
import type { SupabaseContext } from "./context";

export class GoalsStore {
    constructor(private readonly ctx: SupabaseContext) {}

    async getGoals(): Promise<SavingsGoal[]> {
        const client = this.ctx.getClient();
        const { data, error } = await client
            .from("savings_goals")
            .select("*")
            .order("target_date", { ascending: true });
        if (error) throw error;
        return sortGoalsByDate(
            ((data || []) as SavingsGoal[]).map(normalizeGoalStatus),
        );
    }

    async getGoal(id: string): Promise<SavingsGoal | null> {
        const client = this.ctx.getClient();
        const { data, error } = await client
            .from("savings_goals")
            .select("*")
            .eq("id", id)
            .maybeSingle();
        if (error) throw error;
        return data ? normalizeGoalStatus(data as SavingsGoal) : null;
    }

    async addGoal(input: CreateGoalInput): Promise<SavingsGoal> {
        const client = this.ctx.getClient();
        const householdId = isValidUuid(input.household_id)
            ? input.household_id
            : await this.ctx.getHouseholdId();
        const { data, error } = await client
            .from("savings_goals")
            .insert({
                household_id: householdId,
                owner_id: input.owner_id || null,
                title: input.title,
                target_amount: input.target_amount,
                target_date: input.target_date,
                emoji: input.emoji || "🎯",
                status: "on_track",
                use_cpf_oa: input.use_cpf_oa ?? false,
                cpf_oa_cap: input.use_cpf_oa
                    ? roundCpfCap(input.cpf_oa_cap)
                    : null,
                tags: normalizeGoalTags(input.tags),
                goal_type: input.goal_type ?? "standard",
                buffer_months:
                    input.goal_type === "buffer"
                        ? (input.buffer_months ?? null)
                        : null,
            })
            .select()
            .single();
        if (error) throw error;
        return normalizeGoalStatus(data as SavingsGoal);
    }

    /** Progress is computed by the Roadmap, so only the given fields change. */
    async updateGoal(
        id: string,
        updates: Partial<SavingsGoal>,
    ): Promise<SavingsGoal> {
        const client = this.ctx.getClient();
        const finalUpdates = { ...updates };
        if (finalUpdates.cpf_oa_cap !== undefined) {
            finalUpdates.cpf_oa_cap = roundCpfCap(finalUpdates.cpf_oa_cap);
        }
        if (finalUpdates.tags !== undefined) {
            finalUpdates.tags = normalizeGoalTags(finalUpdates.tags);
        }
        if (Object.keys(finalUpdates).length === 0) {
            const existing = await this.getGoal(id);
            if (!existing) throw new Error("Savings goal not found");
            return existing;
        }
        const { data, error } = await client
            .from("savings_goals")
            .update(finalUpdates)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        const updatedGoal = normalizeGoalStatus(data as SavingsGoal);

        // Keep start_date synced on any recurring items linked to this goal
        if (finalUpdates.target_date !== undefined && updatedGoal.target_date) {
            const { data: linkedItems } = await client
                .from("recurring_items")
                .select("id, goal_offset_months")
                .eq("goal_id", id);
            if (linkedItems && linkedItems.length > 0) {
                for (const item of linkedItems) {
                    const syncedStart = resolveGoalLinkedStartDate(
                        updatedGoal.target_date,
                        item.goal_offset_months,
                    );
                    await client
                        .from("recurring_items")
                        .update({ start_date: syncedStart })
                        .eq("id", item.id);
                }
            }
        }

        return updatedGoal;
    }
}
