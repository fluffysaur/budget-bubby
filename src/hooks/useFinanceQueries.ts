/**
 * Unified TanStack Query Hooks for Budget Bubby
 * Provides reactive, cached data fetching layer for all financial domain entities.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { financeService } from "../services/financeService";
import { combineMonthlyBudgets } from "../lib/combineMonthlyBudgets";
import type {
    Perspective,
    ExpenseFilter,
    HouseholdOverview,
    Account,
    SavingsGoal,
    RecurringItem,
    Expense,
    MonthlyBudgetDetail,
    Category,
    BaseBudgetProfile,
    BaseProfileAllocation,
    CreditCard,
    CreditCardStatement,
    StreakSummary,
    DailyCheckin,
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
    streakSummary: (memberId?: string) =>
        ["finance", "streak-summary", memberId ?? "all"] as const,
    dailyCheckins: (memberId?: string) =>
        ["finance", "daily-checkins", memberId ?? "all"] as const,
};

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
        enabled: Boolean(month),
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
    });
}

export function useCreditCardsQuery() {
    return useQuery<CreditCard[]>({
        queryKey: queryKeys.creditCards,
        queryFn: () => financeService.getCreditCards(),
    });
}

export function useCreditCardStatementsQuery(month?: string) {
    return useQuery<CreditCardStatement[]>({
        queryKey: queryKeys.creditCardStatements(month),
        queryFn: () => financeService.getCreditCardStatements(month),
    });
}

export function useStreakSummaryQuery(memberId?: string) {
    return useQuery<StreakSummary>({
        queryKey: queryKeys.streakSummary(memberId),
        queryFn: () => financeService.getStreakSummary(memberId),
    });
}

export function useDailyCheckinsQuery(memberId?: string) {
    return useQuery<DailyCheckin[]>({
        queryKey: queryKeys.dailyCheckins(memberId),
        queryFn: () => financeService.getDailyCheckins(memberId),
    });
}

/**
 * Invalidate all finance queries or specific categories of queries
 */
export function useInvalidateFinance() {
    const queryClient = useQueryClient();

    return {
        invalidateAll: () =>
            queryClient.invalidateQueries({ queryKey: ["finance"] }),
        invalidateAccounts: () =>
            queryClient.invalidateQueries({
                queryKey: ["finance", "accounts"],
            }),
        invalidateExpenses: () => {
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
        },
        invalidateBudget: () =>
            queryClient.invalidateQueries({
                queryKey: ["finance", "monthly-budget"],
            }),
        invalidateGoals: () => {
            queryClient.invalidateQueries({ queryKey: ["finance", "goals"] });
            queryClient.invalidateQueries({
                queryKey: ["finance", "household-overview"],
            });
        },
        invalidateRecurringItems: () => {
            queryClient.invalidateQueries({
                queryKey: ["finance", "recurringItems"],
            });
            queryClient.invalidateQueries({
                queryKey: ["finance", "household-overview"],
            });
        },
        invalidateCategories: () =>
            queryClient.invalidateQueries({
                queryKey: ["finance", "categories"],
            }),
    };
}
