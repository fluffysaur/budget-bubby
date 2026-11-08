/**
 * Category guess and duplicate hint for inbox items. Pure.
 *
 * Order: remembered merchant rule > this household's history for the
 * merchant > keyword table (src/lib/categoryGuess.ts) > none.
 */

import { guessCategoryId } from "../categoryGuess";
import { isSpendableCategory } from "../financialFormulas";
import { normalizeMerchant } from "./merchant";
import { shiftIsoDate, toSgtDateTime } from "./sgTime";
import type {
    Category,
    Expense,
    InboxItem,
    MerchantRule,
} from "../../types/finance";

export type GuessConfidence = "rule" | "history" | "keyword" | "none";

export interface InboxCategoryGuess {
    categoryId: string | null;
    confidence: GuessConfidence;
    /** Remembered Mine/Shared choice, when a rule has one. */
    isShared: boolean | null;
}

/** History needs at least this many past expenses for the merchant. */
export const HISTORY_MIN_HITS = 2;

export interface GuessInput {
    merchant: string;
    merchantKey: string;
    rules: readonly MerchantRule[];
    recentExpenses: readonly Expense[];
    categories: readonly Category[];
}

export function guessInboxCategory({
    merchant,
    merchantKey,
    rules,
    recentExpenses,
    categories,
}: GuessInput): InboxCategoryGuess {
    const known = new Set(categories.map((c) => c.id));

    const rule = rules.find(
        (r) => r.merchant_key === merchantKey && r.action === "categorise",
    );
    if (rule?.category_id && known.has(rule.category_id)) {
        return {
            categoryId: rule.category_id,
            confidence: "rule",
            isShared: rule.is_shared ?? null,
        };
    }

    const counts = new Map<string, number>();
    for (const e of recentExpenses) {
        if (!e.category_id || !known.has(e.category_id)) continue;
        if (normalizeMerchant(e.item) !== merchantKey) continue;
        counts.set(e.category_id, (counts.get(e.category_id) ?? 0) + 1);
    }
    let best: [string, number] | null = null;
    for (const entry of counts) {
        if (!best || entry[1] > best[1]) best = entry;
    }
    if (best && best[1] >= HISTORY_MIN_HITS) {
        return { categoryId: best[0], confidence: "history", isShared: null };
    }

    const keyword = guessCategoryId(`${merchant} ${merchantKey}`, categories);
    if (keyword)
        return { categoryId: keyword, confidence: "keyword", isShared: null };

    return { categoryId: null, confidence: "none", isShared: null };
}

/**
 * A manual expense that probably is this purchase: same payer, a date within
 * a day of the capture, and the same amount (SGD, or the same original
 * amount and currency).
 */
export function findLikelyDuplicate(
    item: Pick<InboxItem, "member_id" | "amount" | "currency" | "captured_at">,
    expenses: readonly Expense[],
): Expense | undefined {
    const sgt = toSgtDateTime(item.captured_at);
    if (!sgt) return undefined;
    const from = shiftIsoDate(sgt.date, -1);
    const to = shiftIsoDate(sgt.date, 1);
    const amount = Number(item.amount);
    return expenses.find((e) => {
        if (e.payer_id !== item.member_id) return false;
        if (e.date < from || e.date > to) return false;
        const currency = e.original_currency || "SGD";
        if (item.currency === "SGD" && currency === "SGD") {
            return Math.abs(Number(e.amount) - amount) < 0.005;
        }
        return (
            currency === item.currency &&
            e.original_amount !== null &&
            e.original_amount !== undefined &&
            Math.abs(Number(e.original_amount) - amount) < 0.005
        );
    });
}

/**
 * Up to `limit` spendable categories by how often this member used them in
 * the last 90 days, with `first` (the guess) leading.
 */
export function topCategoriesForMember(
    expenses: readonly Expense[],
    categories: readonly Category[],
    memberId: string | undefined,
    first: string | null,
    limit = 5,
    today: string = new Date().toISOString().slice(0, 10),
): Category[] {
    const since = shiftIsoDate(today, -90);
    const counts = new Map<string, number>();
    for (const e of expenses) {
        if (!e.category_id || e.date < since) continue;
        if (memberId && e.payer_id !== memberId) continue;
        counts.set(e.category_id, (counts.get(e.category_id) ?? 0) + 1);
    }
    const spendable = categories.filter((c) => isSpendableCategory(c));
    const ranked = [...spendable].sort(
        (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
    );
    const guess = categories.find((c) => c.id === first);
    const ordered = guess
        ? [guess, ...ranked.filter((c) => c.id !== guess.id)]
        : ranked;
    return ordered.slice(0, limit);
}
