/**
 * Whether last month left unspent household surplus, for the monthly
 * "Sweep the surplus" quest. Shares the Expenses page queries and formula,
 * from the household perspective, so both agree on the amount.
 */

import { useMemo } from "react";
import {
    useAllExpensesQuery,
    useBaseAllocationsQuery,
    useBaseProfilesQuery,
    useBudgetDetailQuery,
    useCategoriesQuery,
} from "./useFinanceQueries";
import { useOptionalHousehold } from "../context/HouseholdContext";
import { addMonths } from "../lib/dateUtils";
import { detectUnspentMonthEndSurplus } from "../lib/financialFormulas";

export interface MonthEndSurplusState {
    pending: boolean;
    /** Every input query has loaded or failed, so `pending` is final. */
    settled: boolean;
}

export function useMonthEndSurplus(currentMonth: string): MonthEndSurplusState {
    const household = useOptionalHousehold();
    const members = household?.members;
    const memberIds = useMemo(
        () => (members ?? []).map((m) => m.id),
        [members],
    );
    const lastMonth = useMemo(
        () => addMonths(currentMonth, -1),
        [currentMonth],
    );

    const {
        data: expenses,
        isSuccess: expensesReady,
        isPending: expensesPending,
    } = useAllExpensesQuery();
    const {
        data: categories,
        isSuccess: categoriesReady,
        isPending: categoriesPending,
    } = useCategoriesQuery();
    const {
        data: baseProfiles,
        isSuccess: profilesReady,
        isPending: profilesPending,
    } = useBaseProfilesQuery();
    const {
        data: baseAllocations,
        isSuccess: allocationsReady,
        isPending: allocationsPending,
    } = useBaseAllocationsQuery();
    const {
        data: lastMonthBudget,
        isSuccess: budgetReady,
        isPending: budgetPending,
    } = useBudgetDetailQuery(lastMonth, "household", undefined, memberIds);

    const pending = useMemo(
        () =>
            detectUnspentMonthEndSurplus({
                currentMonth,
                lastMonth,
                perspective: "household",
                expenses,
                categories,
                baseProfiles,
                baseAllocations,
                monthlyBudget: lastMonthBudget ?? undefined,
                queriesReady:
                    expensesReady &&
                    categoriesReady &&
                    profilesReady &&
                    allocationsReady &&
                    budgetReady &&
                    memberIds.length > 0,
            }).hasUnspentSurplus,
        [
            currentMonth,
            lastMonth,
            expenses,
            categories,
            baseProfiles,
            baseAllocations,
            lastMonthBudget,
            expensesReady,
            categoriesReady,
            profilesReady,
            allocationsReady,
            budgetReady,
            memberIds,
        ],
    );
    const settled =
        !expensesPending &&
        !categoriesPending &&
        !profilesPending &&
        !allocationsPending &&
        !budgetPending;
    return { pending, settled };
}
