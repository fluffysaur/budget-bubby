/**
 * Recurring item helpers shared by the finance services and the Recurring UI.
 *
 * - Insurance and tax reduce take-home pay (see calculateMemberRecurringDeductions).
 * - Subscription, bill and other items count as spending toward their own
 *   budget category (or "Uncategorized" when no category is set).
 */

import {
    FileText,
    Package,
    Repeat,
    Shield,
    Zap,
    type LucideIcon,
} from "lucide-react";
import type {
    RecurringFrequency,
    RecurringItem,
    RecurringItemType,
} from "../types/finance";
import { formatMonth } from "./dateUtils";
import type { BadgeVariant } from "../components/ui/Badge";

export const RECURRING_TYPE_ICONS: Record<RecurringItemType, LucideIcon> = {
    insurance: Shield,
    tax: FileText,
    subscription: Repeat,
    bill: Zap,
    other: Package,
};

export const RECURRING_TYPE_BADGE_VARIANTS: Record<
    RecurringItemType,
    BadgeVariant
> = {
    insurance: "lilac",
    tax: "coral",
    subscription: "mint",
    bill: "butter",
    other: "slate",
};

export const RECURRING_ITEM_TYPES: readonly RecurringItemType[] = [
    "insurance",
    "tax",
    "subscription",
    "bill",
    "other",
] as const;

export const RECURRING_TYPE_LABELS: Record<RecurringItemType, string> = {
    insurance: "Insurance",
    tax: "Tax",
    subscription: "Subscription",
    bill: "Bill",
    other: "Other",
};

/** Insurance and tax are payroll-style deductions that reduce take-home pay. */
export function isDeductionType(type: RecurringItemType): boolean {
    return type === "insurance" || type === "tax";
}

/** Subscription, bill and other items are spending tracked against a budget category. */
export function isSpendType(type: RecurringItemType): boolean {
    return !isDeductionType(type);
}

/**
 * Normalizes a due day for storage: an integer 1-31, required (default 1)
 * for monthly items and optional (null) for annual items.
 */
export function resolveDueDay(
    frequency: RecurringFrequency,
    dueDay?: number | null,
): number | null {
    const n = Number(dueDay);
    if (dueDay !== null && dueDay !== undefined && Number.isFinite(n)) {
        return Math.min(31, Math.max(1, Math.round(n)));
    }
    return frequency === "monthly" ? 1 : null;
}

/** Returns the monthly cost of an item: full amount if monthly, amortized if annual. */
export function getRecurringMonthlyAmount(item: RecurringItem): number {
    if (item.frequency === "monthly") {
        return Number(item.amount) || 0;
    }
    if (
        item.monthly_amortized_amount !== undefined &&
        item.monthly_amortized_amount !== null
    ) {
        return Number(item.monthly_amortized_amount) || 0;
    }
    return (Number(item.amount) || 0) / 12;
}

/**
 * True if the item is active in the given 'YYYY-MM' month, based on its
 * optional start_date and end_date (compared at month granularity).
 */
export function isRecurringItemActiveInMonth(
    item: RecurringItem,
    month: string,
): boolean {
    const target = formatMonth(month);
    if (item.start_date && formatMonth(item.start_date) > target) {
        return false;
    }
    if (item.end_date && formatMonth(item.end_date) < target) {
        return false;
    }
    return true;
}

/** True if the item belongs to the member (or is joint). No member = all items. */
export function isRecurringItemOwnedBy(
    item: RecurringItem,
    ownerId?: string | null,
): boolean {
    if (!ownerId || ownerId === "household") return true;
    return item.owner_id === ownerId || item.owner_id === "joint";
}

export interface RecurringSpendBucket {
    total: number;
    items: RecurringItem[];
}

export interface RecurringCategorySpend {
    /** Spend per category_id for items whose category is in `knownCategoryIds` (or any, if omitted). */
    byCategory: Record<string, RecurringSpendBucket>;
    /** Items with no category (or a category outside `knownCategoryIds`). */
    uncategorized: RecurringSpendBucket;
    total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Groups a member's active subscription/bill/other items by spend category
 * for one month. Monthly items count in full; annual items count their
 * amortized monthly amount.
 */
export function calculateRecurringCategorySpend(
    items: RecurringItem[] = [],
    month: string,
    options: {
        ownerId?: string | null;
        knownCategoryIds?: Iterable<string>;
    } = {},
): RecurringCategorySpend {
    const known = options.knownCategoryIds
        ? new Set(options.knownCategoryIds)
        : null;
    const byCategory: Record<string, RecurringSpendBucket> = {};
    const uncategorized: RecurringSpendBucket = { total: 0, items: [] };
    let total = 0;

    for (const item of items || []) {
        if (!isSpendType(item.type)) continue;
        if (!isRecurringItemOwnedBy(item, options.ownerId)) continue;
        if (!isRecurringItemActiveInMonth(item, month)) continue;

        const amount = getRecurringMonthlyAmount(item);
        total += amount;

        const categoryId = item.category_id;
        const bucket =
            categoryId && (!known || known.has(categoryId))
                ? (byCategory[categoryId] ??= { total: 0, items: [] })
                : uncategorized;
        bucket.total = round2(bucket.total + amount);
        bucket.items.push(item);
    }

    return { byCategory, uncategorized, total: round2(total) };
}

/**
 * Picks the household's default spend category for new subscription/bill/other
 * items: the first category whose name contains "lifestyle".
 */
export function findDefaultRecurringCategoryId(
    categories: { id: string; name: string }[] = [],
): string | null {
    const match = categories.find((c) =>
        c.name.toLowerCase().includes("lifestyle"),
    );
    return match?.id ?? null;
}
