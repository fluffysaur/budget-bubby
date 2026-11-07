/**
 * Unified TanStack Query Hooks for Budget Bubby
 * Provides reactive, cached data fetching layer for all financial domain entities.
 */

import { useContext } from "react";
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient as useTanstackQueryClient,
    QueryClientContext,
} from "@tanstack/react-query";
import { queryClient as defaultQueryClient } from "../lib/queryClient";
import { financeService } from "../services/financeService";
import { isOnline } from "../services/offlineSyncQueue";
import { combineMonthlyBudgets } from "../lib/combineMonthlyBudgets";
import { generateUuid } from "../lib/uuid";
import type {
    Perspective,
    ExpenseFilter,
    HouseholdOverview,
    Account,
    AccountSnapshot,
    SavingsGoal,
    RecurringItem,
    Expense,
    CreateExpenseInput,
    MonthlyBudgetDetail,
    Category,
    BaseBudgetProfile,
    BaseProfileAllocation,
    CreditCard,
    CreditCardStatement,
    DailyCheckin,
    BonusEventsResult,
    BonusSplitShare,
} from "../types/finance";

export const queryKeys = {
    householdOverview: ["finance", "household-overview"] as const,
    accounts: (perspective?: Perspective) =>
        ["finance", "accounts", perspective ?? "household"] as const,
    goals: ["finance", "goals"] as const,
    recurringItems: ["finance", "recurringItems"] as const,
    expenses: (filter?: ExpenseFilter) =>
        ["finance", "expenses", filter ?? {}] as const,
    allExpenses: ["finance", "all-expenses"] as const,
    monthlyBudget: (month: string, memberId?: string) =>
        ["finance", "monthly-budget", month, memberId ?? "all"] as const,
    categories: ["finance", "categories"] as const,
    baseProfiles: ["finance", "base-profiles"] as const,
    baseAllocations: (profileId?: string) =>
        ["finance", "base-allocations", profileId ?? "all"] as const,
    creditCards: ["finance", "credit-cards"] as const,
    creditCardStatements: (month?: string) =>
        ["finance", "credit-card-statements", month ?? "all"] as const,
    dailyCheckins: (memberId?: string) =>
        ["finance", "daily-checkins", memberId ?? "all"] as const,
    bonusEvents: ["finance", "bonus-events"] as const,
    bonusSplitDefault: (memberId?: string) =>
        ["finance", "bonus-split-default", memberId ?? "none"] as const,
};

/** Get the query client from context or fall back to the default singleton (for tests). */
export function useSafeQueryClient() {
    const contextClient = useContext(QueryClientContext);
    return useTanstackQueryClient(contextClient ?? defaultQueryClient);
}

/** Bonus log entries plus whether the bonus tables exist yet. */
export function useBonusEventsQuery() {
    return useQuery<BonusEventsResult>({
        queryKey: queryKeys.bonusEvents,
        queryFn: () => financeService.getBonusEvents(),
    });
}

/** A member's default bonus split (seeded default when none is saved). */
export function useBonusSplitDefaultQuery(memberId?: string) {
    return useQuery<BonusSplitShare[]>({
        queryKey: queryKeys.bonusSplitDefault(memberId),
        queryFn: () => financeService.getBonusSplitDefault(memberId as string),
        enabled: Boolean(memberId),
    });
}

export function useHouseholdOverviewQuery() {
    return useQuery<HouseholdOverview>({
        queryKey: queryKeys.householdOverview,
        queryFn: () => financeService.getHouseholdOverview(),
    });
}

export function useAccountsQuery(perspective?: Perspective) {
    return useQuery<Account[]>({
        queryKey: queryKeys.accounts(perspective),
        queryFn: () => financeService.getAccounts(perspective || "household"),
        placeholderData: keepPreviousData,
    });
}

/** Balance snapshots for every account visible in the perspective (net-worth history). */
export function useAccountSnapshotsQuery(perspective?: Perspective) {
    return useQuery<AccountSnapshot[]>({
        queryKey: ["finance", "account-snapshots", perspective ?? "household"],
        queryFn: () => financeService.getAllAccountSnapshots(perspective || "household"),
        placeholderData: keepPreviousData,
    });
}

export function useGoalsQuery() {
    return useQuery<SavingsGoal[]>({
        queryKey: queryKeys.goals,
        queryFn: () => financeService.getGoals(),
    });
}

export function useRecurringItemsQuery() {
    return useQuery<RecurringItem[]>({
        queryKey: queryKeys.recurringItems,
        queryFn: () => financeService.getRecurringItems(),
    });
}

export function useExpensesQuery(filter?: ExpenseFilter) {
    return useQuery<Expense[]>({
        queryKey: queryKeys.expenses(filter),
        queryFn: () => financeService.getExpenses(filter),
        placeholderData: keepPreviousData,
    });
}

