/**
 * Loading skeleton tests:
 * - Skeleton primitives expose an accessible loading status
 * - Pages render page-shaped skeletons (role="status") while loading, then real content
 * - Switching to an uncached month shows skeletons instead of the previous month's numbers
 */

import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { BudgetPage } from "../src/pages/BudgetPage";
import { DashboardPage } from "../src/pages/DashboardPage";
import { GoalsPage } from "../src/pages/GoalsPage";
import { LoansPage } from "../src/pages/LoansPage";
import { RecurringPage } from "../src/pages/RecurringPage";
import { financeService } from "../src/services/financeService";
import { Skeleton, SkeletonGroup, StatCard } from "../src/components/ui";
import { getCurrentMonth, addMonths } from "../src/lib/dateUtils";
import type { MonthlyBudgetDetail, SavingsGoal, Loan, RecurringItem } from "../src/types/finance";

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

function makeBudget(month: string, gross: number): MonthlyBudgetDetail {
    return {
        budget: {
            id: `mb-${month}`,
            household_id: "hh-00000000-0001",
            owner_id: "mem-00000000-0011",
            month,
            gross_salary: gross,
            bonus: 0,
            cpf_deduction: gross * 0.2,
            taxes_deduction: 0,
            insurance_deduction: 0,
            after_deductions: gross * 0.8,
            notes: "",
            is_locked: false,
        },
        categories: [],
        disposablePool: gross * 0.8,
        totalSpent: 0,
        totalRemaining: gross * 0.8,
    };
}

describe("Skeleton primitives", () => {
    it("SkeletonGroup announces loading via role=status, aria-busy and sr-only text", () => {
        render(
            <SkeletonGroup label="Loading things">
                <Skeleton className="h-4 w-10" />
            </SkeletonGroup>,
        );
        const status = screen.getByRole("status");
        expect(status).toHaveAttribute("aria-busy", "true");
        expect(within(status).getByText("Loading things")).toHaveClass("sr-only");
    });

    it("Skeleton blocks are decorative and only pulse when motion is allowed", () => {
        const { container } = render(<Skeleton />);
        const block = container.firstElementChild as HTMLElement;
        expect(block).toHaveAttribute("aria-hidden", "true");
        expect(block.className).toContain("motion-safe:animate-pulse");
        expect(block.className).not.toMatch(/(^|\s)animate-pulse/);
    });

    it("StatCard renders skeleton placeholders instead of its value while loading", () => {
        const { rerender } = render(
            <StatCard title="Gross" value="S$0" subtitle="3 items" loading />,
        );
        expect(screen.getByText("Gross")).toBeInTheDocument();
        expect(screen.queryByText("S$0")).not.toBeInTheDocument();
        expect(screen.queryByText("3 items")).not.toBeInTheDocument();

        rerender(<StatCard title="Gross" value="S$5,000" subtitle="3 items" />);
        expect(screen.getByText("S$5,000")).toBeInTheDocument();
        expect(screen.getByText("3 items")).toBeInTheDocument();
    });
});

