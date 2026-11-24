/**
 * Shared optimistic mutation behaviour: cancel in-flight fetches, snapshot the
 * cache, apply the optimistic change, roll back on error, and refetch on
 * settle. Hooks only describe what is specific to them.
 */

import type {
    QueryClient,
    QueryKey,
    UseMutationOptions,
} from "@tanstack/react-query";

export type CacheSnapshot = [QueryKey, unknown][];

export interface OptimisticMutationContext<TExtra> {
    snapshot: CacheSnapshot;
    extra: TExtra;
}

export interface OptimisticMutationConfig<TData, TVars, TExtra> {
    mutationFn: (vars: TVars) => Promise<TData>;
    /** Key prefixes this mutation touches; each is cancelled and snapshotted. */
    keys: (vars: TVars) => readonly QueryKey[];
    /** Write the optimistic result. Its return value is passed on to `settle`. */
    apply: (queryClient: QueryClient, vars: TVars) => TExtra;
    /** Runs after success or failure (refetch dependent queries here). */
    settle?: (
        vars: TVars,
        data: TData | undefined,
        error: Error | null,
        extra: TExtra | undefined,
    ) => void;
}

/** Cached data for every query under the given key prefixes. */
export function snapshotQueries(
    queryClient: QueryClient,
    keys: readonly QueryKey[],
): CacheSnapshot {
    return keys.flatMap((queryKey) =>
        queryClient.getQueriesData({ queryKey }),
    ) as CacheSnapshot;
}

/** Put a snapshot back. Entries that held no data are left alone. */
export function rollbackSnapshot(
    queryClient: QueryClient,
    snapshot: CacheSnapshot,
): void {
    for (const [key, data] of snapshot) {
        if (data !== undefined) queryClient.setQueryData(key, data);
    }
}

export function createOptimisticMutation<TData, TVars, TExtra = void>(
    queryClient: QueryClient,
    config: OptimisticMutationConfig<TData, TVars, TExtra>,
): UseMutationOptions<TData, Error, TVars, OptimisticMutationContext<TExtra>> {
    return {
        networkMode: "always",
        mutationFn: config.mutationFn,
        onMutate: async (vars) => {
            const keys = config.keys(vars);
            await Promise.all(
                keys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
            );
            const snapshot = snapshotQueries(queryClient, keys);
            const extra = config.apply(queryClient, vars);
            return { snapshot, extra };
        },
        onError: (_error, _vars, context) => {
            if (context) rollbackSnapshot(queryClient, context.snapshot);
        },
        onSettled: (data, error, vars, context) => {
            config.settle?.(vars, data, error, context?.extra);
        },
    };
}
