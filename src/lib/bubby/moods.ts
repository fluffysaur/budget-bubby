/**
 * Bubby moods: a derived base mood plus a short event-driven reaction.
 * Priority: reaction > absence > pacing > neutral. Spending never makes
 * Bubby sad: "snug" and "focused" are both warm faces.
 */

import type { BubbyReaction } from "../appEvents";

export type { BubbyReaction };

export type BubbyMood = "lonely" | "sleepy" | "idle" | "proud" | "snug" | "focused" | "happy";

export type EyeShape = "arc" | "dot" | "half" | "droop" | "sparkle";
export type BeakShape = "open" | "closed" | "munch";

export interface MoodFace {
    eyes: EyeShape;
    beak: BeakShape;
    brows?: "focused";
    blush: boolean;
    fx?: "zzz" | "hearts" | "coin";
}

export const MOOD_FACE: Record<BubbyMood, MoodFace> = {
    happy: { eyes: "arc", beak: "open", blush: true },
    proud: { eyes: "arc", beak: "open", blush: true, fx: "hearts" },
    idle: { eyes: "dot", beak: "closed", blush: true },
    sleepy: { eyes: "half", beak: "closed", blush: false, fx: "zzz" },
    lonely: { eyes: "droop", beak: "closed", blush: false, fx: "coin" },
    snug: { eyes: "arc", beak: "closed", blush: true },
    focused: { eyes: "dot", beak: "closed", brows: "focused", blush: true },
};

export const MOOD_COPY: Partial<Record<BubbyMood, string>> = {
    lonely: "Bubby missed you",
    sleepy: "Log something to wake Bubby",
    snug: "Easy does it",
};

/** How long each reaction class stays on (all ≤400ms). */
export const REACTION_MS: Record<BubbyReaction, number> = {
    cheer: 380,
    nod: 260,
    poof: 360,
    wave: 350,
    munch: 360,
    wiggle: 320,
    celebrate: 400,
};

export interface MoodInputs {
    gapDays: number | null;
    isCoupleDayToday: boolean;
}

/** Spend pace vs time: 1 = exactly on pace. Null without a budget. */
export function computePace(
    spent: number,
    allocated: number,
    dayOfMonth: number,
    daysInMonth: number,
): number | null {
    if (!allocated || allocated <= 0 || !daysInMonth) return null;
    const timeShare = Math.max(dayOfMonth, 1) / daysInMonth;
    return spent / allocated / timeShare;
}

export function deriveBaseMood(
    state: MoodInputs,
    pace: number | null,
    nowMinutes: number,
    checkinMinutes: number,
): BubbyMood {
    // Never logged: treat like a missed day (mornings stay neutral)
    const gap = state.gapDays ?? 1;
    if (gap >= 3) return "lonely";
    if (gap >= 1) return nowMinutes >= checkinMinutes ? "sleepy" : "idle";
    if (state.isCoupleDayToday) return "proud";
    if (pace !== null && pace > 1.15) return "snug";
    if (pace !== null && pace > 1.0) return "focused";
    return "happy";
}
