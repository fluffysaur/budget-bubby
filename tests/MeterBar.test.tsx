import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MeterBar } from "../src/components/ui/MeterBar";

describe("MeterBar", () => {
    it("renders progressbar with correct accessibility attributes", () => {
        render(<MeterBar value={50} max={100} aria-label="Budget meter" />);
        const bar = screen.getByRole("progressbar", { name: "Budget meter" });
        expect(bar).toBeInTheDocument();
        expect(bar).toHaveAttribute("aria-valuenow", "50");
        expect(bar).toHaveAttribute("aria-valuemin", "0");
        expect(bar).toHaveAttribute("aria-valuemax", "100");
    });

    it("automatically derives spend tone from percentage", () => {
        const { rerender } = render(<MeterBar value={50} max={100} />);
        let fill = screen.getByRole("progressbar").firstElementChild;
        expect(fill?.className).toContain("bg-(--tone-ok)");

        rerender(<MeterBar value={85} max={100} />);
        fill = screen.getByRole("progressbar").firstElementChild;
        expect(fill?.className).toContain("bg-(--tone-near)");

        rerender(<MeterBar value={110} max={100} />);
        fill = screen.getByRole("progressbar").firstElementChild;
        expect(fill?.className).toContain("bg-(--tone-over)");
    });

    it("allows tone prop override", () => {
        render(<MeterBar value={50} max={100} tone="over" />);
        const fill = screen.getByRole("progressbar").firstElementChild;
        expect(fill?.className).toContain("bg-(--tone-over)");
    });

    it("clamps fill width to 100% when overspent", () => {
        render(<MeterBar value={150} max={100} />);
        const fill = screen.getByRole("progressbar").firstElementChild;
        expect(fill).toHaveStyle({ width: "100%" });
    });

    it("clamps fill width to 0% when negative", () => {
        render(<MeterBar value={-10} max={100} />);
        const fill = screen.getByRole("progressbar").firstElementChild;
        expect(fill).toHaveStyle({ width: "0%" });
    });

    it("renders optional benchmark/pace marker at correct position", () => {
        render(<MeterBar value={40} max={100} marker={75} />);
        const marker = screen.getByTestId("meter-marker");
        expect(marker).toBeInTheDocument();
        expect(marker).toHaveStyle({ left: "75%" });
    });

    it("applies size classes correctly", () => {
        const { rerender } = render(
            <MeterBar value={50} max={100} size="sm" />,
        );
        expect(screen.getByRole("progressbar").className).toContain("h-1.5");

        rerender(<MeterBar value={50} max={100} size="md" />);
        expect(screen.getByRole("progressbar").className).toContain("h-2.5");

        rerender(<MeterBar value={50} max={100} size="lg" />);
        expect(screen.getByRole("progressbar").className).toContain("h-3.5");
    });
});
