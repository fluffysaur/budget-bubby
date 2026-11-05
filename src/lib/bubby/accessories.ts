/**
 * Bubby accessories: one item per slot, unlocked from derived state.
 */

import { HATCHLING_STAGE } from "./growth";
import type { EquippedPrefs } from "./storage";

export type AccessorySlot = "head" | "face" | "neck" | "hand";

export type AccessoryId =
    | "scarf"
    | "kopi"
    | "specs"
    | "hardhat"
    | "partyhat"
    | "balloon"
    | "buckethat"
    | "angbao"
    | "crown"
    | "bow";

export type UnlockRule =
    | { type: "points"; at: number }
    | { type: "coupleStreak"; at: number }
    | { type: "monthDays"; at: number }
    | { type: "inboxZero"; at: number };

export interface AccessoryDef {
    id: AccessoryId;
    slot: AccessorySlot;
    label: string;
    rule: UnlockRule;
}

export const ACCESSORY_SLOTS: readonly AccessorySlot[] = ["head", "face", "neck", "hand"];

export const ACCESSORIES: readonly AccessoryDef[] = [
    { id: "scarf", slot: "neck", label: "Butter Scarf", rule: { type: "points", at: 40 } },
    { id: "kopi", slot: "hand", label: "Kopi Cup", rule: { type: "points", at: 100 } },
    { id: "specs", slot: "face", label: "Round Specs", rule: { type: "points", at: 200 } },
    { id: "hardhat", slot: "head", label: "Hard Hat", rule: { type: "points", at: 250 } },
    { id: "partyhat", slot: "head", label: "Party Hat", rule: { type: "coupleStreak", at: 14 } },
    { id: "balloon", slot: "hand", label: "Heart Balloon", rule: { type: "coupleStreak", at: 30 } },
    { id: "buckethat", slot: "head", label: "Bucket Hat", rule: { type: "points", at: 400 } },
    { id: "angbao", slot: "hand", label: "Ang Bao", rule: { type: "monthDays", at: 30 } },
    { id: "crown", slot: "head", label: "Crown", rule: { type: "points", at: 600 } },
    { id: "bow", slot: "head", label: "Sparkle Bow", rule: { type: "inboxZero", at: 10 } },
];

export interface UnlockInputs {
    stage: number;
    points: number;
    longestCoupleStreak: number;
    maxHouseholdDaysInMonth: number;
    inboxZeroDays: number;
}

export function getAccessory(id: string): AccessoryDef | undefined {
    return ACCESSORIES.find((a) => a.id === id);
}

/** Current value towards an accessory's rule. */
export function progressValue(def: AccessoryDef, inputs: UnlockInputs): number {
    switch (def.rule.type) {
        case "points":
            return inputs.points;
        case "coupleStreak":
            return inputs.longestCoupleStreak;
        case "monthDays":
            return inputs.maxHouseholdDaysInMonth;
        case "inboxZero":
            return inputs.inboxZeroDays;
    }
}

/** Short "to go" label for a locked item, e.g. "40 🐾" or "14-day couple streak". */
export function lockedLabel(def: AccessoryDef, inputs: UnlockInputs): string {
    const left = Math.max(0, def.rule.at - progressValue(def, inputs));
    switch (def.rule.type) {
        case "points":
            return `${left} 🐾`;
        case "coupleStreak":
            return `${def.rule.at}-day couple streak`;
        case "monthDays":
            return `${def.rule.at} days in a month`;
        case "inboxZero":
            return `${left} inbox zeros`;
    }
}

export function getUnlocked(inputs: UnlockInputs): AccessoryId[] {
    if (inputs.stage < HATCHLING_STAGE) return [];
    return ACCESSORIES.filter((a) => progressValue(a, inputs) >= a.rule.at).map((a) => a.id);
}

/**
 * Equipped item per slot. The user's choice wins (null = slot left empty);
 * otherwise the newest unlock in each slot.
 */
export function resolveEquipped(
    unlocked: readonly string[],
    prefs: EquippedPrefs = {},
): Partial<Record<AccessorySlot, AccessoryId>> {
    const result: Partial<Record<AccessorySlot, AccessoryId>> = {};
    const unlockedSet = new Set(unlocked);
    for (const slot of ACCESSORY_SLOTS) {
        const pref = prefs[slot];
        if (pref === null) continue;
        const prefDef = pref ? getAccessory(pref) : undefined;
        if (prefDef && prefDef.slot === slot && unlockedSet.has(prefDef.id)) {
            result[slot] = prefDef.id;
            continue;
        }
        const newest = ACCESSORIES.filter((a) => a.slot === slot && unlockedSet.has(a.id)).pop();
        if (newest) result[slot] = newest.id;
    }
    return result;
}
