/**
 * Bubby art palette and per-body face placement.
 */

import type { BubbyBody } from "./body";

export const INK = "#141414";
export const FEATHER = "#2b333c";
export const BEAK = "#f59e42";
export const BLUSH = "#f7a8c9";
export const BLUSH_LINE = "#ec4899";
export const COIN = "#f6c344";
export const PINK = "#f472b6";
export const TEAR = "#7cc4f2";
export const SIGN = "#fbf3e0";

/** Face origin (centre between the eyes) for each body shape. */
export const FACE_ANCHOR: Record<BubbyBody, string> = {
    regular: "translate(256 274)",
    chubby: "translate(256 286)",
    lean: "translate(256 264) scale(0.9)",
    buff: "translate(256 276)",
};
