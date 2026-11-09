import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CalendarStrip } from "../src/components/ui/CalendarStrip";

describe("CalendarStrip", () => {
    it("renders meter role with default aria-label and values", () => {
        render(<CalendarStrip daysRemaining={5} totalDots={7} />);
        const meter = screen.getByRole("meter");
        expect(meter).toBeInTheDocument();
        expect(meter).toHaveAttribute("aria-valuenow", "5");
        expect(meter).toHaveAttribute("aria-valuemin", "0");
        expect(meter).toHaveAttribute("aria-valuemax", "7");
        expect(meter).toHaveAttribute("title", "Due in 5 days");
    });

    it("derives urgent status when daysRemaining <= 3", () => {
        render(<CalendarStrip daysRemaining={2} totalDots={5} />);
        const meter = screen.getByRole("meter");
        expect(meter).toHaveAttribute("title", "Due in 2 days");
        // Target dot has urgent tone
        const targetDot = meter.querySelector(".bg-\\(--tone-over\\)");
        expect(targetDot).toBeInTheDocument();
    });

    it("derives overdue status when daysRemaining < 0", () => {
        render(<CalendarStrip daysRemaining={-3} totalDots={5} />);
        const meter = screen.getByRole("meter");
        expect(meter).toHaveAttribute("title", "Overdue by 3 days");
        const pulsatingDots = meter.querySelectorAll(".animate-pulse");
        expect(pulsatingDots.length).toBeGreaterThan(0);
    });

    it("renders paid status when explicitly passed", () => {
        render(
            <CalendarStrip
                daysRemaining={null}
                status="paid"
                label="Paid"
            />,
        );
        const meter = screen.getByRole("meter");
        expect(meter).toBeInTheDocument();
        expect(screen.getByText("Paid")).toBeInTheDocument();
        const okDots = meter.querySelectorAll(".bg-\\(--tone-ok\\)");
        expect(okDots.length).toBe(7); // default 7 dots all filled
    });

    it("renders custom label alongside the dots", () => {
        render(
            <CalendarStrip
                daysRemaining={4}
                label="4d remaining"
            />,
        );
        expect(screen.getByText("4d remaining")).toBeInTheDocument();
    });
});
