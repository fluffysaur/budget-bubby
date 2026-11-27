import { describe, it, expect } from "vitest";
import { aggregateSpendTags, isSameTag } from "../src/lib/spendTags";
import type { Category, Expense } from "../src/types/finance";

const cats = [
    { id: "food", name: "Food", color: "#111111" },
    { id: "fun", name: "Fun", color: "#222222" },
] as Category[];

function exp(
    id: string,
    date: string,
    amount: number,
    tags: string[],
    category_id = "food",
): Expense {
    return {
        id,
        household_id: "hh",
        payer_id: "m1",
        category_id,
        date,
        item: id,
        amount,
        is_shared: false,
        split_ratio: 0,
        settled: false,
        tags,
    } as Expense;
}

describe("aggregateSpendTags", () => {
    it("totals, counts and splits categories per tag", () => {
        const result = aggregateSpendTags(
            [
                exp("a", "2026-10-01", 45, ["Trip"]),
                exp("b", "2026-10-02", 25.5, ["Trip"], "fun"),
                exp("c", "2026-10-03", 5, []),
            ],
            cats,
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            tag: "Trip",
            totalAmount: 70.5,
            transactionCount: 2,
            lastUsed: "2026-10-02",
        });
        expect(result[0].categories.map((c) => c.name)).toEqual([
            "Food",
            "Fun",
        ]);
    });

    it("orders most recently used first", () => {
        const result = aggregateSpendTags([
            exp("a", "2026-01-01", 900, ["Old"]),
            exp("b", "2026-11-01", 1, ["New"]),
            exp("c", "2026-06-01", 50, ["Mid"]),
        ]);
        expect(result.map((r) => r.tag)).toEqual(["New", "Mid", "Old"]);
    });

    it("merges tags case-insensitively and strips the leading #", () => {
        const result = aggregateSpendTags([
            exp("a", "2026-10-01", 10, ["#Bali"]),
            exp("b", "2026-10-02", 20, ["bali"]),
            exp("c", "2026-10-03", 5, ["  "]),
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].tag).toBe("Bali");
        expect(result[0].totalAmount).toBe(30);
    });

    it("falls back to Other for unknown categories", () => {
        const result = aggregateSpendTags([
            exp("a", "2026-10-01", 10, ["X"], "missing"),
        ]);
        expect(result[0].categories[0].name).toBe("Other");
    });
});

describe("isSameTag", () => {
    it("compares normalised, case-insensitive", () => {
        expect(isSameTag("#Bali", "bali")).toBe(true);
        expect(isSameTag(undefined, "bali")).toBe(false);
        expect(isSameTag("a", "b")).toBe(false);
    });
});
