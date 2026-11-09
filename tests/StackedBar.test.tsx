import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
    StackedBar,
    type StackedBarSegment,
} from "../src/components/ui/StackedBar";

describe("StackedBar", () => {
    const sampleSegments: StackedBarSegment[] = [
        { id: "needs", label: "Needs", value: 50, tone: "ok" },
        { id: "wants", label: "Wants", value: 30, tone: "near" },
        { id: "savings", label: "Savings", value: 20, tone: "lilac" },
    ];

    it("renders img with breakdown aria label", () => {
        render(<StackedBar segments={sampleSegments} />);
        const bar = screen.getByRole("img");
        expect(bar).toBeInTheDocument();
        expect(bar).toHaveAttribute(
            "aria-label",
            expect.stringContaining("Needs"),
        );
    });

    it("renders segments with proportional styles", () => {
        render(<StackedBar segments={sampleSegments} total={100} />);
        const bar = screen.getByRole("img");
        const segments = bar.children;
        expect(segments).toHaveLength(3);
        expect(segments[0]).toHaveStyle({ width: "50%" });
        expect(segments[1]).toHaveStyle({ width: "30%" });
        expect(segments[2]).toHaveStyle({ width: "20%" });
    });

    it("renders legend with percentages when showLegend is true", () => {
        render(<StackedBar segments={sampleSegments} showLegend />);
        expect(screen.getByText("Needs")).toBeInTheDocument();
        expect(screen.getByText("50%")).toBeInTheDocument();
        expect(screen.getByText("Wants")).toBeInTheDocument();
        expect(screen.getByText("30%")).toBeInTheDocument();
        expect(screen.getByText("Savings")).toBeInTheDocument();
        expect(screen.getByText("20%")).toBeInTheDocument();
    });

    it("handles zero total gracefully without crashing", () => {
        const emptySegments: StackedBarSegment[] = [
            { id: "a", label: "A", value: 0 },
            { id: "b", label: "B", value: 0 },
        ];
        render(<StackedBar segments={emptySegments} />);
        const bar = screen.getByRole("img");
        expect(bar.children).toHaveLength(0);
    });

    it("supports custom colors and direct Tailwind classes", () => {
        const customSegments: StackedBarSegment[] = [
            {
                id: "custom",
                label: "Custom",
                value: 100,
                color: "bg-(--pastel-pink)",
            },
        ];
        render(<StackedBar segments={customSegments} />);
        const bar = screen.getByRole("img");
        expect(bar.firstElementChild).toHaveClass("bg-(--pastel-pink)");
    });
});
