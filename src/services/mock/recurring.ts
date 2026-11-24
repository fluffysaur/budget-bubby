/** In-memory mock of the recurring domain. */

import type {
    CreateRecurringItemInput,
    RecurringItem,
} from "../../types/finance";
import {
    isSpendType,
    resolveDueDay,
    resolveGoalLinkedStartDate,
} from "../../lib/recurringItems";
import { cloneDeep } from "./context";
import type { MockContext } from "./context";

export class RecurringStore {
    constructor(private readonly ctx: MockContext) {}

    async getRecurringItems(): Promise<RecurringItem[]> {
        return cloneDeep(this.ctx.state.recurringItems);
    }

    async addRecurringItem(
        input: CreateRecurringItemInput,
    ): Promise<RecurringItem> {
        const monthlyAmortized =
            input.frequency === "annually"
                ? Math.round((input.amount / 12) * 100) / 100
                : Math.round(input.amount * 100) / 100;

        const goalId = input.goal_id || null;
        const goalOffsetMonths = goalId
            ? (input.goal_offset_months ?? 0)
            : null;
        const linkedGoal = goalId
            ? this.ctx.state.savingsGoals.find((g) => g.id === goalId)
            : undefined;
        const derivedStartDate = linkedGoal?.target_date
            ? resolveGoalLinkedStartDate(
                  linkedGoal.target_date,
                  goalOffsetMonths,
              )
            : input.start_date || null;

        const newItem: RecurringItem = {
            id: `pol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            household_id: input.household_id || this.ctx.state.household.id,
            owner_id: input.owner_id,
            type: input.type,
            name: input.name,
            amount: Math.round(input.amount * 100) / 100,
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

        this.ctx.state.recurringItems.push(newItem);
        this.ctx.syncUnlockedBudgetsForOwner(newItem.owner_id);
        this.ctx.persist();
        return cloneDeep(newItem);
    }

    async updateRecurringItem(
        id: string,
        updates: Partial<RecurringItem>,
    ): Promise<RecurringItem> {
        const recurringItem = this.ctx.state.recurringItems.find(
            (p) => p.id === id,
        );
        if (!recurringItem) {
            throw new Error(`Recurring item with id "${id}" not found`);
        }

        Object.assign(recurringItem, updates);
        // Insurance/tax reduce take-home pay and never count toward a spend category
        if (!isSpendType(recurringItem.type)) {
            recurringItem.category_id = null;
            recurringItem.paid_from_cpf_oa = false;
        }

        if (!recurringItem.goal_id) {
            recurringItem.goal_id = null;
            recurringItem.goal_offset_months = null;
        } else {
            recurringItem.goal_offset_months =
                recurringItem.goal_offset_months ?? 0;
            const linkedGoal = this.ctx.state.savingsGoals.find(
                (g) => g.id === recurringItem.goal_id,
            );
            if (linkedGoal?.target_date) {
                recurringItem.start_date = resolveGoalLinkedStartDate(
                    linkedGoal.target_date,
                    recurringItem.goal_offset_months,
                );
            }
        }

        // Recompute monthly_amortized_amount if amount or frequency changed
        if (updates.amount !== undefined || updates.frequency !== undefined) {
            recurringItem.monthly_amortized_amount =
                recurringItem.frequency === "annually"
                    ? Math.round((recurringItem.amount / 12) * 100) / 100
                    : Math.round(recurringItem.amount * 100) / 100;
        }

        this.ctx.syncUnlockedBudgetsForOwner();
        this.ctx.persist();
        return cloneDeep(recurringItem);
    }

    async deleteRecurringItem(id: string): Promise<void> {
        this.ctx.state.recurringItems = this.ctx.state.recurringItems.filter(
            (p) => p.id !== id,
        );
        this.ctx.syncUnlockedBudgetsForOwner();
        this.ctx.persist();
    }
}
