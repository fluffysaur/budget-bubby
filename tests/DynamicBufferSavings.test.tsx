/**
 * Dynamic Buffer + Excess Savings:
 * - Savings can't be picked when logging an expense (Buffer can)
 * - Category guessing never lands on Savings
 * - The savings card shows base, excess and total
 */

import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExpenseFormModal } from "../src/components/expenses/ExpenseFormModal";
import { SavingsBreakdownCard } from "../src/components/budget/SavingsBreakdownCard";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { guessCategoryId } from "../src/lib/categoryGuess";
import { mockCategories, mockMembers } from "../src/data/mockSeedData";

vi.mock("../src/lib/soundEffects", () => ({
    playChaChingSound: vi.fn(),
    playBudgetWarningSound: vi.fn(),
    playBudgetExceededSound: vi.fn(),
    playSuccessSound: vi.fn(),
    initAudioUnlock: vi.fn(),
}));

describe("expense logging excludes Savings", () => {
    it("hides Savings from the category picker, even under More", async () => {
        await act(async () => {
            render(
                <HouseholdProvider initialPerspective="yijia">
                    <ExpenseFormModal
                        isOpen
                        onClose={vi.fn()}
                        categories={mockCategories}
                        members={mockMembers}
                        goals={[]}
                    />
                </HouseholdProvider>,
            );
        });

        const picker = screen.getByLabelText("Category Selection");
        expect(picker).toHaveTextContent("Buffer");
        expect(picker).not.toHaveTextContent("Savings");

        // Two allocation categories remain behind "More" (Investments, Tithing)
        screen.getByRole("button", { name: /\+ More \(2\)/ }).click();
        await act(async () => {});
        expect(picker).not.toHaveTextContent("Savings");
        expect(picker).toHaveTextContent("Tithing");
    });

    it("never guesses Savings from text", () => {
        const savings = mockCategories.find((c) => c.name === "Savings")!;
        expect(
            guessCategoryId("monthly savings top up", mockCategories),
        ).not.toBe(savings.id);
    });
});

describe("SavingsBreakdownCard", () => {
    it("shows base and positive excess", () => {
        render(
            <SavingsBreakdownCard
                baseSavings={500}
                spendableAllocated={2000}
                spendableSpent={1500}
            />,
        );
        expect(screen.getByTestId("savings-breakdown")).toHaveTextContent(
            /Base S\$500.*Excess \+S\$500/,
        );
        expect(screen.getByText("On Track")).toBeInTheDocument();
    });

    it("shows negative excess when spending exceeds the cap", () => {
        render(
            <SavingsBreakdownCard
                baseSavings={500}
                spendableAllocated={2000}
                spendableSpent={2300}
            />,
        );
        expect(screen.getByTestId("savings-breakdown")).toHaveTextContent(
            /Excess -S\$300/,
        );
        expect(screen.getByText("Below Base")).toBeInTheDocument();
    });
});
