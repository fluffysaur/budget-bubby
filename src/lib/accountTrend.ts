import type { AccountSnapshot } from "../types/finance";
import { addMonths } from "./dateUtils";

export const TREND_MONTHS = 6;
export const STALE_AFTER_DAYS = 30;

export interface AccountTrend {
    /** Balances, oldest first, within the trend window. */
    points: number[];
    /** Last balance minus first balance in the window. */
    delta: number;
}

/**
 * Builds a per-account balance trend from snapshots over the last
 * TREND_MONTHS months. Returns null when fewer than 2 snapshots exist.
 */
export function buildAccountTrends(
    snapshots: AccountSnapshot[] | undefined,
    today: string,
): Map<string, AccountTrend> {
    const result = new Map<string, AccountTrend>();
    if (!snapshots || snapshots.length === 0) return result;

    const cutoff = addMonths(today, -TREND_MONTHS);
    const byAccount = new Map<string, AccountSnapshot[]>();
    for (const snap of snapshots) {
        if (snap.snapshot_date < cutoff || snap.snapshot_date > today) {
            continue;
        }
        const list = byAccount.get(snap.account_id) ?? [];
        list.push(snap);
        byAccount.set(snap.account_id, list);
    }

    for (const [accountId, list] of byAccount) {
        if (list.length < 2) continue;
        list.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
        const points = list.map((s) => Number(s.balance));
        result.set(accountId, {
            points,
            delta: points[points.length - 1] - points[0],
        });
    }
    return result;
}

/** Whole days since an ISO timestamp/date, or null if unknown. */
export function daysSince(
    iso: string | null | undefined,
    now: Date,
): number | null {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}

export function isStale(days: number | null): boolean {
    return days !== null && days >= STALE_AFTER_DAYS;
}
