/**
 * How each visual mood draws Bubby's face, and how long reactions last.
 * Moods are never shown as words; they only change the drawing.
 */

import type { BubbyReaction } from "../appEvents";
import type { BubbyMood } from "./body";

export type { BubbyReaction, BubbyMood };

export type EyeShape = "arc" | "dot" | "droop" | "sparkle";
export type BeakShape = "open" | "closed" | "munch";

export interface MoodFace {
    eyes: EyeShape;
    beak: BeakShape;
    blush: boolean;
    overlay?: "rumble" | "tears" | "sign";
}

export const MOOD_FACE: Record<BubbyMood, MoodFace> = {
    normal: { eyes: "arc", beak: "open", blush: true },
    rumbly: { eyes: "dot", beak: "closed", blush: true, overlay: "rumble" },
    teary: { eyes: "dot", beak: "closed", blush: false, overlay: "tears" },
    missyou: { eyes: "droop", beak: "closed", blush: false, overlay: "sign" },
};

/** How long each reaction class stays on (feedback ≤400ms, idle moments ~1s). */
export const REACTION_MS: Record<BubbyReaction, number> = {
    cheer: 380,
    nod: 260,
    poof: 360,
    wave: 350,
    munch: 360,
    pat: 360,
    reunion: 400,
    celebrate: 400,
    tilt: 1000,
    waddle: 900,
    yawn: 1300,
};

/** Calm moments that keep Bubby's current mood face (no happy switch). */
export const CALM_REACTIONS: ReadonlySet<BubbyReaction> = new Set([
    "tilt",
    "waddle",
    "yawn",
]);

/** Night in SGT (10pm to 6am): Bubby gets sleepy. */
export const NIGHT_START_MINUTES = 22 * 60;
export const NIGHT_END_MINUTES = 6 * 60;

export function isNight(minutes: number): boolean {
    return minutes >= NIGHT_START_MINUTES || minutes < NIGHT_END_MINUTES;
}

/** Sleepy: night time, or nobody has fed this penguin for 3+ days. */
export function isSleepy(
    minutes: number,
    daysSinceFed: number | null,
): boolean {
    return isNight(minutes) || (daysSinceFed ?? 0) >= 3;
}

/**
 * Who yawns: every penguin if all are sleepy (no target), else the first
 * sleepy one, else nobody.
 */
export function yawnTarget(
    penguins: readonly { id: string; sleepy: boolean }[],
): { memberId?: string } | null {
    const sleepy = penguins.filter((p) => p.sleepy);
    if (sleepy.length === 0) return null;
    if (sleepy.length === penguins.length) return {};
    return { memberId: sleepy[0].id };
}
