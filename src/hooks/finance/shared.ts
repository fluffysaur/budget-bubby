/** shared hooks. */

import { useContext } from "react";
import {
    useQueryClient as useTanstackQueryClient,
    QueryClientContext,
} from "@tanstack/react-query";
import { queryClient as defaultQueryClient } from "../../lib/queryClient";
import { invalidateDomain, ALL_FINANCE_KEY } from "../../lib/queryKeys";

/** Get the query client from context or fall back to the default singleton (for tests). */
export function useSafeQueryClient() {
    const contextClient = useContext(QueryClientContext);
    return useTanstackQueryClient(contextClient ?? defaultQueryClient);
}

/**
 * Invalidate all finance queries or specific categories of queries
 */
export function useInvalidateFinance() {
    const queryClient = useSafeQueryClient();
    const invalidateRecurring = () =>
        invalidateDomain(queryClient, "recurring");

    return {
        invalidateAll: () =>
            queryClient.invalidateQueries({ queryKey: ALL_FINANCE_KEY }),
        invalidateAccounts: () => invalidateDomain(queryClient, "accounts"),
        invalidateExpenses: () => invalidateDomain(queryClient, "expenses"),
        invalidateBudget: () => invalidateDomain(queryClient, "budget"),
        invalidateGoals: () => invalidateDomain(queryClient, "goals"),
        invalidateRecurring,
        invalidateRecurringItems: invalidateRecurring,
        invalidateCategories: () => invalidateDomain(queryClient, "categories"),
        invalidateCreditCards: () => invalidateDomain(queryClient, "cards"),
        invalidateBonus: () => invalidateDomain(queryClient, "bonus"),
    };
}
