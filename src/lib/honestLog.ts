/**
 * Helpers for "Honest Log" end-of-month framing:
 * - Detects when an expense is logged while monthly spendable is <= 10% left
 *   (or already over), and projects Buffer coverage / total overage.
 * - Counts consecutive logged days for a member from daily check-ins.
 */

import type {
    DailyCheckin,
    Expense,
    MonthlyBudgetCategoryDetail,
} from "../types/finance";
import { addDays } from "./bubby/dates";
import {
    computeBufferAbsorption,
    isSpendableCategory,
    type CategoryOverageItem,
} from "./financialFormulas";

export const HONEST_LOG_THRESHOLD_PCT = 90;

export interface SpendablePostLogEvaluation {
    totalAllocated: number;
    totalPrevSpent: number;
    totalNewSpent: number;
    totalNewRemaining: number;
    totalOverAmount: number;
    isTotalOver: boolean;
    isHonestLog: boolean;
    projectedCategoryStatus: CategoryOverageItem["status"] | undefined;
}

export function evaluateSpendablePostLog(
    categories: MonthlyBudgetCategoryDetail[],
    addedExpense: Pick<Expense, "category_id" | "amount">,
): SpendablePostLogEvaluation {
    const spendableCats = categories.filter((c) =>
        isSpendableCategory(c.category ?? c.category_id),
    );
    const addedAmount = Number(addedExpense.amount) || 0;
    const targetCat = spendableCats.find(
        (c) =>
            c.category_id === addedExpense.category_id ||
            c.category?.id === addedExpense.category_id,
    );
    const isUnmatched = !addedExpense.category_id || !targetCat;
    // Also verify the expense wasn't explicitly assigned to a known non-spendable category
    const matchedNonSpendable =
        !targetCat &&
        Boolean(addedExpense.category_id) &&
        categories.some(
            (c) =>
                c.category_id === addedExpense.category_id ||
                c.category?.id === addedExpense.category_id,
        );

    const totalAllocated =
        Math.round(
            spendableCats.reduce(
                (sum, c) => sum + (c.allocated_amount || 0),
                0,
            ) * 100,
        ) / 100;
    const totalPrevSpent =
        Math.round(
            spendableCats.reduce((sum, c) => sum + (c.actualSpent || 0), 0) *
                100,
        ) / 100;

    const countsTowardSpendable =
        Boolean(targetCat) || (isUnmatched && !matchedNonSpendable);
    const totalNewSpent =
        Math.round(
            (totalPrevSpent + (countsTowardSpendable ? addedAmount : 0)) * 100,
        ) / 100;
    const totalNewRemaining =
        Math.round((totalAllocated - totalNewSpent) * 100) / 100;
    const totalOverAmount = Math.max(
        0,
        Math.round(-totalNewRemaining * 100) / 100,
    );
    const isTotalOver = totalAllocated > 0 && totalNewRemaining < 0;

    const thresholdRemaining =
        Math.round(
            totalAllocated * (1 - HONEST_LOG_THRESHOLD_PCT / 100) * 100,
        ) / 100;
    const isHonestLog =
        totalAllocated > 0 &&
        countsTowardSpendable &&
        totalNewRemaining <= thresholdRemaining;

    let projectedCategoryStatus: CategoryOverageItem["status"] | undefined;
    if (targetCat) {
        const projected = categories.map((c) =>
            c === targetCat
                ? { ...c, actualSpent: (c.actualSpent || 0) + addedAmount }
                : c,
        );
        const absorption = computeBufferAbsorption(projected);
        const targetId = targetCat.category_id || targetCat.category?.id || "";
        projectedCategoryStatus =
            absorption.categoryBreakdown[targetId]?.status;
    }

    return {
        totalAllocated,
        totalPrevSpent,
        totalNewSpent,
        totalNewRemaining,
        totalOverAmount,
        isTotalOver,
        isHonestLog,
        projectedCategoryStatus,
    };
}

/**
 * Counts consecutive logged days ending today (or yesterday if today isn't
 * logged yet so an active streak remains visible before today's log).
 */
export function countConsecutiveLoggedDays(
    checkins: readonly DailyCheckin[],
    memberId: string | undefined,
    today: string,
): number {
    if (!memberId || !today) return 0;
    const dates = new Set<string>();
    for (const c of checkins) {
        if (c.member_id === memberId && c.checkin_date) {
            dates.add(c.checkin_date);
        }
    }
    if (dates.size === 0) return 0;

    let cursor = dates.has(today) ? today : addDays(today, -1);
    if (!dates.has(cursor)) return 0;

    let streak = 0;
    while (dates.has(cursor)) {
        streak += 1;
        cursor = addDays(cursor, -1);
    }
    return streak;
}
