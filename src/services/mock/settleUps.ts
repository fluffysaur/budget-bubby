/** In-memory mock of the settleUps domain. */

import type { SettleUpRecordInput, SettleUpsResult } from "../../types/finance";
import { getTodayDateString } from "../../lib/dateUtils";
import { cloneDeep } from "./context";
import type { MockContext } from "./context";

export class SettleUpsStore {
    constructor(private readonly ctx: MockContext) {}

    async settleSharedExpenses(
        member1Id: string,
        member2Id: string,
        expenseIds?: string[],
        record?: SettleUpRecordInput,
    ): Promise<void> {
        if (expenseIds !== undefined && expenseIds.length === 0) {
            return;
        }
        const idSet =
            expenseIds && expenseIds.length > 0 ? new Set(expenseIds) : null;
        for (const exp of this.ctx.state.expenses) {
            if (
                exp.is_shared &&
                !exp.settled &&
                (exp.payer_id === member1Id || exp.payer_id === member2Id) &&
                (!idSet || idSet.has(exp.id))
            ) {
                exp.settled = true;
            }
        }
        if (record && expenseIds && record.amount > 0) {
            const settleUps = (this.ctx.state.settleUps ??= []);
            settleUps.push({
                id:
                    typeof crypto !== "undefined" && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `settle-${Date.now()}-${settleUps.length}`,
                household_id: this.ctx.state.household.id || "hh-00000000-0001",
                payer_id: record.payerId,
                payee_id: record.payeeId,
                amount: record.amount,
                settled_on: getTodayDateString(),
                expense_ids: [...expenseIds],
                created_at: new Date().toISOString(),
            });
        }
        this.ctx.persist();
    }

    async getSettleUps(): Promise<SettleUpsResult> {
        // Stable newest-first: later entries win ties on the same day.
        const settleUps = [...(this.ctx.state.settleUps ?? [])]
            .map((s, i) => ({ s, i }))
            .sort(
                (a, b) =>
                    b.s.settled_on.localeCompare(a.s.settled_on) || b.i - a.i,
            )
            .map(({ s }) => s);
        return { available: true, settleUps: cloneDeep(settleUps) };
    }
}
