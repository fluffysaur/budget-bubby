/**
 * Bubby's body and mood, derived from feed events. No React, so it can be
 * unit-tested.
 *
 * Meters (0-1, never shown as numbers):
 * - Nourishment: food 🍤 over the last 7 days. Full at 14 (about one log a
 *   day each for a couple). Each member's food is capped at 5 a day.
 * - Fitness: exercise 💪 over the last 30 days. Full at 8.
 * A meter is "high" at 0.5 or more: 7 food in a week, or 4 exercise in 30
 * days (e.g. a balance update, a month-end sweep and two recap reads). So a
 * couple who log most days and do the monthly chores reach Buff.
 *
 * Body: low/low Regular (the default), high food only Chubby, high exercise
 * only Lean, both Buff. Meters are rolling windows, so a neglected Bubby
 * drifts back to Regular, and never anything worse.
 *
 * Mood (visual only, never shown as words): days since anyone in the
 * household fed Bubby. 0-2 normal, 3+ rumbly tummy, 5+ teary, 7+ alone with
 * a little "miss you" sign. One feed brings it straight back to normal.
 */

import { addDays, daysBetween } from "./dates";
import type { FeedEvent } from "./sources";

export const FOOD_CAP_PER_MEMBER_DAY = 5;
export const NOURISH_WINDOW_DAYS = 7;
export const NOURISH_FULL = 14;
export const FITNESS_WINDOW_DAYS = 30;
export const FITNESS_FULL = 8;
export const METER_HIGH = 0.5;

export type BubbyBody = "regular" | "chubby" | "lean" | "buff";
export type BubbyMood = "normal" | "rumbly" | "teary" | "missyou";

export interface BubbyCondition {
    nourishment: number;
    fitness: number;
    body: BubbyBody;
    mood: BubbyMood;
    /** Days since anyone fed Bubby, or null if nobody ever has. */
    daysSinceFed: number | null;
    /** Members who fed Bubby today. */
    fedToday: Set<string>;
}

/** Capped food per (member, day). Events without a member share one bucket. */
export function foodByMemberDay(
    events: readonly FeedEvent[],
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const e of events) {
        if (e.kind !== "food") continue;
        const key = `${e.memberId ?? "household"}|${e.date}`;
        counts.set(
            key,
            Math.min(FOOD_CAP_PER_MEMBER_DAY, (counts.get(key) ?? 0) + 1),
        );
    }
    return counts;
}

export function bodyFor(nourishment: number, fitness: number): BubbyBody {
    const fed = nourishment >= METER_HIGH;
    const fit = fitness >= METER_HIGH;
    if (fed && fit) return "buff";
    if (fed) return "chubby";
    if (fit) return "lean";
    return "regular";
}

export function moodFor(daysSinceFed: number | null): BubbyMood {
    if (daysSinceFed === null || daysSinceFed < 3) return "normal";
    if (daysSinceFed < 5) return "rumbly";
    if (daysSinceFed < 7) return "teary";
    return "missyou";
}

function within(date: string, today: string, windowDays: number): boolean {
    return date <= today && date > addDays(today, -windowDays);
}

export function deriveCondition(
    events: readonly FeedEvent[],
    today: string,
): BubbyCondition {
    const food = foodByMemberDay(events);
    let foodInWeek = 0;
    let lastFed: string | null = null;
    const fedToday = new Set<string>();
    for (const [key, count] of food) {
        const [memberId, date] = key.split("|");
        if (date > today) continue;
        if (within(date, today, NOURISH_WINDOW_DAYS)) foodInWeek += count;
        if (!lastFed || date > lastFed) lastFed = date;
        if (date === today && memberId !== "household") fedToday.add(memberId);
    }

    const exerciseInMonth = events.filter(
        (e) =>
            e.kind === "exercise" && within(e.date, today, FITNESS_WINDOW_DAYS),
    ).length;

    const nourishment = Math.min(1, foodInWeek / NOURISH_FULL);
    const fitness = Math.min(1, exerciseInMonth / FITNESS_FULL);
    const daysSinceFed = lastFed ? daysBetween(lastFed, today) : null;

    return {
        nourishment,
        fitness,
        body: bodyFor(nourishment, fitness),
        mood: moodFor(daysSinceFed),
        daysSinceFed,
        fedToday,
    };
}
