import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    playChaChingSound,
    playBudgetWarningSound,
    playBudgetExceededSound,
    playSoftPop,
    playSuccessSound,
} from "../src/lib/soundEffects";

describe("Sound Effects Engine", () => {
    it("executes audio chimes without throwing", () => {
        expect(() => playChaChingSound()).not.toThrow();
        expect(() => playBudgetWarningSound()).not.toThrow();
        expect(() => playBudgetExceededSound()).not.toThrow();
        expect(() => playSoftPop()).not.toThrow();
        expect(() => playSuccessSound()).not.toThrow();
    });
});

describe("Soft pop and success chime gating", () => {
    const oscillators = vi.fn();

    function param() {
        return {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        };
    }

    class FakeAudioContext {
        state = "running";
        currentTime = 0;
        destination = {};
        resume() {
            return Promise.resolve();
        }
        createOscillator() {
            oscillators();
            return {
                type: "sine",
                frequency: param(),
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
            };
        }
        createGain() {
            return { gain: param(), connect: vi.fn() };
        }
    }

    const original = (window as unknown as { AudioContext?: unknown })
        .AudioContext;

    beforeEach(() => {
        localStorage.clear();
        oscillators.mockClear();
        Object.defineProperty(window, "AudioContext", {
            value: FakeAudioContext,
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        Object.defineProperty(window, "AudioContext", {
            value: original,
            writable: true,
            configurable: true,
        });
    });

    it("stays silent when sound is muted", () => {
        localStorage.setItem(
            "bb_notif_prefs_mem-1",
            JSON.stringify({ sound_enabled: false }),
        );
        playSoftPop();
        playSuccessSound();
        expect(oscillators).not.toHaveBeenCalled();
    });

    it("plays one blip for the pop and a three-note arpeggio for success", () => {
        playSoftPop();
        expect(oscillators).toHaveBeenCalledTimes(1);
        playSuccessSound();
        expect(oscillators).toHaveBeenCalledTimes(4);
    });
});
