import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Sparkline } from "../src/components/ui/Sparkline";

describe("Sparkline", () => {
    it("renders polyline and end dot for data array", () => {
        const { container } = render(
            <Sparkline data={[10, 20, 15, 30]} aria-label="Spend trend" />,
        );
        const svg = screen.getByRole("img", { name: "Spend trend" });
        expect(svg).toBeInTheDocument();

        const polyline = container.querySelector("polyline");
        expect(polyline).toBeInTheDocument();
        expect(polyline?.getAttribute("points")).toBeTruthy();

        const dot = container.querySelector("circle");
        expect(dot).toBeInTheDocument();
        expect(dot).toHaveAttribute("r", "3");
    });

    it("handles empty data gracefully", () => {
        const { container } = render(<Sparkline data={[]} />);
        const polyline = container.querySelector("polyline");
        expect(polyline).not.toBeInTheDocument();
    });

    it("handles single-point data gracefully", () => {
        const { container } = render(<Sparkline data={[42]} />);
        const polyline = container.querySelector("polyline");
        expect(polyline).toBeInTheDocument();
        const dot = container.querySelector("circle");
        expect(dot).toBeInTheDocument();
    });

    it("applies tone classes correctly", () => {
        const { container, rerender } = render(
            <Sparkline data={[10, 20]} tone="ok" />,
        );
        let polyline = container.querySelector("polyline");
        expect(polyline?.getAttribute("class")).toContain("stroke-(--tone-ok)");

        rerender(<Sparkline data={[10, 20]} tone="over" />);
        polyline = container.querySelector("polyline");
        expect(polyline?.getAttribute("class")).toContain(
            "stroke-(--tone-over)",
        );

        rerender(<Sparkline data={[10, 20]} tone="neutral" />);
        polyline = container.querySelector("polyline");
        expect(polyline?.getAttribute("class")).toContain(
            "stroke-(--text-muted)",
        );
    });
});
