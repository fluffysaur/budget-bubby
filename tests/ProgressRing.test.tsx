import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LazyMotion, domAnimation } from "motion/react";
import { ProgressRing } from "../src/components/ui/ProgressRing";

function renderWithMotion(ui: React.ReactElement) {
    return render(
        <LazyMotion features={domAnimation} strict>
            {ui}
        </LazyMotion>,
    );
}

describe("ProgressRing", () => {
    it("renders progressbar with correct accessibility attributes", () => {
        renderWithMotion(
            <ProgressRing value={60} aria-label="Goal progress" />,
        );
        const ring = screen.getByRole("progressbar", { name: "Goal progress" });
        expect(ring).toBeInTheDocument();
        expect(ring).toHaveAttribute("aria-valuenow", "60");
    });

    it("handles ratio values (0 to 1) and percentage values (0 to 100)", () => {
        const { rerender } = renderWithMotion(
            <ProgressRing value={0.75} aria-label="Ratio ring" />,
        );
        expect(screen.getByRole("progressbar")).toHaveAttribute(
            "aria-valuenow",
            "75",
        );

        rerender(
            <LazyMotion features={domAnimation} strict>
                <ProgressRing value={80} aria-label="Pct ring" />
            </LazyMotion>,
        );
        expect(screen.getByRole("progressbar")).toHaveAttribute(
            "aria-valuenow",
            "80",
        );
    });

    it("handles value and max props", () => {
        renderWithMotion(<ProgressRing value={250} max={1000} />);
        expect(screen.getByRole("progressbar")).toHaveAttribute(
            "aria-valuenow",
            "25",
        );
    });

    it("renders centerContent or children inside the ring", () => {
        renderWithMotion(
            <ProgressRing
                value={50}
                centerContent={<span data-testid="center-icon">🏆</span>}
            />,
        );
        expect(screen.getByTestId("center-icon")).toBeInTheDocument();
    });

    it("applies tone stroke classes based on spendTone or override", () => {
        const { container, rerender } = renderWithMotion(
            <ProgressRing value={60} />,
        );
        let animatedCircle = container.querySelector("circle:nth-child(2)");
        expect(animatedCircle?.getAttribute("class")).toContain(
            "stroke-(--tone-ok)",
        );

        rerender(
            <LazyMotion features={domAnimation} strict>
                <ProgressRing value={90} />
            </LazyMotion>,
        );
        animatedCircle = container.querySelector("circle:nth-child(2)");
        expect(animatedCircle?.getAttribute("class")).toContain(
            "stroke-(--tone-near)",
        );

        rerender(
            <LazyMotion features={domAnimation} strict>
                <ProgressRing value={120} />
            </LazyMotion>,
        );
        animatedCircle = container.querySelector("circle:nth-child(2)");
        expect(animatedCircle?.getAttribute("class")).toContain(
            "stroke-(--tone-over)",
        );

        rerender(
            <LazyMotion features={domAnimation} strict>
                <ProgressRing value={50} tone="over" />
            </LazyMotion>,
        );
        animatedCircle = container.querySelector("circle:nth-child(2)");
        expect(animatedCircle?.getAttribute("class")).toContain(
            "stroke-(--tone-over)",
        );
    });
});