describe("Page loading skeletons", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("BudgetPage shows a skeleton while loading, then the budget figures", async () => {
        const month = getCurrentMonth();
        const pending = deferred<MonthlyBudgetDetail>();
        vi.spyOn(financeService, "getMonthlyBudget").mockImplementation(() => pending.promise);

        render(
            <HouseholdProvider initialPerspective="yijia">
                <BudgetPage />
            </HouseholdProvider>,
        );

        expect(await screen.findByTestId("budget-skeleton")).toHaveAttribute("role", "status");
        expect(screen.queryByText("S$7,345")).not.toBeInTheDocument();

        await act(async () => {
            pending.resolve(makeBudget(month, 7345));
        });

        await waitFor(() => {
            expect(screen.queryByTestId("budget-skeleton")).not.toBeInTheDocument();
        });
        expect(screen.getAllByText("S$7,345").length).toBeGreaterThan(0);
    });

    it("switching to an uncached month shows the skeleton, not the previous month's numbers", async () => {
        const month = getCurrentMonth();
        const nextMonth = addMonths(month, 1);
        const nextPending = deferred<MonthlyBudgetDetail>();

        vi.spyOn(financeService, "getMonthlyBudget").mockImplementation((m: string) =>
            m === month ? Promise.resolve(makeBudget(month, 7345)) : nextPending.promise,
        );

        render(
            <HouseholdProvider initialPerspective="yijia">
                <BudgetPage />
            </HouseholdProvider>,
        );

        await waitFor(() => {
            expect(screen.getAllByText("S$7,345").length).toBeGreaterThan(0);
        });
        expect(screen.queryByTestId("budget-skeleton")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Next month" }));

        expect(await screen.findByTestId("budget-skeleton")).toBeInTheDocument();
        expect(screen.queryByText("S$7,345")).not.toBeInTheDocument();

        await act(async () => {
            nextPending.resolve(makeBudget(nextMonth, 8120));
        });

        await waitFor(() => {
            expect(screen.getAllByText("S$8,120").length).toBeGreaterThan(0);
        });
        expect(screen.queryByTestId("budget-skeleton")).not.toBeInTheDocument();
        expect(screen.queryByText("S$7,345")).not.toBeInTheDocument();
    });

    it("GoalsPage shows a goals skeleton while loading, then the empty state", async () => {
        const pending = deferred<SavingsGoal[]>();
        vi.spyOn(financeService, "getGoals").mockImplementation(() => pending.promise);

        render(
            <MemoryRouter>
                <HouseholdProvider>
                    <GoalsPage />
                </HouseholdProvider>
            </MemoryRouter>,
        );

        expect(await screen.findByTestId("goals-skeleton")).toHaveAttribute("role", "status");

        await act(async () => {
            pending.resolve([]);
        });

        await waitFor(() => {
            expect(screen.queryByTestId("goals-skeleton")).not.toBeInTheDocument();
        });
        expect(screen.getByText("No Goals")).toBeInTheDocument();
    });

    it("LoansPage shows a loans skeleton while loading, then the empty state", async () => {
        const pending = deferred<Loan[]>();
        vi.spyOn(financeService, "getLoans").mockImplementation(() => pending.promise);

        render(
            <HouseholdProvider>
                <LoansPage />
            </HouseholdProvider>,
        );

        expect(await screen.findByTestId("loans-skeleton")).toHaveAttribute("role", "status");

        await act(async () => {
            pending.resolve([]);
        });

        await waitFor(() => {
            expect(screen.queryByTestId("loans-skeleton")).not.toBeInTheDocument();
        });
        expect(screen.getByText("No Loans")).toBeInTheDocument();
    });

    it("RecurringPage shows a skeleton while loading, then the policy table", async () => {
        const pending = deferred<RecurringItem[]>();
        vi.spyOn(financeService, "getRecurringItems").mockImplementation(() => pending.promise);

        render(
            <HouseholdProvider>
                <RecurringPage />
            </HouseholdProvider>,
        );

        expect(await screen.findByTestId("recurring-skeleton")).toHaveAttribute("role", "status");
        expect(screen.queryByText(/All Recurring/i)).not.toBeInTheDocument();

        await act(async () => {
            pending.resolve([]);
        });

        await waitFor(() => {
            expect(screen.queryByTestId("recurring-skeleton")).not.toBeInTheDocument();
        });
        expect(screen.getByText(/All Recurring/i)).toBeInTheDocument();
    });

    it("DashboardPage keeps the skeleton until budget data arrives instead of showing S$0 figures", async () => {
        const month = getCurrentMonth();
        const pending = deferred<MonthlyBudgetDetail>();
        vi.spyOn(financeService, "getMonthlyBudget").mockImplementation(() => pending.promise);

        render(
            <HouseholdProvider initialPerspective="yijia">
                <DashboardPage />
            </HouseholdProvider>,
        );

        const skeleton = await screen.findByTestId("dashboard-skeleton");
        expect(skeleton).toHaveAttribute("role", "status");
        expect(screen.queryByRole("region", { name: "Personal Budget Progress" })).not.toBeInTheDocument();

        await act(async () => {
            pending.resolve(makeBudget(month, 7345));
        });

        await waitFor(() => {
            expect(screen.queryByTestId("dashboard-skeleton")).not.toBeInTheDocument();
        });
        expect(screen.getByRole("region", { name: "Personal Budget Progress" })).toBeInTheDocument();
    });
});
