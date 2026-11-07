/**
 * Global TanStack Query Client Configuration for Budget Bubby
 * Configures in-memory caching to eliminate redundant database queries during navigation.
 */

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes in-memory freshness
            gcTime: 30 * 60 * 1000, // 30 minutes garbage collection time
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