export function useAllExpensesQuery() {
    return useQuery<Expense[]>({
        queryKey: queryKeys.allExpenses,
        queryFn: () => financeService.getExpenses(),
    });
}

export function useMonthlyBudgetQuery(month: string, memberId?: string) {
    return useQuery<MonthlyBudgetDetail>({
        queryKey: queryKeys.monthlyBudget(month, memberId),
        queryFn: () => financeService.getMonthlyBudget(month, memberId),
        enabled: Boolean(month),
        placeholderData: keepPreviousData,
    });
}

/**
 * Budget for the active perspective: the combined household budget in the
 * Combined view, otherwise the active member's budget (falling back to the
 * first member). Shared by Home and Budget so both show the same figures.
 */
export function useBudgetDetailQuery(
    month: string,
    perspective: Perspective,
    activeMemberId: string | undefined,
    memberIds: string[],
    options: { enabled?: boolean } = {},
) {
    const isCombined = perspective === "household" && memberIds.length > 0;
    return useQuery<MonthlyBudgetDetail | null>({
        queryKey: [
            "finance",
            "budget-detail",
            month,
            perspective,
            activeMemberId,
            memberIds.join(","),
        ],
        queryFn: async () => {
            if (isCombined) {
                const memberBudgets = await Promise.all(
                    memberIds.map((id) => financeService.getMonthlyBudget(month, id)),
                );
                const combined = combineMonthlyBudgets(memberBudgets, month);
                if (combined) return combined;
            }
            return financeService.getMonthlyBudget(month, activeMemberId ?? memberIds[0]);
        },
        enabled: Boolean(month) && options.enabled !== false,
        placeholderData: keepPreviousData,
    });
}

export function useCategoriesQuery() {
    return useQuery<Category[]>({
        queryKey: queryKeys.categories,
        queryFn: () => financeService.getCategories(),
    });
}

export function useBaseProfilesQuery() {
    return useQuery<BaseBudgetProfile[]>({
        queryKey: queryKeys.baseProfiles,
        queryFn: () => financeService.getBaseProfiles(),
    });
}

export function useBaseAllocationsQuery(profileId?: string) {
    return useQuery<BaseProfileAllocation[]>({
        queryKey: queryKeys.baseAllocations(profileId),
        queryFn: () => financeService.getBaseAllocations(profileId),
        placeholderData: keepPreviousData,
    });
}

export function useCreditCardsQuery() {
    const queryClient = useSafeQueryClient();
    return useQuery<CreditCard[]>({
        queryKey: queryKeys.creditCards,
        queryFn: () => financeService.getCreditCards(),
    }, queryClient);
}

export function useCreditCardStatementsQuery(month?: string) {
    const queryClient = useSafeQueryClient();
    return useQuery<CreditCardStatement[]>({
        queryKey: queryKeys.creditCardStatements(month),
        queryFn: () => financeService.getCreditCardStatements(month),
        placeholderData: keepPreviousData,
    }, queryClient);
}

export function useDailyCheckinsQuery(memberId?: string) {
    const queryClient = useSafeQueryClient();
    return useQuery<DailyCheckin[]>({
        queryKey: queryKeys.dailyCheckins(memberId),
        queryFn: () => financeService.getDailyCheckins(memberId),
        placeholderData: keepPreviousData,
    }, queryClient);
}

/**
 * Invalidate all finance queries or specific categories of queries
 */
export function useInvalidateFinance() {
    const queryClient = useSafeQueryClient();

    const invalidateExpenses = () => {
        queryClient.invalidateQueries({
            queryKey: ["finance", "expenses"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "all-expenses"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "household-overview"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "monthly-budget"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "budget-detail"],
        });
    };

    const invalidateBudget = () => {
        queryClient.invalidateQueries({
            queryKey: ["finance", "monthly-budget"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "budget-detail"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "base-profiles"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "base-allocations"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "household-overview"],
        });
    };

    const invalidateAccounts = () => {
        queryClient.invalidateQueries({
            queryKey: ["finance", "accounts"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "account-snapshots"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "household-overview"],
        });
    };

    const invalidateGoals = () => {
        queryClient.invalidateQueries({ queryKey: ["finance", "goals"] });
        queryClient.invalidateQueries({
            queryKey: ["finance", "household-overview"],
        });
    };

    const invalidateRecurring = () => {
        queryClient.invalidateQueries({
            queryKey: ["finance", "recurringItems"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "household-overview"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "monthly-budget"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "budget-detail"],
        });
    };

    const invalidateCategories = () => {
        queryClient.invalidateQueries({
            queryKey: ["finance", "categories"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "monthly-budget"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "budget-detail"],
        });
    };

    const invalidateCreditCards = () => {
        queryClient.invalidateQueries({
            queryKey: ["finance", "credit-cards"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "credit-card-statements"],
        });
    };

    const invalidateBonus = () => {
        queryClient.invalidateQueries({
            queryKey: ["finance", "bonus-events"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "bonus-split-default"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "monthly-budget"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "budget-detail"],
        });
        queryClient.invalidateQueries({
            queryKey: ["finance", "household-overview"],
        });
    };

    return {
        invalidateAll: () =>
            queryClient.invalidateQueries({ queryKey: ["finance"] }),
        invalidateAccounts,
        invalidateExpenses,
        invalidateBudget,
        invalidateGoals,
        invalidateRecurring,
        invalidateRecurringItems: invalidateRecurring,
        invalidateCategories,
        invalidateCreditCards,
        invalidateBonus,
    };
}

