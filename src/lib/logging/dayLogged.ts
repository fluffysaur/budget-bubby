/**
 * "Day logged" definitions. A member logged an SGT date when daily_checkins
 * has a row for it (a confirmed expense dated that day, an inbox confirm, or
 * an explicit No Spend). Captured-but-unsorted inbox items do NOT count.
 */

import type { DailyCheckin } from "../../types/finance";

export function isDayLogged(checkins: readonly DailyCheckin[], memberId: string, date: string): boolean {
    return checkins.some((c) => c.member_id === memberId && c.checkin_date === date);
}

/** Distinct logged dates for a member, optionally from `since` (inclusive). */
export function countDaysLogged(
    checkins: readonly DailyCheckin[],
    memberId: string,
    since?: string,
): number {
    const dates = new Set<string>();
    for (const c of checkins) {
        if (c.member_id !== memberId) continue;
        if (since && c.checkin_date < since) continue;
        dates.add(c.checkin_date);
    }
    return dates.size;
}

/** Every listed member logged the date. False for an empty list. */
export function isCoupleDayLogged(
    checkins: readonly DailyCheckin[],
    memberIds: readonly string[],
    date: string,
): boolean {
    return memberIds.length > 0 && memberIds.every((id) => isDayLogged(checkins, id, date));
}
