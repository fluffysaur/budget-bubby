import { describe, it, expect } from "vitest";
import { combineMonthlyBudgets } from "../src/lib/combineMonthlyBudgets";
import { calculateSpendablePacing } from "../src/lib/financialFormulas";
import type { MonthlyBudgetDetail } from "../src/types/finance";

function memberBudget(owner: string, food: { allocated: number; spent: number }): MonthlyBudgetDetail {
    return {
        budget: {
            id: `mb-${owner}`,
            household_id: "hh-1",
            owner_id: owner,
            month: "2026-11",
            gross_salary: 5000,
            bonus: 0,
            cpf_deduction: 1000,
            taxes_deduction: 100,
            insurance_deduction: 100,
            after_deductions: 3800,
            is_locked: false,
        },
        categories: [
            {
                id: `mbc-${owner}-food`,
                monthly_budget_id: `mb-${owner}`,
                category_id: "cat-food",
                percentage: food.allocated / 3800,
                allocated_amount: food.allocated,
                actualSpent: food.spent,
                remaining: food.allocated - food.spent,
            },
        ],
        disposablePool: 3800,
        totalSpent: food.spent,
        totalRemaining: 3800 - food.spent,
        spendableAllocated: food.allocated,
        spendableSpent: food.spent,
        spendableRemaining: food.allocated - food.spent,
    };
}

describe("combineMonthlyBudgets", () => {
    it("sums bonus summaries and keeps the bonus out of take-home", () => {
        const a = memberBudget("m1", { allocated: 600, spent: 0 });
        a.budget.bonus = 10000;
        a.bonusSummary = { gross: 10000, cpf: 2000, net: 8000, count: 1, source: "events" };
        const b = memberBudget("m2", { allocated: 400, spent: 0 });
        b.budget.bonus = 1500;
        b.bonusSummary = { gross: 1500, cpf: 0, net: 1500, count: 0, source: "legacy" };

        const combined = combineMonthlyBudgets([a, b], "2026-11")!;
        expect(combined.budget.bonus).toBe(11500);
        expect(combined.bonusSummary).toEqual({ gross: 11500, cpf: 2000, net: 9500, count: 1, source: "events" });
        expect(combined.budget.after_deductions).toBe(7600);
        expect(combined.disposablePool).toBe(7600);
    });

    it("returns null with no member budgets", () => {
        expect(combineMonthlyBudgets([], "2026-11")).toBeNull();
    });

    it("sums both members into one household budget", () => {
        const combined = combineMonthlyBudgets(
            [memberBudget("m1", { allocated: 600, spent: 100 }), memberBudget("m2", { allocated: 400, spent: 50.5 })],
            "2026-11",
        )!;

        expect(combined.budget.owner_id).toBe("household");
        expect(combined.budget.after_deductions).toBe(7600);
        expect(combined.categories).toHaveLength(1);
        expect(combined.categories[0].allocated_amount).toBe(1000);
        expect(combined.categories[0].actualSpent).toBe(150.5);
        expect(combined.categories[0].remaining).toBe(849.5);
        expect(combined.spendableAllocated).toBe(1000);
        expect(combined.spendableSpent).toBe(150.5);
        expect(combined.spendableRemaining).toBe(849.5);
        expect(combined.totalRemaining).toBe(7600 - 150.5);
    });

    it("leaves spendable totals unset when a member budget lacks them", () => {
        const partial = memberBudget("m2", { allocated: 400, spent: 50 });
        delete partial.spendableSpent;
        const combined = combineMonthlyBudgets([memberBudget("m1", { allocated: 600, spent: 100 }), partial], "2026-11")!;
        expect(combined.spendableSpent).toBeUndefined();
        expect(combined.spendableAllocated).toBe(1000);
    });

    it("counts joint recurring items once (100%) and deduplicates recurring item lists when combining members (M1)", () => {
        const jointBill = {
            id: "ri-joint-internet",
            household_id: "hh-1",
            owner_id: "joint",
            type: "bill" as const,
            name: "Home Fibre",
            amount: 60,
            frequency: "monthly" as const,
            monthly_amortized_amount: 60,
            category_id: "cat-food",
        };
        const m1 = memberBudget("m1", { allocated: 600, spent: 30 });
        m1.categories[0].recurringSpent = 30;
        m1.categories[0].recurringItems = [jointBill];

        const m2 = memberBudget("m2", { allocated: 400, spent: 30 });
        m2.categories[0].recurringSpent = 30;
        m2.categories[0].recurringItems = [jointBill];

        const combined = combineMonthlyBudgets([m1, m2], "2026-11")!;
        expect(combined.categories[0].recurringSpent).toBe(60);
        expect(combined.categories[0].actualSpent).toBe(60);
        expect(combined.categories[0].recurringItems).toHaveLength(1);
        expect(combined.categories[0].recurringItems?.[0].id).toBe("ri-joint-internet");
    });
});

describe("calculateSpendablePacing with a monthly budget", () => {
    it("uses the budget's limit and spent figure so it matches Home and Budget", () => {
        const budget = memberBudget("m1", { allocated: 1000, spent: 250 });
        const pacing = calculateSpendablePacing({
            month: "2026-11",
            todayDate: "2026-11-04",
            expenses: [],
            monthlyBudget: budget,
        });
        expect(pacing.spendableAllocated).toBe(1000);
        expect(pacing.spendableSpent).toBe(250);
        expect(pacing.spendableRemaining).toBe(750);
    });
});
