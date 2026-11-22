import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePartnerRealtimeSync } from "../usePartnerRealtimeSync";
import { queryKeys } from "../useFinanceQueries";
import { inboxQueryKeys } from "../useInboxQueries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

describe("usePartnerRealtimeSync", () => {
    let mockChannel: {
        on: ReturnType<typeof vi.fn>;
        subscribe: ReturnType<typeof vi.fn>;
    };
    let mockClient: SupabaseClient;
    let mockQueryClient: QueryClient;
    let registeredCallbacks: Record<string, () => void>;

    beforeEach(() => {
        vi.useFakeTimers();
        registeredCallbacks = {};

        mockChannel = {
            on: vi.fn(
                (
                    _type: string,
                    config: { table: string; filter: string; event: string },
                    callback: () => void,
                ) => {
                    registeredCallbacks[config.table] = callback;
                    return mockChannel;
                },
            ),
            subscribe: vi.fn(() => mockChannel),
        };

        mockClient = {
            channel: vi.fn(() => mockChannel),
            removeChannel: vi.fn(),
        } as unknown as SupabaseClient;

        mockQueryClient = {
            invalidateQueries: vi.fn(),
        } as unknown as QueryClient;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("subscribes to partner-sync-${householdId} channel with household_id filter for expenses and inbox_items", () => {
        renderHook(() =>
            usePartnerRealtimeSync({
                householdId: "hh-1234",
                isDemoMode: false,
                isConfigured: true,
                supabaseClient: mockClient,
                queryClient: mockQueryClient,
            }),
        );

        expect(mockClient.channel).toHaveBeenCalledWith("partner-sync-hh-1234");
        expect(mockChannel.on).toHaveBeenCalledWith(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "expenses",
                filter: "household_id=eq.hh-1234",
            },
            expect.any(Function),
        );
        expect(mockChannel.on).toHaveBeenCalledWith(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "inbox_items",
                filter: "household_id=eq.hh-1234",
            },
            expect.any(Function),
        );
        expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);
    });

    it("debounces rapid bursts (~150ms) and invalidates expenses query keys on expenses change", () => {
        renderHook(() =>
            usePartnerRealtimeSync({
                householdId: "hh-1234",
                isDemoMode: false,
                isConfigured: true,
                supabaseClient: mockClient,
                queryClient: mockQueryClient,
            }),
        );

        const onExpenseChange = registeredCallbacks.expenses;
        expect(onExpenseChange).toBeDefined();

        // Fire 3 bursts rapidly within 50ms
        act(() => {
            onExpenseChange();
            vi.advanceTimersByTime(20);
            onExpenseChange();
            vi.advanceTimersByTime(20);
            onExpenseChange();
        });

        // Invalidation should NOT have fired yet because 150ms has not passed since the last burst
        expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();

        // Advance the remaining time past 150ms
        act(() => {
            vi.advanceTimersByTime(150);
        });

        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(5);
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ["finance", "expenses"],
        });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.allExpenses,
        });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ["finance", "monthly-budget"],
        });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ["finance", "daily-checkins"],
        });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.householdOverview,
        });
    });

    it("debounces bursts (~150ms) and invalidates inboxQueryKeys.all on inbox_items change", () => {
        renderHook(() =>
            usePartnerRealtimeSync({
                householdId: "hh-1234",
                isDemoMode: false,
                isConfigured: true,
                supabaseClient: mockClient,
                queryClient: mockQueryClient,
            }),
        );

        const onInboxChange = registeredCallbacks.inbox_items;
        expect(onInboxChange).toBeDefined();

        // Fire bursts
        act(() => {
            onInboxChange();
            vi.advanceTimersByTime(50);
            onInboxChange();
        });

        expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(150);
        });

        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(1);
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: inboxQueryKeys.all,
        });
    });

    it("cleans up channel via removeChannel and clears pending timers on unmount", () => {
        const { unmount } = renderHook(() =>
            usePartnerRealtimeSync({
                householdId: "hh-1234",
                isDemoMode: false,
                isConfigured: true,
                supabaseClient: mockClient,
                queryClient: mockQueryClient,
            }),
        );

        const onExpenseChange = registeredCallbacks.expenses;
        act(() => {
            onExpenseChange();
            vi.advanceTimersByTime(50);
        });

        // Unmount while debounce timer is still pending
        unmount();

        expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);

        // Advance timers - since timer was cleared, no queries should be invalidated
        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
    });

    it("strictly no-ops when isDemoMode is true", () => {
        renderHook(() =>
            usePartnerRealtimeSync({
                householdId: "hh-1234",
                isDemoMode: true,
                isConfigured: true,
                supabaseClient: mockClient,
                queryClient: mockQueryClient,
            }),
        );

        expect(mockClient.channel).not.toHaveBeenCalled();
    });

    it("strictly no-ops when isConfigured is false or client is null", () => {
        interface HookProps {
            isConfigured: boolean;
            client: SupabaseClient | null;
        }

        const { rerender } = renderHook(
            ({ isConfigured, client }: HookProps) =>
                usePartnerRealtimeSync({
                    householdId: "hh-1234",
                    isDemoMode: false,
                    isConfigured,
                    supabaseClient: client,
                    queryClient: mockQueryClient,
                }),
            {
                initialProps: {
                    isConfigured: false,
                    client: mockClient as SupabaseClient | null,
                },
            },
        );

        expect(mockClient.channel).not.toHaveBeenCalled();

        rerender({
            isConfigured: true,
            client: null,
        });

        expect(mockClient.channel).not.toHaveBeenCalled();
    });

    it("strictly no-ops when householdId is not available", () => {
        renderHook(() =>
            usePartnerRealtimeSync({
                householdId: null,
                isDemoMode: false,
                isConfigured: true,
                supabaseClient: mockClient,
                queryClient: mockQueryClient,
            }),
        );

        expect(mockClient.channel).not.toHaveBeenCalled();
    });
});
