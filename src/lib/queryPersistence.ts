/**
 * Synchronous TanStack Query persistence backed by localStorage.
 * Restores cached query state before React's first paint on cold start,
 * persists updates in the background, and disables all reads/writes in Demo Mode.
 */

import { hydrate, type QueryClient } from "@tanstack/react-query";
import {
    persistQueryClientSubscribe,
    type PersistedClient,
} from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { isMockModeActive } from "../services/financeService";
import { isSupabaseConfigured } from "../services/supabaseClient";

export const QUERY_CACHE_STORAGE_KEY = "budget_bubby_rq_cache_v1";
export const QUERY_CACHE_USER_STORAGE_KEY = "budget_bubby_rq_cache_user_v1";
export const QUERY_CACHE_SCHEMA_VERSION = "v1";
export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const CACHE_BUSTER = `${
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"
}:${QUERY_CACHE_SCHEMA_VERSION}`;

export interface QueryPersistenceOptions {
    storage?: Storage;
    key?: string;
    userKey?: string;
    buster?: string;
    maxAge?: number;
}

function getDefaultLocalStorage(): Storage | undefined {
    if (typeof window === "undefined") return undefined;
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}

/**
 * Persisted query cache is strictly disabled in Demo/Mock mode so demo data
 * never leaks into or overwrites real user cache, and real user cache is never
 * exposed during Demo Mode.
 */
export function isPersistedCacheDisabled(): boolean {
    if (typeof window === "undefined") return true;
    if (!isSupabaseConfigured()) return true;
    if (isMockModeActive()) return true;
    try {
        if (
            window.sessionStorage?.getItem("budget_bubby_demo_mode") === "1"
        ) {
            return true;
        }
    } catch {
        // Ignore restricted sessionStorage access
    }
    return false;
}

function createGuardedStorage(
    rawStorage: Storage | undefined,
): Storage | undefined {
    if (!rawStorage) return undefined;
    return {
        get length() {
            return rawStorage.length;
        },
        clear() {
            rawStorage.clear();
        },
        key(index: number) {
            return rawStorage.key(index);
        },
        getItem(key: string) {
            if (isPersistedCacheDisabled()) return null;
            return rawStorage.getItem(key);
        },
        setItem(key: string, value: string) {
            if (isPersistedCacheDisabled()) return;
            rawStorage.setItem(key, value);
        },
        removeItem(key: string) {
            rawStorage.removeItem(key);
        },
    };
}

function isPersistedClient(value: unknown): value is PersistedClient {
    return (
        typeof value === "object" &&
        value !== null &&
        "timestamp" in value &&
        "clientState" in value
    );
}

/**
 * Synchronously restores persisted TanStack Query cache into `client` before
 * React mounts. Returns true if a valid, non-expired, buster-matched cache was
 * hydrated.
 */
export function restorePersistedQueryCache(
    client: QueryClient,
    options: QueryPersistenceOptions = {},
): boolean {
    if (isPersistedCacheDisabled()) return false;

    const storage = createGuardedStorage(
        options.storage ?? getDefaultLocalStorage(),
    );
    if (!storage) return false;

    const key = options.key ?? QUERY_CACHE_STORAGE_KEY;
    const buster = options.buster ?? CACHE_BUSTER;
    const maxAge = options.maxAge ?? QUERY_CACHE_MAX_AGE_MS;

    const persister = createSyncStoragePersister({
        storage,
        key,
    });

    try {
        const restored = persister.restoreClient();
        if (!isPersistedClient(restored)) {
            return false;
        }

        const expired =
            typeof restored.timestamp !== "number" ||
            Date.now() - restored.timestamp > maxAge;
        const busted = restored.buster !== buster;

        if (expired || busted) {
            persister.removeClient();
            return false;
        }

        hydrate(client, restored.clientState);
        return true;
    } catch {
        persister.removeClient();
        return false;
    }
}

/**
 * Subscribes to TanStack Query cache updates and persists them to localStorage.
 * Returns an unsubscribe callback.
 */
export function startQueryPersistence(
    client: QueryClient,
    options: QueryPersistenceOptions = {},
): () => void {
    const storage = createGuardedStorage(
        options.storage ?? getDefaultLocalStorage(),
    );
    if (!storage) return () => {};

    const key = options.key ?? QUERY_CACHE_STORAGE_KEY;
    const buster = options.buster ?? CACHE_BUSTER;

    const persister = createSyncStoragePersister({
        storage,
        key,
    });

    return persistQueryClientSubscribe({
        queryClient: client,
        persister,
        buster,
    });
}

/**
 * Removes the persisted query cache and user-scope tag from localStorage.
 */
export function clearPersistedQueryCache(
    options: Pick<QueryPersistenceOptions, "storage" | "key" | "userKey"> = {},
): void {
    const storage = options.storage ?? getDefaultLocalStorage();
    if (!storage) return;

    const key = options.key ?? QUERY_CACHE_STORAGE_KEY;
    const userKey = options.userKey ?? QUERY_CACHE_USER_STORAGE_KEY;

    try {
        storage.removeItem(key);
        storage.removeItem(userKey);
    } catch {
        // Ignore storage errors in restricted environments
    }
}

/**
 * Ensures the persisted cache belongs to `userId`. If a different user ID was
 * previously cached, wipes both persisted storage and the in-memory QueryClient.
 * Returns true if the cache was wiped due to an account switch.
 */
export function syncPersistedCacheUser(
    userId: string | null | undefined,
    client?: QueryClient,
    options: Pick<QueryPersistenceOptions, "storage" | "key" | "userKey"> = {},
): boolean {
    if (isPersistedCacheDisabled() || !userId) return false;

    const storage = options.storage ?? getDefaultLocalStorage();
    if (!storage) return false;

    const userKey = options.userKey ?? QUERY_CACHE_USER_STORAGE_KEY;

    try {
        const previousUserId = storage.getItem(userKey);
        if (previousUserId && previousUserId !== userId) {
            clearPersistedQueryCache(options);
            client?.clear();
            storage.setItem(userKey, userId);
            return true;
        }
        if (!previousUserId) {
            storage.setItem(userKey, userId);
        }
    } catch {
        // Ignore storage errors in restricted environments
    }

    return false;
}
