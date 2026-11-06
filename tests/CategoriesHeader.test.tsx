import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CategoriesHeader } from "../src/components/budget/CategoriesHeader";

describe("CategoriesHeader", () => {
    it("shows remaining under the cap with an emerald bar", () => {
        render(<CategoriesHeader remaining={500} allocated={1000} spent={500} />);
        expect(screen.getByText(/left/)).toHaveTextContent("S$500.00 left");
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "50");
        expect(bar.firstElementChild?.className).toContain("bg-emerald-500");
    });

    it("uses amber at 85%", () => {
        render(<CategoriesHeader remaining={150} allocated={1000} spent={850} />);
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "85");
        expect(bar.firstElementChild?.className).toContain("bg-amber-500");
    });

    it("shows over amount in rose and clamps the bar when over cap", () => {
        render(<CategoriesHeader remaining={-200} allocated={1000} spent={1200} />);
        expect(screen.getByText(/over/)).toHaveTextContent("S$200.00 over");
        expect(screen.queryByText(/left/)).not.toBeInTheDocument();
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "100");
        expect(bar.firstElementChild?.className).toContain("bg-rose-500");
    });

    it("hides the bar when nothing is allocated", () => {
        render(<CategoriesHeader remaining={0} allocated={0} spent={0} />);
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
});
