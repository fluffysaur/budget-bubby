import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PullToRefresh } from "../src/components/ui/PullToRefresh";

describe("PullToRefresh Component", () => {
    it("renders children properly", () => {
        render(
            <PullToRefresh onRefresh={async () => {}}>
                <div data-testid="test-content">App Content</div>
            </PullToRefresh>,
        );

        expect(screen.getByTestId("test-content")).toBeInTheDocument();
        expect(screen.getByText("App Content")).toBeInTheDocument();
    });

    it("triggers onRefresh when pulled past threshold on touch devices", async () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);
        const { container } = render(
            <PullToRefresh onRefresh={onRefresh} threshold={50}>
                <div>Pullable Area</div>
            </PullToRefresh>,
        );

        const scrollContainer =
            container.querySelector("main") || container.firstChild;
        expect(scrollContainer).toBeInTheDocument();

        // Simulate touch start at top
        fireEvent.touchStart(scrollContainer!, {
            touches: [{ clientY: 100 }],
        });

        // Simulate touch move downward past threshold (e.g. 100 -> 220, diff 120)
        fireEvent.touchMove(scrollContainer!, {
            touches: [{ clientY: 220 }],
        });

        // Indicator should appear indicating ready to release
        expect(screen.getByText("Release to refresh")).toBeInTheDocument();

        // Touch end triggers refresh
        await act(async () => {
            fireEvent.touchEnd(scrollContainer!);
        });

        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("does not trigger onRefresh when pulled below threshold", async () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);
        const { container } = render(
            <PullToRefresh onRefresh={onRefresh} threshold={60}>
                <div>Pullable Area</div>
            </PullToRefresh>,
        );

        const scrollContainer =
            container.querySelector("main") || container.firstChild;

        fireEvent.touchStart(scrollContainer!, {
            touches: [{ clientY: 100 }],
        });

        // Pull very slightly (100 -> 115, diff 15)
        fireEvent.touchMove(scrollContainer!, {
            touches: [{ clientY: 115 }],
        });

        expect(screen.getByText("Pull down to refresh")).toBeInTheDocument();

        await act(async () => {
            fireEvent.touchEnd(scrollContainer!);
        });

        expect(onRefresh).not.toHaveBeenCalled();
    });

    it("applies overscroll-y-contain to prevent browser overscroll chaining", () => {
        const { container } = render(
            <PullToRefresh onRefresh={async () => {}}>
                <div>Content</div>
            </PullToRefresh>,
        );

        const scrollContainer =
            container.querySelector("main") || container.firstChild;
        expect(scrollContainer).toHaveClass("overscroll-y-contain");
    });

    it("ignores gestures that are primarily horizontal (swiping carousels or tabs)", async () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);
        const { container } = render(
            <PullToRefresh onRefresh={onRefresh} threshold={50}>
                <div>Horizontal Swipe Area</div>
            </PullToRefresh>,
        );

        const scrollContainer =
            container.querySelector("main") || container.firstChild;

        // Touch start
        fireEvent.touchStart(scrollContainer!, {
            touches: [{ clientX: 50, clientY: 100 }],
        });

        // Swipe primarily sideways (diffX = 120, diffY = 20)
        fireEvent.touchMove(scrollContainer!, {
            touches: [{ clientX: 170, clientY: 120 }],
        });

        // Should not show indicator
        expect(
            screen.queryByText("Pull down to refresh"),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText("Release to refresh"),
        ).not.toBeInTheDocument();

        await act(async () => {
            fireEvent.touchEnd(scrollContainer!);
        });

        expect(onRefresh).not.toHaveBeenCalled();
    });

    it("ignores diagonal swipes that are not clearly vertical", async () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);
        const { container } = render(
            <PullToRefresh onRefresh={onRefresh} threshold={50}>
                <div>Diagonal Area</div>
            </PullToRefresh>,
        );
        const scrollContainer =
            container.querySelector("main") || container.firstChild;

        fireEvent.touchStart(scrollContainer!, {
            touches: [{ clientX: 50, clientY: 100 }],
        });
        // Down-right diagonal (dx=30, dy=40, ~53 degrees): not clearly vertical
        fireEvent.touchMove(scrollContainer!, {
            touches: [{ clientX: 80, clientY: 140 }],
        });
        // Keeps going down afterwards; the gesture stays locked as horizontal
        fireEvent.touchMove(scrollContainer!, {
            touches: [{ clientX: 95, clientY: 260 }],
        });

        expect(
            screen.queryByText("Pull down to refresh"),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText("Release to refresh"),
        ).not.toBeInTheDocument();

        await act(async () => {
            fireEvent.touchEnd(scrollContainer!);
        });
        expect(onRefresh).not.toHaveBeenCalled();
    });

    it("still refreshes on a mostly vertical pull with slight drift", async () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);
        const { container } = render(
            <PullToRefresh onRefresh={onRefresh} threshold={50}>
                <div>Vertical Area</div>
            </PullToRefresh>,
        );
        const scrollContainer =
            container.querySelector("main") || container.firstChild;

        fireEvent.touchStart(scrollContainer!, {
            touches: [{ clientX: 50, clientY: 100 }],
        });
        fireEvent.touchMove(scrollContainer!, {
            touches: [{ clientX: 55, clientY: 220 }],
        });
        await act(async () => {
            fireEvent.touchEnd(scrollContainer!);
        });
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("does not start a pull from inside a horizontal scroller", async () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);
        render(
            <PullToRefresh onRefresh={onRefresh} threshold={50}>
                <div data-testid="scroller" style={{ overflowX: "auto" }}>
                    Carousel
                </div>
            </PullToRefresh>,
        );
        const scroller = screen.getByTestId("scroller");
        Object.defineProperty(scroller, "scrollWidth", { value: 600 });
        Object.defineProperty(scroller, "clientWidth", { value: 300 });

        fireEvent.touchStart(scroller, {
            touches: [{ clientX: 50, clientY: 100 }],
        });
        fireEvent.touchMove(scroller, {
            touches: [{ clientX: 52, clientY: 240 }],
        });

        expect(
            screen.queryByText("Release to refresh"),
        ).not.toBeInTheDocument();
        await act(async () => {
            fireEvent.touchEnd(scroller);
        });
        expect(onRefresh).not.toHaveBeenCalled();
    });

    it("prevents browser default scroll behavior on cancelable vertical pull-down", () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);
        const { container } = render(
            <PullToRefresh onRefresh={onRefresh} threshold={50}>
                <div>Pull Area</div>
            </PullToRefresh>,
        );

        const scrollContainer =
            container.querySelector("main") || container.firstChild;

        fireEvent.touchStart(scrollContainer!, {
            touches: [{ clientX: 50, clientY: 100 }],
        });

        const touchMoveEvent = new TouchEvent("touchmove", {
            cancelable: true,
            bubbles: true,
            touches: [
                {
                    clientX: 50,
                    clientY: 180,
                } as unknown as Touch,
            ],
        });

        const preventDefaultSpy = vi.spyOn(touchMoveEvent, "preventDefault");
        act(() => {
            scrollContainer!.dispatchEvent(touchMoveEvent);
        });

        expect(preventDefaultSpy).toHaveBeenCalled();
    });
});
