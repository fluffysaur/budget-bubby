import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExpensesPage } from "../src/pages/ExpensesPage";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { queryClient } from "../src/lib/queryClient";
import { financeService } from "../src/services/financeService";
import { ExpenseFormModal } from "../src/components/expenses/ExpenseFormModal";
import * as supabaseClientModule from "../src/services/supabaseClient";

function renderWithProviders(ui: React.ReactElement) {
    return render(<HouseholdProvider>{ui}</HouseholdProvider>);
}

describe("ExpensesPage Pacing & 4-Card Summary Strip", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        queryClient.clear();
        queryClient.setDefaultOptions({
            queries: {
                retry: false,
            },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders Spendable as the primary card in a 4-card summary strip", async () => {
        renderWithProviders(<ExpensesPage />);

        await waitFor(() => {
            expect(screen.getByText(/^Spendable$/i)).toBeInTheDocument();
            expect(screen.getByText(/^Spent$/i)).toBeInTheDocument();
            expect(screen.getByText(/^Shared$/i)).toBeInTheDocument();
            expect(screen.getByText(/^Unsettled$/i)).toBeInTheDocument();
        });
    });

    it("displays dynamic daily pace and meter progress in the Spendable Remaining card", async () => {
        renderWithProviders(<ExpensesPage />);

        await waitFor(() => {
            expect(screen.getByText(/\d+d left/i)).toBeInTheDocument();
            expect(screen.getByRole('progressbar', { name: /spendable/i })).toBeInTheDocument();
        });
    });

    it("shows danger Alert with Retry button when getExpenses fails while keeping cached data", async () => {
        let shouldFail = true;
        vi.spyOn(financeService, "getExpenses").mockImplementation((filter) => {
            if (filter && shouldFail) {
                return Promise.reject(new Error("Database timeout"));
            }
            return Promise.resolve([]);
        });

        renderWithProviders(<ExpensesPage />);

        await waitFor(() => {
            expect(
                screen.getByText(/Couldn't load expenses/i),
            ).toBeInTheDocument();
            expect(screen.getByText(/Database timeout/i)).toBeInTheDocument();
        });

        shouldFail = false;
        const retryBtn = screen.getByRole("button", { name: /^Retry$/i });
        fireEvent.click(retryBtn);

        await waitFor(() => {
            expect(
                screen.queryByText(/Couldn't load expenses/i),
            ).not.toBeInTheDocument();
        });
    });

    it("uses the fresh goal balance from financeService.getGoal when sweeping surplus", async () => {
        const staleGoal = {
            id: "goal-fresh-test",
            household_id: "hh-00000000-0001",
            title: "Emergency Fund",
            target_amount: 10000,
            saved_so_far: 1000,
            target_date: "2027-12-31",
            monthly_contribution: 500,
            emoji: "🛡️",
            status: "on_track" as const,
        };
        const freshGoal = {
            ...staleGoal,
            saved_so_far: 2450,
        };

        vi.spyOn(financeService, "getGoals").mockResolvedValue([staleGoal]);
        const getGoalSpy = vi
            .spyOn(financeService, "getGoal")
            .mockResolvedValue(freshGoal);
        const updateGoalSpy = vi
            .spyOn(financeService, "updateGoal")
            .mockResolvedValue({ ...freshGoal, saved_so_far: 3450 });
        vi.spyOn(financeService, "getMonthlyBudget").mockResolvedValue({
            budget: {
                id: "mb-last",
                household_id: "hh-00000000-0001",
                owner_id: "mem-00000000-0011",
                month: "2026-09",
                gross_salary: 6000,
                bonus: 0,
                cpf_deduction: 1200,
                taxes_deduction: 0,
                insurance_deduction: 0,
                after_deductions: 4800,
                is_locked: false,
            },
            categories: [],
            disposablePool: 4800,
            totalSpent: 4000,
            totalRemaining: 800,
            spendableAllocated: 1500,
            spendableSpent: 1000,
            spendableRemaining: 500,
        });

        renderWithProviders(<ExpensesPage />);

        const sweepBannerBtn = await screen.findByRole("button", {
            name: /Sweep to Goals/i,
        });
        fireEvent.click(sweepBannerBtn);

        const allToTopBtn = await screen.findByRole("button", {
            name: /100% to first goal/i,
        });
        fireEvent.click(allToTopBtn);

        const confirmSweepBtn = await screen.findByRole("button", {
            name: /^Sweep S\$/i,
        });
        fireEvent.click(confirmSweepBtn);

        await waitFor(() => {
            expect(getGoalSpy).toHaveBeenCalledWith("goal-fresh-test");
            // 2450 fresh goal balance + 1000 combined household surplus (500 * 2 members)
            expect(updateGoalSpy).toHaveBeenCalledWith("goal-fresh-test", {
                saved_so_far: 3450,
            });
        });
    });

    it("hides member picker in ExpenseFormModal in Supabase mode until real members load", () => {
        vi.spyOn(
            supabaseClientModule,
            "isSupabaseConfigured",
        ).mockReturnValue(true);

        render(
            <ExpenseFormModal
                isOpen={true}
                onClose={() => {}}
                members={[]}
                categories={[]}
            />,
        );

        expect(
            screen.queryByLabelText("Payer Selection"),
        ).not.toBeInTheDocument();
    });
});
