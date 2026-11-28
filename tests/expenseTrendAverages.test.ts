import { describe, it, expect } from "vitest";
import {
    calculateExpenseTrends,
    isSpendableCategory,
} from "../src/lib/financialFormulas";
import { mockCategories } from "../src/data/mockSeedData";
import type { Expense } from "../src/types/finance";

const cat = mockCategories.find((c) => isSpendableCategory(c))!;

function spend(date: string, amount: number): Expense {
    return {
        id: `e-${date}`,
        household_id: "hh-00000000-0001",
        payer_id: "mem-00000000-0011",
        category_id: cat.id,
        date,
        item: "Test",
        amount,
        is_shared: false,
        split_ratio: 0,
        settled: false,
    } as Expense;
}

describe("calculateExpenseTrends averages", () => {
    it("excludes the current month from the averages", () => {
        const trends = calculateExpenseTrends(
            [
                spend("2026-08-10", 100),
                spend("2026-09-10", 200),
                spend("2026-10-10", 300),
                spend("2026-11-10", 9000),
            ],
            mockCategories,
            [],
            "household",
            undefined,
            "2026-11",
        );
        // Aug–Oct only: (100 + 200 + 300) / 3
        expect(trends.rolling3MonthAvg).toBe(200);
        expect(trends.currentMonthTotal).toBe(9000);
        expect(trends.vsAverageDelta).toBe(8800);
        const row = trends.categoryAverages.find(
            (c) => c.categoryId === cat.id,
        )!;
        expect(row.averageMonthly).toBe(200);
        expect(row.currentMonth).toBe(9000);
    });

    it("has a zero average when only the current month has spend", () => {
        const trends = calculateExpenseTrends(
            [spend("2026-11-10", 500)],
            mockCategories,
            [],
            "household",
            undefined,
            "2026-11",
        );
        expect(trends.rolling3MonthAvg).toBe(0);
    });
});
