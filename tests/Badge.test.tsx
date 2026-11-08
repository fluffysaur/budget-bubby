import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "../src/components/ui/Badge";

describe("Badge", () => {
    it("renders children text", () => {
        render(<Badge>Active</Badge>);
        expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders status variants with their default icons and tone styles", () => {
        const { container, rerender } = render(
            <Badge variant="ok">Done</Badge>,
        );
        expect(container.firstChild).toHaveClass("bg-(--tone-ok-bg)");
        expect(container.querySelector("svg")).toBeInTheDocument(); // Check icon

        rerender(<Badge variant="near">Near Limit</Badge>);
        expect(container.firstChild).toHaveClass("bg-(--tone-near-bg)");
        expect(container.querySelector("svg")).toBeInTheDocument(); // AlertTriangle icon

        rerender(<Badge variant="over">Over Cap</Badge>);
        expect(container.firstChild).toHaveClass("bg-(--tone-over-bg)");
        expect(container.querySelector("svg")).toBeInTheDocument(); // AlertCircle icon

        rerender(<Badge variant="due">Due Soon</Badge>);
        expect(container.firstChild).toHaveClass("bg-(--pastel-lilac-light)");
        expect(container.querySelector("svg")).toBeInTheDocument(); // Clock icon

        rerender(<Badge variant="paid">Settled</Badge>);
        expect(container.firstChild).toHaveClass("bg-(--tone-ok-bg)");
        expect(container.querySelector("svg")).toBeInTheDocument(); // Check icon
    });

    it("allows custom icon override for status variants", () => {
        render(
            <Badge
                variant="ok"
                icon={<span data-testid="custom-icon">✨</span>}
            >
                Custom
            </Badge>,
        );
        expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    });

    it("renders backward compatible pastel and color variants", () => {
        const { container, rerender } = render(
            <Badge variant="lilac">Lilac</Badge>,
        );
        expect(container.firstChild).toHaveClass("bg-(--pastel-lilac-light)");

        rerender(<Badge variant="butter">Butter</Badge>);
        expect(container.firstChild).toHaveClass("bg-(--pastel-butter-light)");

        rerender(<Badge variant="blush">Blush</Badge>);
        expect(container.firstChild).toHaveClass("bg-(--pastel-pink-light)");
    });
});
