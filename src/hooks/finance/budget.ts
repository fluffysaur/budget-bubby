/** budget hooks. */

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { financeService } from "../../services/financeService";
import { keys } from "../../lib/queryKeys";
import { combineMonthlyBudgets } from "../../lib/combineMonthlyBudgets";
import { generateUuid } from "../../lib/uuid";
import type {
    Household,
    HouseholdSettingsInput,
    Perspective,
    HouseholdOverview,
    RecurringItem,
    CreateRecurringItemInput,
    MonthlyBudgetDetail,
    BaseBudgetProfile,
    BaseProfileAllocation,
    MonthlyBudgetHistoryRow,
} from "../../types/finance";
import { useSafeQueryClient, useInvalidateFinance } from "./shared";

export function useHouseholdOverviewQuery() {
    return useQuery<HouseholdOverview>({
        queryKey: keys.overview.all,
        queryFn: () => financeService.getHouseholdOverview(),
    });
}

/** Stored budgets for these months (read-only), for the Roadmap baseline. */
export function useBudgetHistoryQuery(months: string[]) {
    return useQuery<MonthlyBudgetHistoryRow[]>({
        queryKey: keys.budget.history(months),
        queryFn: () => financeService.getMonthlyBudgetHistory(months),
        enabled: months.length > 0,
    });
}

export function useRecurringItemsQuery() {
    return useQuery<RecurringItem[]>({
        queryKey: keys.recurring.all,
        queryFn: () => financeService.getRecurringItems(),
    });
}

export function useMonthlyBudgetQuery(month: string, memberId?: string) {
    return useQuery<MonthlyBudgetDetail>({
        queryKey: keys.budget.month(month, memberId),
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
        queryKey: keys.budget.detail(
            month,
            perspective,
            activeMemberId,
            memberIds,
        ),
        queryFn: async () => {
            if (isCombined) {
                const memberBudgets = await Promise.all(
                    memberIds.map((id) =>
                        financeService.getMonthlyBudget(month, id),
                    ),
                );
                const combined = combineMonthlyBudgets(memberBudgets, month);
                if (combined) return combined;
            }
            return financeService.getMonthlyBudget(
                month,
                activeMemberId ?? memberIds[0],
            );
        },
        enabled: Boolean(month) && options.enabled !== false,
        placeholderData: keepPreviousData,
    });
}

export function useBaseProfilesQuery() {
    return useQuery<BaseBudgetProfile[]>({
        queryKey: keys.budget.baseProfiles,
        queryFn: () => financeService.getBaseProfiles(),
    });
}

export function useBaseAllocationsQuery(profileId?: string) {
    return useQuery<BaseProfileAllocation[]>({
        queryKey: keys.budget.baseAllocations(profileId),
        queryFn: () => financeService.getBaseAllocations(profileId),
        placeholderData: keepPreviousData,
    });
}

/**
 * Optimistic mutation for updating goals (quick deposits, goal edits, etc.).
 */
/** Saves household Roadmap settings (investment haircut %, window). */
export function useUpdateHouseholdSettingsMutation() {
    const queryClient = useSafeQueryClient();
    return useMutation<Household, Error, HouseholdSettingsInput>(
        {
            networkMode: "always",
            mutationFn: (settings) =>
                financeService.updateHouseholdSettings(settings),
            onSuccess: () =>
                queryClient.invalidateQueries({
                    queryKey: keys.overview.all,
                }),
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
                await queryClient.cancelQueries({
                    queryKey: keys.recurring.all,
                });
                const previousRecurring = queryClient.getQueryData<
                    RecurringItem[]
                >(keys.recurring.all);
                const optimisticItem: RecurringItem = {
                    id: generateUuid(),
                    household_id: payload.household_id || "",
                    monthly_amortized_amount:
                        payload.frequency === "annually"
                            ? Math.round((payload.amount / 12) * 100) / 100
                            : payload.amount,
                    ...payload,
                };
                queryClient.setQueryData<RecurringItem[]>(
                    keys.recurring.all,
                    (old) =>
                        old ? [...old, optimisticItem] : [optimisticItem],
                );
                return { previousRecurring };
            },
            onError: (_err, _payload, context) => {
                if (context?.previousRecurring) {
                    queryClient.setQueryData(
                        keys.recurring.all,
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
                await queryClient.cancelQueries({
                    queryKey: keys.recurring.all,
                });
                const previousRecurring = queryClient.getQueryData<
                    RecurringItem[]
                >(keys.recurring.all);
                queryClient.setQueryData<RecurringItem[]>(
                    keys.recurring.all,
                    (old) =>
                        old
                            ? old.map((item) =>
                                  item.id === payload.id
                                      ? { ...item, ...payload }
                                      : item,
                              )
                            : old,
                );
                return { previousRecurring };
            },
            onError: (_err, _payload, context) => {
                if (context?.previousRecurring) {
                    queryClient.setQueryData(
                        keys.recurring.all,
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
                await queryClient.cancelQueries({
                    queryKey: keys.recurring.all,
                });
                const previousRecurring = queryClient.getQueryData<
                    RecurringItem[]
                >(keys.recurring.all);
                queryClient.setQueryData<RecurringItem[]>(
                    keys.recurring.all,
                    (old) => (old ? old.filter((item) => item.id !== id) : old),
                );
                return { previousRecurring };
            },
            onError: (_err, _id, context) => {
                if (context?.previousRecurring) {
                    queryClient.setQueryData(
                        keys.recurring.all,
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
                await queryClient.cancelQueries({
                    queryKey: keys.budget.baseProfiles,
                });
                await queryClient.cancelQueries({
                    queryKey: keys.budget.baseAllocations(profile.id),
                });
                const previousProfiles = queryClient.getQueryData<
                    BaseBudgetProfile[]
                >(keys.budget.baseProfiles);
                const previousAllocations = queryClient.getQueryData<
                    BaseProfileAllocation[]
                >(keys.budget.baseAllocations(profile.id));
                queryClient.setQueryData<BaseBudgetProfile[]>(
                    keys.budget.baseProfiles,
                    (old) =>
                        old
                            ? old.map((p) =>
                                  p.id === profile.id ? profile : p,
                              )
                            : old,
                );
                queryClient.setQueryData<BaseProfileAllocation[]>(
                    keys.budget.baseAllocations(profile.id),
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
                        keys.budget.baseProfiles,
                        context.previousProfiles,
                    );
                }
                if (context?.previousAllocations) {
                    queryClient.setQueryData(
                        keys.budget.baseAllocations(context.profileId),
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
