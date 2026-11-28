/**
 * Spend tag aggregation: totals, counts, category split and recency per tag.
 */

import type { Category, Expense } from "../types/finance";
import { normalizeExpenseTag } from "./expenseFormDraft";

export interface TagCategoryShare {
    id: string;
    name: string;
    color: string;
    amount: number;
}

export interface TagAggregate {
    tag: string;
    totalAmount: number;
    transactionCount: number;
    /** Latest expense date (YYYY-MM-DD) carrying this tag. */
    lastUsed: string;
    categories: TagCategoryShare[];
}

const FALLBACK_CATEGORY_COLOR = "var(--text-faint)";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Case-insensitive tag equality after normalisation. */
export function isSameTag(a: string | undefined, b: string | undefined) {
    if (!a || !b) return false;
    return (
        normalizeExpenseTag(a).toLowerCase() ===
        normalizeExpenseTag(b).toLowerCase()
    );
}

/**
 * Aggregates expenses by tag, most recently used first
 * (ties broken by larger total, then name).
 */
export function aggregateSpendTags(
    expenses: Expense[],
    categories: Category[] = [],
): TagAggregate[] {
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const tagMap = new Map<
        string,
        {
            tag: string;
            total: number;
            count: number;
            lastUsed: string;
            cats: Map<string, number>;
        }
    >();

    for (const exp of expenses) {
        if (!exp.tags || exp.tags.length === 0) continue;
        for (const rawTag of exp.tags) {
            const clean = normalizeExpenseTag(rawTag);
            if (!clean) continue;
            const key = clean.toLowerCase();
            let entry = tagMap.get(key);
            if (!entry) {
                entry = {
                    tag: clean,
                    total: 0,
                    count: 0,
                    lastUsed: "",
                    cats: new Map(),
                };
                tagMap.set(key, entry);
            }
            entry.total += exp.amount;
            entry.count += 1;
            if (exp.date > entry.lastUsed) entry.lastUsed = exp.date;
            if (exp.category_id) {
                entry.cats.set(
                    exp.category_id,
                    (entry.cats.get(exp.category_id) ?? 0) + exp.amount,
                );
            }
        }
    }

    const result: TagAggregate[] = [];
    for (const entry of tagMap.values()) {
        const cats: TagCategoryShare[] = [];
        for (const [id, amount] of entry.cats) {
            const cat = categoryMap.get(id);
            cats.push({
                id,
                name: cat?.name ?? "Other",
                color: cat?.color ?? FALLBACK_CATEGORY_COLOR,
                amount: round2(amount),
            });
        }
        cats.sort((a, b) => b.amount - a.amount);
        result.push({
            tag: entry.tag,
            totalAmount: round2(entry.total),
            transactionCount: entry.count,
            lastUsed: entry.lastUsed,
            categories: cats,
        });
    }

    result.sort(
        (a, b) =>
            b.lastUsed.localeCompare(a.lastUsed) ||
            b.totalAmount - a.totalAmount ||
            a.tag.localeCompare(b.tag),
    );
    return result;
}
