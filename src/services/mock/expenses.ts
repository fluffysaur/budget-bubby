/** In-memory mock of the expenses domain. */

import type {
    CreateExpenseInput,
    Expense,
    ExpenseFilter,
    UpdateExpenseInput,
} from "../../types/finance";
import {
    getCurrentSingaporeTime,
    extractTimeFromISO,
} from "../../lib/dateUtils";
import { cloneDeep } from "./context";
import type { MockContext } from "./context";
import type { FinanceService } from "../financeService";

export class ExpensesStore {
    constructor(
        private readonly ctx: MockContext,
        private readonly peers: () => FinanceService,
    ) {}

    async getExpenses(filter?: ExpenseFilter): Promise<Expense[]> {
        let result = [...this.ctx.state.expenses];

        if (filter?.month) {
            result = result.filter((e) => e.date.startsWith(filter.month!));
        }
        if (filter?.categoryId) {
            result = result.filter((e) => e.category_id === filter.categoryId);
        }
        if (filter?.payerId) {
            result = result.filter((e) => e.payer_id === filter.payerId);
        }
        if (filter?.isShared !== undefined) {
            result = result.filter((e) => e.is_shared === filter.isShared);
        }
        if (filter?.settled !== undefined) {
            result = result.filter((e) => e.settled === filter.settled);
        }
        if (filter?.tag) {
            const tagLower = filter.tag.toLowerCase();
            result = result.filter(
                (e) =>
                    e.tags && e.tags.some((t) => t.toLowerCase() === tagLower),
            );
        }
        if (filter?.goalId) {
            result = result.filter((e) => e.goal_id === filter.goalId);
        }
        if (filter?.search) {
            const query = filter.search.toLowerCase();
            result = result.filter(
                (e) =>
                    e.item.toLowerCase().includes(query) ||
                    (e.remarks && e.remarks.toLowerCase().includes(query)) ||
                    (e.tags &&
                        e.tags.some((t) => t.toLowerCase().includes(query))),
            );
        }

        // Sorting
        const sortBy = filter?.sortBy || "date";
        const sortOrder = filter?.sortOrder || "desc";
        result.sort((a, b) => {
            let comparison = 0;
            if (sortBy === "date") {
                comparison = a.date.localeCompare(b.date);
                if (comparison === 0) {
                    const timeA =
                        a.time ||
                        (a.created_at ? extractTimeFromISO(a.created_at) : "");
                    const timeB =
                        b.time ||
                        (b.created_at ? extractTimeFromISO(b.created_at) : "");
                    comparison = timeA.localeCompare(timeB);
                }
                if (comparison === 0 && a.created_at && b.created_at) {
                    comparison = a.created_at.localeCompare(b.created_at);
                }
            } else if (sortBy === "amount") {
                comparison = a.amount - b.amount;
            } else if (sortBy === "category") {
                const catA =
                    this.ctx.state.categories.find(
                        (c) => c.id === a.category_id,
                    )?.name || "";
                const catB =
                    this.ctx.state.categories.find(
                        (c) => c.id === b.category_id,
                    )?.name || "";
                comparison = catA.localeCompare(catB);
            } else if (sortBy === "payer") {
                comparison = a.payer_id.localeCompare(b.payer_id);
            }
            return sortOrder === "desc" ? -comparison : comparison;
        });

        // Pagination
        if (filter?.page && filter?.pageSize) {
            const start = (filter.page - 1) * filter.pageSize;
            result = result.slice(start, start + filter.pageSize);
        }

        return cloneDeep(result);
    }

    async addExpense(input: CreateExpenseInput): Promise<Expense> {
        const newExpense: Expense = {
            id:
                input.id ||
                `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            household_id: input.household_id || this.ctx.state.household.id,
            payer_id: input.payer_id,
            category_id: input.category_id || null,
            partner_category_id: input.is_shared
                ? (input.partner_category_id ?? null)
                : null,
            date: input.date,
            time: input.time || getCurrentSingaporeTime(),
            item: input.item,
            amount: Math.round(input.amount * 100) / 100,
            remarks: input.remarks || null,
            is_shared: input.is_shared,
            split_ratio: input.split_ratio ?? 0.5,
            settled: false,
            tags: input.tags || [],
            goal_id: input.goal_id || null,
            original_amount:
                input.original_amount !== undefined
                    ? input.original_amount
                    : null,
            original_currency: input.original_currency || "SGD",
            exchange_rate:
                input.exchange_rate !== undefined ? input.exchange_rate : null,
            created_at: new Date().toISOString(),
        };

        // Auto-record daily check-in
        await this.peers().recordDailyCheckin(
            newExpense.payer_id,
            newExpense.date,
            "expense",
        );

        this.ctx.state.expenses.unshift(newExpense);
        this.ctx.persist();
        return cloneDeep(newExpense);
    }

    async updateExpense(
        id: string,
        updates: UpdateExpenseInput,
    ): Promise<Expense> {
        const expense = this.ctx.state.expenses.find((e) => e.id === id);
        if (!expense) {
            throw new Error(`Expense with id "${id}" not found`);
        }

        Object.assign(expense, updates);
        if (!expense.is_shared) {
            expense.partner_category_id = null;
        }
        this.ctx.persist();
        return cloneDeep(expense);
    }

    async bulkAddExpenses(expenses: CreateExpenseInput[]): Promise<Expense[]> {
        const created: Expense[] = [];
        for (const input of expenses) {
            const exp = await this.addExpense(input);
            created.push(exp);
        }
        return created;
    }

    async deleteExpense(id: string): Promise<void> {
        const expense = this.ctx.state.expenses.find((e) => e.id === id);
        if (!expense) {
            return;
        }
        this.ctx.state.expenses = this.ctx.state.expenses.filter(
            (e) => e.id !== id,
        );
        this.ctx.persist();
    }
}
