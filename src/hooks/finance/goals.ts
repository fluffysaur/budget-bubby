/** goals hooks. */

import { useMutation, useQuery } from "@tanstack/react-query";
import { financeService } from "../../services/financeService";
import { keys } from "../../lib/queryKeys";
import { createOptimisticMutation } from "../../lib/optimisticMutation";
import { generateUuid } from "../../lib/uuid";
import type { SavingsGoal, CreateGoalInput } from "../../types/finance";
import { useSafeQueryClient, useInvalidateFinance } from "./shared";

export function useGoalsQuery(options: { enabled?: boolean } = {}) {
    const queryClient = useSafeQueryClient();
    return useQuery<SavingsGoal[]>(
        {
            queryKey: keys.goals.all,
            queryFn: () => financeService.getGoals(),
            enabled: options.enabled ?? true,
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

    return useMutation(
        createOptimisticMutation<
            SavingsGoal,
            CreateGoalInput & { id?: string }
        >(queryClient, {
            mutationFn: (input) => financeService.addGoal(input),
            keys: () => [keys.goals.all],
            apply: (qc, input) => {
                const optimisticGoal: SavingsGoal = {
                    id: input.id || generateUuid(),
                    household_id: input.household_id || "",
                    title: input.title,
                    target_amount: input.target_amount,
                    target_date: input.target_date,
                    emoji: input.emoji || "🎯",
                    status: "on_track",
                    created_at: new Date().toISOString(),
                };
                qc.setQueryData<SavingsGoal[]>(keys.goals.all, (old) =>
                    old ? [...old, optimisticGoal] : [optimisticGoal],
                );
            },
            settle: () => invalidateGoals(),
        }),
        queryClient,
    );
}

export function useUpdateGoalMutation() {
    const queryClient = useSafeQueryClient();
    const { invalidateGoals, invalidateRecurring } = useInvalidateFinance();

    return useMutation(
        createOptimisticMutation<
            SavingsGoal,
            { id: string; updates: Partial<SavingsGoal> }
        >(queryClient, {
            mutationFn: ({ id, updates }) =>
                financeService.updateGoal(id, updates),
            keys: () => [keys.goals.all],
            apply: (qc, { id, updates }) => {
                qc.setQueryData<SavingsGoal[]>(keys.goals.all, (old) =>
                    old
                        ? old.map((g) =>
                              g.id === id ? { ...g, ...updates } : g,
                          )
                        : old,
                );
            },
            settle: (vars) => {
                invalidateGoals();
                if (vars.updates.target_date !== undefined) {
                    invalidateRecurring();
                }
            },
        }),
        queryClient,
    );
}
