/**
 * Minimal Add Expense:
 * - Amount, Category and Description visible; secondary fields under a closed "More"
 * - "More" summarises its defaults and opens itself for non-default values
 * - The split choice is remembered for next time
 */

import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExpenseFormModal } from "../src/components/expenses/ExpenseFormModal";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { financeService } from "../src/services/financeService";
import { mockCategories, mockMembers } from "../src/data/mockSeedData";
import type { Expense } from "../src/types/finance";

vi.mock("../src/lib/soundEffects", () => ({
    playChaChingSound: vi.fn(),
    playBudgetWarningSound: vi.fn(),
    playBudgetExceededSound: vi.fn(),
    playSuccessSound: vi.fn(),
    initAudioUnlock: vi.fn(),
}));

async function renderModal(props: Partial<React.ComponentProps<typeof ExpenseFormModal>> = {}) {
    await act(async () => {
        render(
            <HouseholdProvider initialPerspective="yijia">
                <ExpenseFormModal
                    isOpen
                    onClose={vi.fn()}
                    categories={mockCategories}
                    members={mockMembers}
                    goals={[]}
                    {...props}
                />
            </HouseholdProvider>,
        );
    });
}

function moreToggle() {
    return screen.getByRole("button", { name: /^more/i });
}

describe("Add Expense minimal layout", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it("keeps secondary fields in a closed More section with a defaults summary", async () => {
        await renderModal();

        expect(screen.getByRole("heading", { name: "Add Expense" })).toBeInTheDocument();
        expect(screen.getByLabelText("Description")).toBeInTheDocument();
        expect(screen.getByLabelText("Category Selection")).toBeInTheDocument();

        expect(moreToggle()).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByTestId("expense-more-summary")).toHaveTextContent(/^Today · .+ · Personal$/);

        // Secondary fields live inside the collapsed section
        const payer = screen.getByLabelText("Payer Selection");
        expect(payer.closest(".hidden")).not.toBeNull();
        expect(screen.getByLabelText("Select currency").closest(".hidden")).not.toBeNull();

        fireEvent.click(moreToggle());
        expect(moreToggle()).toHaveAttribute("aria-expanded", "true");
        expect(payer.closest(".hidden")).toBeNull();
    });

    it("opens More on its own when a foreign currency is chosen", async () => {
        await renderModal();
        fireEvent.change(screen.getByLabelText("Select currency"), { target: { value: "JPY" } });
        expect(moreToggle()).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByTestId("expense-more-summary")).toHaveTextContent("JPY");
    });

    it("remembers the last split for the next expense", async () => {
        const addSpy = vi.spyOn(financeService, "addExpense").mockImplementation(
            async (input) => ({ id: "exp-new", household_id: "hh", settled: false, ...input }) as Expense,
        );
        await renderModal();

        fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "12.50" } });
        fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Lunch" } });
        fireEvent.click(
            within(screen.getByRole("group", { name: "Expense Split Type" })).getByRole("button", { name: /shared/i }),
        );

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
        });
        await waitFor(() => expect(addSpy).toHaveBeenCalled());
        expect(addSpy.mock.calls[0][0].is_shared).toBe(true);
        expect(localStorage.getItem("budget_bubby_last_split_v1")).toBe("shared");
    });

    it("defaults to the remembered split", async () => {
        localStorage.setItem("budget_bubby_last_split_v1", "shared");
        await renderModal();
        expect(screen.getByTestId("expense-more-summary")).toHaveTextContent(/Shared$/);
    });
});
