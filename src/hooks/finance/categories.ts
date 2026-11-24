/** categories hooks. */

import { useMutation, useQuery } from "@tanstack/react-query";
import { financeService } from "../../services/financeService";
import { keys } from "../../lib/queryKeys";
import { createOptimisticMutation } from "../../lib/optimisticMutation";
import { generateUuid } from "../../lib/uuid";
import type {
    Category,
    CreateCategoryInput,
    UpdateCategoryInput,
} from "../../types/finance";
import { useSafeQueryClient, useInvalidateFinance } from "./shared";

export function useCategoriesQuery() {
    return useQuery<Category[]>({
        queryKey: keys.categories.all,
        queryFn: () => financeService.getCategories(),
    });
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
                await queryClient.cancelQueries({
                    queryKey: keys.categories.all,
                });
                const previousCategories = queryClient.getQueryData<Category[]>(
                    keys.categories.all,
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
                queryClient.setQueryData<Category[]>(
                    keys.categories.all,
                    (old) =>
                        old
                            ? [...old, optimisticCategory]
                            : [optimisticCategory],
                );
                return { previousCategories };
            },
            onError: (_err, _input, context) => {
                if (context?.previousCategories) {
                    queryClient.setQueryData(
                        keys.categories.all,
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
            mutationFn: ({ id, updates }) =>
                financeService.updateCategory(id, updates),
            onMutate: async ({ id, updates }) => {
                await queryClient.cancelQueries({
                    queryKey: keys.categories.all,
                });
                const previousCategories = queryClient.getQueryData<Category[]>(
                    keys.categories.all,
                );
                queryClient.setQueryData<Category[]>(
                    keys.categories.all,
                    (old) =>
                        old
                            ? old.map((c) =>
                                  c.id === id ? { ...c, ...updates } : c,
                              )
                            : old,
                );
                return { previousCategories };
            },
            onError: (_err, _vars, context) => {
                if (context?.previousCategories) {
                    queryClient.setQueryData(
                        keys.categories.all,
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

    return useMutation(
        createOptimisticMutation<void, string>(queryClient, {
            mutationFn: (id) => financeService.deleteCategory(id),
            keys: () => [keys.categories.all],
            apply: (qc, id) => {
                qc.setQueryData<Category[]>(keys.categories.all, (old) =>
                    old ? old.filter((c) => c.id !== id) : old,
                );
            },
            settle: () => invalidateCategories(),
        }),
        queryClient,
    );
}
