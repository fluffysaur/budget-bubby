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
    CreateGoalInput,
    RecurringItem,
    CreateRecurringItemInput,
    Expense,
    CreateExpenseInput,
    MonthlyBudgetDetail,
    Category,
    CreateCategoryInput,
    UpdateCategoryInput,
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

/**
 * Optimistic mutation for adding goals.
 */
export function useAddGoalMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateGoals } = useInvalidateFinance();

    return useMutation<
        SavingsGoal,
        Error,
        CreateGoalInput & { id?: string },
        { previousGoals: SavingsGoal[] | undefined }
    >(
        {
            networkMode: "always",
            mutationFn: (input) => financeService.addGoal(input),
            onMutate: async (input) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.goals });
                const previousGoals = queryClient.getQueryData<SavingsGoal[]>(queryKeys.goals);
                const optimisticGoal: SavingsGoal = {
                    id: input.id || generateUuid(),
                    household_id: input.household_id || "",
                    title: input.title,
                    target_amount: input.target_amount,
                    saved_so_far: input.saved_so_far ?? 0,
                    target_date: input.target_date,
                    monthly_contribution: input.monthly_contribution ?? 0,
                    emoji: input.emoji || "🎯",
                    status: (input.saved_so_far ?? 0) >= input.target_amount ? "achieved" : "on_track",
                    created_at: new Date().toISOString(),
                };
                queryClient.setQueryData<SavingsGoal[]>(queryKeys.goals, (old) =>
                    old ? [...old, optimisticGoal] : [optimisticGoal],
                );
                return { previousGoals };
            },
            onError: (_err, _input, context) => {
                if (context?.previousGoals) {
                    queryClient.setQueryData(queryKeys.goals, context.previousGoals);
                }
            },
            onSettled: () => {
                invalidateGoals();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for updating goals (quick deposits, goal edits, etc.).
 */
export function useUpdateGoalMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateGoals } = useInvalidateFinance();

    return useMutation<
        SavingsGoal,
        Error,
        { id: string; updates: Partial<SavingsGoal> },
        { previousGoals: SavingsGoal[] | undefined }
    >(
        {
            networkMode: "always",
            mutationFn: ({ id, updates }) => financeService.updateGoal(id, updates),
            onMutate: async ({ id, updates }) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.goals });
                const previousGoals = queryClient.getQueryData<SavingsGoal[]>(queryKeys.goals);
                queryClient.setQueryData<SavingsGoal[]>(queryKeys.goals, (old) =>
                    old ? old.map((g) => (g.id === id ? { ...g, ...updates } : g)) : old,
                );
                return { previousGoals };
            },
            onError: (_err, _vars, context) => {
                if (context?.previousGoals) {
                    queryClient.setQueryData(queryKeys.goals, context.previousGoals);
                }
            },
            onSettled: () => {
                invalidateGoals();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for adding recurring items.
 */
export function useAddRecurringItemMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateRecurring } = useInvalidateFinance();

    return useMutation<
        RecurringItem,
        Error,
        CreateRecurringItemInput,
        { previousRecurring: RecurringItem[] | undefined }
    >(
        {
            networkMode: "always",
            mutationFn: (payload) => financeService.addRecurringItem(payload),
            onMutate: async (payload) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.recurringItems });
                const previousRecurring = queryClient.getQueryData<RecurringItem[]>(
                    queryKeys.recurringItems,
                );
                const optimisticItem: RecurringItem = {
                    id: generateUuid(),
                    household_id: payload.household_id || "",
                    monthly_amortized_amount:
                        payload.frequency === "annually"
                            ? Math.round((payload.amount / 12) * 100) / 100
                            : payload.amount,
                    ...payload,
                };
                queryClient.setQueryData<RecurringItem[]>(queryKeys.recurringItems, (old) =>
                    old ? [...old, optimisticItem] : [optimisticItem],
                );
                return { previousRecurring };
            },
            onError: (_err, _payload, context) => {
                if (context?.previousRecurring) {
                    queryClient.setQueryData(
                        queryKeys.recurringItems,
                        context.previousRecurring,
                    );
                }
            },
            onSettled: () => {
                invalidateRecurring();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for updating recurring items (active toggle, edits).
 */
export function useUpdateRecurringItemMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateRecurring } = useInvalidateFinance();

    return useMutation<
        RecurringItem,
        Error,
        Partial<RecurringItem> & { id: string },
        { previousRecurring: RecurringItem[] | undefined }
    >(
        {
            networkMode: "always",
            mutationFn: (payload) =>
                financeService.updateRecurringItem(payload.id, payload),
            onMutate: async (payload) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.recurringItems });
                const previousRecurring = queryClient.getQueryData<RecurringItem[]>(
                    queryKeys.recurringItems,
                );
                queryClient.setQueryData<RecurringItem[]>(queryKeys.recurringItems, (old) =>
                    old ? old.map((item) => (item.id === payload.id ? { ...item, ...payload } : item)) : old,
                );
                return { previousRecurring };
            },
            onError: (_err, _payload, context) => {
                if (context?.previousRecurring) {
                    queryClient.setQueryData(
                        queryKeys.recurringItems,
                        context.previousRecurring,
                    );
                }
            },
            onSettled: () => {
                invalidateRecurring();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for deleting recurring items.
 */
export function useDeleteRecurringItemMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateRecurring } = useInvalidateFinance();

    return useMutation<
        void,
        Error,
        string,
        { previousRecurring: RecurringItem[] | undefined }
    >(
        {
            networkMode: "always",
            mutationFn: (id) => financeService.deleteRecurringItem(id),
            onMutate: async (id) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.recurringItems });
                const previousRecurring = queryClient.getQueryData<RecurringItem[]>(
                    queryKeys.recurringItems,
                );
                queryClient.setQueryData<RecurringItem[]>(queryKeys.recurringItems, (old) =>
                    old ? old.filter((item) => item.id !== id) : old,
                );
                return { previousRecurring };
            },
            onError: (_err, _id, context) => {
                if (context?.previousRecurring) {
                    queryClient.setQueryData(
                        queryKeys.recurringItems,
                        context.previousRecurring,
                    );
                }
            },
            onSettled: () => {
                invalidateRecurring();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for updating a single account's balance across all perspective queries.
 */
export function useUpdateAccountBalanceMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateAccounts } = useInvalidateFinance();

    return useMutation<
        Account,
        Error,
        {
            accountId: string;
            newBalance: number;
            notes?: string;
            snapshotDate?: string;
        },
        { previousAccountQueries: [readonly unknown[], Account[] | undefined][] }
    >(
        {
            networkMode: "always",
            mutationFn: ({ accountId, newBalance, notes, snapshotDate }) =>
                financeService.updateAccountBalance(
                    accountId,
                    newBalance,
                    notes,
                    snapshotDate,
                ),
            onMutate: async ({ accountId, newBalance }) => {
                await queryClient.cancelQueries({ queryKey: ["finance", "accounts"] });
                const previousAccountQueries = queryClient.getQueriesData<Account[]>({
                    queryKey: ["finance", "accounts"],
                });
                const nowIso = new Date().toISOString();
                for (const [key] of previousAccountQueries) {
                    queryClient.setQueryData<Account[]>(key, (old) =>
                        old
                            ? old.map((acc) =>
                                  acc.id === accountId
                                      ? {
                                            ...acc,
                                            balance: newBalance,
                                            updated_at: nowIso,
                                        }
                                      : acc,
                              )
                            : old,
                    );
                }
                return { previousAccountQueries };
            },
            onError: (_err, _vars, context) => {
                if (context?.previousAccountQueries) {
                    for (const [key, oldData] of context.previousAccountQueries) {
                        queryClient.setQueryData(key, oldData);
                    }
                }
            },
            onSettled: () => {
                invalidateAccounts();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for bulk updating account balances.
 */
export function useBulkUpdateAccountBalancesMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateAccounts } = useInvalidateFinance();

    return useMutation<
        Account[],
        Error,
        {
            updates: Array<{
                accountId?: string;
                id?: string;
                balance?: number;
                newBalance?: number;
                current_balance?: number;
                notes?: string | null;
            }>;
            snapshotDate?: string;
        },
        { previousAccountQueries: [readonly unknown[], Account[] | undefined][] }
    >(
        {
            networkMode: "always",
            mutationFn: ({ updates, snapshotDate }) =>
                financeService.bulkUpdateAccountBalances(
                    updates.map((u) => ({
                        accountId: u.accountId ?? u.id ?? "",
                        balance:
                            u.newBalance ?? u.balance ?? u.current_balance ?? 0,
                        newBalance:
                            u.newBalance ?? u.balance ?? u.current_balance ?? 0,
                        notes: u.notes,
                    })),
                    snapshotDate ?? new Date().toISOString().slice(0, 10),
                ),
            onMutate: async ({ updates }) => {
                await queryClient.cancelQueries({ queryKey: ["finance", "accounts"] });
                const previousAccountQueries = queryClient.getQueriesData<Account[]>({
                    queryKey: ["finance", "accounts"],
                });
                const balanceMap = new Map(
                    updates.map((u) => [
                        u.accountId ?? u.id ?? "",
                        u.newBalance ?? u.balance ?? u.current_balance ?? 0,
                    ]),
                );
                const nowIso = new Date().toISOString();
                for (const [key] of previousAccountQueries) {
                    queryClient.setQueryData<Account[]>(key, (old) =>
                        old
                            ? old.map((acc) =>
                                  balanceMap.has(acc.id)
                                      ? {
                                            ...acc,
                                            balance: balanceMap.get(acc.id)!,
                                            updated_at: nowIso,
                                        }
                                      : acc,
                              )
                            : old,
                    );
                }
                return { previousAccountQueries };
            },
            onError: (_err, _vars, context) => {
                if (context?.previousAccountQueries) {
                    for (const [key, oldData] of context.previousAccountQueries) {
                        queryClient.setQueryData(key, oldData);
                    }
                }
            },
            onSettled: () => {
                invalidateAccounts();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for creating an account.
 */
export function useCreateAccountMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateAccounts } = useInvalidateFinance();

    return useMutation<
        Account,
        Error,
        Parameters<typeof financeService.createAccount>[0]
    >(
        {
            networkMode: "always",
            mutationFn: (input) => financeService.createAccount(input),
            onSettled: () => {
                invalidateAccounts();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for updating account metadata (name, type, etc.).
 */
export function useUpdateAccountMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateAccounts } = useInvalidateFinance();

    return useMutation<
        Account,
        Error,
        {
            id: string;
            updates: Parameters<typeof financeService.updateAccount>[1];
        },
        { previousAccountQueries: [readonly unknown[], Account[] | undefined][] }
    >(
        {
            networkMode: "always",
            mutationFn: ({ id, updates }) => financeService.updateAccount(id, updates),
            onMutate: async ({ id, updates }) => {
                await queryClient.cancelQueries({ queryKey: ["finance", "accounts"] });
                const previousAccountQueries = queryClient.getQueriesData<Account[]>({
                    queryKey: ["finance", "accounts"],
                });
                for (const [key] of previousAccountQueries) {
                    queryClient.setQueryData<Account[]>(key, (old) =>
                        old
                            ? old.map((acc) =>
                                  acc.id === id ? { ...acc, ...updates } : acc,
                              )
                            : old,
                    );
                }
                return { previousAccountQueries };
            },
            onError: (_err, _vars, context) => {
                if (context?.previousAccountQueries) {
                    for (const [key, oldData] of context.previousAccountQueries) {
                        queryClient.setQueryData(key, oldData);
                    }
                }
            },
            onSettled: () => {
                invalidateAccounts();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for deleting an account.
 */
export function useDeleteAccountMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateAccounts } = useInvalidateFinance();

    return useMutation<
        void,
        Error,
        string,
        { previousAccountQueries: [readonly unknown[], Account[] | undefined][] }
    >(
        {
            networkMode: "always",
            mutationFn: (id) => financeService.deleteAccount(id),
            onMutate: async (id) => {
                await queryClient.cancelQueries({ queryKey: ["finance", "accounts"] });
                const previousAccountQueries = queryClient.getQueriesData<Account[]>({
                    queryKey: ["finance", "accounts"],
                });
                for (const [key] of previousAccountQueries) {
                    queryClient.setQueryData<Account[]>(key, (old) =>
                        old ? old.filter((acc) => acc.id !== id) : old,
                    );
                }
                return { previousAccountQueries };
            },
            onError: (_err, _id, context) => {
                if (context?.previousAccountQueries) {
                    for (const [key, oldData] of context.previousAccountQueries) {
                        queryClient.setQueryData(key, oldData);
                    }
                }
            },
            onSettled: () => {
                invalidateAccounts();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for adding categories.
 */
export function useAddCategoryMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateCategories } = useInvalidateFinance();

    return useMutation<
        Category,
        Error,
        CreateCategoryInput & { id?: string },
        { previousCategories: Category[] | undefined }
    >(
        {
            networkMode: "always",
            mutationFn: (input) => financeService.addCategory(input),
            onMutate: async (input) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.categories });
                const previousCategories = queryClient.getQueryData<Category[]>(
                    queryKeys.categories,
                );
                const optimisticCategory: Category = {
                    id: input.id || generateUuid(),
                    household_id: input.household_id || "",
                    name: input.name,
                    color: input.color || "#F59E0B",
                    icon: input.icon || "tag",
                    group: input.group,
                    is_system: input.is_system ?? false,
                };
                queryClient.setQueryData<Category[]>(queryKeys.categories, (old) =>
                    old ? [...old, optimisticCategory] : [optimisticCategory],
                );
                return { previousCategories };
            },
            onError: (_err, _input, context) => {
                if (context?.previousCategories) {
                    queryClient.setQueryData(
                        queryKeys.categories,
                        context.previousCategories,
                    );
                }
            },
            onSettled: () => {
                invalidateCategories();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for updating categories.
 */
export function useUpdateCategoryMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateCategories } = useInvalidateFinance();

    return useMutation<
        Category,
        Error,
        { id: string; updates: UpdateCategoryInput },
        { previousCategories: Category[] | undefined }
    >(
        {
            networkMode: "always",
            mutationFn: ({ id, updates }) => financeService.updateCategory(id, updates),
            onMutate: async ({ id, updates }) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.categories });
                const previousCategories = queryClient.getQueryData<Category[]>(
                    queryKeys.categories,
                );
                queryClient.setQueryData<Category[]>(queryKeys.categories, (old) =>
                    old ? old.map((c) => (c.id === id ? { ...c, ...updates } : c)) : old,
                );
                return { previousCategories };
            },
            onError: (_err, _vars, context) => {
                if (context?.previousCategories) {
                    queryClient.setQueryData(
                        queryKeys.categories,
                        context.previousCategories,
                    );
                }
            },
            onSettled: () => {
                invalidateCategories();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for deleting categories.
 */
export function useDeleteCategoryMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateCategories } = useInvalidateFinance();

    return useMutation<
        void,
        Error,
        string,
        { previousCategories: Category[] | undefined }
    >(
        {
            networkMode: "always",
            mutationFn: (id) => financeService.deleteCategory(id),
            onMutate: async (id) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.categories });
                const previousCategories = queryClient.getQueryData<Category[]>(
                    queryKeys.categories,
                );
                queryClient.setQueryData<Category[]>(queryKeys.categories, (old) =>
                    old ? old.filter((c) => c.id !== id) : old,
                );
                return { previousCategories };
            },
            onError: (_err, _id, context) => {
                if (context?.previousCategories) {
                    queryClient.setQueryData(
                        queryKeys.categories,
                        context.previousCategories,
                    );
                }
            },
            onSettled: () => {
                invalidateCategories();
            },
        },
        queryClient,
    );
}

/**
 * Optimistic mutation for updating base budget profile and allocations.
 */
export function useUpdateBaseProfileMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateBudget } = useInvalidateFinance();

    return useMutation<
        void,
        Error,
        { profile: BaseBudgetProfile; allocations: BaseProfileAllocation[] },
        {
            previousProfiles: BaseBudgetProfile[] | undefined;
            previousAllocations: BaseProfileAllocation[] | undefined;
            profileId: string;
        }
    >(
        {
            networkMode: "always",
            mutationFn: ({ profile, allocations }) =>
                financeService.updateBaseProfile(profile, allocations),
            onMutate: async ({ profile, allocations }) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.baseProfiles });
                await queryClient.cancelQueries({
                    queryKey: queryKeys.baseAllocations(profile.id),
                });
                const previousProfiles = queryClient.getQueryData<BaseBudgetProfile[]>(
                    queryKeys.baseProfiles,
                );
                const previousAllocations = queryClient.getQueryData<BaseProfileAllocation[]>(
                    queryKeys.baseAllocations(profile.id),
                );
                queryClient.setQueryData<BaseBudgetProfile[]>(queryKeys.baseProfiles, (old) =>
                    old ? old.map((p) => (p.id === profile.id ? profile : p)) : old,
                );
                queryClient.setQueryData<BaseProfileAllocation[]>(
                    queryKeys.baseAllocations(profile.id),
                    allocations,
                );
                return {
                    previousProfiles,
                    previousAllocations,
                    profileId: profile.id,
                };
            },
            onError: (_err, _vars, context) => {
                if (context?.previousProfiles) {
                    queryClient.setQueryData(
                        queryKeys.baseProfiles,
                        context.previousProfiles,
                    );
                }
                if (context?.previousAllocations) {
                    queryClient.setQueryData(
                        queryKeys.baseAllocations(context.profileId),
                        context.previousAllocations,
                    );
                }
            },
            onSettled: () => {
                invalidateBudget();
            },
        },
        queryClient,
    );
}

/**
 * Mutation for updating monthly budget details.
 */
export function useUpdateMonthlyBudgetMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateBudget } = useInvalidateFinance();

    return useMutation<
        void,
        Error,
        Parameters<typeof financeService.updateMonthlyBudget>[0]
    >(
        {
            networkMode: "always",
            mutationFn: (budget) => financeService.updateMonthlyBudget(budget),
            onSettled: () => {
                invalidateBudget();
            },
        },
        queryClient,
    );
}

