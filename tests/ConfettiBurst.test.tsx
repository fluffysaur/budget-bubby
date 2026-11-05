import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ConfettiBurst } from "../src/components/ui";

function setReducedMotion(reduce: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: reduce && query.includes("reduce"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
}

describe("ConfettiBurst", () => {
    afterEach(() => {
        vi.useRealTimers();
        setReducedMotion(false);
    });

    it("renders at most 24 non-interactive pieces and unmounts within 1.2s", () => {
        vi.useFakeTimers();
        setReducedMotion(false);
        const onDone = vi.fn();
        render(<ConfettiBurst pieces={100} onDone={onDone} />);

        const burst = screen.getByTestId("confetti-burst");
        expect(burst.className).toContain("pointer-events-none");
        expect(burst.children).toHaveLength(24);

        act(() => {
            vi.advanceTimersByTime(1200);
        });
        expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("shows a static sparkle badge under reduced motion", () => {
        setReducedMotion(true);
        render(<ConfettiBurst />);
        expect(screen.getByTestId("confetti-static")).toBeInTheDocument();
        expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
    });
});
