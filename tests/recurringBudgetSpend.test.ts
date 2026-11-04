/**
 * Monthly budget detail: recurring subscription/bill/other spend counts toward
 * each item's own category (or an "Uncategorized" total), in both the mock and
 * Supabase finance services.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockFinanceService } from "../src/services/mockFinanceService";
import { supabaseFinanceService } from "../src/services/supabaseFinanceService";
import * as supabaseClientModule from "../src/services/supabaseClient";
import { mockMembers } from "../src/data/mockSeedData";
import type {
    MonthlyBudgetDetail,
    RecurringItem,
} from "../src/types/finance";

const FOOD = "cat-00000000-0101";
const LIFESTYLE = "cat-00000000-0102";

const spentFor = (detail: MonthlyBudgetDetail, categoryId: string) =>
    detail.categories.find((c) => c.category_id === categoryId)?.actualSpent ??
    0;

describe("mockFinanceService recurring spend by category", () => {
    const yiJia = mockMembers.find((m) => m.display_name === "Yi Jia")!;

    beforeEach(() => {
        mockFinanceService.resetData();
    });

    it("counts seeded subscriptions toward Lifestyle via category_id", async () => {
        const detail = await mockFinanceService.getMonthlyBudget(
            "2026-11",
            yiJia.id,
        );
        const lifestyle = detail.categories.find(
            (c) => c.category_id === LIFESTYLE,
        )!;
        // Spotify 3.5 + Prime 4.99 + HBO 9.65 + Google AI 28.99 + Simba 0
        expect(lifestyle.recurringSpent).toBe(47.13);
        expect(lifestyle.recurringItems?.map((i) => i.name)).toContain(
            "Spotify (Family)",
        );
        const food = detail.categories.find((c) => c.category_id === FOOD)!;
        expect(food.recurringSpent).toBe(0);
    });

    it("adds bills to their own category, annual items amortized, uncategorized to total only", async () => {
        const before = await mockFinanceService.getMonthlyBudget(
            "2026-11",
            yiJia.id,
        );

        await mockFinanceService.addRecurringItem({
            owner_id: yiJia.id,
            type: "bill",
            name: "Meal Plan",
            amount: 120,
            frequency: "monthly",
            due_day: 5,
            category_id: FOOD,
        });
        await mockFinanceService.addRecurringItem({
            owner_id: yiJia.id,
            type: "other",
            name: "Cloud Storage",
            amount: 120,
            frequency: "annually",
            payment_month: 3,
            category_id: FOOD,
        });
        await mockFinanceService.addRecurringItem({
            owner_id: yiJia.id,
            type: "other",
            name: "Mystery Box",
            amount: 25,
            frequency: "monthly",
            due_day: 1,
            category_id: null,
        });
        await mockFinanceService.addRecurringItem({
            owner_id: yiJia.id,
            type: "bill",
            name: "Future Gym",
            amount: 80,
            frequency: "monthly",
            due_day: 1,
            start_date: "2027-01-01",
            category_id: FOOD,
        });
        await mockFinanceService.addRecurringItem({
            owner_id: yiJia.id,
            type: "insurance",
            name: "Travel Insurance",
            amount: 240,
            frequency: "annually",
            payment_month: 6,
            category_id: FOOD, // ignored: insurance never counts as spend
        });

        const after = await mockFinanceService.getMonthlyBudget(
            "2026-11",
            yiJia.id,
        );

        // Food: +120 (monthly bill) + 10 (annual 120 / 12); Future Gym not active yet
        expect(
            Math.round((spentFor(after, FOOD) - spentFor(before, FOOD)) * 100) /
                100,
        ).toBe(130);
        expect(
            after.categories.find((c) => c.category_id === FOOD)!.recurringSpent,
        ).toBe(130);
        expect(spentFor(after, LIFESTYLE)).toBe(spentFor(before, LIFESTYLE));

        expect(after.uncategorizedRecurringSpent).toBe(25);
        expect(after.uncategorizedRecurringItems?.map((i) => i.name)).toEqual([
            "Mystery Box",
        ]);

        // Total spend includes category spend + uncategorized line
        expect(Math.round((after.totalSpent - before.totalSpent) * 100) / 100).toBe(
            155,
        );

        // Starting January, the gym bill counts too
        const jan = await mockFinanceService.getMonthlyBudget("2027-01", yiJia.id);
        expect(
            jan.categories.find((c) => c.category_id === FOOD)!.recurringSpent,
        ).toBe(210);
    });

    it("clears category_id when an item becomes insurance or tax", async () => {
        const created = await mockFinanceService.addRecurringItem({
            owner_id: yiJia.id,
            type: "bill",
            name: "Phone",
            amount: 30,
            frequency: "monthly",
            due_day: 10,
            category_id: FOOD,
        });
        expect(created.category_id).toBe(FOOD);
        const updated = await mockFinanceService.updateRecurringItem(created.id, {
            type: "insurance",
        });
        expect(updated.category_id).toBeNull();
    });
});

describe("supabaseFinanceService recurring spend by category", () => {
    const ownerId = "00000000-0000-0000-0000-000000000011";
    const budgetId = "00000000-0000-0000-0000-000000000701";

    function chain(result: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = {};
        for (const m of ["select", "eq", "gte", "lt", "limit", "order"]) {
            obj[m] = vi.fn(() => obj);
        }
        obj.maybeSingle = vi.fn().mockResolvedValue(result);
        obj.single = vi.fn().mockResolvedValue(result);
        obj.then = (
            resolve: (v: unknown) => unknown,
            reject: (e: unknown) => unknown,
        ) => Promise.resolve(result).then(resolve, reject);
        return obj;
    }

    const item = (overrides: Partial<RecurringItem>): RecurringItem => ({
        id: overrides.id ?? "ri",
        household_id: "hh",
        owner_id: ownerId,
        type: "bill",
        name: "Item",
        amount: 10,
        frequency: "monthly",
        payment_month: null,
        start_date: null,
        end_date: null,
        notes: null,
        monthly_amortized_amount: 10,
        due_day: 1,
        category_id: null,
        ...overrides,
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        const recurringItems = [
            item({ id: "netflix", type: "subscription", amount: 20, monthly_amortized_amount: 20, category_id: LIFESTYLE }),
            item({ id: "power", amount: 90, monthly_amortized_amount: 90, category_id: FOOD }),
            item({ id: "annual", type: "other", frequency: "annually", payment_month: 2, amount: 120, monthly_amortized_amount: 10, category_id: FOOD }),
            item({ id: "loose", type: "other", amount: 7, monthly_amortized_amount: 7, category_id: null }),
            item({ id: "ended", amount: 50, monthly_amortized_amount: 50, end_date: "2026-10-31", category_id: FOOD }),
            item({ id: "other-owner", owner_id: "someone-else", amount: 99, monthly_amortized_amount: 99, category_id: FOOD }),
        ];
        const tables: Record<string, unknown> = {
            monthly_budgets: {
                data: {
                    id: budgetId,
                    household_id: "hh",
                    owner_id: ownerId,
                    month: "2026-11",
                    gross_salary: 6000,
                    bonus: 0,
                    cpf_deduction: 1200,
                    taxes_deduction: 0,
                    insurance_deduction: 0,
                    after_deductions: 4800,
                    is_locked: false,
                },
                error: null,
            },
            monthly_budget_categories: {
                data: [
                    { id: "mbc-food", monthly_budget_id: budgetId, category_id: FOOD, percentage: 0.2, allocated_amount: 960, categories: { id: FOOD, household_id: "hh", name: "Food", color: "#000", icon: "utensils", is_system: false } },
                    { id: "mbc-life", monthly_budget_id: budgetId, category_id: LIFESTYLE, percentage: 0.2, allocated_amount: 960, categories: { id: LIFESTYLE, household_id: "hh", name: "Lifestyle", color: "#000", icon: "sparkles", is_system: false } },
                ],
                error: null,
            },
            expenses: { data: [], error: null },
            recurring_items: { data: recurringItems, error: null },
        };
        const mockClient = {
            from: vi.fn((table: string) => chain(tables[table] ?? { data: [], error: null })),
        };
        vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue(
            mockClient as never,
        );
    });

    it("reads from recurring_items and assigns spend per category", async () => {
        const detail = await supabaseFinanceService.getMonthlyBudget("2026-11", ownerId);

        const food = detail.categories.find((c) => c.category_id === FOOD)!;
        const lifestyle = detail.categories.find((c) => c.category_id === LIFESTYLE)!;
        expect(food.recurringSpent).toBe(100); // 90 monthly + 10 amortized
        expect(food.actualSpent).toBe(100);
        expect(lifestyle.recurringSpent).toBe(20);
        expect(detail.uncategorizedRecurringSpent).toBe(7);
        expect(detail.totalSpent).toBe(127);
        expect(food.recurringItems?.map((i) => i.id)).toEqual(["power", "annual"]);
    });
});
