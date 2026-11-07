import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DeltaBadge } from "../src/components/ui/DeltaBadge";

describe("DeltaBadge", () => {
    it("renders formatted percentage delta", () => {
        render(<DeltaBadge value={-8} />);
        expect(screen.getByText("8%")).toBeInTheDocument();
    });

    it("renders sign when showSign is true", () => {
        const { rerender } = render(<DeltaBadge value={-8} showSign />);
        expect(screen.getByText("-8%")).toBeInTheDocument();

        rerender(<DeltaBadge value={12} showSign />);
        expect(screen.getByText("+12%")).toBeInTheDocument();

        rerender(<DeltaBadge value={0} showSign />);
        expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("uses tone 'ok' when direction matches goodWhen", () => {
        // Default goodWhen="down": decrease in expenses is good (ok)
        const { container, rerender } = render(<DeltaBadge value={-8} />);
        expect(container.firstChild).toHaveClass("text-(--tone-ok-text)");

        // Increase in expenses is bad (over)
        rerender(<DeltaBadge value={15} />);
        expect(container.firstChild).toHaveClass("text-(--tone-over-text)");

        // Inverted: goodWhen="up" (e.g. savings / income)
        rerender(<DeltaBadge value={15} goodWhen="up" />);
        expect(container.firstChild).toHaveClass("text-(--tone-ok-text)");

        rerender(<DeltaBadge value={-10} goodWhen="up" />);
        expect(container.firstChild).toHaveClass("text-(--tone-over-text)");
    });

    it("uses tone 'neutral' when value is zero", () => {
        const { container } = render(<DeltaBadge value={0} />);
        expect(container.firstChild).toHaveClass("text-(--text-muted)");
    });

    it("renders label or children suffix", () => {
        render(<DeltaBadge value={-8} label="vs 3-mo avg" />);
        expect(screen.getByText("vs 3-mo avg")).toBeInTheDocument();
    });
});
