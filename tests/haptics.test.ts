import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    haptics,
    isHapticsSupported,
    isHapticsEnabled,
    triggerHaptic,
    HAPTIC_PATTERNS,
} from "../src/lib/haptics";

describe("Haptics Engine (src/lib/haptics.ts)", () => {
    const originalNavigator = window.navigator;

    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        // Restore navigator
        Object.defineProperty(window, "navigator", {
            value: originalNavigator,
            writable: true,
            configurable: true,
        });
    });

    it("detects support correctly when navigator.vibrate is missing or present", () => {
        // Missing
        Object.defineProperty(window, "navigator", {
            value: {},
            writable: true,
            configurable: true,
        });
        expect(isHapticsSupported()).toBe(false);

        // Present
        Object.defineProperty(window, "navigator", {
            value: { vibrate: vi.fn() },
            writable: true,
            configurable: true,
        });
        expect(isHapticsSupported()).toBe(true);
    });

    it("respects system prefers-reduced-motion: reduce", () => {
        const vibrateSpy = vi.fn().mockReturnValue(true);
        Object.defineProperty(window, "navigator", {
            value: { vibrate: vibrateSpy },
            writable: true,
            configurable: true,
        });

        // Mock matchMedia returning reduced motion
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: query.includes("prefers-reduced-motion: reduce"),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        expect(isHapticsEnabled()).toBe(false);
        expect(triggerHaptic(HAPTIC_PATTERNS.lightTap)).toBe(false);
        expect(vibrateSpy).not.toHaveBeenCalled();
    });

    it("respects user preference toggle in localStorage bb_notif_prefs_", () => {
        const vibrateSpy = vi.fn().mockReturnValue(true);
        Object.defineProperty(window, "navigator", {
            value: { vibrate: vibrateSpy },
            writable: true,
            configurable: true,
        });

        window.matchMedia = vi.fn().mockReturnValue({ matches: false });

        // Defaults to true when no prefs set
        expect(isHapticsEnabled()).toBe(true);

        // Explicitly disabled
        localStorage.setItem(
            "bb_notif_prefs_user123",
            JSON.stringify({ haptics_enabled: false }),
        );
        expect(isHapticsEnabled()).toBe(false);
        expect(triggerHaptic(HAPTIC_PATTERNS.success)).toBe(false);
        expect(vibrateSpy).not.toHaveBeenCalled();

        // Explicitly enabled
        localStorage.setItem(
            "bb_notif_prefs_user123",
            JSON.stringify({ haptics_enabled: true }),
        );
        expect(isHapticsEnabled()).toBe(true);
        expect(triggerHaptic(HAPTIC_PATTERNS.success)).toBe(true);
        expect(vibrateSpy).toHaveBeenCalledWith(25);
    });

    it("triggers correct semantic patterns for each interaction tier", () => {
        const vibrateSpy = vi.fn().mockReturnValue(true);
        Object.defineProperty(window, "navigator", {
            value: { vibrate: vibrateSpy },
            writable: true,
            configurable: true,
        });
        window.matchMedia = vi.fn().mockReturnValue({ matches: false });

        haptics.lightTap();
        expect(vibrateSpy).toHaveBeenLastCalledWith(12);

        haptics.success();
        expect(vibrateSpy).toHaveBeenLastCalledWith(25);

        haptics.celebrate();
        expect(vibrateSpy).toHaveBeenLastCalledWith([30, 45, 50]);

        haptics.sweep();
        expect(vibrateSpy).toHaveBeenLastCalledWith([35, 50, 65]);

        haptics.goalMilestone();
        expect(vibrateSpy).toHaveBeenLastCalledWith([30, 40, 50]);

        haptics.warning();
        expect(vibrateSpy).toHaveBeenLastCalledWith([35, 45, 35]);

        haptics.alert();
        expect(vibrateSpy).toHaveBeenLastCalledWith([65, 45, 65]);

        haptics.destructive();
        expect(vibrateSpy).toHaveBeenLastCalledWith([50, 50]);
    });

    it("handles vibration exceptions without throwing", () => {
        const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
        Object.defineProperty(window, "navigator", {
            value: {
                vibrate: vi.fn().mockImplementation(() => {
                    throw new Error("Vibration denied");
                }),
            },
            writable: true,
            configurable: true,
        });
        window.matchMedia = vi.fn().mockReturnValue({ matches: false });

        expect(() => haptics.lightTap()).not.toThrow();
        expect(haptics.lightTap()).toBe(false);
        expect(consoleDebugSpy).toHaveBeenCalled();
    });
});
