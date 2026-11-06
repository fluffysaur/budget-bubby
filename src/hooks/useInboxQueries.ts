/**
 * Capture Inbox queries. The inbox refetches on focus and when an iOS PWA
 * resumes (visibilitychange), unlike the app-wide 5 minute default.
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { financeService } from "../services/financeService";
import type {
    CaptureTokensResult,
    InboxItemsResult,
    InboxSummary,
    MerchantRule,
} from "../types/finance";

export const inboxQueryKeys = {
    all: ["finance", "inbox"] as const,
    items: ["finance", "inbox", "items", "pending"] as const,
    summary: (memberId?: string) => ["finance", "inbox", "summary", memberId ?? "household"] as const,
    rules: ["finance", "inbox", "rules"] as const,
    tokens: (memberId?: string) => ["finance", "inbox", "tokens", memberId ?? "me"] as const,
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
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [queryClient]);
}

/** Household-wide pending items (both partners). */
export function useInboxQuery() {
    useRefetchInboxOnVisible();
    return useQuery<InboxItemsResult>({
        queryKey: inboxQueryKeys.items,
        queryFn: () => financeService.getInboxItems("pending"),
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
