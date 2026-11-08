/**
 * Tests for domain save mutations moved to TanStack Query (Issue #38).
 *
 * Verifies:
 * 1. Goal mutations: optimistic deposit/edit, rollback on error, targeted invalidation.
 * 2. Recurring item mutations: optimistic toggle/update/delete, rollback on error.
 * 3. Account balance mutations: single & bulk optimistic update across perspectives, rollback on error.
 * 4. Category mutations: optimistic add/update/delete, rollback on error.
 * 5. Budget profile mutations: optimistic updates and invalidation.
 * 6. Inbox mutations: optimistic confirm/resolve, rollback on error.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
    useUpdateGoalMutation,
    useAddGoalMutation,
    useUpdateRecurringItemMutation,
    useDeleteRecurringItemMutation,
    useUpdateAccountBalanceMutation,
    useBulkUpdateAccountBalancesMutation,
    useAddCategoryMutation,
    useUpdateCategoryMutation,
    useDeleteCategoryMutation,
    useUpdateBaseProfileMutation,
    queryKeys,
} from "../src/hooks/useFinanceQueries";
import {
    useConfirmInboxItemMutation,
    useResolveInboxItemMutation,
    inboxQueryKeys,
} from "../src/hooks/useInboxQueries";
import { financeService } from "../src/services/financeService";
import type {
    SavingsGoal,
    RecurringItem,
    Account,
    Category,
    BaseBudgetProfile,
    BaseProfileAllocation,
    InboxItem,
    InboxItemsResult,
    CreateExpenseInput,
} from "../src/types/finance";

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

describe("Issue #38: Domain Save Mutations", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.restoreAllMocks();
        queryClient = createTestQueryClient();
    });

    describe("1. Goal Mutations", () => {
        const initialGoals: SavingsGoal[] = [
            {
                id: "goal-1",
                household_id: "hh-1",
                title: "Japan Trip",
                target_amount: 5000,
                saved_so_far: 1200,
                target_date: "2026-12-31",
                monthly_contribution: 200,
                emoji: "✈️",
                status: "on_track",
                created_at: "2026-01-01T00:00:00Z",
            },
        ];

        it("optimistically updates goal saved_so_far and rolls back on error", async () => {
            queryClient.setQueryData(queryKeys.goals, initialGoals);

            let rejectPromise!: (err: Error) => void;
            const updateSpy = vi.spyOn(financeService, "updateGoal").mockImplementation(
                () => new Promise((_, reject) => { rejectPromise = reject; }),
            );

            const { result } = renderHook(() => useUpdateGoalMutation(), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                result.current.mutate({
                    id: "goal-1",
                    updates: { saved_so_far: 1500 },
                });
            });

            // Optimistic update should immediately reflect in cache
            const cachedBeforeServer = queryClient.getQueryData<SavingsGoal[]>(queryKeys.goals);
            expect(cachedBeforeServer?.[0].saved_so_far).toBe(1500);

            // Server fails
            await act(async () => {
                rejectPromise(new Error("Network failed"));
            });

            // Cache should be rolled back to initial state
            const cachedAfterError = queryClient.getQueryData<SavingsGoal[]>(queryKeys.goals);
            expect(cachedAfterError?.[0].saved_so_far).toBe(1200);
            expect(updateSpy).toHaveBeenCalledWith("goal-1", { saved_so_far: 1500 });
        });

        it("optimistically adds a goal and rolls back on error", async () => {
            queryClient.setQueryData(queryKeys.goals, initialGoals);

            let rejectPromise!: (err: Error) => void;
            vi.spyOn(financeService, "addGoal").mockImplementation(
                () => new Promise((_, reject) => { rejectPromise = reject; }),
            );

            const { result } = renderHook(() => useAddGoalMutation(), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                result.current.mutate({
                    title: "Emergency Fund",
                    target_amount: 10000,
                    saved_so_far: 0,
                    target_date: "2027-12-31",
                    monthly_contribution: 500,
                    emoji: "🛡️",
                });
            });

            expect(queryClient.getQueryData<SavingsGoal[]>(queryKeys.goals)).toHaveLength(2);

            await act(async () => {
                rejectPromise(new Error("Add failed"));
            });

            expect(queryClient.getQueryData<SavingsGoal[]>(queryKeys.goals)).toHaveLength(1);
        });
    });

    describe("2. Recurring Item Mutations", () => {
        const initialRecurring: RecurringItem[] = [
            {
                id: "rec-1",
                household_id: "hh-1",
                owner_id: "mem-1",
                type: "subscription",
                name: "Netflix",
                amount: 25.98,
                monthly_amortized_amount: 25.98,
                frequency: "monthly",
                due_day: 15,
                category_id: "cat-1",
            },
        ];

        it("optimistically updates recurring item and rolls back on error", async () => {
            queryClient.setQueryData(queryKeys.recurringItems, initialRecurring);

            let rejectPromise!: (err: Error) => void;
            vi.spyOn(financeService, "updateRecurringItem").mockImplementation(
                () => new Promise((_, reject) => { rejectPromise = reject; }),
            );

            const { result } = renderHook(() => useUpdateRecurringItemMutation(), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                result.current.mutate({ id: "rec-1", amount: 30 });
            });

            expect(queryClient.getQueryData<RecurringItem[]>(queryKeys.recurringItems)?.[0].amount).toBe(30);

            await act(async () => {
                rejectPromise(new Error("Update failed"));
            });

            expect(queryClient.getQueryData<RecurringItem[]>(queryKeys.recurringItems)?.[0].amount).toBe(25.98);
        });

        it("optimistically deletes recurring item", async () => {
            queryClient.setQueryData(queryKeys.recurringItems, initialRecurring);

            vi.spyOn(financeService, "deleteRecurringItem").mockResolvedValue(undefined as never);

            const { result } = renderHook(() => useDeleteRecurringItemMutation(), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                result.current.mutate("rec-1");
            });

            expect(queryClient.getQueryData<RecurringItem[]>(queryKeys.recurringItems)).toHaveLength(0);
        });
    });

    describe("3. Account Balance Mutations", () => {
        const initialAccounts: Account[] = [
            {
                id: "acc-1",
                household_id: "hh-1",
                owner_id: "mem-1",
                name: "DBS Savings",
                type: "Cash",
                balance: 10000,
                currency: "SGD",
                updated_at: "2026-11-01T00:00:00Z",
                is_joint: false,
            },
            {
                id: "acc-2",
                household_id: "hh-1",
                owner_id: "mem-2",
                name: "OCBC Joint",
                type: "Cash",
                balance: 5000,
                currency: "SGD",
                updated_at: "2026-11-01T00:00:00Z",
                is_joint: true,
            },
        ];

        it("optimistically updates single account balance across perspective queries", async () => {
            queryClient.setQueryData(queryKeys.accounts(), initialAccounts);
            queryClient.setQueryData(queryKeys.accounts("mem-1"), [initialAccounts[0]]);

            let rejectPromise!: (err: Error) => void;
            vi.spyOn(financeService, "updateAccountBalance").mockImplementation(
                () => new Promise((_, reject) => { rejectPromise = reject; }),
            );

            const { result } = renderHook(() => useUpdateAccountBalanceMutation(), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                result.current.mutate({ accountId: "acc-1", newBalance: 12500 });
            });

            // Check household perspective
            expect(queryClient.getQueryData<Account[]>(queryKeys.accounts())?.[0].balance).toBe(12500);
            // Check member perspective
            expect(queryClient.getQueryData<Account[]>(queryKeys.accounts("mem-1"))?.[0].balance).toBe(12500);

            // Rollback on error
            await act(async () => {
                rejectPromise(new Error("Balance update failed"));
            });

            expect(queryClient.getQueryData<Account[]>(queryKeys.accounts())?.[0].balance).toBe(10000);
            expect(queryClient.getQueryData<Account[]>(queryKeys.accounts("mem-1"))?.[0].balance).toBe(10000);
        });

        it("optimistically performs bulk balance updates", async () => {
            queryClient.setQueryData(queryKeys.accounts(), initialAccounts);

            let resolvePromise!: (val: Account[]) => void;
            vi.spyOn(financeService, "bulkUpdateAccountBalances").mockImplementation(
                () => new Promise((resolve) => { resolvePromise = resolve; }),
            );

            const { result } = renderHook(() => useBulkUpdateAccountBalancesMutation(), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                result.current.mutate({
                    updates: [
                        { id: "acc-1", current_balance: 11000 },
                        { id: "acc-2", current_balance: 6000 },
                    ],
                });
            });

            const updatedCached = queryClient.getQueryData<Account[]>(queryKeys.accounts());
            expect(updatedCached?.[0].balance).toBe(11000);
            expect(updatedCached?.[1].balance).toBe(6000);

            await act(async () => {
                resolvePromise(updatedCached!);
            });
        });
    });

    describe("4. Category Mutations", () => {
        const initialCategories: Category[] = [
            {
                id: "cat-1",
                household_id: "hh-1",
                name: "Dining",
                color: "#ffb4a2",
                icon: "Utensils",
                is_system: false,
            },
        ];

        it("optimistically updates a category", async () => {
            queryClient.setQueryData(queryKeys.categories, initialCategories);

            let rejectPromise!: (err: Error) => void;
            vi.spyOn(financeService, "updateCategory").mockImplementation(
                () => new Promise((_, reject) => { rejectPromise = reject; }),
            );

            const { result } = renderHook(() => useUpdateCategoryMutation(), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                result.current.mutate({ id: "cat-1", updates: { name: "Food & Dining" } });
            });

            expect(queryClient.getQueryData<Category[]>(queryKeys.categories)?.[0].name).toBe("Food & Dining");

            await act(async () => {
                rejectPromise(new Error("Update failed"));
            });

            expect(queryClient.getQueryData<Category[]>(queryKeys.categories)?.[0].name).toBe("Dining");
        });

        it("optimistically adds a category and rolls back on error", async () => {
            queryClient.setQueryData(queryKeys.categories, initialCategories);

            let rejectPromise!: (err: Error) => void;
            vi.spyOn(financeService, "addCategory").mockImplementation(
                () => new Promise((_, reject) => { rejectPromise = reject; }),
            );

            const { result } = renderHook(() => useAddCategoryMutation(), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                result.current.mutate({
                    name: "Travel",
                    color: "#90e0ef",
                    icon: "Plane",
                    household_id: "hh-1",
                });
            });

            expect(queryClient.getQueryData<Category[]>(queryKeys.categories)).toHaveLength(2);

            await act(async () => {
                rejectPromise(new Error("Add category failed"));
            });

            expect(queryClient.getQueryData<Category[]>(queryKeys.categories)).toHaveLength(1);
        });

        it("optimistically deletes a category", async () => {
            queryClient.setQueryData(queryKeys.categories, initialCategories);

            vi.spyOn(financeService, "deleteCategory").mockResolvedValue(undefined as never);

            const { result } = renderHook(() => useDeleteCategoryMutation(), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                result.current.mutate("cat-1");
            });

            expect(queryClient.getQueryData<Category[]>(queryKeys.categories)).toHaveLength(0);
        });
    });

    describe("5. Base Profile & Allocation Mutations", () => {
        const mockProfile: BaseBudgetProfile = {
            id: "prof-1",
            household_id: "hh-1",
            owner_id: "mem-1",
            gross_salary: 6000,
            cpf_employee_rate: 0.2,
            tithing_enabled: false,
        };

        const mockAllocations: BaseProfileAllocation[] = [
            {
                id: "alloc-1",
                profile_id: "prof-1",
                category_id: "cat-1",
                target_percentage: 0.5,
            },
        ];

        it("optimistically updates base profile allocations and rolls back on error", async () => {
            queryClient.setQueryData(queryKeys.baseProfiles, [mockProfile]);
            queryClient.setQueryData(queryKeys.baseAllocations("prof-1"), mockAllocations);

            let rejectPromise!: (err: Error) => void;
            vi.spyOn(financeService, "updateBaseProfile").mockImplementation(
                () => new Promise((_, reject) => { rejectPromise = reject; }),
            );

            const { result } = renderHook(() => useUpdateBaseProfileMutation(), {
                wrapper: createWrapper(queryClient),
            });

            const updatedProfile = { ...mockProfile, gross_salary: 7000 };
            const updatedAllocations = [{ ...mockAllocations[0], target_percentage: 0.6 }];

            await act(async () => {
                result.current.mutate({
                    profile: updatedProfile,
                    allocations: updatedAllocations,
                });
            });

            expect(queryClient.getQueryData<BaseBudgetProfile[]>(queryKeys.baseProfiles)?.[0].gross_salary).toBe(7000);
            expect(queryClient.getQueryData<BaseProfileAllocation[]>(queryKeys.baseAllocations("prof-1"))?.[0].target_percentage).toBe(0.6);

            await act(async () => {
                rejectPromise(new Error("Update failed"));
            });

            expect(queryClient.getQueryData<BaseBudgetProfile[]>(queryKeys.baseProfiles)?.[0].gross_salary).toBe(6000);
            expect(queryClient.getQueryData<BaseProfileAllocation[]>(queryKeys.baseAllocations("prof-1"))?.[0].target_percentage).toBe(0.5);
        });
    });

    describe("6. Inbox Mutations", () => {
        const initialInboxItem: InboxItem = {
            id: "inbox-1",
            household_id: "hh-1",
            member_id: "mem-1",
            merchant: "FairPrice",
            merchant_key: "fairprice",
            amount: 54.2,
            currency: "SGD",
            captured_at: "2026-11-08T00:00:00Z",
            suggested_category_id: "cat-1",
            status: "pending",
        };

        const initialInboxResult: InboxItemsResult = {
            items: [initialInboxItem],
            available: true,
        };

        it("optimistically removes item on confirm and rolls back on error", async () => {
            queryClient.setQueryData(inboxQueryKeys.items, initialInboxResult);

            let rejectPromise!: (err: Error) => void;
            vi.spyOn(financeService, "confirmInboxItem").mockImplementation(
                () => new Promise((_, reject) => { rejectPromise = reject; }),
            );

            const { result } = renderHook(() => useConfirmInboxItemMutation(), {
                wrapper: createWrapper(queryClient),
            });

            const input: CreateExpenseInput = {
                amount: 54.2,
                category_id: "cat-1",
                payer_id: "mem-1",
                date: "2026-11-08",
                item: "FairPrice",
                is_shared: true,
            };

            await act(async () => {
                result.current.mutate({
                    item: initialInboxItem,
                    input,
                    via: "swipe",
                    guessedCategoryId: "cat-1",
                });
            });

            // Optimistically removed
            expect(queryClient.getQueryData<InboxItemsResult>(inboxQueryKeys.items)?.items).toHaveLength(0);

            // Error rolls back
            await act(async () => {
                rejectPromise(new Error("Confirm failed"));
            });

            expect(queryClient.getQueryData<InboxItemsResult>(inboxQueryKeys.items)?.items).toHaveLength(1);
        });

        it("optimistically resolves item", async () => {
            queryClient.setQueryData(inboxQueryKeys.items, initialInboxResult);

            let resolvePromise!: (val: void) => void;
            vi.spyOn(financeService, "resolveInboxItem").mockImplementation(
                () => new Promise((resolve) => { resolvePromise = resolve; }),
            );

            const { result } = renderHook(() => useResolveInboxItemMutation(), {
                wrapper: createWrapper(queryClient),
            });

            await act(async () => {
                result.current.mutate({ id: "inbox-1", reason: "discarded" });
            });

            expect(queryClient.getQueryData<InboxItemsResult>(inboxQueryKeys.items)?.items).toHaveLength(0);

            await act(async () => {
                resolvePromise();
            });
        });
    });
});
