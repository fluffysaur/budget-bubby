import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipPopover } from "../src/components/ui/TooltipPopover";

describe("TooltipPopover Component", () => {
    it("renders trigger button and opens popover on click", () => {
        render(
            <TooltipPopover title="Shared Info" ariaLabel="Shared spending info">
                This explains how shared spending works.
            </TooltipPopover>,
        );

        const triggerButton = screen.getByRole("button", { name: "Shared spending info" });
        expect(triggerButton).toBeInTheDocument();
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

        // Click to open
        fireEvent.click(triggerButton);

        expect(triggerButton).toHaveClass("bg-(--bg-cream)");
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toBeInTheDocument();
        expect(tooltip).toHaveClass("z-9999");
        expect(screen.getByText("Shared Info")).toBeInTheDocument();
        expect(screen.getByText("This explains how shared spending works.")).toBeInTheDocument();

        // Click close button inside tooltip
        const closeButton = screen.getByRole("button", { name: "Close tooltip" });
        fireEvent.click(closeButton);
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("closes popover when clicking outside", () => {
        render(
            <div>
                <button type="button" data-testid="outside-button">Outside</button>
                <TooltipPopover title="Test Title" ariaLabel="Info">
                    Details content
                </TooltipPopover>
            </div>,
        );

        const triggerButton = screen.getByRole("button", { name: "Info" });
        fireEvent.click(triggerButton);
        expect(screen.getByRole("tooltip")).toBeInTheDocument();

        // Click outside element
        fireEvent.mouseDown(screen.getByTestId("outside-button"));
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("renders custom triggerLabel when provided", () => {
        render(
            <TooltipPopover triggerLabel={<span>Custom Trigger</span>}>
                Custom body content
            </TooltipPopover>,
        );

        expect(screen.getByText("Custom Trigger")).toBeInTheDocument();
    });
});

