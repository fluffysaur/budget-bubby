/** Supabase queries for the expenses domain. */

import type {
    CreateExpenseInput,
    Expense,
    ExpenseFilter,
    UpdateExpenseInput,
} from "../../types/finance";
import { addMonths, getCurrentSingaporeTime } from "../../lib/dateUtils";
import { isValidUuid } from "../../lib/uuid";
import {
    normalizeExpenseTag,
    normalizeExpenseTags,
} from "../../lib/expenseFormDraft";
import { PartialBulkAddError } from "../bulkAddError";
import {
    isMissingColumnError,
    buildExpenseSearchOrFilter,
    fetchAllPages,
    columnSupport,
    type PaginatableQuery,
} from "./shared";
import type { SupabaseContext, StorePeers } from "./context";

export class ExpensesStore {
    constructor(
        private readonly ctx: SupabaseContext,
        private readonly peers: () => StorePeers,
    ) {}

    async getExpenses(filter?: ExpenseFilter): Promise<Expense[]> {
        const client = this.ctx.getClient();
        const sortBy = filter?.sortBy || "date";
        const ascending = filter?.sortOrder === "asc";

        const buildQuery = () => {
            let query = client.from("expenses").select("*");

            if (sortBy === "amount") {
                query = query.order("amount", { ascending });
            } else {
                query = query
                    .order("date", { ascending })
                    .order("time", { ascending, nullsFirst: false })
                    .order("created_at", { ascending });
            }

            if (filter?.month) {
                const nextMonth = addMonths(filter.month, 1);
                query = query
                    .gte("date", `${filter.month}-01`)
                    .lt("date", `${nextMonth}-01`);
            }
            if (filter?.categoryId) {
                query = query.eq("category_id", filter.categoryId);
            }
            if (filter?.payerId) {
                query = query.eq("payer_id", filter.payerId);
            }
            if (filter?.isShared !== undefined) {
                query = query.eq("is_shared", filter.isShared);
            }
            if (filter?.settled !== undefined) {
                query = query.eq("settled", filter.settled);
            }
            if (filter?.goalId) {
                query = query.eq("goal_id", filter.goalId);
            }
            if (filter?.tag) {
                query = query.contains("tags", [
                    normalizeExpenseTag(filter.tag),
                ]);
            }
            if (filter?.search) {
                query = query.or(buildExpenseSearchOrFilter(filter.search));
            }

            return query;
        };

        if (filter?.page && filter?.pageSize) {
            const from = (filter.page - 1) * filter.pageSize;
            const to = from + filter.pageSize - 1;
            const { data, error } = await buildQuery().range(from, to);
            if (error) throw error;
            return (data || []) as Expense[];
        }

        return fetchAllPages<Expense>(
            () => buildQuery() as unknown as PaginatableQuery<Expense>,
        );
    }

