import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

describe("Lazy demo mode & seed data loading", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.doUnmock("../src/services/supabaseClient");
        vi.doUnmock("../src/services/supabaseFinanceService");
        vi.doUnmock("../src/services/mockFinanceService");
        vi.doUnmock("../src/data/mockSeedData");
        vi.restoreAllMocks();
        sessionStorage.clear();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("does not load mockFinanceService or mockSeedData when Supabase mode is active", async () => {
        let mockServiceLoaded = false;
        let mockSeedLoaded = false;

        vi.doMock("../src/services/supabaseClient", () => ({
            isSupabaseConfigured: () => true,
            supabase: null,
        }));

        vi.doMock("../src/services/supabaseFinanceService", () => ({
            supabaseFinanceService: {
                getCategories: vi.fn().mockResolvedValue([
                    {
                        id: "live-cat-1",
                        household_id: "live-hh-1",
                        name: "Food",
                        color: "#F59E0B",
                        icon: "utensils",
                        is_system: true,
                        group: "spendable",
                    },
                ]),
            },
        }));

        vi.doMock("../src/services/mockFinanceService", () => {
            mockServiceLoaded = true;
            return { mockFinanceService: {} };
        });

        vi.doMock("../src/data/mockSeedData", () => {
            mockSeedLoaded = true;
            return {
                mockMembers: [],
                mockCategories: [],
                mockBaseProfiles: [],
                mockBaseAllocations: [],
            };
        });

        const { financeService } = await import("../src/services/financeService");
        await import("../src/services/offlineSyncQueue");

        const categories = await financeService.getCategories();
        expect(categories).toHaveLength(1);
        expect(categories[0].id).toBe("live-cat-1");
        expect(mockServiceLoaded).toBe(false);
        expect(mockSeedLoaded).toBe(false);
    });

    it("dynamically loads mockFinanceService when mock/demo mode is active", async () => {
        vi.doMock("../src/services/supabaseClient", () => ({
            isSupabaseConfigured: () => false,
            supabase: null,
        }));

        const { financeService, getActiveService } = await import(
            "../src/services/financeService"
        );
        const service = await getActiveService();
        expect(service).toBeDefined();

        const overview = await financeService.getHouseholdOverview();
        expect(overview.household.name).toBe("Alex & Sam");
    });

    it("useLazyMockDefaults skips mockSeedData when disabled and loads dynamically when enabled", async () => {
        let mockSeedLoaded = false;
        vi.doMock("../src/data/mockSeedData", () => {
            mockSeedLoaded = true;
            return {
                mockMembers: [{ id: "m1", display_name: "Alex" }],
                mockCategories: [{ id: "c1", name: "Food" }],
                mockBaseProfiles: [{ id: "p1", owner_id: "m1" }],
                mockBaseAllocations: [{ id: "a1", profile_id: "p1" }],
            };
        });

        const { useLazyMockDefaults } = await import(
            "../src/hooks/useLazyMockDefaults"
        );

        const disabled = renderHook(() => useLazyMockDefaults(false));
        expect(disabled.result.current.members).toEqual([]);
        expect(disabled.result.current.categories).toEqual([]);
        expect(mockSeedLoaded).toBe(false);
        disabled.unmount();

        const enabled = renderHook(() => useLazyMockDefaults(true));
        await waitFor(() => {
            expect(enabled.result.current.members).toHaveLength(1);
        });
        expect(mockSeedLoaded).toBe(true);
        expect(enabled.result.current.categories).toHaveLength(1);
        expect(enabled.result.current.baseProfiles).toHaveLength(1);
        expect(enabled.result.current.baseAllocations).toHaveLength(1);
    });
});
