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

        const scrollContainer = container.querySelector("main") || container.firstChild;
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

        const scrollContainer = container.querySelector("main") || container.firstChild;

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
});