/** Check if an expense matches the active filter */
export function matchesExpenseFilter(expense: Expense, filter?: ExpenseFilter): boolean {
    if (!filter) return true;
    if (filter.month && !expense.date.startsWith(filter.month)) return false;
    if (filter.categoryId && expense.category_id !== filter.categoryId) return false;
    if (filter.payerId && expense.payer_id !== filter.payerId) return false;
    if (filter.isShared !== undefined && expense.is_shared !== filter.isShared) return false;
    if (filter.tag && (!expense.tags || !expense.tags.includes(filter.tag))) return false;
    if (filter.search) {
        const term = filter.search.toLowerCase().trim();
        const itemMatch = expense.item.toLowerCase().includes(term);
        const remarksMatch = Boolean(expense.remarks?.toLowerCase().includes(term));
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
            previousExpensesQueries: [readonly unknown[], Expense[] | undefined][];
            previousAllExpenses: Expense[] | undefined;
            optimisticExpense: Expense;
        }
    >(
        {
            networkMode: "always",
            mutationFn: (input: CreateExpenseInput) => financeService.addExpense(input),
            onMutate: async (input: CreateExpenseInput) => {
                await queryClient.cancelQueries({ queryKey: ["finance", "expenses"] });
                await queryClient.cancelQueries({ queryKey: ["finance", "all-expenses"] });

                if (!input.id) {
                    input.id = generateUuid();
                }

                const previousExpensesQueries = queryClient.getQueriesData<Expense[]>({
                    queryKey: ["finance", "expenses"],
                });
                const previousAllExpenses = queryClient.getQueryData<Expense[]>(
                    queryKeys.allExpenses,
                );

                const optimisticExpense: Expense = {
                    id: input.id,
                    household_id: (input as Partial<Expense>).household_id || "",
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
                queryClient.setQueryData<Expense[]>(queryKeys.allExpenses, (old) =>
                    old ? [optimisticExpense, ...old] : [optimisticExpense],
                );

                // Optimistically update matching expense queries
                for (const [key] of previousExpensesQueries) {
                    const filter = key[2] as ExpenseFilter | undefined;
                    if (matchesExpenseFilter(optimisticExpense, filter)) {
                        queryClient.setQueryData<Expense[]>(key, (old) =>
                            old ? [optimisticExpense, ...old] : [optimisticExpense],
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
                    for (const [key, oldData] of context.previousExpensesQueries) {
                        queryClient.setQueryData(key, oldData);
                    }
                }
                if (context?.previousAllExpenses !== undefined) {
                    queryClient.setQueryData(
                        queryKeys.allExpenses,
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
            previousExpensesQueries: [readonly unknown[], Expense[] | undefined][];
            previousAllExpenses: Expense[] | undefined;
            deletedExpense: Expense | undefined;
        }
    >(
        {
            networkMode: "always",
            mutationFn: (id: string) => financeService.deleteExpense(id),
            onMutate: async (id: string) => {
                await queryClient.cancelQueries({ queryKey: ["finance", "expenses"] });
                await queryClient.cancelQueries({ queryKey: ["finance", "all-expenses"] });

                const previousExpensesQueries = queryClient.getQueriesData<Expense[]>({
                    queryKey: ["finance", "expenses"],
                });
                const previousAllExpenses = queryClient.getQueryData<Expense[]>(
                    queryKeys.allExpenses,
                );

                let deletedExpense = previousAllExpenses?.find((e) => e.id === id);
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
                queryClient.setQueryData<Expense[]>(queryKeys.allExpenses, (old) =>
                    old ? old.filter((e) => e.id !== id) : [],
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
                    for (const [key, oldData] of context.previousExpensesQueries) {
                        queryClient.setQueryData(key, oldData);
                    }
                }
                if (context?.previousAllExpenses !== undefined) {
                    queryClient.setQueryData(
                        queryKeys.allExpenses,
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
