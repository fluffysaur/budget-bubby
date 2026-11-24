/** accounts hooks. */

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { financeService } from "../../services/financeService";
import { keys } from "../../lib/queryKeys";
import type {
    Perspective,
    Account,
    AccountSnapshot,
} from "../../types/finance";
import { useSafeQueryClient, useInvalidateFinance } from "./shared";

export function useAccountsQuery(perspective?: Perspective) {
    return useQuery<Account[]>({
        queryKey: keys.accounts.list(perspective),
        queryFn: () => financeService.getAccounts(perspective || "household"),
        placeholderData: keepPreviousData,
    });
}

/** Balance snapshots for every account visible in the perspective (net-worth history). */
export function useAccountSnapshotsQuery(perspective?: Perspective) {
    return useQuery<AccountSnapshot[]>({
        queryKey: keys.accounts.snapshots(perspective),
        queryFn: () =>
            financeService.getAllAccountSnapshots(perspective || "household"),
        placeholderData: keepPreviousData,
    });
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
        {
            previousAccountQueries: [
                readonly unknown[],
                Account[] | undefined,
            ][];
        }
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
                await queryClient.cancelQueries({
                    queryKey: keys.accounts.all,
                });
                const previousAccountQueries = queryClient.getQueriesData<
                    Account[]
                >({
                    queryKey: keys.accounts.all,
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
                    for (const [
                        key,
                        oldData,
                    ] of context.previousAccountQueries) {
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
        {
            previousAccountQueries: [
                readonly unknown[],
                Account[] | undefined,
            ][];
        }
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
                await queryClient.cancelQueries({
                    queryKey: keys.accounts.all,
                });
                const previousAccountQueries = queryClient.getQueriesData<
                    Account[]
                >({
                    queryKey: keys.accounts.all,
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
                    for (const [
                        key,
                        oldData,
                    ] of context.previousAccountQueries) {
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
        {
            previousAccountQueries: [
                readonly unknown[],
                Account[] | undefined,
            ][];
        }
    >(
        {
            networkMode: "always",
            mutationFn: ({ id, updates }) =>
                financeService.updateAccount(id, updates),
            onMutate: async ({ id, updates }) => {
                await queryClient.cancelQueries({
                    queryKey: keys.accounts.all,
                });
                const previousAccountQueries = queryClient.getQueriesData<
                    Account[]
                >({
                    queryKey: keys.accounts.all,
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
                    for (const [
                        key,
                        oldData,
                    ] of context.previousAccountQueries) {
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
        {
            previousAccountQueries: [
                readonly unknown[],
                Account[] | undefined,
            ][];
        }
    >(
        {
            networkMode: "always",
            mutationFn: (id) => financeService.deleteAccount(id),
            onMutate: async (id) => {
                await queryClient.cancelQueries({
                    queryKey: keys.accounts.all,
                });
                const previousAccountQueries = queryClient.getQueriesData<
                    Account[]
                >({
                    queryKey: keys.accounts.all,
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
                    for (const [
                        key,
                        oldData,
                    ] of context.previousAccountQueries) {
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
