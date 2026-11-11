import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    supabaseFinanceService,
    quotePostgrestIlikePattern,
    buildExpenseSearchOrFilter,
} from "../src/services/supabaseFinanceService";
import * as supabaseClientModule from "../src/services/supabaseClient";
import type {
    BaseBudgetProfile,
    BaseProfileAllocation,
    CreateExpenseInput,
} from "../src/types/finance";
import { isValidUuid } from "../src/lib/uuid";

describe("supabaseFinanceService", () => {
    const validHouseholdId = "00000000-0000-0000-0000-000000000001";
    const validMemberId = "00000000-0000-0000-0000-000000000011";
    const validCategoryId = "00000000-0000-0000-0000-000000000101";
    const validProfileId = "00000000-0000-0000-0000-000000000201";

    let mockClient: any;
    let upsertProfileSpy: any;
    let insertAllocationsSpy: any;
    let deleteAllocationsSpy: any;
    let expensesOrSpy: any;

    beforeEach(() => {
        vi.restoreAllMocks();

        upsertProfileSpy = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                    data: { id: validProfileId },
                    error: null,
                }),
            }),
        });

        insertAllocationsSpy = vi.fn().mockResolvedValue({ error: null });

        deleteAllocationsSpy = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({ error: null }),
                then: (resolve: any) => resolve({ error: null }),
            }),
        });

        expensesOrSpy = vi.fn();

        mockClient = {
            from: vi.fn((table: string) => {
                if (table === "households") {
                    return {
                        select: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: { id: validHouseholdId },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                if (table === "household_members") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: validMemberId,
                                        display_name: "Yi Jia",
                                    },
                                ],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "categories") {
                    return {
                        select: vi.fn().mockResolvedValue({
                            data: [{ id: validCategoryId, name: "Food" }],
                            error: null,
                        }),
                    };
                }
                if (table === "base_budget_profiles") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    maybeSingle: vi.fn().mockResolvedValue({
                                        data: { id: validProfileId },
                                        error: null,
                                    }),
                                }),
                            }),
                        }),
                        upsert: upsertProfileSpy,
                    };
                }
                if (table === "base_profile_allocations") {
                    return {
                        delete: deleteAllocationsSpy,
                        insert: insertAllocationsSpy,
                        upsert: insertAllocationsSpy,
                    };
                }
                if (table === "expenses") {
                    const queryChain: any = {
                        eq: vi.fn(() => queryChain),
                        gte: vi.fn(() => queryChain),
                        lt: vi.fn(() => queryChain),
                        lte: vi.fn(() => queryChain),
                        order: vi.fn(() => queryChain),
                        or: vi.fn((arg: string) => {
                            expensesOrSpy(arg);
                            return queryChain;
                        }),
                        then: (resolve: any) =>
                            resolve({ data: [], error: null }),
                    };
                    return {
                        select: vi.fn().mockReturnValue(queryChain),
                    };
                }
                if (table === "monthly_budgets") {
                    const mbChain: any = {
                        select: vi.fn(() => mbChain),
                        eq: vi.fn(() => mbChain),
                        gte: vi.fn(() => mbChain),
                        limit: vi.fn(() => mbChain),
                        maybeSingle: vi
                            .fn()
                            .mockResolvedValue({ data: null, error: null }),
                        single: vi
                            .fn()
                            .mockResolvedValue({ data: null, error: null }),
                        insert: vi.fn().mockReturnValue({
                            select: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: {
                                        id: "00000000-0000-0000-0000-000000000301",
                                    },
                                    error: null,
                                }),
                            }),
                        }),
                        update: vi.fn(() => mbChain),
                        delete: vi.fn(() => mbChain),
                        then: (resolve: any) =>
                            resolve({ data: [], error: null }),
                    };
                    return mbChain;
                }
                if (table === "monthly_budget_categories") {
                    const mbcChain: any = {
                        select: vi.fn(() => mbcChain),
                        eq: vi.fn(() => mbcChain),
                        insert: vi.fn().mockResolvedValue({ error: null }),
                        delete: vi.fn(() => mbcChain),
                        then: (resolve: any) =>
                            resolve({ data: [], error: null }),
                    };
                    return mbcChain;
                }
                return {};
            }),
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { email: "yijia@example.com" } },
                }),
            },
        };

        vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue(
            mockClient,
        );
    });

    describe("search escaping for PostgREST or()", () => {
        it("quotes and escapes special characters covering 'coffee, tea', '(a)', and '\"q\"'", () => {
            expect(quotePostgrestIlikePattern("coffee, tea")).toBe(
                '"%coffee, tea%"',
            );
            expect(buildExpenseSearchOrFilter("coffee, tea")).toBe(
                'item.ilike."%coffee, tea%",remarks.ilike."%coffee, tea%"',
            );

            expect(quotePostgrestIlikePattern("(a)")).toBe('"%(a)%"');
            expect(buildExpenseSearchOrFilter("(a)")).toBe(
                'item.ilike."%(a)%",remarks.ilike."%(a)%"',
            );

            expect(quotePostgrestIlikePattern('"q"')).toBe('"%\\"q\\"%"');
            expect(buildExpenseSearchOrFilter('"q"')).toBe(
                'item.ilike."%\\"q\\"%",remarks.ilike."%\\"q\\"%"',
            );

            expect(quotePostgrestIlikePattern("a\\b")).toBe('"%a\\\\b%"');
        });

        it("passes quoted search pattern to PostgREST query.or() in getExpenses", async () => {
            for (const term of ["coffee, tea", "(a)", '"q"']) {
                expensesOrSpy.mockClear();
                await supabaseFinanceService.getExpenses({ search: term });
                expect(expensesOrSpy).toHaveBeenCalledTimes(1);
                expect(expensesOrSpy).toHaveBeenCalledWith(
                    buildExpenseSearchOrFilter(term),
                );
            }
        });
    });

    describe("rejecting mock IDs in Supabase mode (M4)", () => {
        it("sanitizes household_id and profile/allocation primary keys when owner_id and category_id are valid UUIDs", async () => {
            const inputProfile: BaseBudgetProfile = {
                id: "prof-00000000-0201",
                household_id: "hh-00000000-0001",
                owner_id: validMemberId,
                gross_salary: 6000,
                cpf_employee_rate: 0.2,
                tithing_enabled: true,
            };

            const inputAllocations: BaseProfileAllocation[] = [
                {
                    id: "alloc-yj-01",
                    profile_id: "prof-00000000-0201",
                    category_id: validCategoryId,
                    target_percentage: 1.0,
                },
            ];

            await supabaseFinanceService.updateBaseProfile(
                inputProfile,
                inputAllocations,
            );

            expect(upsertProfileSpy).toHaveBeenCalledTimes(1);
            const [upsertPayload, options] = upsertProfileSpy.mock.calls[0];

            expect(options).toEqual({ onConflict: "household_id,owner_id" });
            expect(upsertPayload.household_id).toBe(validHouseholdId);
            expect(upsertPayload.owner_id).toBe(validMemberId);
            expect(isValidUuid(upsertPayload.id)).toBe(true);

            expect(insertAllocationsSpy).toHaveBeenCalledTimes(1);
            const [insertedAllocations] = insertAllocationsSpy.mock.calls[0];
            expect(insertedAllocations).toHaveLength(1);

            const alloc = insertedAllocations[0];
            expect(alloc.profile_id).toBe(validProfileId);
            expect(alloc.category_id).toBe(validCategoryId);
            expect(isValidUuid(alloc.id)).toBe(true);
        });

        it("throws in updateBaseProfile when owner_id or category_id is a non-UUID mock ID", async () => {
            const badOwnerProfile: BaseBudgetProfile = {
                id: validProfileId,
                household_id: validHouseholdId,
                owner_id: "mem-00000000-0011",
                gross_salary: 6000,
                cpf_employee_rate: 0.2,
                tithing_enabled: true,
            };

            await expect(
                supabaseFinanceService.updateBaseProfile(badOwnerProfile, []),
            ).rejects.toThrow(/Invalid member ID/i);
            expect(upsertProfileSpy).not.toHaveBeenCalled();

            const validOwnerProfile: BaseBudgetProfile = {
                ...badOwnerProfile,
                owner_id: validMemberId,
            };
            const badCategoryAllocs: BaseProfileAllocation[] = [
                {
                    id: "alloc-yj-01",
                    profile_id: validProfileId,
                    category_id: "cat-00000000-0101",
                    target_percentage: 1.0,
                },
            ];

            await expect(
                supabaseFinanceService.updateBaseProfile(
                    validOwnerProfile,
                    badCategoryAllocs,
                ),
            ).rejects.toThrow(/Invalid category ID/i);
            expect(insertAllocationsSpy).not.toHaveBeenCalled();
        });

        it("throws in addExpense when payer_id or category_id is a non-UUID mock ID", async () => {
            const badPayerExpense: CreateExpenseInput = {
                payer_id: "mem-00000000-0011",
                category_id: validCategoryId,
                amount: 25,
                item: "Lunch",
                date: "2026-10-01",
                is_shared: false,
            };

            await expect(
                supabaseFinanceService.addExpense(badPayerExpense),
            ).rejects.toThrow(/Invalid payer member ID/i);

            const badCategoryExpense: CreateExpenseInput = {
                payer_id: validMemberId,
                category_id: "cat-00000000-0101",
                amount: 25,
                item: "Lunch",
                date: "2026-10-01",
                is_shared: false,
            };

            await expect(
                supabaseFinanceService.addExpense(badCategoryExpense),
            ).rejects.toThrow(/Invalid category ID/i);
        });
    });

    describe("updateBaseProfile 0% CPF rate and atomic upsert-then-delete (M5)", () => {
        it("preserves a 0% CPF rate as 0 instead of falling back to 0.20, and upserts allocations before deleting stale categories", async () => {
            const callOrder: string[] = [];
            const notSpy = vi.fn().mockImplementation(async () => {
                callOrder.push("delete-stale");
                return { error: null };
            });
            deleteAllocationsSpy.mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    not: notSpy,
                    then: (resolve: any) => {
                        callOrder.push("delete-all");
                        return resolve({ error: null });
                    },
                }),
            });
            insertAllocationsSpy.mockImplementation(async () => {
                callOrder.push("upsert-allocs");
                return { error: null };
            });

            const zeroCpfProfile: BaseBudgetProfile = {
                id: validProfileId,
                household_id: validHouseholdId,
                owner_id: validMemberId,
                gross_salary: 6000,
                cpf_employee_rate: 0,
                tithing_enabled: false,
            };
            const allocations: BaseProfileAllocation[] = [
                {
                    id: "00000000-0000-0000-0000-000000000301",
                    profile_id: validProfileId,
                    category_id: validCategoryId,
                    target_percentage: 1.0,
                },
            ];

            await supabaseFinanceService.updateBaseProfile(
                zeroCpfProfile,
                allocations,
            );

            const [upsertPayload] = upsertProfileSpy.mock.calls[0];
            expect(upsertPayload.cpf_employee_rate).toBe(0);

            expect(callOrder).toEqual(["upsert-allocs", "delete-stale"]);
            expect(insertAllocationsSpy).toHaveBeenCalledWith(
                expect.any(Array),
                { onConflict: "profile_id,category_id" },
            );
            expect(notSpy).toHaveBeenCalledWith(
                "category_id",
                "in",
                `(${validCategoryId})`,
            );
        });

        it("does not delete existing allocations if the allocation upsert fails", async () => {
            insertAllocationsSpy.mockResolvedValueOnce({
                error: new Error("Upsert failed"),
            });

            const profile: BaseBudgetProfile = {
                id: validProfileId,
                household_id: validHouseholdId,
                owner_id: validMemberId,
                gross_salary: 6000,
                cpf_employee_rate: 0.2,
                tithing_enabled: true,
            };
            const allocations: BaseProfileAllocation[] = [
                {
                    id: "00000000-0000-0000-0000-000000000301",
                    profile_id: validProfileId,
                    category_id: validCategoryId,
                    target_percentage: 1.0,
                },
            ];

            await expect(
                supabaseFinanceService.updateBaseProfile(profile, allocations),
            ).rejects.toThrow("Upsert failed");
            expect(deleteAllocationsSpy).not.toHaveBeenCalled();
        });
    });

    describe("1,000-row PostgREST pagination & descending snapshot order (M8)", () => {
        it("orders account_snapshots descending, paginates past 1,000 rows, and returns chronological ascending order", async () => {
            const orderSpy = vi.fn();
            const rangeSpy = vi.fn();

            const page1 = Array.from({ length: 1000 }, (_, idx) => ({
                id: `snap-p1-${idx}`,
                account_id: "acc-1",
                household_id: validHouseholdId,
                balance: 1000 + idx,
                snapshot_date: idx === 0 ? "2026-11-01" : "2026-10-15",
            }));
            const page2 = [
                {
                    id: "snap-oldest",
                    account_id: "acc-1",
                    household_id: validHouseholdId,
                    balance: 500,
                    snapshot_date: "2026-01-01",
                },
            ];

            const baseFrom = mockClient.from;
            mockClient.from = vi.fn((table: string) => {
                if (table === "account_snapshots") {
                    const chain: any = {
                        order: vi.fn((col: string, opts: any) => {
                            orderSpy(col, opts);
                            return chain;
                        }),
                        range: vi.fn(async (from: number, to: number) => {
                            rangeSpy(from, to);
                            return {
                                data: from === 0 ? page1 : page2,
                                error: null,
                            };
                        }),
                    };
                    return {
                        select: vi.fn().mockReturnValue(chain),
                    };
                }
                return baseFrom(table);
            });

            const snapshots =
                await supabaseFinanceService.getAllAccountSnapshots(
                    "household",
                );
            expect(orderSpy).toHaveBeenCalledWith("snapshot_date", {
                ascending: false,
            });
            expect(rangeSpy).toHaveBeenNthCalledWith(1, 0, 999);
            expect(rangeSpy).toHaveBeenNthCalledWith(2, 1000, 1999);
            expect(snapshots).toHaveLength(1001);
            expect(snapshots[0].snapshot_date).toBe("2026-01-01");
            expect(snapshots[snapshots.length - 1].snapshot_date).toBe(
                "2026-11-01",
            );
        });

        it("paginates unbounded getExpenses and getDailyCheckins across 1,000-row pages", async () => {
            const expenseRangeSpy = vi.fn();
            const checkinRangeSpy = vi.fn();

            const expPage1 = Array.from({ length: 1000 }, (_, idx) => ({
                id: `exp-${idx}`,
                household_id: validHouseholdId,
                payer_id: validMemberId,
                category_id: validCategoryId,
                date: "2026-10-10",
                item: `Item ${idx}`,
                amount: 10,
                is_shared: false,
                settled: false,
            }));
            const expPage2 = [
                {
                    id: "exp-1000",
                    household_id: validHouseholdId,
                    payer_id: validMemberId,
                    category_id: validCategoryId,
                    date: "2026-10-01",
                    item: "Item 1000",
                    amount: 20,
                    is_shared: false,
                    settled: false,
                },
            ];

            const checkinPage1 = Array.from({ length: 1000 }, (_, idx) => ({
                id: `ci-${idx}`,
                household_id: validHouseholdId,
                member_id: validMemberId,
                checkin_date: "2026-10-10",
                type: "expense",
            }));
            const checkinPage2 = [
                {
                    id: "ci-1000",
                    household_id: validHouseholdId,
                    member_id: validMemberId,
                    checkin_date: "2026-01-01",
                    type: "no_spend",
                },
            ];

            mockClient.from = vi.fn((table: string) => {
                if (table === "expenses") {
                    const chain: any = {
                        order: vi.fn(() => chain),
                        range: vi.fn(async (from: number, to: number) => {
                            expenseRangeSpy(from, to);
                            return {
                                data: from === 0 ? expPage1 : expPage2,
                                error: null,
                            };
                        }),
                    };
                    return { select: vi.fn().mockReturnValue(chain) };
                }
                if (table === "daily_checkins") {
                    const chain: any = {
                        order: vi.fn(() => chain),
                        eq: vi.fn(() => chain),
                        range: vi.fn(async (from: number, to: number) => {
                            checkinRangeSpy(from, to);
                            return {
                                data: from === 0 ? checkinPage1 : checkinPage2,
                                error: null,
                            };
                        }),
                    };
                    return { select: vi.fn().mockReturnValue(chain) };
                }
                return {};
            });

            const expenses = await supabaseFinanceService.getExpenses();
            expect(expenses).toHaveLength(1001);
            expect(expenseRangeSpy).toHaveBeenNthCalledWith(1, 0, 999);
            expect(expenseRangeSpy).toHaveBeenNthCalledWith(2, 1000, 1999);

            const checkins =
                await supabaseFinanceService.getDailyCheckins(validMemberId);
            expect(checkins).toHaveLength(1001);
            expect(checkinRangeSpy).toHaveBeenNthCalledWith(1, 0, 999);
            expect(checkinRangeSpy).toHaveBeenNthCalledWith(2, 1000, 1999);
        });
    });

    describe("settleSharedExpenses by explicit expense IDs (M11)", () => {
        it("filters by .in('id', expenseIds) when explicit expense IDs are passed", async () => {
            const inSpy = vi.fn();
            const orSpy = vi.fn().mockResolvedValue({ error: null });

            mockClient.from = vi.fn((table: string) => {
                if (table === "expenses") {
                    const updateChain: any = {
                        eq: vi.fn(() => updateChain),
                        in: vi.fn((col: string, ids: string[]) => {
                            inSpy(col, ids);
                            return updateChain;
                        }),
                        or: orSpy,
                    };
                    return {
                        update: vi.fn().mockReturnValue(updateChain),
                    };
                }
                return {};
            });

            const partnerId = "00000000-0000-0000-0000-000000000012";
            await supabaseFinanceService.settleSharedExpenses(
                validMemberId,
                partnerId,
                ["exp-1", "exp-2"],
            );

            expect(inSpy).toHaveBeenCalledWith("id", ["exp-1", "exp-2"]);
            expect(orSpy).toHaveBeenCalledWith(
                `payer_id.eq.${validMemberId},payer_id.eq.${partnerId}`,
            );
        });
    });

    describe("settle-up history (#39)", () => {
        const partnerId = "00000000-0000-0000-0000-000000000012";

        function mockSettleTables(insertResult: { error: unknown }) {
            const insertSpy = vi.fn().mockResolvedValue(insertResult);
            const updateChain: any = {
                eq: vi.fn(() => updateChain),
                in: vi.fn(() => updateChain),
                or: vi.fn().mockResolvedValue({ error: null }),
            };
            mockClient.from = vi.fn((table: string) => {
                if (table === "expenses") {
                    return { update: vi.fn().mockReturnValue(updateChain) };
                }
                if (table === "households") {
                    return {
                        select: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: { id: validHouseholdId },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                if (table === "settle_ups") {
                    return { insert: insertSpy };
                }
                return {};
            });
            return insertSpy;
        }

        it("inserts a settle_ups row with direction, amount and expense ids", async () => {
            supabaseFinanceService.resetBonusLogAvailability();
            const insertSpy = mockSettleTables({ error: null });
            await supabaseFinanceService.settleSharedExpenses(
                validMemberId,
                partnerId,
                ["exp-1", "exp-2"],
                { payerId: partnerId, payeeId: validMemberId, amount: 20 },
            );
            expect(insertSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    household_id: validHouseholdId,
                    payer_id: partnerId,
                    payee_id: validMemberId,
                    amount: 20,
                    expense_ids: ["exp-1", "exp-2"],
                }),
            );
        });

        it("does not insert a row when no record is supplied", async () => {
            supabaseFinanceService.resetBonusLogAvailability();
            const insertSpy = mockSettleTables({ error: null });
            await supabaseFinanceService.settleSharedExpenses(
                validMemberId,
                partnerId,
                ["exp-1"],
            );
            expect(insertSpy).not.toHaveBeenCalled();
        });

        it("still settles when the settle_ups table is missing", async () => {
            supabaseFinanceService.resetBonusLogAvailability();
            mockSettleTables({
                error: { code: "42P01", message: "relation does not exist" },
            });
            await expect(
                supabaseFinanceService.settleSharedExpenses(
                    validMemberId,
                    partnerId,
                    ["exp-1"],
                    { payerId: partnerId, payeeId: validMemberId, amount: 5 },
                ),
            ).resolves.toBeUndefined();
        });
    });

    describe("monthly budgets persistence and historical isolation (Issue #33 / H8)", () => {
        const pastMonth = "2025-01";
        const currentOrFutureMonth = "2099-01";
        const sampleBudgetId = "00000000-0000-0000-0000-000000000777";

        it("persists a newly generated monthly budget and category allocations to Supabase with real UUIDs", async () => {
            let insertedBudgetRow: any = null;
            let insertedCategoryRows: any[] = [];

            mockClient.from = vi.fn((table: string) => {
                if (table === "households") {
                    return {
                        select: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: { id: validHouseholdId },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                if (table === "household_members") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: validMemberId,
                                        display_name: "Yi Jia",
                                    },
                                ],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "base_budget_profiles") {
                    return {
                        select: vi.fn().mockResolvedValue({
                            data: [
                                {
                                    id: validProfileId,
                                    household_id: validHouseholdId,
                                    owner_id: validMemberId,
                                    gross_salary: 6000,
                                    cpf_employee_rate: 0.2,
                                },
                            ],
                            error: null,
                        }),
                    };
                }
                if (table === "base_profile_allocations") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: "00000000-0000-0000-0000-000000000888",
                                        profile_id: validProfileId,
                                        category_id: validCategoryId,
                                        target_percentage: 0.5,
                                    },
                                ],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "categories") {
                    return {
                        select: vi.fn().mockResolvedValue({
                            data: [
                                {
                                    id: validCategoryId,
                                    name: "Food",
                                    is_spendable: true,
                                },
                            ],
                            error: null,
                        }),
                    };
                }
                if (table === "recurring_items") {
                    return {
                        select: vi.fn().mockResolvedValue({
                            data: [],
                            error: null,
                        }),
                    };
                }
                if (table === "bonus_events") {
                    const chain: any = {
                        eq: vi.fn(() => chain),
                        gte: vi.fn(() => chain),
                        lt: vi.fn(() => chain),
                        then: (resolve: any) =>
                            resolve({ data: [], error: null }),
                    };
                    return { select: vi.fn().mockReturnValue(chain) };
                }
                if (table === "expenses") {
                    const chain: any = {
                        gte: vi.fn(() => chain),
                        lt: vi.fn(() => chain),
                        then: (resolve: any) =>
                            resolve({ data: [], error: null }),
                    };
                    return { select: vi.fn().mockReturnValue(chain) };
                }
                if (table === "monthly_budgets") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    limit: vi.fn().mockReturnValue({
                                        maybeSingle: vi.fn().mockResolvedValue({
                                            data: null, // no existing budget
                                            error: null,
                                        }),
                                    }),
                                }),
                            }),
                        }),
                        insert: vi.fn((row: any) => {
                            insertedBudgetRow = row;
                            return {
                                select: vi.fn().mockReturnValue({
                                    single: vi.fn().mockResolvedValue({
                                        data: {
                                            ...row,
                                            id: row.id || sampleBudgetId,
                                        },
                                        error: null,
                                    }),
                                }),
                            };
                        }),
                    };
                }
                if (table === "monthly_budget_categories") {
                    return {
                        insert: vi.fn().mockImplementation((rows: any[]) => {
                            insertedCategoryRows = rows;
                            return Promise.resolve({ error: null });
                        }),
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: "00000000-0000-0000-0000-000000000999",
                                        monthly_budget_id: sampleBudgetId,
                                        category_id: validCategoryId,
                                        percentage: 0.5,
                                        allocated_amount: 2400,
                                        categories: {
                                            id: validCategoryId,
                                            name: "Food",
                                            is_spendable: true,
                                        },
                                    },
                                ],
                                error: null,
                            }),
                        }),
                    };
                }
                return {};
            });

            const result = await supabaseFinanceService.getMonthlyBudget(
                currentOrFutureMonth,
                validMemberId,
            );

            expect(insertedBudgetRow).toBeDefined();
            expect(isValidUuid(insertedBudgetRow.id)).toBe(true);
            expect(insertedBudgetRow.gross_salary).toBe(6000);
            expect(insertedBudgetRow.is_locked).toBe(false);
            expect(insertedCategoryRows.length).toBeGreaterThan(0);
            expect(isValidUuid(result.budget.id)).toBe(true);
        });

        it("locks past months with is_locked: true both on newly generated months and existing unlocked past months", async () => {
            let insertedPastRow: any = null;
            let updatedLockId: string | null = null;

            mockClient.from = vi.fn((table: string) => {
                if (table === "households") {
                    return {
                        select: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: { id: validHouseholdId },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                if (table === "household_members") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: validMemberId,
                                        display_name: "Yi Jia",
                                    },
                                ],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "base_budget_profiles") {
                    return {
                        select: vi.fn().mockResolvedValue({
                            data: [
                                {
                                    id: validProfileId,
                                    household_id: validHouseholdId,
                                    owner_id: validMemberId,
                                    gross_salary: 6000,
                                    cpf_employee_rate: 0.2,
                                },
                            ],
                            error: null,
                        }),
                    };
                }
                if (table === "base_profile_allocations") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: [],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "categories") {
                    return {
                        select: vi.fn().mockResolvedValue({
                            data: [{ id: validCategoryId, name: "Food" }],
                            error: null,
                        }),
                    };
                }
                if (table === "recurring_items") {
                    return {
                        select: vi.fn().mockResolvedValue({
                            data: [],
                            error: null,
                        }),
                    };
                }
                if (table === "bonus_events" || table === "expenses") {
                    const chain: any = {
                        gte: vi.fn(() => chain),
                        lt: vi.fn(() => chain),
                        eq: vi.fn(() => chain),
                        then: (resolve: any) =>
                            resolve({ data: [], error: null }),
                    };
                    return { select: vi.fn().mockReturnValue(chain) };
                }
                if (table === "monthly_budgets") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    limit: vi.fn().mockReturnValue({
                                        maybeSingle: vi
                                            .fn()
                                            .mockImplementation(() => {
                                                if (insertedPastRow) {
                                                    return Promise.resolve({
                                                        data: {
                                                            id: sampleBudgetId,
                                                            month: pastMonth,
                                                            owner_id:
                                                                validMemberId,
                                                            gross_salary: 6000,
                                                            is_locked: false, // unlocked past month
                                                        },
                                                        error: null,
                                                    });
                                                }
                                                return Promise.resolve({
                                                    data: null,
                                                    error: null,
                                                });
                                            }),
                                    }),
                                }),
                            }),
                        }),
                        insert: vi.fn((row: any) => {
                            insertedPastRow = row;
                            return {
                                select: vi.fn().mockReturnValue({
                                    single: vi.fn().mockResolvedValue({
                                        data: { ...row, id: sampleBudgetId },
                                        error: null,
                                    }),
                                }),
                            };
                        }),
                        update: vi.fn((updates: any) => {
                            return {
                                eq: vi.fn((_col: string, idVal: string) => {
                                    if (updates.is_locked) {
                                        updatedLockId = idVal;
                                    }
                                    return Promise.resolve({ error: null });
                                }),
                            };
                        }),
                    };
                }
                if (table === "monthly_budget_categories") {
                    return {
                        insert: vi.fn().mockResolvedValue({ error: null }),
                        select: vi.fn().mockReturnValue({
                            eq: vi
                                .fn()
                                .mockResolvedValue({ data: [], error: null }),
                        }),
                    };
                }
                return {};
            });

            // 1. Newly generated past month is locked immediately
            const res1 = await supabaseFinanceService.getMonthlyBudget(
                pastMonth,
                validMemberId,
            );
            expect(insertedPastRow).toBeDefined();
            expect(insertedPastRow.is_locked).toBe(true);
            expect(res1.budget.is_locked).toBe(true);

            // 2. Existing unlocked past month gets locked on view
            const res2 = await supabaseFinanceService.getMonthlyBudget(
                pastMonth,
                validMemberId,
            );
            expect(updatedLockId).toBe(sampleBudgetId);
            expect(res2.budget.is_locked).toBe(true);
        });

        it("returns an empty 'no profile' budget when partner has no base profile, without falling back to profs[0] or 5000 salary", async () => {
            const partnerId = "00000000-0000-0000-0000-000000000099";

            mockClient.from = vi.fn((table: string) => {
                if (table === "households") {
                    return {
                        select: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: { id: validHouseholdId },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                if (table === "household_members") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: validMemberId,
                                        display_name: "Yi Jia",
                                    },
                                    { id: partnerId, display_name: "Partner" },
                                ],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "base_budget_profiles") {
                    // Only Yi Jia has a profile; Partner has NONE
                    return {
                        select: vi.fn().mockResolvedValue({
                            data: [
                                {
                                    id: validProfileId,
                                    household_id: validHouseholdId,
                                    owner_id: validMemberId,
                                    gross_salary: 8000,
                                    cpf_employee_rate: 0.2,
                                },
                            ],
                            error: null,
                        }),
                    };
                }
                if (table === "categories") {
                    return {
                        select: vi.fn().mockResolvedValue({
                            data: [{ id: validCategoryId, name: "Food" }],
                            error: null,
                        }),
                    };
                }
                if (table === "recurring_items") {
                    return {
                        select: vi
                            .fn()
                            .mockResolvedValue({ data: [], error: null }),
                    };
                }
                if (table === "bonus_events" || table === "expenses") {
                    const chain: any = {
                        gte: vi.fn(() => chain),
                        lt: vi.fn(() => chain),
                        eq: vi.fn(() => chain),
                        then: (resolve: any) =>
                            resolve({ data: [], error: null }),
                    };
                    return { select: vi.fn().mockReturnValue(chain) };
                }
                if (table === "monthly_budgets") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    limit: vi.fn().mockReturnValue({
                                        maybeSingle: vi.fn().mockResolvedValue({
                                            data: null,
                                            error: null,
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                return {};
            });

            const partnerBudgetDetail =
                await supabaseFinanceService.getMonthlyBudget(
                    currentOrFutureMonth,
                    partnerId,
                );

            expect(partnerBudgetDetail.budget.owner_id).toBe(partnerId);
            expect(partnerBudgetDetail.budget.gross_salary).toBe(0);
            expect(partnerBudgetDetail.budget.cpf_deduction).toBe(0);
            expect(partnerBudgetDetail.budget.after_deductions).toBe(0);
            expect(partnerBudgetDetail.budget.notes).toBe(
                "No base budget profile configured",
            );
            expect(partnerBudgetDetail.categories).toHaveLength(0);
        });

        it("synchronizes unlocked current and future months on salary update, leaving past months intact", async () => {
            const updatedBudgetsMap = new Map<string, any>();

            mockClient.from = vi.fn((table: string) => {
                if (table === "households") {
                    return {
                        select: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: { id: validHouseholdId },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                if (table === "base_budget_profiles") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    maybeSingle: vi.fn().mockResolvedValue({
                                        data: { id: validProfileId },
                                        error: null,
                                    }),
                                }),
                            }),
                        }),
                        upsert: vi.fn().mockReturnValue({
                            select: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: { id: validProfileId },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                if (table === "base_profile_allocations") {
                    return {
                        upsert: vi.fn().mockResolvedValue({ error: null }),
                        delete: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                not: vi.fn().mockResolvedValue({ error: null }),
                                then: (res: any) => res({ error: null }),
                            }),
                        }),
                    };
                }
                if (table === "recurring_items") {
                    return {
                        select: vi
                            .fn()
                            .mockResolvedValue({ data: [], error: null }),
                    };
                }
                if (table === "monthly_budgets") {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                gte: vi.fn(
                                    (_col: string, _minMonth: string) => ({
                                        eq: vi.fn(
                                            (
                                                _col2: string,
                                                _lockedVal: boolean,
                                            ) => {
                                                // Returns only current/future unlocked budget
                                                return Promise.resolve({
                                                    data: [
                                                        {
                                                            id: sampleBudgetId,
                                                            owner_id:
                                                                validMemberId,
                                                            month: currentOrFutureMonth,
                                                            gross_salary: 6000,
                                                            cpf_deduction: 1200,
                                                            is_locked: false,
                                                        },
                                                    ],
                                                    error: null,
                                                });
                                            },
                                        ),
                                    }),
                                ),
                            }),
                        }),
                        update: vi.fn((updates: any) => ({
                            eq: vi.fn((_col: string, id: string) => {
                                updatedBudgetsMap.set(id, updates);
                                return Promise.resolve({ error: null });
                            }),
                        })),
                    };
                }
                if (table === "monthly_budget_categories") {
                    return {
                        delete: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({ error: null }),
                        }),
                        insert: vi.fn().mockResolvedValue({ error: null }),
                    };
                }
                return {};
            });

            await supabaseFinanceService.updateBaseProfile(
                {
                    id: validProfileId,
                    household_id: validHouseholdId,
                    owner_id: validMemberId,
                    gross_salary: 7500,
                    cpf_employee_rate: 0.2,
                    tithing_enabled: true,
                },
                [
                    {
                        id: "00000000-0000-0000-0000-000000000888",
                        profile_id: validProfileId,
                        category_id: validCategoryId,
                        target_percentage: 1.0,
                    },
                ],
            );

            expect(updatedBudgetsMap.has(sampleBudgetId)).toBe(true);
            const updated = updatedBudgetsMap.get(sampleBudgetId);
            expect(updated.gross_salary).toBe(7500);
            expect(updated.cpf_deduction).toBe(1500); // 20% of 7500
            expect(updated.after_deductions).toBe(6000); // 7500 - 1500
        });

        it("throws in updateMonthlyBudget when id is missing or not a valid UUID", async () => {
            await expect(
                supabaseFinanceService.updateMonthlyBudget({} as any),
            ).rejects.toThrow("Monthly budget ID is required for update");

            await expect(
                supabaseFinanceService.updateMonthlyBudget({
                    id: "mb-dyn-2026-11-user",
                    notes: "test",
                }),
            ).rejects.toThrow(
                /Budget must be persisted with a valid UUID before update/,
            );
        });
    });
});
