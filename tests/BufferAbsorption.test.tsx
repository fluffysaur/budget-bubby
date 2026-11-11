import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CategoryProgressList } from "../src/components/budget/CategoryProgressList";
import type { Category, MonthlyBudgetCategoryDetail } from "../src/types/finance";

describe("Buffer Overspending Auto-Absorption (Issue #141)", () => {
    const foodCategory: Category = {
        id: "cat-food",
        name: "Food",
        group: "spendable",
        color: "#F97316",
        icon: "utensils",
        is_system: true,
        household_id: "hh-01",
    };

    const transportCategory: Category = {
        id: "cat-transport",
        name: "Transport",
        group: "spendable",
        color: "#06B6D4",
        icon: "car",
        is_system: true,
        household_id: "hh-01",
    };

    const bufferCategory: Category = {
        id: "cat-buf",
        name: "Buffer",
        group: "spendable",
        color: "#8B5CF6",
        icon: "shield",
        is_system: true,
        household_id: "hh-01",
    };

    it("displays 'Covered by Buffer' badge and cushions deficit without alarming alert banner", () => {
        const categories: MonthlyBudgetCategoryDetail[] = [
            {
                id: "mbc-food",
                monthly_budget_id: "mb-01",
                category_id: "cat-food",
                percentage: 0.5,
                allocated_amount: 500.0,
                actualSpent: 600.0, // $100 overage
                category: foodCategory,
            },
            {
                id: "mbc-buf",
                monthly_budget_id: "mb-01",
                category_id: "cat-buf",
                percentage: 0.3,
                allocated_amount: 300.0,
                actualSpent: 50.0, // $250 available buffer
                category: bufferCategory,
            },
        ];

        render(<CategoryProgressList categories={categories} />);

        // Food category retains visibility of spending and overage
        expect(screen.getByText("Food")).toBeInTheDocument();
        expect(screen.getAllByText("S$100.00").length).toBeGreaterThanOrEqual(2);
        expect(
            screen.getByText(
                (content, el) =>
                    el?.tagName.toLowerCase() === "span" &&
                    content.trim() === "over",
            ),
        ).toBeInTheDocument();

        // Food displays 'Covered by Buffer' badge
        expect(screen.getByText("Covered by Buffer")).toBeInTheDocument();
        expect(screen.getByTestId("badge-covered-cat-food")).toBeInTheDocument();

        // Alarming top over-budget alert banner should NOT be displayed
        expect(
            screen.queryByText(/categories have exceeded budget|category has exceeded budget/i),
        ).not.toBeInTheDocument();

        // Buffer category card deducts absorbed overages from remaining balance
        // Allocated $300 - direct $50 - absorbed $100 = $150 remaining
        expect(screen.getByText("S$150.00")).toBeInTheDocument();
        expect(screen.getByText("Cushioning")).toBeInTheDocument();

        // Buffer card shows direct spending alongside absorbed overages
        expect(screen.getByText("Direct:")).toBeInTheDocument();
        expect(screen.getByText("Absorbed overages:")).toBeInTheDocument();
    });

    it("handles multiple overspent categories comfortably cushioned by Buffer", () => {
        const categories: MonthlyBudgetCategoryDetail[] = [
            {
                id: "mbc-food",
                monthly_budget_id: "mb-01",
                category_id: "cat-food",
                percentage: 0.4,
                allocated_amount: 400.0,
                actualSpent: 480.0, // $80 overage
                category: foodCategory,
            },
            {
                id: "mbc-trans",
                monthly_budget_id: "mb-01",
                category_id: "cat-transport",
                percentage: 0.2,
                allocated_amount: 200.0,
                actualSpent: 240.0, // $40 overage
                category: transportCategory,
            },
            {
                id: "mbc-buf",
                monthly_budget_id: "mb-01",
                category_id: "cat-buf",
                percentage: 0.4,
                allocated_amount: 400.0,
                actualSpent: 100.0, // $300 available
                category: bufferCategory,
            },
        ];

        render(<CategoryProgressList categories={categories} />);

        const coveredBadges = screen.getAllByText("Covered by Buffer");
        expect(coveredBadges).toHaveLength(2);

        // Buffer allocated $400 - direct $100 - absorbed $120 = $180 remaining
        expect(screen.getByText("S$180.00")).toBeInTheDocument();
        expect(screen.getByText("Cushioning")).toBeInTheDocument();
    });

    it("handles partial depletion when total category overages exceed available Buffer", () => {
        const categories: MonthlyBudgetCategoryDetail[] = [
            {
                id: "mbc-food",
                monthly_budget_id: "mb-01",
                category_id: "cat-food",
                percentage: 0.5,
                allocated_amount: 500.0,
                actualSpent: 600.0, // $100 overage (2/3 of $150)
                category: foodCategory,
            },
            {
                id: "mbc-trans",
                monthly_budget_id: "mb-01",
                category_id: "cat-transport",
                percentage: 0.2,
                allocated_amount: 200.0,
                actualSpent: 250.0, // $50 overage (1/3 of $150)
                category: transportCategory,
            },
            {
                id: "mbc-buf",
                monthly_budget_id: "mb-01",
                category_id: "cat-buf",
                percentage: 0.1,
                allocated_amount: 100.0,
                actualSpent: 20.0, // $80 available buffer capacity
                category: bufferCategory,
            },
        ];

        render(<CategoryProgressList categories={categories} />);

        // Buffer hits $0 remaining with a Depleted alert state
        expect(screen.getByText("Depleted")).toBeInTheDocument();
        expect(screen.getByTestId("badge-depleted-cat-buf")).toBeInTheDocument();
        expect(screen.getByText("S$0.00")).toBeInTheDocument();

        // Affected categories indicate 'Partially covered'
        const partiallyCovered = screen.getAllByText("Partially covered");
        expect(partiallyCovered).toHaveLength(2);

        // Indicate 'Uncovered by $X'
        expect(
            screen.getByText(
                (_, el) =>
                    el?.tagName.toLowerCase() === "span" &&
                    Boolean(el.textContent?.includes("Uncovered by S$46.67")),
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                (_, el) =>
                    el?.tagName.toLowerCase() === "span" &&
                    Boolean(el.textContent?.includes("Uncovered by S$23.33")),
            ),
        ).toBeInTheDocument();

        // Over-budget alert banner shows categories exceeding buffer cushion
        expect(screen.getByText(/2 categories have exceeded budget/i)).toBeInTheDocument();
    });

    it("displays 'Uncovered by $X' when Buffer has $0 available capacity", () => {
        const categories: MonthlyBudgetCategoryDetail[] = [
            {
                id: "mbc-food",
                monthly_budget_id: "mb-01",
                category_id: "cat-food",
                percentage: 0.5,
                allocated_amount: 500.0,
                actualSpent: 550.0, // $50 overage
                category: foodCategory,
            },
            {
                id: "mbc-buf",
                monthly_budget_id: "mb-01",
                category_id: "cat-buf",
                percentage: 0.1,
                allocated_amount: 100.0,
                actualSpent: 100.0, // 0 available buffer capacity
                category: bufferCategory,
            },
        ];

        render(<CategoryProgressList categories={categories} />);

        expect(screen.getByText("Depleted")).toBeInTheDocument();
        expect(screen.getByText(/Uncovered by/i)).toBeInTheDocument();
        expect(screen.getByTestId("badge-uncovered-cat-food")).toBeInTheDocument();
    });

    it("displays cushion breakdown in Buffer details popover", () => {
        const categories: MonthlyBudgetCategoryDetail[] = [
            {
                id: "mbc-food",
                monthly_budget_id: "mb-01",
                category_id: "cat-food",
                percentage: 0.5,
                allocated_amount: 500.0,
                actualSpent: 550.0, // $50 overage
                category: foodCategory,
            },
            {
                id: "mbc-buf",
                monthly_budget_id: "mb-01",
                category_id: "cat-buf",
                percentage: 0.2,
                allocated_amount: 200.0,
                actualSpent: 20.0, // available $180
                category: bufferCategory,
            },
        ];

        render(<CategoryProgressList categories={categories} />);

        const bufferPopoverBtn = screen.getByRole("button", {
            name: /buffer budget breakdown/i,
        });
        fireEvent.click(bufferPopoverBtn);

        expect(screen.getByText("Buffer Details")).toBeInTheDocument();
        expect(screen.getByText("Remaining cushion:")).toBeInTheDocument();
        expect(
            screen.getByText((_, el) =>
                Boolean(
                    el?.tagName.toLowerCase() === "li" &&
                        el.textContent?.includes("Food: S$50.00"),
                ),
            ),
        ).toBeInTheDocument();
    });
});
