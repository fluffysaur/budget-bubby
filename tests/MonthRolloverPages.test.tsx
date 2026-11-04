/**
 * Page-level month rollover: pages that default to the current month must
 * follow the calendar into the next month, unless the user pinned a month.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { BudgetPage } from "../src/pages/BudgetPage";
import { ExpensesPage } from "../src/pages/ExpensesPage";
import { mockFinanceService } from "../src/services/mockFinanceService";

// 2026-10-31 22:00 in Singapore (UTC+8)
const LATE_OCT_SGT = new Date("2026-10-31T14:00:00.000Z");
// 2026-11-01 09:00 in Singapore (UTC+8)
const EARLY_NOV_SGT = new Date("2026-11-01T01:00:00.000Z");

function rollOverToNovember() {
    vi.setSystemTime(EARLY_NOV_SGT);
    act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
    });
}

function renderWithProviders(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <HouseholdProvider>{ui}</HouseholdProvider>
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    localStorage.clear();
    mockFinanceService.resetData();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(LATE_OCT_SGT);
});

afterEach(() => {
    vi.useRealTimers();
});

describe("BudgetPage month rollover", () => {
    it("follows the current month into the new month", async () => {
        renderWithProviders(<BudgetPage />);
        expect(
            screen.getAllByRole("button", { name: /Choose month: October 2026/i }).length,
        ).toBeGreaterThan(0);

        rollOverToNovember();

        await waitFor(() => {
            expect(
                screen.getAllByRole("button", { name: /Choose month: November 2026/i }).length,
            ).toBeGreaterThan(0);
        });
    });

    it("keeps a month the user picked", async () => {
        renderWithProviders(<BudgetPage />);
        fireEvent.click(screen.getAllByRole("button", { name: "Previous month" })[0]);
        expect(
            screen.getAllByRole("button", { name: /Choose month: September 2026/i }).length,
        ).toBeGreaterThan(0);

        rollOverToNovember();

        expect(
            screen.getAllByRole("button", { name: /Choose month: September 2026/i }).length,
        ).toBeGreaterThan(0);
        expect(
            screen.queryByRole("button", { name: /Choose month: November 2026/i }),
        ).not.toBeInTheDocument();
    });
});

describe("ExpensesPage month rollover", () => {
    function monthInput(container: HTMLElement) {
        return container.querySelector<HTMLInputElement>("#filter-month")!;
    }

    async function renderExpensesPage() {
        const view = renderWithProviders(<ExpensesPage />);
        await waitFor(() => {
            expect(monthInput(view.container)).not.toBeNull();
        });
        return view;
    }

    it("moves the month filter to the new month", async () => {
        const { container } = await renderExpensesPage();
        expect(monthInput(container).value).toBe("2026-10");

        rollOverToNovember();

        await waitFor(() => {
            expect(monthInput(container)?.value).toBe("2026-11");
        });
    });

    it("keeps a month the user filtered to", async () => {
        const { container } = await renderExpensesPage();
        fireEvent.change(monthInput(container), { target: { value: "2026-08" } });
        await waitFor(() => {
            expect(monthInput(container)?.value).toBe("2026-08");
        });

        rollOverToNovember();

        await waitFor(() => {
            expect(monthInput(container)?.value).toBe("2026-08");
        });
    });

    it("resets the filter to the new current month", async () => {
        const { container } = await renderExpensesPage();
        fireEvent.change(monthInput(container), { target: { value: "2026-08" } });
        await waitFor(() => {
            expect(monthInput(container)?.value).toBe("2026-08");
        });

        rollOverToNovember();
        fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

        await waitFor(() => {
            expect(monthInput(container)?.value).toBe("2026-11");
        });
    });
});
