import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExpensesPage } from "../src/pages/ExpensesPage";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { queryClient } from "../src/lib/queryClient";
import { financeService } from "../src/services/financeService";
import { matchesExpenseFilter } from "../src/hooks/finance/expenses";
import { getCurrentMonth } from "../src/lib/dateUtils";
import type { Expense } from "../src/types/finance";

function make(id: string, date: string, item: string, tags: string[]): Expense {
    return {
        id,
        household_id: "hh-00000000-0001",
        payer_id: "mem-00000000-0011",
        category_id: "cat-food",
        date,
        item,
        amount: 12.34,
        is_shared: false,
        split_ratio: 0,
        settled: false,
        tags,
    } as Expense;
}

const THIS_MONTH = `${getCurrentMonth()}-02`;
const all = [
    make("now", THIS_MONTH, "Current Month Lunch", []),
    make("old", "2020-03-05", "Old Trip Dinner", ["Trip"]),
];

describe("Expenses tag scope", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        queryClient.clear();
        queryClient.setDefaultOptions({ queries: { retry: false } });
        vi.spyOn(financeService, "getExpenses").mockImplementation((filter) =>
            Promise.resolve(all.filter((e) => matchesExpenseFilter(e, filter))),
        );
    });
    afterEach(() => vi.restoreAllMocks());

    it("lists a past-month tag across months and restores the month on clear", async () => {
        render(
            <HouseholdProvider>
                <ExpensesPage />
            </HouseholdProvider>,
        );

        await waitFor(() =>
            expect(screen.getByText("Current Month Lunch")).toBeInTheDocument(),
        );
        expect(screen.queryByText("Old Trip Dinner")).not.toBeInTheDocument();

        fireEvent.click(await screen.findByTestId("tag-chip-Trip"));

        await waitFor(() =>
            expect(screen.getByText("Old Trip Dinner")).toBeInTheDocument(),
        );
        expect(screen.getByTestId("active-tag-summary")).toHaveTextContent(
            "All time",
        );
        expect(
            screen.queryByText("Current Month Lunch"),
        ).not.toBeInTheDocument();
        // Stats/trends queries stay on the remembered month (never month-less
        // with a tag); only the all-time query has no filter at all.
        const calls = vi.mocked(financeService.getExpenses).mock.calls;
        expect(calls.every(([f]) => f === undefined || Boolean(f.month))).toBe(
            true,
        );
        // The month query ignores the tag, so the Spent card keeps the month.
        expect(calls.every(([f]) => !f?.tag)).toBe(true);
        expect(screen.getByText("1 transaction")).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: "Clear tag filter" }),
        );

        await waitFor(() =>
            expect(screen.getByText("Current Month Lunch")).toBeInTheDocument(),
        );
        expect(screen.queryByText("Old Trip Dinner")).not.toBeInTheDocument();
        expect(screen.queryByTestId("active-tag-summary")).toBeNull();
    });
});
