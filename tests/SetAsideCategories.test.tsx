/**
 * Set-aside (allocation) categories never warn:
 * - isSpendableCategory name hints and explicit group precedence
 * - CategoryProgressList shows Set aside / Funded, no banner, no rose badge
 * - CategoryLimitWarningBanner fires no sound, toast or banner
 * - checkBudgetLimitReminders skips allocation categories
 */

import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as soundEffects from "../src/lib/soundEffects";
import { CategoryLimitWarningBanner } from "../src/components/budget/CategoryLimitWarningBanner";
import { CategoryProgressList } from "../src/components/budget/CategoryProgressList";
import { isSpendableCategory } from "../src/lib/financialFormulas";
import { checkBudgetLimitReminders } from "../src/lib/reminders/rules";
import type {
    Category,
    Expense,
    MonthlyBudgetCategoryDetail,
    MonthlyBudgetDetail,
} from "../src/types/finance";

vi.mock("../src/lib/soundEffects", () => ({
    playBudgetWarningSound: vi.fn(),
    playBudgetExceededSound: vi.fn(),
    playChaChingSound: vi.fn(),
    initAudioUnlock: vi.fn(),
}));

function cat(name: string, group?: Category["group"]): Category {
    return {
        id: `cat-${name}`,
        household_id: "hh-01",
        name,
        color: "#10B981",
        icon: "layers",
        is_system: false,
        ...(group ? { group } : {}),
    } as Category;
}

function detail(
    category: Category | undefined,
    allocated: number,
    spent: number,
    categoryId = category?.id ?? "cat-missing",
): MonthlyBudgetCategoryDetail {
    return {
        id: `mbc-${categoryId}`,
        monthly_budget_id: "mb-01",
        category_id: categoryId,
        percentage: 0.1,
        allocated_amount: allocated,
        actualSpent: spent,
        remaining: allocated - spent,
        category,
    };
}

describe("isSpendableCategory", () => {
    it("treats Allowance as an allocation by name", () => {
        expect(isSpendableCategory("Allowance")).toBe(false);
        expect(isSpendableCategory("  Pocket ALLOWANCE ")).toBe(false);
        expect(isSpendableCategory({ ...cat("Allowance") })).toBe(false);
    });

    it("lets an explicit group win over the name", () => {
        expect(isSpendableCategory(cat("Allowance", "spendable"))).toBe(true);
        expect(isSpendableCategory(cat("Food", "allocation"))).toBe(false);
    });

    it("keeps existing hints and defaults", () => {
        expect(isSpendableCategory("Investments")).toBe(false);
        expect(isSpendableCategory("Savings")).toBe(false);
        expect(isSpendableCategory("Tithing")).toBe(false);
        expect(isSpendableCategory("Food")).toBe(true);
        expect(isSpendableCategory(undefined)).toBe(true);
    });

    it("treats a bare UUID as spendable", () => {
        expect(
            isSpendableCategory("0b9f7a52-3c1d-4e8a-9a41-6f2d1c7e5b10"),
        ).toBe(true);
    });
});

describe("CategoryProgressList set-aside rows", () => {
    it("shows Set aside / Funded with no warnings when over cap", () => {
        const allowance = detail(cat("Allowance"), 200, 350);
        render(<CategoryProgressList categories={[allowance]} />);

        expect(screen.queryByText(/exceeded budget/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Over by/i)).not.toBeInTheDocument();
        expect(
            screen.queryByTestId(`badge-rose-${allowance.category_id}`),
        ).not.toBeInTheDocument();
        expect(screen.getAllByText("Set aside").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Funded")).toBeInTheDocument();
        expect(screen.getByText("S$350.00")).toBeInTheDocument();
        expect(screen.queryByText("Remaining")).not.toBeInTheDocument();
    });

    it("hides Funded when nothing is funded and hides the bar at zero allocation", () => {
        render(
            <CategoryProgressList
                categories={[detail(cat("Savings"), 0, 0)]}
            />,
        );
        expect(screen.queryByText("Funded")).not.toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("still warns for spendable categories over cap", () => {
        const food = detail(cat("Food", "spendable"), 100, 150);
        render(<CategoryProgressList categories={[food]} />);
        expect(screen.getByText(/exceeded budget/i)).toBeInTheDocument();
        expect(
            screen.getByTestId(`badge-rose-${food.category_id}`),
        ).toBeInTheDocument();
    });

    it("banner only counts spendable categories in a mixed list", () => {
        render(
            <CategoryProgressList
                categories={[
                    detail(cat("Allowance"), 100, 300),
                    detail(cat("Food"), 100, 150),
                ]}
            />,
        );
        expect(screen.getByText(/1 category has exceeded budget/i)).toBeInTheDocument();
    });
});

describe("CategoryLimitWarningBanner with allocation categories", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders no banner for an over-cap allocation category", () => {
        const { container } = render(
            <CategoryLimitWarningBanner
                categories={[detail(cat("Allowance"), 100, 300)]}
            />,
        );
        expect(
            container.querySelector('[data-testid="category-limit-warning-banner"]'),
        ).toBeNull();
    });

    it("plays no sound and shows no toast when an allocation crosses 80% and 100%", () => {
        const allowance = detail(cat("Allowance"), 100, 70);
        render(<CategoryLimitWarningBanner categories={[allowance]} />);

        const fire = (amount: number) =>
            act(() => {
                const expense: Expense = {
                    id: `exp-${amount}`,
                    household_id: "hh-01",
                    payer_id: "mem-01",
                    category_id: allowance.category_id,
                    date: "2026-10-27",
                    item: "Top up",
                    amount,
                    is_shared: false,
                    split_ratio: 0.5,
                    settled: false,
                };
                window.dispatchEvent(
                    new CustomEvent("expenseAdded", { detail: expense }),
                );
            });

        fire(15); // 85%
        fire(50); // beyond 100% of the original
        expect(soundEffects.playBudgetWarningSound).not.toHaveBeenCalled();
        expect(soundEffects.playBudgetExceededSound).not.toHaveBeenCalled();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});

describe("checkBudgetLimitReminders with allocation categories", () => {
    const base = (
        categories: MonthlyBudgetCategoryDetail[],
    ): MonthlyBudgetDetail => ({
        budget: {
            id: "b-1",
            household_id: "hh-1",
            owner_id: "mem-1",
            month: "2026-10",
            gross_salary: 5000,
            bonus: 0,
            cpf_deduction: 1000,
            taxes_deduction: 0,
            insurance_deduction: 0,
            after_deductions: 4000,
            is_locked: false,
        },
        disposablePool: 4000,
        totalSpent: 0,
        totalRemaining: 0,
        categories,
    });

    it("returns nothing for an allocation category over cap", () => {
        expect(
            checkBudgetLimitReminders(
                base([detail(cat("Allowance"), 100, 300)]),
                80,
            ),
        ).toEqual([]);
        expect(
            checkBudgetLimitReminders(
                base([detail(cat("Food", "allocation"), 100, 300)]),
                80,
            ),
        ).toEqual([]);
    });

    it("documents the missing-join case: a bare category id is treated as spendable", () => {
        const alerts = checkBudgetLimitReminders(
            base([detail(undefined, 100, 300, "0b9f7a52-3c1d-4e8a-9a41-6f2d1c7e5b10")]),
            80,
        );
        expect(alerts).toHaveLength(1);
    });
});
