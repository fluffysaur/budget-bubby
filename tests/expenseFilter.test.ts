import { describe, expect, it } from "vitest";
import { matchesExpenseFilter } from "../src/hooks/finance/expenses";
import { getFilterCategoryIds } from "../src/lib/expenseFilter";
import type { Expense } from "../src/types/finance";

const expense = (category_id: string | null): Expense =>
    ({
        id: "e1",
        date: "2026-09-10",
        category_id,
        payer_id: "m1",
        is_shared: false,
    }) as unknown as Expense;

describe("getFilterCategoryIds", () => {
    it("returns [] for no filter, no ids or an empty array", () => {
        expect(getFilterCategoryIds(undefined)).toEqual([]);
        expect(getFilterCategoryIds({})).toEqual([]);
        expect(getFilterCategoryIds({ categoryIds: [] })).toEqual([]);
    });

    it("returns categoryIds as given", () => {
        expect(getFilterCategoryIds({ categoryIds: ["a", "b"] })).toEqual([
            "a",
            "b",
        ]);
    });

    it("maps a legacy single categoryId to [categoryId]", () => {
        expect(getFilterCategoryIds({ categoryId: "a" })).toEqual(["a"]);
    });

    it("prefers categoryIds over the legacy field", () => {
        expect(
            getFilterCategoryIds({ categoryIds: ["b"], categoryId: "a" }),
        ).toEqual(["b"]);
    });
});

describe("matchesExpenseFilter category matching", () => {
    it("matches any of several category ids", () => {
        const filter = { categoryIds: ["a", "b"] };
        expect(matchesExpenseFilter(expense("a"), filter)).toBe(true);
        expect(matchesExpenseFilter(expense("b"), filter)).toBe(true);
        expect(matchesExpenseFilter(expense("c"), filter)).toBe(false);
        expect(matchesExpenseFilter(expense(null), filter)).toBe(false);
    });

    it("matches everything when categoryIds is empty", () => {
        expect(matchesExpenseFilter(expense("c"), { categoryIds: [] })).toBe(
            true,
        );
    });

    it("accepts the legacy single categoryId", () => {
        expect(matchesExpenseFilter(expense("a"), { categoryId: "a" })).toBe(
            true,
        );
        expect(matchesExpenseFilter(expense("b"), { categoryId: "a" })).toBe(
            false,
        );
    });
});
