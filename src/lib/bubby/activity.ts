/**
 * Honest "day logged" check-ins.
 *
 * The server checks in the *payer* on the *expense date*. That misses the
 * partner who actually did the logging, and backfilled receipts never mark
 * today. After any add, bulk add, inbox confirm or inbox clear, this also
 * checks in the logged-in member for today's SGT date.
 *
 * Fire-and-forget: it updates the cached check-ins optimistically (so
 * Bubby wakes up on the same frame) and goes through
 * financeService.recordDailyCheckin, which is offline-queued and idempotent.
 */

import { queryClient } from "../queryClient";
import { queryKeys } from "../../hooks/useFinanceQueries";
import { financeService } from "../../services/financeService";
import { emitAppEvent } from "../appEvents";
import { toSgtDateString } from "./dates";
import { addLocalExercise, type LocalExerciseKind } from "./storage";
import type { DailyCheckin } from "../../types/finance";

let lastRecordedKey: string | null = null;

export interface ActivityCheckinResult {
    firstForDate: boolean;
}

/** True if the cached check-ins show this member logged on `date`. */
export function isMemberLoggedInCache(memberId: string, date: string): boolean | null {
    const cached = queryClient.getQueryData<DailyCheckin[]>(queryKeys.dailyCheckins());
    if (!cached) return null;
    return cached.some((c) => c.member_id === memberId && c.checkin_date === date);
}

export function recordActivityCheckin(
    memberId: string | null | undefined,
    source: "expense" | "inbox" = "expense",
    today: string = toSgtDateString(),
): ActivityCheckinResult | null {
    if (!memberId) return null;
    const key = `${memberId}|${today}`;
    const cached = queryClient.getQueryData<DailyCheckin[]>(queryKeys.dailyCheckins());
    const alreadyLogged =
        cached?.some((c) => c.member_id === memberId && c.checkin_date === today) ?? false;
    // Unknown cache: don't claim a first log (no false celebrations)
    const firstForDate = Boolean(cached) && !alreadyLogged && lastRecordedKey !== key;

    if (cached && !alreadyLogged) {
        const optimistic: DailyCheckin = {
            id: `optimistic-${key}`,
            household_id: cached[0]?.household_id ?? "",
            member_id: memberId,
            checkin_date: today,
            type: "expense",
        };
        queryClient.setQueryData<DailyCheckin[]>(queryKeys.dailyCheckins(), [
            optimistic,
            ...cached,
        ]);
    }

    if (!alreadyLogged && lastRecordedKey !== key) {
        lastRecordedKey = key;
        void financeService
            .recordDailyCheckin(memberId, today, "expense")
            .catch((err) => {
                lastRecordedKey = null;
                console.debug("Activity check-in skipped:", err);
            });
    }

    emitAppEvent("day:logged", { memberId, date: today, source, firstForDate });
    return { firstForDate };
}

/**
 * Exercise 💪 with no table behind it (goal adds, month-end actions, balance
 * updates): recorded on this device for today. Counts once per period.
 */
export function recordExercise(kind: LocalExerciseKind, today: string = toSgtDateString()): void {
    addLocalExercise(kind, today);
    emitAppEvent("bubby:store-changed", {});
}

/** Test helper. */
export function resetActivityCheckinState(): void {
    lastRecordedKey = null;
}
