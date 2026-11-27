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

describe("ExpensesPage Pacing & 2-Card Summary Strip", () => {
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

    it("renders Spendable and Unsettled in a 2-card summary strip", async () => {
        renderWithProviders(<ExpensesPage />);

        await waitFor(() => {
            expect(screen.getByText(/^Spendable$/i)).toBeInTheDocument();
            expect(screen.getByText(/^Unsettled$/i)).toBeInTheDocument();
        });
    });

    it("displays dynamic daily pace and meter progress in the Spendable Remaining card", async () => {
        renderWithProviders(<ExpensesPage />);

        await waitFor(() => {
            expect(screen.getByText(/\d+d left/i)).toBeInTheDocument();
            expect(
                screen.getByRole("progressbar", { name: /spendable/i }),
            ).toBeInTheDocument();
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

    it("opens the Bank Surplus modal from the month-end banner", async () => {
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

        const bankBannerBtn = await screen.findByRole("button", {
            name: /Bank Surplus/i,
        });
        expect(
            screen.queryByRole("button", { name: /Sweep to Goals/i }),
        ).not.toBeInTheDocument();
        fireEvent.click(bankBannerBtn);

        expect(await screen.findByText(/Reserve S\$/i)).toBeInTheDocument();
    });

    it("hides member picker in ExpenseFormModal in Supabase mode until real members load", () => {
        vi.spyOn(supabaseClientModule, "isSupabaseConfigured").mockReturnValue(
            true,
        );

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
