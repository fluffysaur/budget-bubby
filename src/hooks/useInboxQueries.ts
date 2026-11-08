/**
 * Capture Inbox queries. The inbox refetches on focus and when an iOS PWA
 * resumes (visibilitychange), unlike the app-wide 5 minute default.
 */

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { financeService } from "../services/financeService";
import {
    INBOX_ITEMS_QUERY_KEY,
    afterInboxConfirmed,
} from "../lib/inbox/inboxConfirm";
import { useSafeQueryClient } from "./useFinanceQueries";
import type { InboxEventMap } from "../lib/inbox/inboxEvents";
import type {
    CaptureTokensResult,
    CreateExpenseInput,
    InboxItem,
    InboxItemsResult,
    InboxSummary,
    MerchantRule,
} from "../types/finance";

export const inboxQueryKeys = {
    all: ["finance", "inbox"] as const,
    items: INBOX_ITEMS_QUERY_KEY,
    summary: (memberId?: string) =>
        ["finance", "inbox", "summary", memberId ?? "household"] as const,
    rules: ["finance", "inbox", "rules"] as const,
    tokens: (memberId?: string) =>
        ["finance", "inbox", "tokens", memberId ?? "me"] as const,
};

const INBOX_STALE_MS = 30_000;

/** Refetch inbox queries when the app becomes visible again. */
function useRefetchInboxOnVisible() {
    const queryClient = useQueryClient();
    useEffect(() => {
        if (typeof document === "undefined") return;
        const onVisible = () => {
            if (document.visibilityState === "visible") {
                queryClient.invalidateQueries({ queryKey: inboxQueryKeys.all });
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
    return useQuery<InboxItemsResult>({
        queryKey: inboxQueryKeys.items,
        queryFn: () => financeService.getInboxItems("pending"),
        enabled: options.enabled ?? true,
        staleTime: INBOX_STALE_MS,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    });
}

/** Pending count and total. No member id: the whole household. */
export function useInboxSummary(memberId?: string) {
    useRefetchInboxOnVisible();
    return useQuery<InboxSummary>({
        queryKey: inboxQueryKeys.summary(memberId),
        queryFn: () => financeService.getInboxSummary(memberId),
        staleTime: INBOX_STALE_MS,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    });
}

export function useMerchantRulesQuery() {
    return useQuery<MerchantRule[]>({
        queryKey: inboxQueryKeys.rules,
        queryFn: () => financeService.getMerchantRules(),
    });
}

export function useCaptureTokensQuery(memberId?: string) {
    return useQuery<CaptureTokensResult>({
        queryKey: inboxQueryKeys.tokens(memberId),
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
                    queryKey: inboxQueryKeys.items,
                });
                await queryClient.cancelQueries({
                    queryKey: ["finance", "inbox", "summary"],
                });

                const previousItems =
                    queryClient.getQueryData<InboxItemsResult>(
                        inboxQueryKeys.items,
                    );
                const previousSummaries =
                    queryClient.getQueriesData<InboxSummary>({
                        queryKey: ["finance", "inbox", "summary"],
                    });

                // Optimistically remove from items list
                queryClient.setQueryData<InboxItemsResult>(
                    inboxQueryKeys.items,
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
                        inboxQueryKeys.items,
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
                queryClient.invalidateQueries({ queryKey: inboxQueryKeys.all });
                queryClient.invalidateQueries({
                    queryKey: ["finance", "expenses"],
                });
                queryClient.invalidateQueries({
                    queryKey: ["finance", "all-expenses"],
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
                if (vars?.input?.goal_id) {
                    queryClient.invalidateQueries({
                        queryKey: ["finance", "goals"],
                    });
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
                    queryKey: inboxQueryKeys.items,
                });
                await queryClient.cancelQueries({
                    queryKey: ["finance", "inbox", "summary"],
                });

                const previousItems =
                    queryClient.getQueryData<InboxItemsResult>(
                        inboxQueryKeys.items,
                    );
                const previousSummaries =
                    queryClient.getQueriesData<InboxSummary>({
                        queryKey: ["finance", "inbox", "summary"],
                    });

                if (reason === "discarded" || reason === "duplicate") {
                    queryClient.setQueryData<InboxItemsResult>(
                        inboxQueryKeys.items,
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
                        inboxQueryKeys.items,
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
                queryClient.invalidateQueries({ queryKey: inboxQueryKeys.all });
            },
        },
        queryClient,
    );
}
