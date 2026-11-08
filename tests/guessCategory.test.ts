import { describe, it, expect } from "vitest";
import {
    guessInboxCategory,
    findLikelyDuplicate,
    topCategoriesForMember,
} from "../src/lib/capture/guessCategory";
import type { Category, Expense, MerchantRule } from "../src/types/finance";

const cat = (id: string, name: string): Category => ({
    id,
    household_id: "h",
    name,
    color: "#000",
    icon: "x",
    is_system: false,
    group: "spendable",
});
const categories = [
    cat("food", "Food"),
    cat("transport", "Transport"),
    cat("life", "Lifestyle"),
];

const exp = (over: Partial<Expense>): Expense => ({
    id: Math.random().toString(36),
    household_id: "h",
    payer_id: "m1",
    category_id: "life",
    date: "2026-11-05",
    item: "Thing",
    amount: 10,
    is_shared: false,
    split_ratio: 0.5,
    settled: false,
    original_currency: "SGD",
    original_amount: null,
    ...over,
});

const rule = (over: Partial<MerchantRule>): MerchantRule => ({
    id: "r1",
    merchant_key: "grab food",
    action: "categorise",
    category_id: "life",
    is_shared: true,
    hit_count: 3,
    ...over,
});

describe("guessInboxCategory", () => {
    const base = {
        merchant: "Grab Food",
        merchantKey: "grab food",
        categories,
    };

    it("prefers a merchant rule", () => {
        expect(
            guessInboxCategory({
                ...base,
                rules: [rule({})],
                recentExpenses: [],
            }),
        ).toEqual({ categoryId: "life", confidence: "rule", isShared: true });
    });

    it("ignores rules for unknown categories and ignore rules", () => {
        const g = guessInboxCategory({
            ...base,
            rules: [
                rule({ category_id: "gone" }),
                rule({ id: "r2", action: "ignore", category_id: null }),
            ],
            recentExpenses: [],
        });
        expect(g.confidence).toBe("keyword");
    });

    it("uses history with at least two hits", () => {
        const history = [
            exp({ item: "GRAB*FOOD 1234", category_id: "food" }),
            exp({ item: "Grab Food", category_id: "food" }),
        ];
        expect(
            guessInboxCategory({ ...base, rules: [], recentExpenses: history })
                .confidence,
        ).toBe("history");
        expect(
            guessInboxCategory({
                ...base,
                rules: [],
                recentExpenses: history.slice(0, 1),
            }).confidence,
        ).toBe("keyword");
    });

    it("falls back to keywords, then none", () => {
        expect(
            guessInboxCategory({ ...base, rules: [], recentExpenses: [] }),
        ).toEqual({
            categoryId: "transport",
            confidence: "keyword",
            isShared: null,
        });
        expect(
            guessInboxCategory({
                merchant: "Zzz Pte Ltd",
                merchantKey: "zzz pte ltd",
                categories,
                rules: [],
                recentExpenses: [],
            }),
        ).toEqual({ categoryId: null, confidence: "none", isShared: null });
    });
});

describe("findLikelyDuplicate", () => {
    const item = {
        member_id: "m1",
        amount: 12.5,
        currency: "SGD",
        captured_at: "2026-11-05T04:00:00Z",
    };

    it("matches same payer and amount within a day", () => {
        const match = exp({ amount: 12.5, date: "2026-11-04" });
        expect(findLikelyDuplicate(item, [exp({ amount: 3 }), match])).toBe(
            match,
        );
    });

    it("skips other payers and far dates", () => {
        expect(
            findLikelyDuplicate(item, [
                exp({ amount: 12.5, payer_id: "m2" }),
                exp({ amount: 12.5, date: "2026-11-01" }),
            ]),
        ).toBeUndefined();
    });

    it("matches foreign items on the original amount", () => {
        const foreign = { ...item, amount: 4.99, currency: "USD" };
        const match = exp({
            amount: 6.6,
            original_amount: 4.99,
            original_currency: "USD",
        });
        expect(findLikelyDuplicate(foreign, [match])).toBe(match);
        expect(
            findLikelyDuplicate(foreign, [exp({ amount: 4.99 })]),
        ).toBeUndefined();
    });
});

describe("topCategoriesForMember", () => {
    it("ranks by recent use and leads with the guess", () => {
        const expenses = [
            exp({ category_id: "food" }),
            exp({ category_id: "food" }),
            exp({ category_id: "transport" }),
        ];
        const top = topCategoriesForMember(
            expenses,
            categories,
            "m1",
            "life",
            5,
            "2026-11-06",
        );
        expect(top.map((c) => c.id)).toEqual(["life", "food", "transport"]);
        expect(
            topCategoriesForMember(
                expenses,
                categories,
                "m1",
                null,
                2,
                "2026-11-06",
            ).map((c) => c.id),
        ).toEqual(["food", "transport"]);
    });
});
