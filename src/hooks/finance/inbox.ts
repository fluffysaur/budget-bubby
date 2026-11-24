/**
 * Capture Inbox queries. The inbox refetches on focus and when an iOS PWA
 * resumes (visibilitychange), unlike the app-wide 5 minute default.
 */

import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { financeService } from "../../services/financeService";
import { afterInboxConfirmed } from "../../lib/inbox/inboxConfirm";
import { invalidateDomain, keys } from "../../lib/queryKeys";
import { useSafeQueryClient } from "./shared";
import type { InboxEventMap } from "../../lib/inbox/inboxEvents";
import type {
    CaptureTokensResult,
    CreateExpenseInput,
    InboxItem,
    InboxItemsResult,
    InboxSummary,
    MerchantRule,
} from "../../types/finance";

const INBOX_STALE_MS = 30_000;

/** Refetch inbox queries when the app becomes visible again. */
function useRefetchInboxOnVisible() {
    const queryClient = useSafeQueryClient();
    useEffect(() => {
        if (typeof document === "undefined") return;
        const onVisible = () => {
            if (document.visibilityState === "visible") {
                queryClient.invalidateQueries({ queryKey: keys.inbox.all });
            }
        };
        document.addEventListener("visibilitychange", onVisible);
        return () =>
            document.removeEventListener("visibilitychange", onVisible);
    }, [queryClient]);
}

/** Household-wide pending items (both partners). */
export function useInboxQuery(options: { enabled?: boolean } = {}) {
    useRefetchInboxOnVisible();
    const queryClient = useSafeQueryClient();
    return useQuery<InboxItemsResult>(
        {
            queryKey: keys.inbox.items,
            queryFn: () => financeService.getInboxItems("pending"),
            enabled: options.enabled ?? true,
            staleTime: INBOX_STALE_MS,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
        },
        queryClient,
    );
}

/** Pending count and total. No member id: the whole household. */
export function useInboxSummary(memberId?: string) {
    useRefetchInboxOnVisible();
    return useQuery<InboxSummary>({
        queryKey: keys.inbox.summary(memberId),
        queryFn: () => financeService.getInboxSummary(memberId),
        staleTime: INBOX_STALE_MS,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    });
}

export function useMerchantRulesQuery() {
    return useQuery<MerchantRule[]>({
        queryKey: keys.inbox.rules,
        queryFn: () => financeService.getMerchantRules(),
    });
}

export function useCaptureTokensQuery(memberId?: string) {
    return useQuery<CaptureTokensResult>({
        queryKey: keys.inbox.tokens(memberId),
        queryFn: () => financeService.listCaptureTokens(memberId),
    });
}

export interface ConfirmInboxItemParams {
    item: Pick<InboxItem, "id" | "merchant_key" | "suggested_category_id">;
    input: CreateExpenseInput;
    via: InboxEventMap["inbox:item-confirmed"]["via"];
    guessedCategoryId: string | null;
}

/**
 * Optimistic mutation for confirming an inbox item as an expense.
 * Immediately removes item from pending cache, rolls back on error.
 */
