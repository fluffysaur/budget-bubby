/**
 * Life events: dated changes to monthly savings, read from recurring items
 * with a future start or end date (childcare starting, a mortgage, rent
 * ending). See docs/plans/2026-11-18-roadmap.md, decision 12.
 *
 * - A change applies to future months only (after the last balance update).
 * - Once the baseline window covers a change's first month, the baseline
 *   already reflects it, so the change is dropped and never counted twice.
 * - Only spend items (subscription, bill, other) count, matching the
 *   baseline, which reads the same items as spending.
 * - Items "Paid from CPF OA" change OA growth instead of cash savings, so
 *   they are read by `oaEventsFromRecurring`, never here.
 */

import { addMonths, formatMonth, monthsBetween } from "../dateUtils";
import { getRecurringMonthlyAmount, isSpendType } from "../recurringItems";
import type { RecurringItem } from "../../types/finance";

/** A dated change to monthly savings. */
export interface CashFlowChange {
    id: string;
    name: string;
    /** "starts": a new cost begins; "ends": an existing cost stops. */
    kind: "starts" | "ends";
    /** 'YYYY-MM': the first month the change applies. */
    startMonth: string;
    /** 'YYYY-MM': the last month it applies, or null for open-ended. */
    endMonth: string | null;
    /** Change to monthly savings: negative for a new cost, positive when one ends. */
    monthlyDelta: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Life events from recurring items. `coveredThrough` ('YYYY-MM') is the last
 * month the baseline already reflects; changes from then on are dropped.
 */
export function lifeEventsFromRecurring(
    items: RecurringItem[],
    coveredThrough: string,
): CashFlowChange[] {
    return changesFromItems(
        items.filter((i) => !i.paid_from_cpf_oa),
        coveredThrough,
    );
}

/**
 * Dated changes to OA growth from items "Paid from CPF OA". `coveredThrough`
 * is the last month the OA snapshots already reflect.
 */
export function oaEventsFromRecurring(
    items: RecurringItem[],
    coveredThrough: string,
): CashFlowChange[] {
    return changesFromItems(
        items.filter((i) => i.paid_from_cpf_oa),
        coveredThrough,
    );
}

function changesFromItems(
    items: RecurringItem[],
    coveredThrough: string,
): CashFlowChange[] {
    const changes: CashFlowChange[] = [];
    for (const item of items) {
        if (!isSpendType(item.type)) continue;
        const amount = round2(getRecurringMonthlyAmount(item));
        if (amount <= 0) continue;
        const start = item.start_date ? formatMonth(item.start_date) : null;
        const end = item.end_date ? formatMonth(item.end_date) : null;
        if (end && start && end < start) continue;

        if (start && start > coveredThrough) {
            changes.push({
                id: `${item.id}-starts`,
                name: item.name,
                kind: "starts",
                startMonth: start,
                endMonth: end,
                monthlyDelta: -amount,
            });
            continue;
        }
        // Active within the baseline: its end frees up savings.
        if (end) {
            const after = addMonths(end, 1);
            if (after > coveredThrough) {
                changes.push({
                    id: `${item.id}-ends`,
                    name: item.name,
                    kind: "ends",
                    startMonth: after,
                    endMonth: null,
                    monthlyDelta: amount,
                });
            }
        }
    }
    return changes.sort(
        (a, b) =>
            a.startMonth.localeCompare(b.startMonth) ||
            a.id.localeCompare(b.id),
    );
}

/**
 * Total effect of the changes over the `t` months after `fromMonth`
 * (months fromMonth+1 .. fromMonth+t).
 */
export function changesOver(
    changes: readonly CashFlowChange[] | undefined,
    fromMonth: string,
    t: number,
): number {
    if (!changes || changes.length === 0 || t <= 0) return 0;
    const first = addMonths(fromMonth, 1);
    const last = addMonths(fromMonth, t);
    let total = 0;
    for (const c of changes) {
        const from = c.startMonth > first ? c.startMonth : first;
        const to = c.endMonth && c.endMonth < last ? c.endMonth : last;
        const months = monthsBetween(from, to) + 1;
        if (months > 0) total += c.monthlyDelta * months;
    }
    return round2(total);
}
