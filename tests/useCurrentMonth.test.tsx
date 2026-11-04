/**
 * Month rollover: the app is an installed PWA that can stay open for days,
 * so "current month" must update when the calendar month changes.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { msUntilNextMonth } from "../src/lib/dateUtils";
import {
    useCurrentMonth,
    useFollowCurrentMonth,
} from "../src/hooks/useCurrentMonth";

// 2026-10-31 23:59:00 in Singapore (UTC+8)
const LAST_MINUTE_OF_OCT_SGT = new Date("2026-10-31T15:59:00.000Z");
// 2026-11-01 00:00:00 in Singapore (UTC+8)
const START_OF_NOV_SGT = new Date("2026-10-31T16:00:00.000Z");

afterEach(() => {
    vi.useRealTimers();
});

describe("msUntilNextMonth", () => {
    it("returns ms until the next Singapore month boundary", () => {
        expect(msUntilNextMonth(LAST_MINUTE_OF_OCT_SGT)).toBe(60_000);
        expect(msUntilNextMonth(START_OF_NOV_SGT)).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it("rolls over the year in December", () => {
        // 2026-12-31 23:00 SGT
        const lateDec = new Date("2026-12-31T15:00:00.000Z");
        expect(msUntilNextMonth(lateDec)).toBe(60 * 60 * 1000);
    });
});

describe("useCurrentMonth", () => {
    it("updates when the month boundary timer fires", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        vi.setSystemTime(LAST_MINUTE_OF_OCT_SGT);

        const { result } = renderHook(() => useCurrentMonth());
        expect(result.current).toBe("2026-10");

        act(() => {
            vi.advanceTimersByTime(61_000);
        });
        expect(result.current).toBe("2026-11");
    });

    it("updates on visibilitychange after the device slept past the boundary", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        vi.setSystemTime(LAST_MINUTE_OF_OCT_SGT);

        const { result } = renderHook(() => useCurrentMonth());
        expect(result.current).toBe("2026-10");

        // Clock jumps (device asleep) without timers firing.
        vi.setSystemTime(new Date("2026-11-03T01:00:00.000Z"));
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(result.current).toBe("2026-11");
    });

    it("updates on window focus", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        vi.setSystemTime(LAST_MINUTE_OF_OCT_SGT);

        const { result } = renderHook(() => useCurrentMonth());
        vi.setSystemTime(new Date("2026-11-03T01:00:00.000Z"));
        act(() => {
            window.dispatchEvent(new Event("focus"));
        });
        expect(result.current).toBe("2026-11");
    });
});

function MonthHarness() {
    const [selected, setSelected] = useState<string>(() => "2026-10");
    const currentMonth = useFollowCurrentMonth(selected, setSelected);
    return (
        <div>
            <span data-testid="selected">{selected}</span>
            <span data-testid="current">{currentMonth}</span>
            <button onClick={() => setSelected("2026-08")}>pick</button>
        </div>
    );
}

describe("useFollowCurrentMonth", () => {
    it("moves a selection that was on the current month to the new month", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        vi.setSystemTime(LAST_MINUTE_OF_OCT_SGT);

        render(<MonthHarness />);
        expect(screen.getByTestId("selected")).toHaveTextContent("2026-10");

        act(() => {
            vi.advanceTimersByTime(61_000);
        });
        expect(screen.getByTestId("current")).toHaveTextContent("2026-11");
        expect(screen.getByTestId("selected")).toHaveTextContent("2026-11");
    });

    it("leaves a deliberately pinned month alone", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        vi.setSystemTime(LAST_MINUTE_OF_OCT_SGT);

        render(<MonthHarness />);
        fireEvent.click(screen.getByText("pick"));
        expect(screen.getByTestId("selected")).toHaveTextContent("2026-08");

        act(() => {
            vi.advanceTimersByTime(61_000);
        });
        expect(screen.getByTestId("current")).toHaveTextContent("2026-11");
        expect(screen.getByTestId("selected")).toHaveTextContent("2026-08");
    });
});