export function useConfirmInboxItemMutation() {
    const queryClient = useSafeQueryClient();

    return useMutation<
        string,
        Error,
        ConfirmInboxItemParams,
        {
            previousItems: InboxItemsResult | undefined;
            previousSummaries: [readonly unknown[], InboxSummary | undefined][];
        }
    >(
        {
            networkMode: "always",
            mutationFn: async ({ item, input, via, guessedCategoryId }) => {
                const expenseId = await financeService.confirmInboxItem(
                    item.id,
                    input,
                );
                await afterInboxConfirmed({
                    item,
                    expenseId,
                    input,
                    via,
                    guessedCategoryId,
                });
                return expenseId;
            },
            onMutate: async ({ item }) => {
                await queryClient.cancelQueries({
                    queryKey: keys.inbox.items,
                });
                await queryClient.cancelQueries({
                    queryKey: keys.inbox.summaryAll,
                });

                const previousItems =
                    queryClient.getQueryData<InboxItemsResult>(
                        keys.inbox.items,
                    );
                const previousSummaries =
                    queryClient.getQueriesData<InboxSummary>({
                        queryKey: keys.inbox.summaryAll,
                    });

                // Optimistically remove from items list
                queryClient.setQueryData<InboxItemsResult>(
                    keys.inbox.items,
                    (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            items: old.items.filter((i) => i.id !== item.id),
                        };
                    },
                );

                for (const [key] of previousSummaries) {
                    queryClient.setQueryData<InboxSummary>(key, (old) =>
                        old
                            ? {
                                  ...old,
                                  pendingCount: Math.max(
                                      0,
                                      old.pendingCount - 1,
                                  ),
                              }
                            : old,
                    );
                }

                return { previousItems, previousSummaries };
            },
            onError: (_err, _vars, context) => {
                if (context?.previousItems) {
                    queryClient.setQueryData(
                        keys.inbox.items,
                        context.previousItems,
                    );
                }
                if (context?.previousSummaries) {
                    for (const [key, oldData] of context.previousSummaries) {
                        queryClient.setQueryData(key, oldData);
                    }
                }
            },
            onSettled: (_data, _err, vars) => {
                queryClient.invalidateQueries({ queryKey: keys.inbox.all });
                invalidateDomain(queryClient, "expenses");
                if (vars?.input?.goal_id) {
                    invalidateDomain(queryClient, "goals");
                }
            },
        },
        queryClient,
    );
}

export interface ResolveInboxItemParams {
    id: string;
    reason: "discarded" | "duplicate" | "pending";
}

/**
 * Optimistic mutation for resolving (discarding/ignoring/restoring) an inbox item.
 */
export function useResolveInboxItemMutation() {
    const queryClient = useSafeQueryClient();

    return useMutation<
        void,
        Error,
        ResolveInboxItemParams,
        {
            previousItems: InboxItemsResult | undefined;
            previousSummaries: [readonly unknown[], InboxSummary | undefined][];
        }
    >(
        {
            networkMode: "always",
            mutationFn: async ({ id, reason }) => {
                await financeService.resolveInboxItem(id, reason);
            },
            onMutate: async ({ id, reason }) => {
                await queryClient.cancelQueries({
                    queryKey: keys.inbox.items,
                });
                await queryClient.cancelQueries({
                    queryKey: keys.inbox.summaryAll,
                });

                const previousItems =
                    queryClient.getQueryData<InboxItemsResult>(
                        keys.inbox.items,
                    );
                const previousSummaries =
                    queryClient.getQueriesData<InboxSummary>({
                        queryKey: keys.inbox.summaryAll,
                    });

                if (reason === "discarded" || reason === "duplicate") {
                    queryClient.setQueryData<InboxItemsResult>(
                        keys.inbox.items,
                        (old) => {
                            if (!old) return old;
                            return {
                                ...old,
                                items: old.items.filter((i) => i.id !== id),
                            };
                        },
                    );
                    for (const [key] of previousSummaries) {
                        queryClient.setQueryData<InboxSummary>(key, (old) =>
                            old
                                ? {
                                      ...old,
                                      pendingCount: Math.max(
                                          0,
                                          old.pendingCount - 1,
                                      ),
                                  }
                                : old,
                        );
                    }
                }

                return { previousItems, previousSummaries };
            },
            onError: (_err, _vars, context) => {
                if (context?.previousItems) {
                    queryClient.setQueryData(
                        keys.inbox.items,
                        context.previousItems,
                    );
                }
                if (context?.previousSummaries) {
                    for (const [key, oldData] of context.previousSummaries) {
                        queryClient.setQueryData(key, oldData);
                    }
                }
            },
            onSettled: () => {
                queryClient.invalidateQueries({ queryKey: keys.inbox.all });
            },
        },
        queryClient,
    );
}