    async addExpense(input: CreateExpenseInput): Promise<Expense> {
        const client = this.ctx.getClient();
        const householdId = isValidUuid(input.household_id)
            ? input.household_id!
            : await this.ctx.getHouseholdId();

        if (!isValidUuid(input.payer_id)) {
            throw new Error(`Invalid payer member ID: "${input.payer_id}"`);
        }
        const resolvedPayerId = input.payer_id;

        const resolvedCategoryId: string | null = input.category_id || null;
        if (resolvedCategoryId && !isValidUuid(resolvedCategoryId)) {
            throw new Error(`Invalid category ID: "${resolvedCategoryId}"`);
        }

        const resolvedPartnerCategoryId: string | null = input.is_shared
            ? input.partner_category_id || null
            : null;
        if (
            resolvedPartnerCategoryId &&
            !isValidUuid(resolvedPartnerCategoryId)
        ) {
            throw new Error(
                `Invalid partner category ID: "${resolvedPartnerCategoryId}"`,
            );
        }

        const insertPayload: Record<string, unknown> = {
            ...(input.id ? { id: input.id } : {}),
            payer_id: resolvedPayerId,
            household_id: householdId,
            category_id: resolvedCategoryId,
            ...(columnSupport.expensePartnerCategory !== false
                ? { partner_category_id: resolvedPartnerCategoryId }
                : {}),
            date: input.date,
            time: input.time || getCurrentSingaporeTime(),
            item: input.item,
            amount: input.amount,
            remarks: input.remarks || null,
            is_shared: input.is_shared,
            split_ratio: input.split_ratio ?? 0.5,
            settled: false,
            tags: normalizeExpenseTags(input.tags),
            goal_id: input.goal_id || null,
            original_amount:
                input.original_amount !== undefined
                    ? input.original_amount
                    : null,
            original_currency: input.original_currency || "SGD",
            exchange_rate:
                input.exchange_rate !== undefined ? input.exchange_rate : null,
        };

        let { data, error } = await client
            .from("expenses")
            .insert(insertPayload)
            .select();

        if (
            error &&
            "partner_category_id" in insertPayload &&
            isMissingColumnError(error)
        ) {
            columnSupport.expensePartnerCategory = false;
            delete insertPayload.partner_category_id;
            ({ data, error } = await client
                .from("expenses")
                .insert(insertPayload)
                .select());
        } else if (!error && "partner_category_id" in insertPayload) {
            columnSupport.expensePartnerCategory = true;
        }

        if (error) {
            const code = (error as { code?: string }).code;
            const message = (error as { message?: string }).message || "";
            const isDuplicateKey =
                code === "23505" || /duplicate key/i.test(message);
            if (!isDuplicateKey) {
                throw error;
            }
        }

        // Auto-record daily checkin
        try {
            await this.peers().service.recordDailyCheckin(
                resolvedPayerId,
                input.date,
                "expense",
            );
        } catch {
            // Non-fatal
        }

        if (!data || data.length === 0) {
            return {
                id: input.id || `exp-${Date.now()}`,
                household_id: householdId,
                payer_id: resolvedPayerId,
                category_id: resolvedCategoryId,
                partner_category_id: resolvedPartnerCategoryId,
                date: input.date,
                time: input.time || getCurrentSingaporeTime(),
                item: input.item,
                amount: input.amount,
                remarks: input.remarks || null,
                is_shared: input.is_shared,
                split_ratio: input.split_ratio ?? 0.5,
                settled: false,
                tags: normalizeExpenseTags(input.tags),
                goal_id: input.goal_id || null,
                original_amount:
                    input.original_amount !== undefined
                        ? input.original_amount
                        : null,
                original_currency: input.original_currency || "SGD",
                exchange_rate:
                    input.exchange_rate !== undefined
                        ? input.exchange_rate
                        : null,
                created_at: new Date().toISOString(),
            };
        }
        return data[0] as Expense;
    }

    async updateExpense(
        id: string,
        updates: UpdateExpenseInput,
    ): Promise<Expense> {
        const client = this.ctx.getClient();
        const payload: Record<string, unknown> = { ...updates };
        if (updates.tags !== undefined) {
            payload.tags = normalizeExpenseTags(updates.tags);
        }
        if (payload.is_shared === false) {
            payload.partner_category_id = null;
        }
        if (
            "partner_category_id" in payload &&
            columnSupport.expensePartnerCategory === false
        ) {
            delete payload.partner_category_id;
        }

        let { data, error } = await client
            .from("expenses")
            .update(payload)
            .eq("id", id)
            .select()
            .single();

        if (
            error &&
            "partner_category_id" in payload &&
            isMissingColumnError(error)
        ) {
            columnSupport.expensePartnerCategory = false;
            delete payload.partner_category_id;
            ({ data, error } = await client
                .from("expenses")
                .update(payload)
                .eq("id", id)
                .select()
                .single());
        } else if (!error && "partner_category_id" in payload) {
            columnSupport.expensePartnerCategory = true;
        }

        if (error) throw error;
        return data as Expense;
    }

    async bulkAddExpenses(expenses: CreateExpenseInput[]): Promise<Expense[]> {
        const created: Expense[] = [];
        for (const item of expenses) {
            try {
                created.push(await this.peers().service.addExpense(item));
            } catch (err) {
                // Report what was saved so callers do not re-send those rows
                if (created.length > 0)
                    throw new PartialBulkAddError(created, err);
                throw err;
            }
        }
        return created;
    }

    async deleteExpense(id: string): Promise<void> {
        const client = this.ctx.getClient();
        const { error } = await client.from("expenses").delete().eq("id", id);
        if (error) throw error;
    }
}
