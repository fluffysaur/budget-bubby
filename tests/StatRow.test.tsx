import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatRow } from "../src/components/ui/StatRow";
import { Calendar } from "lucide-react";

describe("StatRow", () => {
    it("renders icon and value with accessible title and aria-label", () => {
        render(
            <StatRow
                icon={<Calendar data-testid="icon" />}
                label="Due Day"
                value="28th"
            />,
        );
        expect(screen.getByTestId("icon")).toBeInTheDocument();
        expect(screen.getByText("28th")).toBeInTheDocument();
        // Label is exposed to assistive tech even when visually hidden
        expect(screen.getByText("Due Day")).toHaveClass("sr-only");
        expect(screen.getByText("28th").parentElement).toHaveAttribute(
            "title",
            "Due Day",
        );
    });

    it("displays visible text label when showLabel is true", () => {
        render(
            <StatRow
                icon={<Calendar />}
                label="Statement Day"
                value="3rd"
                showLabel
            />,
        );
        expect(screen.getByText("Statement Day")).toBeInTheDocument();
        expect(screen.getByText("3rd")).toBeInTheDocument();
    });

    it("applies tone styling correctly", () => {
        const { rerender } = render(
            <StatRow
                icon={<Calendar />}
                label="Status"
                value="Over"
                tone="over"
            />,
        );
        expect(screen.getByText("Over")).toHaveClass("text-rose-700");

        rerender(
            <StatRow
                icon={<Calendar />}
                label="Status"
                value="Good"
                tone="ok"
            />,
        );
        expect(screen.getByText("Good")).toHaveClass("text-emerald-700");
    });
});
