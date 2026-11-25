import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CategoriesHeader } from "../src/components/budget/CategoriesHeader";

describe("CategoriesHeader", () => {
    it("shows spent / allocated under the cap with an ok tone bar", () => {
        render(
            <CategoriesHeader remaining={500} allocated={1000} spent={500} />,
        );
        const spentEl = screen.getByText("S$500.00");
        expect(spentEl.parentElement?.className).toContain("text-(--text-ink)");
        expect(
            spentEl.closest("p")?.textContent?.replace(/\s+/g, " ").trim(),
        ).toBe("S$500.00 / S$1,000.00");
        expect(screen.queryByText(/left|over cap/i)).not.toBeInTheDocument();
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "50");
        expect(bar.firstElementChild?.className).toContain("bg-(--tone-ok)");
    });

    it("uses near tone at 85%", () => {
        render(
            <CategoriesHeader remaining={150} allocated={1000} spent={850} />,
        );
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "85");
        expect(bar.firstElementChild?.className).toContain("bg-(--tone-near)");
    });

    it("colours spent in coral and clamps the bar when over cap", () => {
        render(
            <CategoriesHeader remaining={-200} allocated={1000} spent={1200} />,
        );
        const spentEl = screen.getByText("S$1,200.00");
        expect(spentEl.parentElement?.className).toContain(
            "text-(--accent-coral-ink)",
        );
        expect(
            spentEl.closest("p")?.textContent?.replace(/\s+/g, " ").trim(),
        ).toBe("S$1,200.00 / S$1,000.00");
        expect(screen.queryByText(/left|over cap/i)).not.toBeInTheDocument();
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "120");
        expect(bar.firstElementChild?.className).toContain("bg-(--tone-over)");
    });

    it("hides the bar when nothing is allocated", () => {
        render(<CategoriesHeader remaining={0} allocated={0} spent={0} />);
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
});
