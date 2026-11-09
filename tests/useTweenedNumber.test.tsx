import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTweenedNumber } from "../src/hooks/useTweenedNumber";

describe("useTweenedNumber", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns initial value immediately on mount", () => {
        const { result } = renderHook(() => useTweenedNumber(100));
        expect(result.current).toBe(100);
    });

    it("tweens to the new value over duration", async () => {
        const { result, rerender } = renderHook(
            ({ val }) => useTweenedNumber(val, { duration: 0.2 }),
            { initialProps: { val: 100 } },
        );

        expect(result.current).toBe(100);

        await act(async () => {
            rerender({ val: 200 });
        });

        // Midway through animation
        await act(async () => {
            vi.advanceTimersByTime(100);
        });
        expect(result.current).toBeGreaterThan(100);
        expect(result.current).toBeLessThan(200);

        // Completion
        await act(async () => {
            vi.advanceTimersByTime(150);
        });
        expect(result.current).toBe(200);
    });

    it("snaps immediately without animating when disabled is true", async () => {
        const { result, rerender } = renderHook(
            ({ val }) => useTweenedNumber(val, { disabled: true }),
            { initialProps: { val: 50 } },
        );

        expect(result.current).toBe(50);

        await act(async () => {
            rerender({ val: 150 });
        });
        expect(result.current).toBe(150);
    });

    it("snaps immediately when prefers-reduced-motion is true", async () => {
        const originalMatchMedia = window.matchMedia;
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

        try {
            const { result, rerender } = renderHook(
                ({ val }) => useTweenedNumber(val, { duration: 0.2 }),
                { initialProps: { val: 10 } },
            );

            expect(result.current).toBe(10);

            await act(async () => {
                rerender({ val: 500 });
            });
            // Should immediately snap to 500 without advancing timers
            expect(result.current).toBe(500);
        } finally {
            window.matchMedia = originalMatchMedia;
        }
    });

    it("handles mid-animation direction changes smoothly", async () => {
        const { result, rerender } = renderHook(
            ({ val }) => useTweenedNumber(val, { duration: 0.2 }),
            { initialProps: { val: 100 } },
        );

        await act(async () => {
            rerender({ val: 200 });
        });

        await act(async () => {
            vi.advanceTimersByTime(100);
        });
        const midValue = result.current;
        expect(midValue).toBeGreaterThan(100);
        expect(midValue).toBeLessThan(200);

        // Re-target towards 0
        await act(async () => {
            rerender({ val: 0 });
        });

        await act(async () => {
            vi.advanceTimersByTime(50);
        });
        expect(result.current).toBeLessThan(midValue);

        await act(async () => {
            vi.advanceTimersByTime(200);
        });
        expect(result.current).toBe(0);
    });

    it("returns non-finite numbers directly without animating", async () => {
        const { result, rerender } = renderHook(
            ({ val }) => useTweenedNumber(val),
            { initialProps: { val: 10 } },
        );

        await act(async () => {
            rerender({ val: NaN });
        });
        expect(result.current).toBeNaN();

        await act(async () => {
            rerender({ val: Infinity });
        });
        expect(result.current).toBe(Infinity);
    });
});
