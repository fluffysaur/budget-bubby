import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExpensesPage } from "../src/pages/ExpensesPage";
import * as HouseholdModule from "../src/context/HouseholdContext";
import { queryClient } from "../src/lib/queryClient";
import { financeService } from "../src/services/financeService";
import { matchesExpenseFilter } from "../src/hooks/finance/expenses";
import { getCurrentMonth } from "../src/lib/dateUtils";
import type { Expense } from "../src/types/finance";

/** Matches the Budget card's spent line, which spans CurrencyText + text. */
const spentLine = (re: RegExp) => (_: string, el: Element | null) =>
    el?.tagName === "P" && re.test(el.textContent ?? "");

const { HouseholdProvider } = HouseholdModule;
const memberLimit = vi.hoisted(() => ({ value: 0 }));

vi.mock("../src/context/HouseholdContext", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("../src/context/HouseholdContext")
        >();
    return {
        ...actual,
        useHousehold: () => {
            const real = actual.useHousehold();
            return memberLimit.value > 0
                ? { ...real, members: real.members.slice(0, memberLimit.value) }
                : real;
        },
    };
});

function make(
    id: string,
    item: string,
    amount: number,
    is_shared: boolean,
    category_id: string,
): Expense {
    return {
        id,
        household_id: "hh-00000000-0001",
        payer_id: "mem-00000000-0011",
        category_id,
        date: `${getCurrentMonth()}-02`,
        item,
        amount,
        is_shared,
        split_ratio: 0,
        settled: false,
        tags: [],
    } as Expense;
}

const all = [
    make("a", "Alpha Lunch", 100, false, "cat-00000000-0101"),
    make("b", "Beta Dinner", 40, true, "cat-00000000-0101"),
];

const sharedLine = (_: string, el: Element | null) =>
    el?.tagName === "P" &&
    /^S\$40(\.00)? shared this month$/.test(el.textContent ?? "");

function renderPage() {
    return render(
        <HouseholdProvider>
            <ExpensesPage />
        </HouseholdProvider>,
    );
}

describe("Expenses summary cards", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        memberLimit.value = 0;
        localStorage.clear();
        queryClient.clear();
        queryClient.setDefaultOptions({ queries: { retry: false } });
        vi.spyOn(financeService, "getExpenses").mockImplementation((filter) =>
            Promise.resolve(all.filter((e) => matchesExpenseFilter(e, filter))),
        );
    });
    afterEach(() => vi.restoreAllMocks());

    it("shows the Budget card with remaining and the month spent line", async () => {
        renderPage();
        expect(await screen.findByText(/^Spendable$/)).toBeInTheDocument();
        expect(
            await screen.findByText(
                spentLine(/S\$140(\.00)? spent · 2 expenses$/),
            ),
        ).toBeInTheDocument();
        expect(screen.getByText(/\d+d left/)).toBeInTheDocument();
        expect(screen.queryByText(/^Spent$/)).not.toBeInTheDocument();
    });

    it("shows the Shared card with unsettled, shared total and Settle Up", async () => {
        renderPage();
        expect(await screen.findByText(/^Unsettled$/)).toBeInTheDocument();
        expect(await screen.findByText(sharedLine)).toBeInTheDocument();
        expect(
            await screen.findByRole("button", { name: /Settle Up/i }),
        ).toBeInTheDocument();
    });

    it("hides the Shared card with fewer than 2 members", async () => {
        memberLimit.value = 1;
        renderPage();
        expect(await screen.findByText(/^Spendable$/)).toBeInTheDocument();
        await screen.findByText(spentLine(/spent · 2 expenses$/));
        expect(screen.queryByText(/^Unsettled$/)).not.toBeInTheDocument();
        expect(screen.queryByText(/shared this month/)).not.toBeInTheDocument();
    });

    it("keeps whole-month stats while a search narrows the list", async () => {
        renderPage();
        await screen.findByText(spentLine(/spent · 2 expenses$/));
        await screen.findByText("Beta Dinner");

        fireEvent.change(
            screen.getByPlaceholderText("Search merchant, item, note..."),
            { target: { value: "Alpha" } },
        );

        await waitFor(() =>
            expect(screen.queryByText("Beta Dinner")).not.toBeInTheDocument(),
        );
        expect(screen.getByText("Alpha Lunch")).toBeInTheDocument();
        expect(
            screen.getByText(spentLine(/S\$140(\.00)? spent · 2 expenses$/)),
        ).toBeInTheDocument();
        expect(screen.getByText(sharedLine)).toBeInTheDocument();
        const calls = vi.mocked(financeService.getExpenses).mock.calls;
        expect(
            calls.every(([f]) => f === undefined || (f.month && !f.search)),
        ).toBe(true);
    });
});
