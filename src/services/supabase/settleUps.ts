/** Supabase queries for the settleUps domain. */

import type { SettleUpRecordInput, SettleUpsResult } from "../../types/finance";
import { getTodayDateString } from "../../lib/dateUtils";
import { isMissingRelationError } from "../../lib/supabaseErrors";

import type { SupabaseContext } from "./context";

export class SettleUpsStore {
    constructor(private readonly ctx: SupabaseContext) {}

    async settleSharedExpenses(
        member1Id: string,
        member2Id: string,
        expenseIds?: string[],
        record?: SettleUpRecordInput,
    ): Promise<void> {
        if (expenseIds !== undefined && expenseIds.length === 0) {
            return;
        }
        const client = this.ctx.getClient();
        let query = client
            .from("expenses")
            .update({ settled: true })
            .eq("is_shared", true)
            .eq("settled", false);

        if (expenseIds && expenseIds.length > 0) {
            query = query.in("id", expenseIds);
        }

        const { error } = await query.or(
            `payer_id.eq.${member1Id},payer_id.eq.${member2Id}`,
        );
        if (error) throw error;

        if (record && expenseIds && record.amount > 0) {
            await this.recordSettleUp(record, expenseIds);
        }
    }

    /**
     * Best-effort history row. The expenses are already settled, so a missing
     * table (migration not applied) must not fail the settle-up itself.
     */

    private async recordSettleUp(
        record: SettleUpRecordInput,
        expenseIds: string[],
    ): Promise<void> {
        if (this.ctx.settleUpsTableAvailable === false) return;
        const client = this.ctx.getClient();
        const { error } = await client.from("settle_ups").insert({
            household_id: await this.ctx.getHouseholdId(),
            payer_id: record.payerId,
            payee_id: record.payeeId,
            amount: record.amount,
            settled_on: getTodayDateString(),
            expense_ids: expenseIds,
        });
        if (error) {
            if (isMissingRelationError(error)) {
                this.ctx.settleUpsTableAvailable = false;
                return;
            }
            throw error;
        }
        this.ctx.settleUpsTableAvailable = true;
    }

    async getSettleUps(): Promise<SettleUpsResult> {
        if (this.ctx.settleUpsTableAvailable === false)
            return { available: false, settleUps: [] };
        const { data, error } = await this.ctx
            .getClient()
            .from("settle_ups")
            .select("*")
            .order("settled_on", { ascending: false })
            .order("created_at", { ascending: false });
        if (error) {
            if (isMissingRelationError(error)) {
                this.ctx.settleUpsTableAvailable = false;
                return { available: false, settleUps: [] };
            }
            throw error;
        }
        this.ctx.settleUpsTableAvailable = true;
        return {
            available: true,
            settleUps: ((data || []) as Record<string, unknown>[]).map(
                (row) => ({
                    id: String(row.id),
                    household_id: String(row.household_id ?? ""),
                    payer_id: String(row.payer_id),
                    payee_id: String(row.payee_id),
                    amount: Number(row.amount),
                    settled_on: String(row.settled_on),
                    expense_ids: Array.isArray(row.expense_ids)
                        ? (row.expense_ids as string[])
                        : [],
                    created_at: row.created_at
                        ? String(row.created_at)
                        : undefined,
                }),
            ),
        };
    }
}
