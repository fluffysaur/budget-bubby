import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    filterCategoriesForMember,
    getExpenseCategoryForMember,
    calculateExpenseTrends,
    calculateCumulativeSurplus,
    calculateSpendablePacing,
} from "../src/lib/financialFormulas";
import { mockFinanceService } from "../src/services/mockFinanceService";
import {
    supabaseFinanceService,
    resetCategoryGroupColumnSupport,
} from "../src/services/supabaseFinanceService";
import * as supabaseClientModule from "../src/services/supabaseClient";
import * as offlineSyncQueue from "../src/services/offlineSyncQueue";
import { getCurrentMonth } from "../src/lib/dateUtils";
import type { Category, Expense } from "../src/types/finance";

describe("Member-specific categories & per-member split overrides", () => {
    const m1 = "mem-00000000-0011";
    const m2 = "mem-00000000-0012";

    describe("filterCategoriesForMember", () => {
        const categories: Category[] = [
            {
                id: "cat-shared",
                household_id: "hh-1",
                name: "Food",
                color: "#F59E0B",
                icon: "utensils",
                is_system: true,
                group: "spendable",
            },
            {
                id: "cat-m1",
                household_id: "hh-1",
                member_id: m1,
                name: "Allowance",
                color: "#10B981",
                icon: "wallet",
                is_system: false,
                group: "allocation",
            },
            {
                id: "cat-m2",
                household_id: "hh-1",
                member_id: m2,
                name: "Allowance",
                color: "#EC4899",
                icon: "sparkles",
                is_system: false,
                group: "spendable",
            },
        ];

        it("returns shared + member personal categories when memberId is provided", () => {
            const m1Cats = filterCategoriesForMember(categories, m1);
            expect(m1Cats.map((c) => c.id)).toEqual(["cat-shared", "cat-m1"]);

            const m2Cats = filterCategoriesForMember(categories, m2);
            expect(m2Cats.map((c) => c.id)).toEqual(["cat-shared", "cat-m2"]);
        });

        it("returns all categories when memberId is omitted or null", () => {
            expect(filterCategoriesForMember(categories, null)).toHaveLength(3);
            expect(filterCategoriesForMember(categories)).toHaveLength(3);
        });
    });

    describe("getExpenseCategoryForMember", () => {
        const sharedWithOverride: Expense = {
            id: "exp-1",
            household_id: "hh-1",
            payer_id: m1,
            category_id: "cat-food",
            partner_category_id: "cat-hobbies",
            date: "2026-10-10",
            item: "Shared Dinner",
            amount: 100,
            is_shared: true,
            split_ratio: 0.5,
            settled: false,
        };

        it("returns category_id for payer and partner_category_id for non-paying partner", () => {
            expect(getExpenseCategoryForMember(sharedWithOverride, m1)).toBe(
                "cat-food",
            );
            expect(getExpenseCategoryForMember(sharedWithOverride, m2)).toBe(
                "cat-hobbies",
            );
        });

        it("falls back to category_id when partner_category_id is null or expense is personal", () => {
            const sharedNoOverride: Expense = {
                ...sharedWithOverride,
                partner_category_id: null,
            };
            expect(getExpenseCategoryForMember(sharedNoOverride, m2)).toBe(
                "cat-food",
            );

            const personal: Expense = {
                ...sharedWithOverride,
                is_shared: false,
            };
            expect(getExpenseCategoryForMember(personal, m2)).toBe("cat-food");
        });
    });

    describe("MockFinanceService scoping & budget attribution", () => {
        beforeEach(() => {
            mockFinanceService.resetData();
        });

        it("allows two members to create same-name personal categories without collision, but rejects duplicates in same scope", async () => {
            const cat1 = await mockFinanceService.addCategory({
                name: "Allowance",
                member_id: m1,
                group: "spendable",
            });
            const cat2 = await mockFinanceService.addCategory({
                name: "Allowance",
                member_id: m2,
                group: "spendable",
            });

            expect(cat1.id).not.toBe(cat2.id);
            expect(cat1.member_id).toBe(m1);
            expect(cat2.member_id).toBe(m2);

            await expect(
                mockFinanceService.addCategory({
                    name: "allowance",
                    member_id: m1,
                    group: "spendable",
                }),
            ).rejects.toThrow(/already exists/i);
        });

        it("attributes payer share to category_id and partner share to partner_category_id in monthly budgets", async () => {
            const m2Personal = await mockFinanceService.addCategory({
                name: "Sam Treat",
                member_id: m2,
                group: "spendable",
            });
            const profiles = await mockFinanceService.getBaseProfiles();
            const m2Profile = profiles.find((p) => p.owner_id === m2)!;
            const allocs = await mockFinanceService.getBaseAllocations(
                m2Profile.id,
            );
            await mockFinanceService.updateBaseProfile(m2Profile, [
                ...allocs,
                {
                    id: "alloc-m2-treat",
                    profile_id: m2Profile.id,
                    category_id: m2Personal.id,
                    target_percentage: 0,
                },
            ]);

            const currentMonth = getCurrentMonth();
            const beforeM1 = await mockFinanceService.getMonthlyBudget(
                currentMonth,
                m1,
            );
            const beforeM2 = await mockFinanceService.getMonthlyBudget(
                currentMonth,
                m2,
            );
            const m1FoodBefore =
                beforeM1?.categories.find(
                    (c) => c.category_id === "cat-00000000-0101",
                )?.actualSpent ?? 0;
            const m2FoodBefore =
                beforeM2?.categories.find(
                    (c) => c.category_id === "cat-00000000-0101",
                )?.actualSpent ?? 0;

            await mockFinanceService.addExpense({
                payer_id: m1,
                category_id: "cat-00000000-0101", // Food
                partner_category_id: m2Personal.id,
                date: `${currentMonth}-20`,
                item: "Special Treat",
                amount: 100,
                is_shared: true,
                split_ratio: 0.4,
            });

            const afterM1 = await mockFinanceService.getMonthlyBudget(
                currentMonth,
                m1,
            );
            const afterM2 = await mockFinanceService.getMonthlyBudget(
                currentMonth,
                m2,
            );

            const m1FoodAfter =
                afterM1?.categories.find(
                    (c) => c.category_id === "cat-00000000-0101",
                )?.actualSpent ?? 0;
            const m2FoodAfter =
                afterM2?.categories.find(
                    (c) => c.category_id === "cat-00000000-0101",
                )?.actualSpent ?? 0;
            const m2TreatAfter =
                afterM2?.categories.find((c) => c.category_id === m2Personal.id)
                    ?.actualSpent ?? 0;

            expect(m1FoodAfter - m1FoodBefore).toBeCloseTo(60, 2);
            expect(m2FoodAfter - m2FoodBefore).toBeCloseTo(0, 2);
            expect(m2TreatAfter).toBeCloseTo(40, 2);
        });
    });

    describe("Formula attribution with partner_category_id", () => {
        const categories: Category[] = [
            {
                id: "cat-food",
                household_id: "hh-1",
                name: "Food",
                color: "#F59E0B",
                icon: "utensils",
                is_system: true,
                group: "spendable",
            },
            {
                id: "cat-inv",
                household_id: "hh-1",
                name: "Investments",
                color: "#10B981",
                icon: "trending-up",
                is_system: true,
                group: "allocation",
            },
            {
                id: "cat-m2",
                household_id: "hh-1",
                member_id: m2,
                name: "Hobbies",
                color: "#EC4899",
                icon: "sparkles",
                is_system: false,
                group: "spendable",
            },
        ];

        const expenses: Expense[] = [
            {
                id: "exp-split",
                household_id: "hh-1",
                payer_id: m1,
                category_id: "cat-food",
                partner_category_id: "cat-inv",
                date: "2026-10-12",
                item: "Split Food vs Inv",
                amount: 100,
                is_shared: true,
                split_ratio: 0.3,
                settled: false,
            },
        ];

        it("attributes shares accurately in trends, surplus, and pacing", () => {
            const hhTrends = calculateExpenseTrends(
                expenses,
                categories,
                [],
                "household",
                undefined,
                "2026-10",
                1,
            );
            expect(hhTrends.monthlySeries[0].byCategory["cat-food"]).toBe(70);
            expect(hhTrends.monthlySeries[0].totalSpent).toBe(70);

            const m2Trends = calculateExpenseTrends(
                expenses,
                categories,
                [],
                "personal",
                m2,
                "2026-10",
                1,
            );
            expect(m2Trends.monthlySeries[0].totalSpent).toBe(0);

            const surplus = calculateCumulativeSurplus({
                months: ["2026-10"],
                monthlyCap: 100,
                expenses,
                categories,
                perspective: "household",
            });
            expect(surplus.currentMonthSurplus).toBe(30);

            const pacing = calculateSpendablePacing({
                month: "2026-10",
                perspective: "household",
                expenses,
                categories,
                monthlyCap: 100,
                todayDate: "2026-10-15",
            });
            expect(pacing.spendableSpent).toBe(70);
        });
    });

    describe("supabaseFinanceService column mapping & fallbacks", () => {
        const householdId = "00000000-0000-0000-0000-000000000001";
        const memberId = "00000000-0000-0000-0000-000000000011";
        const catId = "00000000-0000-0000-0000-000000000101";
        const partnerCatId = "00000000-0000-0000-0000-000000000102";

        beforeEach(() => {
            vi.restoreAllMocks();
            resetCategoryGroupColumnSupport();
        });

        it("writes member_id on addCategory and retries without it if column missing", async () => {
            const missingCol = {
                code: "42703",
                message: 'column "member_id" does not exist',
            };
            const seenPayloads: Array<Record<string, unknown>> = [];
            const insertSpy = vi.fn().mockImplementation((payload: any) => {
                seenPayloads.push({ ...payload });
                return {
                    select: () => ({
                        single: vi.fn().mockImplementation(async () => {
                            if ("member_id" in payload) {
                                return { data: null, error: missingCol };
                            }
                            return {
                                data: {
                                    id: catId,
                                    household_id: householdId,
                                    ...payload,
                                },
                                error: null,
                            };
                        }),
                    }),
                };
            });

            vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue({
                from: vi.fn(() => ({ insert: insertSpy })),
            } as any);

            const created = await supabaseFinanceService.addCategory({
                household_id: householdId,
                member_id: memberId,
                name: "Personal",
                group: "spendable",
            });

            expect(insertSpy).toHaveBeenCalledTimes(2);
            expect("member_id" in seenPayloads[0]).toBe(true);
            expect("member_id" in seenPayloads[1]).toBe(false);
            expect(created.id).toBe(catId);
        });

        it("writes partner_category_id on addExpense and updateExpense", async () => {
            const insertSpy = vi.fn().mockImplementation((payload: any) => ({
                select: vi.fn().mockResolvedValue({
                    data: [{ id: "exp-1", ...payload }],
                    error: null,
                }),
            }));
            const updateSpy = vi.fn().mockImplementation((payload: any) => ({
                eq: () => ({
                    select: () => ({
                        single: vi.fn().mockResolvedValue({
                            data: { id: "exp-1", ...payload },
                            error: null,
                        }),
                    }),
                }),
            }));

            vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue({
                from: vi.fn((table: string) =>
                    table === "expenses"
                        ? { insert: insertSpy, update: updateSpy }
                        : {
                              upsert: vi.fn().mockResolvedValue({ error: null }),
                          },
                ),
            } as any);

            const added = await supabaseFinanceService.addExpense({
                household_id: householdId,
                payer_id: memberId,
                category_id: catId,
                partner_category_id: partnerCatId,
                date: "2026-10-10",
                item: "Dinner",
                amount: 50,
                is_shared: true,
            });
            expect(added.partner_category_id).toBe(partnerCatId);

            const updated = await supabaseFinanceService.updateExpense(
                "exp-1",
                {
                    partner_category_id: null,
                },
            );
            expect(updated.partner_category_id).toBeNull();
        });
    });

    describe("offlineSyncQueue partner_category_id preservation", () => {
        beforeEach(() => {
            mockFinanceService.resetData();
            offlineSyncQueue.clearPendingMutations();
            vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        });

        it("preserves partner_category_id on offline addExpense and updateExpense", async () => {
            const added = await offlineSyncQueue.addExpense({
                payer_id: m1,
                category_id: "cat-00000000-0101",
                partner_category_id: "cat-00000000-0102",
                date: "2026-10-10",
                item: "Offline Shared",
                amount: 40,
                is_shared: true,
            });

            expect(added.partner_category_id).toBe("cat-00000000-0102");

            const updated = await offlineSyncQueue.updateExpense(added.id, {
                partner_category_id: "cat-00000000-0103",
            });

            expect(updated.partner_category_id).toBe("cat-00000000-0103");
        });
    });
});
