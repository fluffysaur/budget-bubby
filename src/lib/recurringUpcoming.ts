/**
 * Upcoming recurring changes: items that start or end after today, for the
 * Recurring page's "Upcoming Changes" list.
 */

import { formatMonth } from "./dateUtils";
import {
    getRecurringMonthlyAmount,
    isSpendType,
    resolveRecurringStartDate,
} from "./recurringItems";
import type { RecurringItem, SavingsGoal } from "../types/finance";

export interface UpcomingChange {
    id: string;
    name: string;
    kind: "starts" | "ends";
    /** 'YYYY-MM-DD' */
    date: string;
    /** 'YYYY-MM' for display. */
    month: string;
    /** Monthly amount: negative when a cost starts, positive when one ends. */
    monthlyDelta: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Changes dated after `today` ('YYYY-MM-DD'), soonest first. */
export function upcomingRecurringChanges(
    items: readonly RecurringItem[],
    today: string,
    goals?: readonly Pick<SavingsGoal, "id" | "target_date">[],
): UpcomingChange[] {
    const goalsById = goals ? new Map(goals.map((g) => [g.id, g])) : undefined;
    const out: UpcomingChange[] = [];
    for (const item of items) {
        // Spend items only, matching what the forecast counts.
        if (!isSpendType(item.type)) continue;
        const amount = round2(getRecurringMonthlyAmount(item));
        if (amount <= 0) continue;
        const start = resolveRecurringStartDate(item, goalsById);
        if (start && start > today) {
            out.push({
                id: `${item.id}-starts`,
                name: item.name,
                kind: "starts",
                date: start,
                month: formatMonth(start),
                monthlyDelta: -amount,
            });
        }
        if (item.end_date && item.end_date > today) {
            out.push({
                id: `${item.id}-ends`,
                name: item.name,
                kind: "ends",
                date: item.end_date,
                month: formatMonth(item.end_date),
                monthlyDelta: amount,
            });
        }
    }
    return out.sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
}
