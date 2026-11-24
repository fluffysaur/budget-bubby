/** expenses hooks. */

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { financeService } from "../../services/financeService";
import { isOnline } from "../../services/offlineSyncQueue";
import { keys } from "../../lib/queryKeys";
import { generateUuid } from "../../lib/uuid";
import type {
    ExpenseFilter,
    Expense,
    CreateExpenseInput,
} from "../../types/finance";
import { useSafeQueryClient, useInvalidateFinance } from "./shared";

export function useExpensesQuery(filter?: ExpenseFilter) {
    return useQuery<Expense[]>({
        queryKey: keys.expenses.list(filter),
        queryFn: () => financeService.getExpenses(filter),
        placeholderData: keepPreviousData,
    });
}

export function useAllExpensesQuery() {
    return useQuery<Expense[]>({
        queryKey: keys.expenses.every,
        queryFn: () => financeService.getExpenses(),
    });
}

/** Check if an expense matches the active filter */
export function matchesExpenseFilter(
    expense: Expense,
    filter?: ExpenseFilter,
): boolean {
    if (!filter) return true;
    if (filter.month && !expense.date.startsWith(filter.month)) return false;
    if (filter.categoryId && expense.category_id !== filter.categoryId)
        return false;
    if (filter.payerId && expense.payer_id !== filter.payerId) return false;
    if (filter.isShared !== undefined && expense.is_shared !== filter.isShared)
        return false;
    if (filter.tag && (!expense.tags || !expense.tags.includes(filter.tag)))
        return false;
    if (filter.search) {
        const term = filter.search.toLowerCase().trim();
        const itemMatch = expense.item.toLowerCase().includes(term);
        const remarksMatch = Boolean(
            expense.remarks?.toLowerCase().includes(term),
        );
        if (!itemMatch && !remarksMatch) return false;
    }
    return true;
}

/**
 * Optimistic mutation for adding expenses.
 * Updates query cache instantly, rolls back on error, invalidates targeted queries when online.
 */
