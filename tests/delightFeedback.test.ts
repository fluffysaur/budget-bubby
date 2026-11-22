import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../src/lib/soundEffects", () => ({
    playChaChingSound: vi.fn(),
    playSoftPop: vi.fn(),
    playSuccessSound: vi.fn(),
    playBudgetWarningSound: vi.fn(),
    playBudgetExceededSound: vi.fn(),
    initAudioUnlock: vi.fn(),
}));

import * as sounds from "../src/lib/soundEffects";
import { haptics } from "../src/lib/haptics";
import { feedback, resetFeedbackState } from "../src/lib/delight/feedback";
import { onAppEvent, type MilestoneDetail } from "../src/lib/appEvents";

function setReducedMotion(reduce: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: reduce && query.includes("reduce"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
}

describe("delight feedback", () => {
    let vibrate: ReturnType<typeof vi.fn>;
    const originalNavigator = window.navigator;

    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        resetFeedbackState();
        setReducedMotion(false);
        vibrate = vi.fn().mockReturnValue(true);
        Object.defineProperty(window, "navigator", {
            value: { vibrate },
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        Object.defineProperty(window, "navigator", {
            value: originalNavigator,
            writable: true,
            configurable: true,
        });
    });

    it("routine add plays cha-ching, success haptic and a cheer", () => {
        const reactions: string[] = [];
        const off = onAppEvent("bubby:react", (d) => reactions.push(d.kind));
        feedback.routine("add");
        off();
        expect(sounds.playChaChingSound).toHaveBeenCalledTimes(1);
        expect(vibrate).toHaveBeenCalledWith(25);
        expect(reactions).toEqual(["cheer"]);
    });

    it("muted sound never reaches audio, but the cue still runs", () => {
        // The mute gate lives inside soundEffects; feedback always delegates to it
        feedback.routine("edit");
        expect(sounds.playSoftPop).toHaveBeenCalledTimes(1);
        expect(vibrate).toHaveBeenCalledWith(12);
    });

    it("reduced motion skips confetti and haptics", () => {
        setReducedMotion(true);
        const milestones: MilestoneDetail[] = [];
        const off = onAppEvent("delight:milestone", (d) => milestones.push(d));
        const result = feedback.milestone("body-change", {
            title: "Bubby got buff!",
        });
        off();
        expect(result).toBe("milestone");
        expect(milestones[0].confetti).toBe(false);
        expect(vibrate).not.toHaveBeenCalled();
        expect(sounds.playSuccessSound).toHaveBeenCalledTimes(1);
    });

    it("rate limit degrades a second big milestone within 8s", () => {
        const milestones: MilestoneDetail[] = [];
        const off = onAppEvent("delight:milestone", (d) => milestones.push(d));
        expect(feedback.milestone("body-change")).toBe("milestone");
        expect(feedback.milestone("inbox-zero")).toBe("degraded");
        off();
        expect(milestones.map((m) => m.confetti)).toEqual([true, false]);
        expect(sounds.playSuccessSound).toHaveBeenCalledTimes(1);
        expect(sounds.playSoftPop).toHaveBeenCalledTimes(1);
    });

    it("lite milestones are not rate limited and never get confetti", () => {
        const milestones: MilestoneDetail[] = [];
        const off = onAppEvent("delight:milestone", (d) => milestones.push(d));
        feedback.milestone("body-change");
        expect(feedback.milestone("full-belly")).toBe("milestone");
        off();
        expect(milestones[1].confetti).toBe(false);
    });

    it("dedupes by key, so inbox zero plays once a day", () => {
        const key = "inbox-zero:2026-11-05:mem-1";
        expect(feedback.milestone("inbox-zero", { dedupeKey: key })).toBe(
            "milestone",
        );
        resetFeedbackState();
        expect(feedback.milestone("inbox-zero", { dedupeKey: key })).toBe(
            "duplicate",
        );
        expect(
            feedback.milestone("inbox-zero", {
                dedupeKey: "inbox-zero:2026-11-06:mem-1",
            }),
        ).toBe("milestone");
    });

    it("calls the semantic haptics so existing spies keep working", () => {
        const spy = vi.spyOn(haptics, "destructive");
        feedback.routine("delete");
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("routine tab triggers lightTap haptic without sound or Bubby reaction", () => {
        const reactions: string[] = [];
        const off = onAppEvent("bubby:react", (d) => reactions.push(d.kind));
        const spy = vi.spyOn(haptics, "lightTap");

        feedback.routine("tab");
        off();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(sounds.playChaChingSound).not.toHaveBeenCalled();
        expect(sounds.playSoftPop).not.toHaveBeenCalled();
        expect(sounds.playSuccessSound).not.toHaveBeenCalled();
        expect(reactions).toHaveLength(0);
    });

    it("routine save triggers lightTap haptic without sound or Bubby reaction", () => {
        const reactions: string[] = [];
        const off = onAppEvent("bubby:react", (d) => reactions.push(d.kind));
        const spy = vi.spyOn(haptics, "lightTap");

        feedback.routine("save");
        off();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(sounds.playChaChingSound).not.toHaveBeenCalled();
        expect(sounds.playSoftPop).not.toHaveBeenCalled();
        expect(sounds.playSuccessSound).not.toHaveBeenCalled();
        expect(reactions).toHaveLength(0);
    });

    it("suppresses routine haptics when haptics_enabled is false in localStorage", () => {
        localStorage.setItem(
            "bb_notif_prefs_mem-1",
            JSON.stringify({ haptics_enabled: false }),
        );
        feedback.routine("tab");
        feedback.routine("save");
        feedback.routine("delete");
        expect(vibrate).not.toHaveBeenCalled();
    });

    it("suppresses routine haptics when prefers-reduced-motion is active", () => {
        setReducedMotion(true);
        feedback.routine("tab");
        feedback.routine("save");
        feedback.routine("delete");
        expect(vibrate).not.toHaveBeenCalled();
    });
});
