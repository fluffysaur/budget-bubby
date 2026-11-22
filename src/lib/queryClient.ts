/**
 * Global TanStack Query Client Configuration for Budget Bubby
 * Configures in-memory caching to eliminate redundant database queries during navigation.
 */

import { QueryClient } from "@tanstack/react-query";
import {
    QUERY_CACHE_MAX_AGE_MS,
    restorePersistedQueryCache,
    startQueryPersistence,
} from "./queryPersistence";

export const queryClient = new QueryClient({
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

if (typeof window !== "undefined") {
    const restored = restorePersistedQueryCache(queryClient);
    startQueryPersistence(queryClient);
    if (restored) {
        setTimeout(() => {
            void queryClient.invalidateQueries({ refetchType: "active" });
        }, 0);
    }
}
