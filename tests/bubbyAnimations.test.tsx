import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
import {
    TILT_MAX_MS,
    TILT_MIN_MS,
    YAWN_EVERY_MS,
    useBubbyIdle,
} from "../src/hooks/useBubbyIdle";
import {
    isNight,
    isSleepy,
    REACTION_MS,
    yawnTarget,
} from "../src/lib/bubby/moods";
import { Bubby } from "../src/components/bubby/Bubby";
import { BubbyLoadingScreen } from "../src/components/bubby/BubbyLoadingScreen";
import { writeBubbyStore } from "../src/lib/bubby/storage";

function mockReducedMotion(reduce: boolean) {
    vi.spyOn(window, "matchMedia").mockImplementation(
        (query: string) =>
            ({
                matches: reduce && query.includes("reduce"),
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }) as MediaQueryList,
    );
}

describe("sleepy", () => {
    it("is night from 10pm to 6am SGT", () => {
        expect(isNight(22 * 60)).toBe(true);
        expect(isNight(2 * 60)).toBe(true);
        expect(isNight(6 * 60)).toBe(false);
        expect(isNight(21 * 60 + 59)).toBe(false);
    });

    it("is sleepy at night or after 3 days unfed", () => {
        expect(isSleepy(12 * 60, null)).toBe(false);
        expect(isSleepy(12 * 60, 2)).toBe(false);
        expect(isSleepy(12 * 60, 3)).toBe(true);
        expect(isSleepy(23 * 60, 0)).toBe(true);
    });

    it("yawns everyone, the first sleepy penguin, or nobody", () => {
        const awake = { id: "a", sleepy: false };
        const tired = { id: "b", sleepy: true };
        expect(yawnTarget([awake])).toBeNull();
        expect(yawnTarget([tired, { ...tired, id: "c" }])).toEqual({});
        expect(yawnTarget([awake, tired])).toEqual({ memberId: "b" });
    });
});

describe("idle cycle", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockReducedMotion(false);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("tilts now and then, then settles", () => {
        // Halfway between the shortest and longest wait
        vi.spyOn(Math, "random").mockReturnValue(0.5);
        const { result } = renderHook(() => useBubbyIdle(true, false));
        expect(result.current).toBeNull();
        act(() => {
            vi.advanceTimersByTime((TILT_MIN_MS + TILT_MAX_MS) / 2);
        });
        expect(result.current).toBe("tilt");
        act(() => {
            vi.advanceTimersByTime(REACTION_MS.tilt);
        });
        expect(result.current).toBeNull();
    });

    it("yawns every ~20s when sleepy", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const { result } = renderHook(() => useBubbyIdle(true, true));
        act(() => {
            vi.advanceTimersByTime(YAWN_EVERY_MS);
        });
        expect(result.current).toBe("yawn");
    });

    it("stays still when off or under reduced motion", () => {
        const off = renderHook(() => useBubbyIdle(false, true));
        mockReducedMotion(true);
        const reduced = renderHook(() => useBubbyIdle(true, true));
        act(() => {
            vi.advanceTimersByTime(YAWN_EVERY_MS * 2);
        });
        expect(off.result.current).toBeNull();
        expect(reduced.result.current).toBeNull();
    });
});

describe("Bubby", () => {
    it("keeps the mood face for calm moments, switches to happy for feedback", () => {
        const { container, rerender } = render(
            <Bubby mood="teary" reaction="tilt" decorative />,
        );
        const svg = container.querySelector("svg.bubby")!;
        expect(svg.getAttribute("data-reaction")).toBe("tilt");
        expect(svg.querySelector("[data-overlay='tears']")).not.toBeNull();

        rerender(<Bubby mood="teary" reaction="reunion" decorative />);
        expect(svg.querySelector("[data-overlay='tears']")).toBeNull();
    });

    it("marks idle and looping penguins for the CSS", () => {
        const { container } = render(
            <>
                <Bubby idle decorative />
                <Bubby loop="waddle" idle decorative />
            </>,
        );
        const [idle, looping] = container.querySelectorAll("svg.bubby");
        expect(idle.hasAttribute("data-idle")).toBe(true);
        expect(looping.getAttribute("data-loop")).toBe("waddle");
        // A looping penguin does not also run the idle cycle
        expect(looping.hasAttribute("data-idle")).toBe(false);
    });
});

describe("BubbyLoadingScreen", () => {
    beforeEach(() => localStorage.clear());

    it("waddles two plain penguins on a first visit", () => {
        const { getByTestId } = render(<BubbyLoadingScreen />);
        const penguins =
            getByTestId("bubby-loading").querySelectorAll("svg.bubby");
        expect(penguins).toHaveLength(2);
        penguins.forEach((p) => {
            expect(p.getAttribute("data-loop")).toBe("waddle");
            expect(p.querySelector("[data-layer='scarf']")).toBeNull();
        });
    });

    it("shows the household last seen here, with scarves", () => {
        writeBubbyStore({ roster: ["lilac", "butter"] });
        const { getByTestId } = render(<BubbyLoadingScreen />);
        const scarves = Array.from(
            getByTestId("bubby-loading").querySelectorAll(
                "[data-layer='scarf']",
            ),
        ).map((s) => s.getAttribute("data-scarf"));
        expect(scarves).toEqual(["lilac", "butter"]);
    });

    it("shows one penguin for a solo household", () => {
        writeBubbyStore({ roster: [null] });
        const { getByTestId } = render(<BubbyLoadingScreen />);
        expect(
            getByTestId("bubby-loading").querySelectorAll("svg.bubby"),
        ).toHaveLength(1);
    });
});
