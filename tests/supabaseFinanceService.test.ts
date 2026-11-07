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
            eq: vi.fn().mockResolvedValue({ error: null }),
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
                                    { id: validMemberId, display_name: "Yi Jia" },
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
});


