import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import * as soundEffects from "../src/lib/soundEffects";
import { ExpenseSuccessCelebration } from "../src/components/expenses/ExpenseSuccessCelebration";
import { writeBubbyStore } from "../src/lib/bubby/storage";

function dispatchAdded(detail: Record<string, unknown>) {
    act(() => {
        window.dispatchEvent(new CustomEvent("expenseAdded", { detail }));
    });
}

describe("compact expense toast", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows a cheering Bubby, no confetti, and leaves after 2s", () => {
        writeBubbyStore({ snapshot: { stage: 3, equipped: {} } });
        const play = vi.spyOn(soundEffects, "playChaChingSound").mockImplementation(() => {});
        const { container } = render(<ExpenseSuccessCelebration />);

        dispatchAdded({ id: "e1", item: "Kopi", amount: 1.8, source: "form" });

        expect(screen.getByRole("status")).toBeInTheDocument();
        const bubby = container.querySelector("svg.bubby");
        expect(bubby?.getAttribute("data-stage")).toBe("chick");
        expect(bubby?.getAttribute("data-reaction")).toBe("cheer");
        expect(container.querySelector(".animate-confetti-left, .animate-confetti-right")).toBeNull();
        expect(play).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(1999);
        });
        expect(screen.getByRole("status")).toBeInTheDocument();
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("skips the toast and sound for inbox confirms", () => {
        const play = vi.spyOn(soundEffects, "playChaChingSound").mockImplementation(() => {});
        render(<ExpenseSuccessCelebration />);

        dispatchAdded({ id: "e2", item: "Grab", amount: 12.5, source: "inbox" });

        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(play).not.toHaveBeenCalled();
    });
});
