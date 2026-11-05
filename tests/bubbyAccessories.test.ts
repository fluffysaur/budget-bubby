import { describe, it, expect } from "vitest";
import {
    ACCESSORIES,
    getUnlocked,
    lockedLabel,
    resolveEquipped,
    type UnlockInputs,
} from "../src/lib/bubby/accessories";

const base: UnlockInputs = {
    stage: 2,
    points: 0,
    longestCoupleStreak: 0,
    maxHouseholdDaysInMonth: 0,
    inboxZeroDays: 0,
};

describe("accessory unlocks", () => {
    it.each([
        ["scarf", { points: 40 }],
        ["kopi", { points: 100 }],
        ["specs", { points: 200 }],
        ["hardhat", { points: 250 }],
        ["partyhat", { longestCoupleStreak: 14 }],
        ["balloon", { longestCoupleStreak: 30 }],
        ["buckethat", { points: 400 }],
        ["angbao", { maxHouseholdDaysInMonth: 30 }],
        ["crown", { points: 600 }],
        ["bow", { inboxZeroDays: 10 }],
    ] as const)("unlocks %s at its rule", (id, patch) => {
        expect(getUnlocked({ ...base, ...patch })).toContain(id);
        const def = ACCESSORIES.find((a) => a.id === id)!;
        const key = Object.keys(patch)[0] as keyof UnlockInputs;
        const below = { ...base, ...patch, [key]: def.rule.at - 1 };
        expect(getUnlocked(below)).not.toContain(id);
    });

    it("unlocks nothing before Hatchling", () => {
        expect(getUnlocked({ ...base, stage: 1, longestCoupleStreak: 30 })).toEqual([]);
    });

    it("labels locked items with what is left", () => {
        const scarf = ACCESSORIES.find((a) => a.id === "scarf")!;
        expect(lockedLabel(scarf, { ...base, points: 25 })).toBe("15 🐾");
    });
});

describe("equipping", () => {
    it("defaults to the newest unlock in each slot, one item per slot", () => {
        const equipped = resolveEquipped(["scarf", "hardhat", "partyhat", "kopi"]);
        expect(equipped).toEqual({ neck: "scarf", head: "partyhat", hand: "kopi" });
    });

    it("keeps the user's choice and allows an empty slot", () => {
        const equipped = resolveEquipped(["scarf", "hardhat", "partyhat"], {
            head: "hardhat",
            neck: null,
        });
        expect(equipped).toEqual({ head: "hardhat" });
    });

    it("ignores a choice that is locked or in the wrong slot", () => {
        expect(resolveEquipped(["hardhat"], { head: "crown" })).toEqual({ head: "hardhat" });
        expect(resolveEquipped(["hardhat", "scarf"], { head: "scarf" })).toEqual({
            head: "hardhat",
            neck: "scarf",
        });
    });
});
