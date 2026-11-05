/**
 * Multi-currency regressions: edit keeps the saved rate, linked SGD/rate fields.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ExpenseFormModal } from "../src/components/expenses/ExpenseFormModal";
import { financeService } from "../src/services/financeService";
import { mockCategories, mockMembers } from "../src/data/mockSeedData";
import type { Expense } from "../src/types/finance";

const jpyExpense: Expense = {
    id: "exp-fx-1",
    household_id: "hh-00000000-0001",
    payer_id: "mem-00000000-0011",
    category_id: "cat-00000000-0101",
    date: "2026-10-20",
    item: "Ichiran Ramen",
    amount: 20,
    original_amount: 2000,
    original_currency: "JPY",
    exchange_rate: 100, // custom rate, differs from default 115.5
    remarks: null,
    is_shared: false,
    split_ratio: 0.5,
    settled: false,
    tags: [],
    created_at: "2026-10-20T12:00:00Z",
};

function renderEdit(expense: Expense = jpyExpense) {
    return render(
        <ExpenseFormModal
            isOpen={true}
            onClose={vi.fn()}
            expense={expense}
            categories={mockCategories}
            members={mockMembers}
        />,
    );
}

describe("ExpenseFormModal (edit mode) multi-currency", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(new Error("offline in tests")),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("shows the saved custom rate, not the default rate", () => {
        renderEdit();
        expect(screen.getByLabelText(/Exchange rate/i)).toHaveValue(100);
        expect(screen.getByLabelText(/Converted SGD/i)).toHaveValue(20);
    });

    it("keeps the saved rate and SGD amount when editing another field", async () => {
        const updateSpy = vi
            .spyOn(financeService, "updateExpense")
            .mockResolvedValue(jpyExpense);
        renderEdit();

        fireEvent.change(screen.getByLabelText(/^Description$/i), {
            target: { value: "Ichiran Ramen Tokyo" },
        });
        fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(
                jpyExpense.id,
                expect.objectContaining({
                    amount: 20,
                    original_amount: 2000,
                    original_currency: "JPY",
                    exchange_rate: 100,
                }),
            );
        });
    });

    it("works out the rate when the SGD amount is typed", async () => {
        const updateSpy = vi
            .spyOn(financeService, "updateExpense")
            .mockResolvedValue(jpyExpense);
        renderEdit();

        fireEvent.change(screen.getByLabelText(/Converted SGD/i), {
            target: { value: "16" },
        });
        expect(screen.getByLabelText(/Exchange rate/i)).toHaveValue(125);

        fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(
                jpyExpense.id,
                expect.objectContaining({ amount: 16, exchange_rate: 125 }),
            );
        });
    });

    it("saves SGD expenses with null FX fields", async () => {
        const updateSpy = vi
            .spyOn(financeService, "updateExpense")
            .mockResolvedValue(jpyExpense);
        renderEdit({
            ...jpyExpense,
            amount: 12,
            original_amount: null,
            original_currency: "SGD",
            exchange_rate: 1,
        });

        fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(
                jpyExpense.id,
                expect.objectContaining({
                    amount: 12,
                    original_amount: null,
                    exchange_rate: null,
                }),
            );
        });
    });
});
