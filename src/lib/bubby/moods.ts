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

/** How long each reaction class stays on (all ≤400ms). */
export const REACTION_MS: Record<BubbyReaction, number> = {
    cheer: 380,
    nod: 260,
    poof: 360,
    wave: 350,
    munch: 360,
    pat: 360,
    reunion: 400,
    celebrate: 400,
};
