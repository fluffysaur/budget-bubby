/**
 * Bubby growth, derived from the daily_checkins history (no migration).
 *
 * Per household day (any member logged): +1 🐾, +1 if both partners logged
 * (a couple day), +1 if the household streak including that day is ≥ 7.
 * Missing a day costs nothing and the total is a sum over history, so it
 * never regresses; a per-device high-water mark covers deleted rows.
 */

import type { DailyCheckin } from "../../types/finance";
import { addDays, daysBetween } from "./dates";

export type StageId = "egg" | "wobbly" | "hatchling" | "chick" | "fledgling" | "adult";

export interface StageDef {
    id: StageId;
    name: string;
    at: number;
}

export const STAGES: readonly StageDef[] = [
    { id: "egg", name: "Egg", at: 0 },
    { id: "wobbly", name: "Wobbly Egg", at: 6 },
    { id: "hatchling", name: "Hatchling", at: 20 },
    { id: "chick", name: "Chick", at: 60 },
    { id: "fledgling", name: "Fledgling", at: 150 },
    { id: "adult", name: "Bubby", at: 300 },
];

/** First stage that can wear accessories and shows a face. */
export const HATCHLING_STAGE = 2;
export const ON_A_ROLL_DAYS = 7;

export function pointsForDay(couple: boolean, householdStreak: number): number {
    return 1 + (couple ? 1 : 0) + (householdStreak >= ON_A_ROLL_DAYS ? 1 : 0);
}

export function stageForPoints(points: number): number {
    let stage = 0;
    for (let i = 0; i < STAGES.length; i++) {
        if (points >= STAGES[i].at) stage = i;
    }
    return stage;
}

export interface BubbyState {
    points: number;
    derivedPoints: number;
    stage: number;
    /** Points needed for the next stage, or null at the final stage. */
    nextStageAt: number | null;
    householdDays: number;
    coupleDays: number;
    /** Current streaks; today counts as pending, so it never breaks them early. */
    householdStreak: number;
    coupleStreak: number;
    longestCoupleStreak: number;
    /** Most household days logged in any single calendar month. */
    maxHouseholdDaysInMonth: number;
    todayLoggedBy: Set<string>;
    /** Days since the last household day (0 = logged today), null if never. */
    gapDays: number | null;
    isCoupleDayToday: boolean;
}

/** Consecutive days in `dates` ending at today (or yesterday while today is pending). */
export function currentStreak(dates: Set<string>, today: string): number {
    let cursor = dates.has(today) ? today : addDays(today, -1);
    let streak = 0;
    while (dates.has(cursor)) {
        streak++;
        cursor = addDays(cursor, -1);
    }
    return streak;
}

/** Personal streak for one member. */
export function memberStreak(checkins: DailyCheckin[], memberId: string, today: string): number {
    const dates = new Set(
        checkins.filter((c) => c.member_id === memberId).map((c) => c.checkin_date),
    );
    return currentStreak(dates, today);
}

export function deriveBubbyState(
    checkins: DailyCheckin[],
    memberIds: readonly string[],
    today: string,
    hwmPoints = 0,
): BubbyState {
    const byDate = new Map<string, Set<string>>();
    for (const c of checkins) {
        if (!c?.checkin_date || c.checkin_date > today) continue;
        let set = byDate.get(c.checkin_date);
        if (!set) {
            set = new Set();
            byDate.set(c.checkin_date, set);
        }
        set.add(c.member_id);
    }

    const pair = memberIds.slice(0, 2);
    const isCouple = (set: Set<string> | undefined) =>
        pair.length === 2 && !!set && set.has(pair[0]) && set.has(pair[1]);

    const dates = Array.from(byDate.keys()).sort();
    let points = 0;
    let coupleDays = 0;
    let run = 0;
    let coupleRun = 0;
    let longestCoupleStreak = 0;
    let prev: string | null = null;
    let prevCouple: string | null = null;
    const perMonth = new Map<string, number>();

    for (const date of dates) {
        run = prev && daysBetween(prev, date) === 1 ? run + 1 : 1;
        prev = date;
        const couple = isCouple(byDate.get(date));
        if (couple) {
            coupleDays++;
            coupleRun = prevCouple && daysBetween(prevCouple, date) === 1 ? coupleRun + 1 : 1;
            prevCouple = date;
            longestCoupleStreak = Math.max(longestCoupleStreak, coupleRun);
        }
        points += pointsForDay(couple, run);
        const month = date.slice(0, 7);
        perMonth.set(month, (perMonth.get(month) ?? 0) + 1);
    }

    const householdSet = new Set(dates);
    const coupleSet = new Set(dates.filter((d) => isCouple(byDate.get(d))));
    const last = dates[dates.length - 1];
    const derivedPoints = points;
    const total = Math.max(derivedPoints, hwmPoints);
    const stage = stageForPoints(total);

    return {
        points: total,
        derivedPoints,
        stage,
        nextStageAt: stage < STAGES.length - 1 ? STAGES[stage + 1].at : null,
        householdDays: dates.length,
        coupleDays,
        householdStreak: currentStreak(householdSet, today),
        coupleStreak: currentStreak(coupleSet, today),
        longestCoupleStreak,
        maxHouseholdDaysInMonth: Math.max(0, ...perMonth.values()),
        todayLoggedBy: new Set(byDate.get(today) ?? []),
        gapDays: last ? daysBetween(last, today) : null,
        isCoupleDayToday: isCouple(byDate.get(today)),
    };
}
