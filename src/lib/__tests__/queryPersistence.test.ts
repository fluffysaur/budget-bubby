import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { dehydrate } from "@tanstack/react-query";
import * as supabaseClient from "../../services/supabaseClient";
import * as financeService from "../../services/financeService";
import {
    CACHE_BUSTER,
    QUERY_CACHE_STORAGE_KEY,
    QUERY_CACHE_USER_STORAGE_KEY,
    clearPersistedQueryCache,
    restorePersistedQueryCache,
    startQueryPersistence,
    syncPersistedCacheUser,
} from "../queryPersistence";

function createMemoryStorage(): Storage {
    const store = new Map<string, string>();
    return {
        get length() {
            return store.size;
        },
        clear() {
            store.clear();
        },
        key(index: number) {
            return Array.from(store.keys())[index] ?? null;
        },
        getItem(key: string) {
            return store.get(key) ?? null;
        },
        setItem(key: string, value: string) {
            store.set(key, value);
        },
        removeItem(key: string) {
            store.delete(key);
        },
    };
}

describe("queryPersistence", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
        localStorage.clear();
        vi.spyOn(supabaseClient, "isSupabaseConfigured").mockReturnValue(true);
        vi.spyOn(financeService, "isMockModeActive").mockReturnValue(false);
    });

    it("synchronously restores warm cache into QueryClient on startup", () => {
        const storage = createMemoryStorage();
        const seedClient = new QueryClient();
        seedClient.setQueryData(["finance", "household-overview"], {
            members: [{ id: "m1", display_name: "Alex" }],
        });

        storage.setItem(
            QUERY_CACHE_STORAGE_KEY,
            JSON.stringify({
                timestamp: Date.now(),
                buster: CACHE_BUSTER,
                clientState: dehydrate(seedClient),
            }),
        );

        const freshClient = new QueryClient();
        const restored = restorePersistedQueryCache(freshClient, { storage });

        expect(restored).toBe(true);
        expect(
            freshClient.getQueryData(["finance", "household-overview"]),
        ).toEqual({
            members: [{ id: "m1", display_name: "Alex" }],
        });
    });

    it("invalidates and removes persisted cache when buster mismatches", () => {
        const storage = createMemoryStorage();
        const seedClient = new QueryClient();
        seedClient.setQueryData(["finance", "categories"], [{ id: "c1" }]);

        storage.setItem(
            QUERY_CACHE_STORAGE_KEY,
            JSON.stringify({
                timestamp: Date.now(),
                buster: "stale-version:v0",
                clientState: dehydrate(seedClient),
            }),
        );

        const freshClient = new QueryClient();
        const restored = restorePersistedQueryCache(freshClient, { storage });

        expect(restored).toBe(false);
        expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
        expect(
            freshClient.getQueryData(["finance", "categories"]),
        ).toBeUndefined();
    });

    it("never reads from or writes to persisted cache in Demo Mode", () => {
        const storage = createMemoryStorage();
        const seedClient = new QueryClient();
        seedClient.setQueryData(["finance", "categories"], [{ id: "c1" }]);
        storage.setItem(
            QUERY_CACHE_STORAGE_KEY,
            JSON.stringify({
                timestamp: Date.now(),
                buster: CACHE_BUSTER,
                clientState: dehydrate(seedClient),
            }),
        );

        sessionStorage.setItem("budget_bubby_demo_mode", "1");

        const client = new QueryClient();
        const restored = restorePersistedQueryCache(client, { storage });
        expect(restored).toBe(false);
        expect(client.getQueryData(["finance", "categories"])).toBeUndefined();

        const unsubscribe = startQueryPersistence(client, { storage });
        client.setQueryData(["finance", "demo-only"], { amount: 123 });
        unsubscribe();

        // Storage still only has the pre-existing entry, never overwritten by demo data
        expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toContain(
            "demo-only",
        );
    });

    it("never reads from or writes to persisted cache when Supabase is not configured", () => {
        vi.spyOn(supabaseClient, "isSupabaseConfigured").mockReturnValue(false);
        const storage = createMemoryStorage();
        const client = new QueryClient();
        const unsubscribe = startQueryPersistence(client, { storage });
        client.setQueryData(["finance", "mock-only"], { amount: 99 });
        unsubscribe();

        expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    });

    it("wipes persisted cache and QueryClient when signed-in user changes or clearPersistedQueryCache is called", () => {
        const storage = createMemoryStorage();
        const client = new QueryClient();
        client.setQueryData(["finance", "household-overview"], {
            members: [{ id: "m1" }],
        });
        storage.setItem(QUERY_CACHE_STORAGE_KEY, '{"timestamp":1}');

        expect(syncPersistedCacheUser("user-a", client, { storage })).toBe(
            false,
        );
        expect(storage.getItem(QUERY_CACHE_USER_STORAGE_KEY)).toBe("user-a");

        // Switching to a different user wipes both persisted cache and QueryClient
        expect(syncPersistedCacheUser("user-b", client, { storage })).toBe(
            true,
        );
        expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
        expect(storage.getItem(QUERY_CACHE_USER_STORAGE_KEY)).toBe("user-b");
        expect(
            client.getQueryData(["finance", "household-overview"]),
        ).toBeUndefined();

        // Explicit clearPersistedQueryCache removes both keys
        storage.setItem(QUERY_CACHE_STORAGE_KEY, '{"timestamp":2}');
        clearPersistedQueryCache({ storage });
        expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
        expect(storage.getItem(QUERY_CACHE_USER_STORAGE_KEY)).toBeNull();
    });
});