export function useAddExpenseMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateExpenses, invalidateGoals } = useInvalidateFinance();

    return useMutation<
        Expense,
        Error,
        CreateExpenseInput,
        {
            previousExpensesQueries: [
                readonly unknown[],
                Expense[] | undefined,
            ][];
            previousAllExpenses: Expense[] | undefined;
            optimisticExpense: Expense;
        }
    >(
        {
            networkMode: "always",
            mutationFn: (input: CreateExpenseInput) =>
                financeService.addExpense(input),
            onMutate: async (input: CreateExpenseInput) => {
                await queryClient.cancelQueries({
                    queryKey: keys.expenses.all,
                });
                await queryClient.cancelQueries({
                    queryKey: keys.expenses.every,
                });

                if (!input.id) {
                    input.id = generateUuid();
                }

                const previousExpensesQueries = queryClient.getQueriesData<
                    Expense[]
                >({
                    queryKey: keys.expenses.all,
                });
                const previousAllExpenses = queryClient.getQueryData<Expense[]>(
                    keys.expenses.every,
                );

                const optimisticExpense: Expense = {
                    id: input.id,
                    household_id:
                        (input as Partial<Expense>).household_id || "",
                    amount: input.amount,
                    category_id: input.category_id,
                    payer_id: input.payer_id,
                    date: input.date,
                    item: input.item,
                    remarks: input.remarks ?? null,
                    is_shared: Boolean(input.is_shared),
                    split_ratio: input.split_ratio ?? 0,
                    settled: false,
                    created_at: new Date().toISOString(),
                    original_currency: input.original_currency ?? null,
                    original_amount: input.original_amount ?? null,
                    exchange_rate: input.exchange_rate ?? null,
                    time: input.time ?? null,
                    tags: input.tags ?? undefined,
                    goal_id: input.goal_id ?? null,
                };

                // Optimistically update allExpenses
                queryClient.setQueryData<Expense[]>(
                    keys.expenses.every,
                    (old) =>
                        old ? [optimisticExpense, ...old] : [optimisticExpense],
                );

                // Optimistically update matching expense queries
                for (const [key] of previousExpensesQueries) {
                    const filter = key[2] as ExpenseFilter | undefined;
                    if (matchesExpenseFilter(optimisticExpense, filter)) {
                        queryClient.setQueryData<Expense[]>(key, (old) =>
                            old
                                ? [optimisticExpense, ...old]
                                : [optimisticExpense],
                        );
                    }
                }

                return {
                    previousExpensesQueries,
                    previousAllExpenses,
                    optimisticExpense,
                };
            },
            onError: (_err, _input, context) => {
                if (context?.previousExpensesQueries) {
                    for (const [
                        key,
                        oldData,
                    ] of context.previousExpensesQueries) {
                        queryClient.setQueryData(key, oldData);
                    }
                }
                if (context?.previousAllExpenses !== undefined) {
                    queryClient.setQueryData(
                        keys.expenses.every,
                        context.previousAllExpenses,
                    );
                }
            },
            onSettled: (_data, _error, variables) => {
                if (isOnline()) {
                    invalidateExpenses();
                    if (variables.goal_id) {
                        invalidateGoals();
                    }
                }
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for deleting expenses.
 * Removes from cache instantly, rolls back on error, invalidates targeted queries when online.
 */
export function useDeleteExpenseMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateExpenses, invalidateGoals } = useInvalidateFinance();

    return useMutation<
        void,
        Error,
        string,
        {
            previousExpensesQueries: [
                readonly unknown[],
                Expense[] | undefined,
            ][];
            previousAllExpenses: Expense[] | undefined;
            deletedExpense: Expense | undefined;
        }
    >(
        {
            networkMode: "always",
            mutationFn: (id: string) => financeService.deleteExpense(id),
            onMutate: async (id: string) => {
                await queryClient.cancelQueries({
                    queryKey: keys.expenses.all,
                });
                await queryClient.cancelQueries({
                    queryKey: keys.expenses.every,
                });

                const previousExpensesQueries = queryClient.getQueriesData<
                    Expense[]
                >({
                    queryKey: keys.expenses.all,
                });
                const previousAllExpenses = queryClient.getQueryData<Expense[]>(
                    keys.expenses.every,
                );

                let deletedExpense = previousAllExpenses?.find(
                    (e) => e.id === id,
                );
                if (!deletedExpense) {
                    for (const [, oldData] of previousExpensesQueries) {
                        const found = oldData?.find((e) => e.id === id);
                        if (found) {
                            deletedExpense = found;
                            break;
                        }
                    }
                }

                // Remove from allExpenses
                queryClient.setQueryData<Expense[]>(
                    keys.expenses.every,
                    (old) => (old ? old.filter((e) => e.id !== id) : []),
                );

                // Remove from matching expenses queries
                for (const [key] of previousExpensesQueries) {
                    queryClient.setQueryData<Expense[]>(key, (old) =>
                        old ? old.filter((e) => e.id !== id) : [],
                    );
                }

                return {
                    previousExpensesQueries,
                    previousAllExpenses,
                    deletedExpense,
                };
            },
            onError: (_err, _id, context) => {
                if (context?.previousExpensesQueries) {
                    for (const [
                        key,
                        oldData,
                    ] of context.previousExpensesQueries) {
                        queryClient.setQueryData(key, oldData);
                    }
                }
                if (context?.previousAllExpenses !== undefined) {
                    queryClient.setQueryData(
                        keys.expenses.every,
                        context.previousAllExpenses,
                    );
                }
            },
            onSettled: (_data, _error, _id, context) => {
                if (isOnline()) {
                    invalidateExpenses();
                    if (context?.deletedExpense?.goal_id) {
                        invalidateGoals();
                    }
                }
            },
        },
        queryClient,
    );
}
