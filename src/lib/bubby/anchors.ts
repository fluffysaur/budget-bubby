/**
 * Bubby art palette and per-stage anchor transforms.
 * Each accessory is drawn once, centred at the origin; the anchor places it
 * on the stage's head, face, neck or right flipper.
 */

import type { StageId } from "./growth";

export const INK = "#141414";
export const FEATHER = "#2b333c";
export const FLUFF = "#8e98a4";
export const CREAM = "#f4f1ec";
export const EGG = "#fbf3e0";
export const SPECKLE = "#e6d3b0";
export const BEAK = "#f59e42";
export const BLUSH = "#f7a8c9";
export const BLUSH_LINE = "#ec4899";
export const COIN = "#f6c344";
export const COIN_SHINE = "#ffe999";
export const PINK = "#f472b6";

export interface StageAnchors {
    head: string;
    face: string;
    neck: string;
    handR: string;
}

export const ANCHORS: Partial<Record<StageId, StageAnchors>> = {
    hatchling: {
        head: "translate(256 280) scale(0.6)",
        face: "translate(256 366) scale(0.7)",
        neck: "translate(256 424) scale(0.62)",
        handR: "translate(352 410) scale(0.6)",
    },
    chick: {
        head: "translate(256 226) scale(0.7)",
        face: "translate(256 318) scale(0.85)",
        neck: "translate(256 392) scale(0.8)",
        handR: "translate(380 380) scale(0.75)",
    },
    fledgling: {
        head: "translate(256 176) scale(0.72)",
        face: "translate(256 290) scale(0.88)",
        neck: "translate(256 360) scale(0.85)",
        handR: "translate(400 392) scale(0.85)",
    },
    adult: {
        head: "translate(256 146) scale(0.82)",
        face: "translate(256 274)",
        neck: "translate(256 352) scale(0.95)",
        handR: "translate(418 404) scale(0.9)",
    },
};
