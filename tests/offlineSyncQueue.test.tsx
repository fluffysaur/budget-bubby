import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
    cleanup,
} from "@testing-library/react";
import {
    offlineSyncQueue,
    getPendingSyncCount,
    getFailedSyncCount,
    getPendingMutations,
    getFailedMutations,
    clearPendingMutations,
    enqueueMutation,
    flushOutbox,
    flushIfOnline,
    setNetworkOverride,
} from "../src/services/offlineSyncQueue";
import { financeService } from "../src/services/financeService";
import { supabaseFinanceService } from "../src/services/supabaseFinanceService";
import * as supabaseClientModule from "../src/services/supabaseClient";
import { OfflineBanner } from "../src/components/pwa/OfflineBanner";
import { queryClient } from "../src/lib/queryClient";
import { isValidUuid } from "../src/lib/uuid";
import type { CreateExpenseInput, Expense } from "../src/types/finance";

const SAMPLE_PAYER_ID = "00000000-0000-4000-8000-000000000011";
const SAMPLE_CATEGORY_ID = "00000000-0000-4000-8000-000000000101";

function makeExpenseInput(
    overrides: Partial<CreateExpenseInput> = {},
): CreateExpenseInput {
    return {
        household_id: "00000000-0000-4000-8000-000000000001",
        payer_id: SAMPLE_PAYER_ID,
        category_id: SAMPLE_CATEGORY_ID,
        date: "2026-11-07",
        item: "Kopi Peng",
        amount: 2.5,
        is_shared: false,
        ...overrides,
    };
}

