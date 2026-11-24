/**
 * Global TanStack Query Client Configuration for Budget Bubby
 * Configures in-memory caching to eliminate redundant database queries during navigation.
 */

import { MutationCache, QueryClient } from "@tanstack/react-query";
import { emitAppEvent } from "./appEvents";
import {
    QUERY_CACHE_MAX_AGE_MS,
    restorePersistedQueryCache,
    startQueryPersistence,
} from "./queryPersistence";

declare module "@tanstack/react-query" {
    interface Register {
        mutationMeta: {
            skipErrorToast?: boolean;
            errorTitle?: string;
        };
    }
}

export function createAppMutationCache(): MutationCache {
    return new MutationCache({
        onError: (error, _variables, _context, mutation) => {
            if (mutation.meta?.skipErrorToast) return;
            const title = mutation.meta?.errorTitle ?? "Save failed";
            const subtitle =
                error instanceof Error && error.message
                    ? error.message
                    : "Changes weren't saved. Try again.";
            emitAppEvent("app:error", { title, subtitle });
        },
    });
}

export function createAppQueryClient(): QueryClient {
    return new QueryClient({
        mutationCache: createAppMutationCache(),
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000, // 5 minutes in-memory freshness
                gcTime: QUERY_CACHE_MAX_AGE_MS, // >= persisted maxAge so restored entries aren't immediately GC'd
                refetchOnWindowFocus: true, // Refresh stale data when returning to app
                refetchOnMount: false, // Use cached data immediately when navigating back to a page
                refetchOnReconnect: true,
                retry: 1,
            },
            mutations: {
                networkMode: "always",
            },
        },
    });
}

export const queryClient = createAppQueryClient();

if (typeof window !== "undefined") {
    const restored = restorePersistedQueryCache(queryClient);
    startQueryPersistence(queryClient);
    if (restored) {
        setTimeout(() => {
            void queryClient.invalidateQueries({ refetchType: "active" });
        }, 0);
    }
}
