import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TruncatedText } from "../src/components/ui/TruncatedText";

describe("TruncatedText Component", () => {
    it("renders text normally", () => {
        render(<TruncatedText text="Short Name" />);
        expect(screen.getByText("Short Name")).toBeInTheDocument();
    });

    it("displays tooltip popover when hovered or clicked and text is overflowing", () => {
        // Mock scrollWidth to simulate overflowing text
        const originalScrollWidth = Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            "scrollWidth",
        );
        const originalClientWidth = Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            "clientWidth",
        );

        Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
            configurable: true,
            value: 300,
        });
        Object.defineProperty(HTMLElement.prototype, "clientWidth", {
            configurable: true,
            value: 100,
        });

        render(<TruncatedText text="Income Enhanced Incomeshield Preferred" />);
        const textElement = screen.getByText("Income Enhanced Incomeshield Preferred");
        expect(textElement).toBeInTheDocument();

        // Click / tap triggers popover
        fireEvent.click(textElement);
        expect(screen.getByRole("tooltip")).toBeInTheDocument();
        expect(screen.getByRole("tooltip")).toHaveTextContent("Income Enhanced Incomeshield Preferred");

        // Click again closes popover
        fireEvent.click(textElement);
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

        // Restore mocks
        if (originalScrollWidth) {
            Object.defineProperty(HTMLElement.prototype, "scrollWidth", originalScrollWidth);
        }
        if (originalClientWidth) {
            Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
        }
    });

    it("closes tooltip when clicking outside", () => {
        Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
            configurable: true,
            value: 300,
        });
        Object.defineProperty(HTMLElement.prototype, "clientWidth", {
            configurable: true,
            value: 100,
        });

        render(
            <div>
                <span data-testid="outside">Outside Area</span>
                <TruncatedText text="Very Long Insurance Name That Truncates" />
            </div>,
        );

        const textElement = screen.getByText("Very Long Insurance Name That Truncates");
        fireEvent.click(textElement);
        expect(screen.getByRole("tooltip")).toBeInTheDocument();

        // Click outside
        fireEvent.mouseDown(screen.getByTestId("outside"));
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
});
