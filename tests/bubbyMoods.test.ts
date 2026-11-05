import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { computePace, deriveBaseMood, MOOD_FACE, type BubbyMood } from "../src/lib/bubby/moods";
import { useBubbyReaction } from "../src/hooks/useBubby";
import { emitAppEvent } from "../src/lib/appEvents";

const CHECKIN = 18 * 60;
const MORNING = 9 * 60;
const EVENING = 20 * 60;

describe("deriveBaseMood", () => {
    it.each<[string, number | null, boolean, number | null, number, BubbyMood]>([
        ["3+ days away is lonely", 3, false, null, MORNING, "lonely"],
        ["absence beats pacing", 4, false, 1.5, EVENING, "lonely"],
        ["a missed day is sleepy after check-in time", 1, false, null, EVENING, "sleepy"],
        ["mornings are never sad", 1, false, null, MORNING, "idle"],
        ["sleepy beats over-pace", 2, false, 1.4, EVENING, "sleepy"],
        ["never logged in the morning is idle", null, false, null, MORNING, "idle"],
        ["couple day is proud", 0, true, 1.4, EVENING, "proud"],
        ["well over pace is snug", 0, false, 1.2, EVENING, "snug"],
        ["a little over pace is focused", 0, false, 1.05, EVENING, "focused"],
        ["on pace is happy", 0, false, 0.9, EVENING, "happy"],
        ["no budget is happy", 0, false, null, EVENING, "happy"],
    ])("%s", (_label, gapDays, couple, pace, now, expected) => {
        expect(deriveBaseMood({ gapDays, isCoupleDayToday: couple }, pace, now, CHECKIN)).toBe(expected);
    });

    it("never produces a negative face from pacing", () => {
        for (const pace of [0.5, 1.01, 1.2, 2, 10]) {
            const mood = deriveBaseMood({ gapDays: 0, isCoupleDayToday: false }, pace, EVENING, CHECKIN);
            expect(["happy", "focused", "snug"]).toContain(mood);
            expect(MOOD_FACE[mood].eyes).not.toBe("droop");
        }
    });
});

describe("computePace", () => {
    it("compares spend share to time share", () => {
        expect(computePace(500, 1000, 15, 30)).toBeCloseTo(1);
        expect(computePace(600, 1000, 15, 30)).toBeCloseTo(1.2);
        expect(computePace(100, 0, 15, 30)).toBeNull();
    });
});

describe("reactions", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("overrides then clears", () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useBubbyReaction(3));
        expect(result.current).toBeNull();
        act(() => emitAppEvent("bubby:react", { kind: "cheer" }));
        expect(result.current).toBe("cheer");
        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(result.current).toBeNull();
    });

    it("eggs wiggle for everything", () => {
        const { result } = renderHook(() => useBubbyReaction(1));
        act(() => emitAppEvent("bubby:react", { kind: "celebrate" }));
        expect(result.current).toBe("wiggle");
    });
});