describe("PR #2 fix/offline-queue — Offline Sync Queue & Banner", () => {
    beforeEach(() => {
        localStorage.clear();
        clearPendingMutations();
        setNetworkOverride(null);
        Object.defineProperty(navigator, "onLine", {
            value: true,
            configurable: true,
        });
        queryClient.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        cleanup();
        setNetworkOverride(null);
        clearPendingMutations();
        Object.defineProperty(navigator, "onLine", {
            value: true,
            configurable: true,
        });
        queryClient.clear();
        vi.restoreAllMocks();
    });

    describe("1. Deduplication (H4)", () => {
        it("cancels add + edit + delete of an offline-created expense so outbox is empty", async () => {
            setNetworkOverride(false);

            const added = await offlineSyncQueue.addExpense(
                makeExpenseInput({ item: "Offline Snack", amount: 5 }),
            );
            expect(getPendingSyncCount()).toBe(1);

            await offlineSyncQueue.updateExpense(added.id, {
                item: "Offline Snack Updated",
                amount: 6.5,
            });
            expect(getPendingSyncCount()).toBe(2);

            await offlineSyncQueue.deleteExpense(added.id);

            expect(getPendingSyncCount()).toBe(0);
            expect(getPendingMutations()).toHaveLength(0);
        });

        it("drops queued updateExpense and still queues deleteExpense when deleting a server-side row", async () => {
            setNetworkOverride(false);
            const serverId = "00000000-0000-4000-8000-000000009999";

            await offlineSyncQueue.updateExpense(serverId, {
                item: "Edited Server Row",
                amount: 42,
            });
            expect(getPendingMutations().map((m) => m.type)).toEqual([
                "updateExpense",
            ]);

            await offlineSyncQueue.deleteExpense(serverId);

            const mutations = getPendingMutations();
            expect(mutations).toHaveLength(1);
            expect(mutations[0].type).toBe("deleteExpense");
            expect(mutations[0].payload).toEqual({ id: serverId });

            // Replaying sends deleteExpense to the server
            setNetworkOverride(true);
            const fakeBackend = {
                deleteExpense: vi.fn().mockResolvedValue(undefined),
                updateExpense: vi.fn(),
            };
            const res = await flushOutbox(fakeBackend);
            expect(res).toEqual({ processed: 1, errors: 0 });
            expect(fakeBackend.updateExpense).not.toHaveBeenCalled();
            expect(fakeBackend.deleteExpense).toHaveBeenCalledWith(serverId);
        });
    });

    describe("2. Client-generated UUIDs & Duplicate-key 23505 handling (H4 & H5)", () => {
        it("generates a client UUID on addExpense and preserves it across offline updateExpense and replay", async () => {
            setNetworkOverride(false);

            const created = await offlineSyncQueue.addExpense(
                makeExpenseInput({ item: "Chicken Rice", amount: 5.5 }),
            );
            expect(isValidUuid(created.id)).toBe(true);

            const updated = await offlineSyncQueue.updateExpense(created.id, {
                amount: 6.0,
                remarks: "Extra chicken",
            });
            expect(updated.id).toBe(created.id);
            expect(updated.amount).toBe(6.0);

            setNetworkOverride(true);
            const fakeBackend = {
                addExpense: vi.fn(async (input: CreateExpenseInput) => ({
                    ...created,
                    ...input,
                    id: input.id!,
                })),
                updateExpense: vi.fn(
                    async (id: string, updates: Partial<Expense>) => ({
                        ...created,
                        ...updates,
                        id,
                    }),
                ),
            };

            const res = await flushOutbox(fakeBackend);
            expect(res).toEqual({ processed: 2, errors: 0 });
            expect(fakeBackend.addExpense).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: created.id,
                    item: "Chicken Rice",
                }),
            );
            expect(fakeBackend.updateExpense).toHaveBeenCalledWith(created.id, {
                amount: 6.0,
                remarks: "Extra chicken",
            });
        });

        it("treats Postgres 23505 duplicate-key error on addExpense replay as success", async () => {
            setNetworkOverride(false);
            const created = await offlineSyncQueue.addExpense(
                makeExpenseInput({ item: "Timed-out Insert", amount: 18 }),
            );
            expect(getPendingSyncCount()).toBe(1);

            setNetworkOverride(true);
            const dupError = Object.assign(
                new Error(
                    'duplicate key value violates unique constraint "expenses_pkey"',
                ),
                { code: "23505" },
            );
            const fakeBackend = {
                addExpense: vi.fn().mockRejectedValue(dupError),
            };

            const res = await flushOutbox(fakeBackend);
            expect(res).toEqual({ processed: 1, errors: 0 });
            expect(fakeBackend.addExpense).toHaveBeenCalledWith(
                expect.objectContaining({ id: created.id }),
            );
            expect(getPendingSyncCount()).toBe(0);
        });
    });

    describe("3. Offline edits of server rows in Supabase mode (H5)", () => {
        it("queues updateExpense for a server row without calling mockFinanceService and patches TanStack Query cache", async () => {
            vi.spyOn(
                supabaseClientModule,
                "isSupabaseConfigured",
            ).mockReturnValue(true);
            setNetworkOverride(false);

            const serverExpense: Expense = {
                id: "00000000-0000-4000-8000-000000008888",
                household_id: "00000000-0000-4000-8000-000000000001",
                payer_id: SAMPLE_PAYER_ID,
                category_id: SAMPLE_CATEGORY_ID,
                date: "2026-11-06",
                item: "Server MRT Ride",
                amount: 1.9,
                is_shared: false,
                split_ratio: 0.5,
                settled: false,
            };

            queryClient.setQueryData(
                ["finance", "expenses", { month: "2026-11" }],
                [serverExpense],
            );
            queryClient.setQueryData(
                ["finance", "all-expenses"],
                [serverExpense],
            );

            const updated = await financeService.updateExpense(
                serverExpense.id,
                {
                    item: "Server MRT Ride (Edited Offline)",
                    amount: 2.4,
                },
            );

            expect(updated.id).toBe(serverExpense.id);
            expect(updated.item).toBe("Server MRT Ride (Edited Offline)");
            expect(updated.amount).toBe(2.4);

            const cachedMonth = queryClient.getQueryData<Expense[]>([
                "finance",
                "expenses",
                { month: "2026-11" },
            ]);
            expect(cachedMonth?.[0].item).toBe(
                "Server MRT Ride (Edited Offline)",
            );
            expect(cachedMonth?.[0].amount).toBe(2.4);

            const cachedAll = queryClient.getQueryData<Expense[]>([
                "finance",
                "all-expenses",
            ]);
            expect(cachedAll?.[0].amount).toBe(2.4);
            expect(getPendingSyncCount()).toBe(1);
        });
    });

    describe("4. Only network errors queue (H5)", () => {
        it("rethrows non-network backend errors and does not enqueue in addExpense, updateExpense, deleteExpense, bulkAddExpenses", async () => {
            vi.spyOn(
                supabaseClientModule,
                "isSupabaseConfigured",
            ).mockReturnValue(true);
            setNetworkOverride(true);

            const rlsError = new Error(
                'new row violates row-level security policy for table "expenses"',
            );
            vi.spyOn(supabaseFinanceService, "addExpense").mockRejectedValue(
                rlsError,
            );
            vi.spyOn(supabaseFinanceService, "updateExpense").mockRejectedValue(
                rlsError,
            );
            vi.spyOn(supabaseFinanceService, "deleteExpense").mockRejectedValue(
                rlsError,
            );
            vi.spyOn(
                supabaseFinanceService,
                "bulkAddExpenses",
            ).mockRejectedValue(rlsError);

            await expect(
                offlineSyncQueue.addExpense(makeExpenseInput()),
            ).rejects.toThrow("row-level security");
            await expect(
                offlineSyncQueue.updateExpense("exp-1", { amount: 10 }),
            ).rejects.toThrow("row-level security");
            await expect(
                offlineSyncQueue.deleteExpense("exp-1"),
            ).rejects.toThrow("row-level security");
            await expect(
                offlineSyncQueue.bulkAddExpenses([makeExpenseInput()]),
            ).rejects.toThrow("row-level security");

            expect(getPendingSyncCount()).toBe(0);
        });
    });

    describe("5. Flush triggers & cache invalidation (H6)", () => {
        it("flushes on startup and visibilitychange and invalidates ['finance'] queries", async () => {
            const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
            setNetworkOverride(false);
            await offlineSyncQueue.addExpense(
                makeExpenseInput({ item: "Queued Before Close", amount: 11 }),
            );
            expect(getPendingSyncCount()).toBe(1);

            // Simulate app resuming online via visibilitychange
            setNetworkOverride(true);
            Object.defineProperty(document, "visibilityState", {
                value: "visible",
                configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));

            await waitFor(() => {
                expect(getPendingSyncCount()).toBe(0);
            });
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: ["finance"],
            });

            // Also verify startup flush via flushIfOnline()
            setNetworkOverride(false);
            await offlineSyncQueue.addExpense(
                makeExpenseInput({
                    item: "Queued Before Cold Start",
                    amount: 14,
                }),
            );
            expect(getPendingSyncCount()).toBe(1);

            setNetworkOverride(true);
            await flushIfOnline();
            expect(getPendingSyncCount()).toBe(0);
        });
    });

    describe("6. No dropped mutations during in-flight flush (H6)", () => {
        it("preserves a mutation enqueued while flushOutbox is running", async () => {
            setNetworkOverride(false);
            const first = await offlineSyncQueue.addExpense(
                makeExpenseInput({ item: "First Item", amount: 10 }),
            );
            expect(getPendingSyncCount()).toBe(1);

            setNetworkOverride(true);
            let concurrentAddedId = "";

            const slowBackend = {
                addExpense: vi.fn(async (input: CreateExpenseInput) => {
                    // While the first item is syncing, a second mutation is enqueued
                    const second = enqueueMutation("addExpense", {
                        input: makeExpenseInput({
                            id: "00000000-0000-4000-8000-000000007777",
                            item: "Concurrent Item",
                            amount: 25,
                        }),
                        optimisticId: "00000000-0000-4000-8000-000000007777",
                    });
                    concurrentAddedId = second.id;
                    return { ...first, ...input } as Expense;
                }),
            };

            const res = await flushOutbox(slowBackend);
            expect(res).toEqual({ processed: 1, errors: 0 });

            // The concurrently enqueued mutation must still be in the outbox!
            const remaining = getPendingMutations();
            expect(remaining).toHaveLength(1);
            expect(remaining[0].id).toBe(concurrentAddedId);
            expect(remaining[0].payload.input.item).toBe("Concurrent Item");
        });
    });

    describe("7. Failure surfacing after 5 retries, Retry and Discard in OfflineBanner", () => {
        it("marks a mutation failed after 5 failed attempts and surfaces Retry and Discard in OfflineBanner", async () => {
            setNetworkOverride(false);
            await offlineSyncQueue.addExpense(
                makeExpenseInput({ item: "Stubborn Expense", amount: 99 }),
            );
            expect(getPendingSyncCount()).toBe(1);
            expect(getFailedSyncCount()).toBe(0);

            setNetworkOverride(true);
            const failingBackend = {
                addExpense: vi
                    .fn()
                    .mockRejectedValue(new Error("Server 500 error")),
            };

            // 5 failed attempts mark the mutation as failed
            for (let attempt = 1; attempt <= 5; attempt++) {
                const res = await flushOutbox(failingBackend);
                expect(res.errors).toBe(1);
            }

            expect(getPendingSyncCount()).toBe(0);
            expect(getFailedSyncCount()).toBe(1);
            expect(getFailedMutations()[0].status).toBe("failed");
            expect(getFailedMutations()[0].retryCount).toBe(5);

            // 6th automatic flush skips failed mutations
            const sixth = await flushOutbox(failingBackend);
            expect(sixth).toEqual({ processed: 0, errors: 0 });
            expect(failingBackend.addExpense).toHaveBeenCalledTimes(5);

            // Render OfflineBanner: shows "1 not synced"
            render(<OfflineBanner />);
            const notSyncedBtn = screen.getByRole("button", {
                name: /1 not synced/i,
            });
            expect(notSyncedBtn).toBeInTheDocument();

            // Open the failed mutations modal
            fireEvent.click(notSyncedBtn);
            expect(
                await screen.findByText(/Stubborn Expense/i),
            ).toBeInTheDocument();
            expect(screen.getByText(/Server 500 error/i)).toBeInTheDocument();

            // Clicking Retry resets status and triggers flushOutbox
            const addSpy = vi
                .spyOn(
                    (await import("../src/services/mockFinanceService"))
                        .mockFinanceService,
                    "addExpense",
                )
                .mockResolvedValue({ id: "ok" } as Expense);

            const retryBtn = screen.getByRole("button", { name: /^Retry$/i });
            await act(async () => {
                fireEvent.click(retryBtn);
            });

            await waitFor(() => {
                expect(getFailedSyncCount()).toBe(0);
            });
            addSpy.mockRestore();
        });

        it("allows discarding a failed mutation from OfflineBanner", async () => {
            setNetworkOverride(false);
            await offlineSyncQueue.addExpense(
                makeExpenseInput({ item: "Discardable Expense", amount: 12 }),
            );
            setNetworkOverride(true);

            const failingBackend = {
                addExpense: vi
                    .fn()
                    .mockRejectedValue(new Error("Permanent failure")),
            };
            for (let i = 0; i < 5; i++) {
                await flushOutbox(failingBackend);
            }
            expect(getFailedSyncCount()).toBe(1);

            render(<OfflineBanner />);
            fireEvent.click(
                screen.getByRole("button", { name: /1 not synced/i }),
            );

            const discardBtn = await screen.findByRole("button", {
                name: /^Discard$/i,
            });
            await act(async () => {
                fireEvent.click(discardBtn);
            });

            await waitFor(() => {
                expect(getFailedSyncCount()).toBe(0);
                expect(getPendingMutations()).toHaveLength(0);
            });
        });
    });
});
