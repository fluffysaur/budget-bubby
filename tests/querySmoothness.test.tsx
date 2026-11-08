/**
 * PR #5: Query Smoothness & Double-Submit Guard Tests
 *
 * Verifies:
 * 1. Hook test: Previous month's data remains visible (isPlaceholderData = true) during month change.
 * 2. Optimistic add: New expense appears in cache/UI before the server resolves.
 * 3. Rollback on error: Cache rolls back to snapshot and error is surfaced on failure.
 * 4. Pending delete guard: Delete button is disabled while deletion is pending, preventing double-submits.
 * 5. useSubmitLock: Concurrency guard blocks duplicate execution.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    renderHook,
    act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
    useExpensesQuery,
    useAddExpenseMutation,
    useDeleteExpenseMutation,
    queryKeys,
} from "../src/hooks/useFinanceQueries";
import { useSubmitLock } from "../src/hooks/useSubmitLock";
import { DeleteExpenseModal } from "../src/components/expenses/DeleteExpenseModal";
import { financeService } from "../src/services/financeService";
import { mockCategories, mockMembers } from "../src/data/mockSeedData";
import type { Expense, CreateExpenseInput } from "../src/types/finance";

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: Infinity,
            },
            mutations: {
                retry: false,
            },
        },
    });
}

function createWrapper(client: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

const mockOctExpense: Expense = {
    id: "exp-oct-1",
    household_id: "hh-00000000-0001",
    payer_id: "mem-00000000-0011",
    category_id: "cat-00000000-0101",
    date: "2026-10-10",
    item: "October Groceries",
    amount: 120.5,
    is_shared: true,
    split_ratio: 0.5,
    settled: false,
    created_at: "2026-10-10T08:00:00Z",
};

const mockNovExpense: Expense = {
    id: "exp-nov-1",
    household_id: "hh-00000000-0001",
    payer_id: "mem-00000000-0011",
    category_id: "cat-00000000-0101",
    date: "2026-11-05",
    item: "November Dinner",
    amount: 85.0,
    is_shared: false,
    split_ratio: 0,
    settled: false,
    created_at: "2026-11-05T12:00:00Z",
};

describe("PR #5: Query Smoothness & Optimistic Mutations", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.restoreAllMocks();
        queryClient = createTestQueryClient();
    });

    describe("1. Previous month data stays visible during month change (keepPreviousData)", () => {
        it("keeps previous month data and sets isPlaceholderData while next month query is in-flight", async () => {
            let resolveNov: (value: Expense[]) => void = () => {};
            const novPromise = new Promise<Expense[]>((resolve) => {
                resolveNov = resolve;
            });

            const getExpensesSpy = vi
                .spyOn(financeService, "getExpenses")
                .mockImplementation(async (filter) => {
                    if (filter?.month === "2026-10") {
                        return [mockOctExpense];
                    }
                    if (filter?.month === "2026-11") {
                        return await novPromise;
                    }
                    return [];
                });

            const wrapper = createWrapper(queryClient);
            const { result, rerender } = renderHook(
                ({ month }) => useExpensesQuery({ month }),
                {
                    wrapper,
                    initialProps: { month: "2026-10" },
                },
            );

            // Wait for initial month (October) data
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual([mockOctExpense]);
            expect(result.current.isPlaceholderData).toBe(false);

            // Change month to November while November query is still in flight
            rerender({ month: "2026-11" });

            // Data should STAY visible (not flash empty/undefined!)
            expect(result.current.data).toEqual([mockOctExpense]);
            expect(result.current.isPlaceholderData).toBe(true);

            // Now resolve November
            await act(async () => {
                resolveNov([mockNovExpense]);
            });

            await waitFor(() => {
                expect(result.current.isPlaceholderData).toBe(false);
            });

            expect(result.current.data).toEqual([mockNovExpense]);
            expect(getExpensesSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("2. Optimistic add: new expense appears in cache before server responds", () => {
        it("inserts new expense into cache synchronously before server resolves", async () => {
            let resolveAdd: (value: Expense) => void = () => {};
            const addPromise = new Promise<Expense>((resolve) => {
                resolveAdd = resolve;
            });

            vi.spyOn(financeService, "addExpense").mockImplementation(
                async () => {
                    return await addPromise;
                },
            );

            const wrapper = createWrapper(queryClient);
            const { result: mutationResult } = renderHook(
                () => useAddExpenseMutation(),
                { wrapper },
            );

            // Seed initial cache
            queryClient.setQueryData(queryKeys.allExpenses, [mockOctExpense]);
            queryClient.setQueryData(queryKeys.expenses({ month: "2026-10" }), [
                mockOctExpense,
            ]);

            const newExpenseInput: CreateExpenseInput = {
                payer_id: "mem-00000000-0011",
                category_id: "cat-00000000-0101",
                date: "2026-10-25",
                item: "Optimistic Kaya Toast",
                amount: 7.2,
                is_shared: true,
                split_ratio: 0.5,
            };

            // Trigger mutation
            await act(async () => {
                mutationResult.current.mutate(newExpenseInput);
            });

            // Check cache immediately (BEFORE server resolves!)
            const cachedAll = queryClient.getQueryData<Expense[]>(
                queryKeys.allExpenses,
            );
            expect(cachedAll).toBeDefined();
            expect(cachedAll?.length).toBe(2);
            expect(cachedAll?.[0].item).toBe("Optimistic Kaya Toast");
            expect(cachedAll?.[0].amount).toBe(7.2);

            const cachedOct = queryClient.getQueryData<Expense[]>(
                queryKeys.expenses({ month: "2026-10" }),
            );
            expect(cachedOct).toBeDefined();
            expect(cachedOct?.length).toBe(2);
            expect(cachedOct?.[0].item).toBe("Optimistic Kaya Toast");

            // Now resolve the server call
            const serverExpense: Expense = {
                ...newExpenseInput,
                split_ratio: newExpenseInput.split_ratio ?? 0.5,
                id: "exp-server-saved-1",
                household_id: "hh-00000000-0001",
                settled: false,
                created_at: new Date().toISOString(),
            };

            await act(async () => {
                resolveAdd(serverExpense);
            });

            await waitFor(() => {
                expect(mutationResult.current.isSuccess).toBe(true);
            });
        });
    });

    describe("3. Rollback on error: cache rolls back to snapshot if mutation fails", () => {
        it("rolls back added expense if server rejects with an error", async () => {
            vi.spyOn(financeService, "addExpense").mockRejectedValue(
                new Error("Database connection timed out"),
            );

            const wrapper = createWrapper(queryClient);
            const { result: mutationResult } = renderHook(
                () => useAddExpenseMutation(),
                { wrapper },
            );

            // Initial cache
            queryClient.setQueryData(queryKeys.allExpenses, [mockOctExpense]);
            queryClient.setQueryData(queryKeys.expenses({}), [mockOctExpense]);

            const newExpenseInput: CreateExpenseInput = {
                payer_id: "mem-00000000-0011",
                category_id: "cat-00000000-0101",
                date: "2026-10-25",
                item: "Will Fail Toast",
                amount: 5.0,
                is_shared: false,
                split_ratio: 0,
            };

            await act(async () => {
                try {
                    await mutationResult.current.mutateAsync(newExpenseInput);
                } catch {
                    // Expected rejection
                }
            });

            // Cache should have rolled back to initial state
            await waitFor(() => {
                expect(mutationResult.current.isError).toBe(true);
            });
            expect(mutationResult.current.error?.message).toBe(
                "Database connection timed out",
            );

            const cachedAll = queryClient.getQueryData<Expense[]>(
                queryKeys.allExpenses,
            );
            expect(cachedAll).toEqual([mockOctExpense]);
        });

        it("rolls back deleted expense if delete rejects with an error", async () => {
            vi.spyOn(financeService, "deleteExpense").mockRejectedValue(
                new Error("Forbidden: Expense is locked"),
            );

            const wrapper = createWrapper(queryClient);
            const { result: mutationResult } = renderHook(
                () => useDeleteExpenseMutation(),
                { wrapper },
            );

            // Initial cache has 2 items
            const initialList = [mockOctExpense, mockNovExpense];
            queryClient.setQueryData(queryKeys.allExpenses, initialList);
            queryClient.setQueryData(queryKeys.expenses({}), initialList);

            await act(async () => {
                try {
                    await mutationResult.current.mutateAsync(mockOctExpense.id);
                } catch {
                    // Expected rejection
                }
            });

            await waitFor(() => {
                expect(mutationResult.current.isError).toBe(true);
            });
            expect(mutationResult.current.error?.message).toBe(
                "Forbidden: Expense is locked",
            );

            // Cache restored! Both items must be present
            const cachedAll = queryClient.getQueryData<Expense[]>(
                queryKeys.allExpenses,
            );
            expect(cachedAll).toEqual(initialList);
        });
    });

    describe("4. Double-submit guard on delete", () => {
        it("disables delete button while deletion is pending to prevent double-submit", async () => {
            let resolveDelete: () => void = () => {};
            const deletePromise = new Promise<void>((resolve) => {
                resolveDelete = resolve;
            });

            const deleteSpy = vi
                .spyOn(financeService, "deleteExpense")
                .mockImplementation(async () => {
                    return await deletePromise;
                });

            const onClose = vi.fn();
            const onDeleted = vi.fn();

            render(
                <QueryClientProvider client={queryClient}>
                    <DeleteExpenseModal
                        isOpen={true}
                        onClose={onClose}
                        expense={mockOctExpense}
                        onDeleted={onDeleted}
                        categories={mockCategories}
                        members={mockMembers}
                    />
                </QueryClientProvider>,
            );

            const deleteButton = screen.getByRole("button", {
                name: `Confirm delete ${mockOctExpense.item}`,
            });
            expect(deleteButton).toBeEnabled();

            // First click triggers deletion
            fireEvent.click(deleteButton);

            // Button should now be disabled (isDeleting = true)
            await waitFor(() => {
                expect(deleteButton).toBeDisabled();
            });

            // Second click while pending should be blocked / ignored
            fireEvent.click(deleteButton);
            expect(deleteSpy).toHaveBeenCalledTimes(1);

            // Resolve the delete promise
            await act(async () => {
                resolveDelete();
            });

            await waitFor(() => {
                expect(onDeleted).toHaveBeenCalledWith(mockOctExpense.id);
                expect(onClose).toHaveBeenCalled();
            });

            // Ensure financeService.deleteExpense was called exactly once
            expect(deleteSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("5. useSubmitLock reusable hook", () => {
        it("prevents duplicate concurrent executions", async () => {
            const { result } = renderHook(() => useSubmitLock());

            let resolveAction: () => void = () => {};
            const actionPromise = new Promise<string>((resolve) => {
                resolveAction = () => resolve("done");
            });

            const slowAction = vi.fn(async () => {
                return await actionPromise;
            });

            let firstCallPromise: Promise<string | undefined>;
            act(() => {
                firstCallPromise = result.current.runWithLock(slowAction);
            });

            expect(result.current.isPending).toBe(true);

            // Attempt a second call while first is in-flight
            let secondCallResult: string | undefined = "sentinel";
            await act(async () => {
                secondCallResult = await result.current.runWithLock(slowAction);
            });

            // Second call was blocked and returned undefined
            expect(secondCallResult).toBeUndefined();
            expect(slowAction).toHaveBeenCalledTimes(1);

            // Resolve first call
            await act(async () => {
                resolveAction();
            });

            const firstResult = await firstCallPromise!;
            expect(firstResult).toBe("done");
            expect(result.current.isPending).toBe(false);
        });
    });
});
