/**
 * Home declutter:
 * - CategoryLimitWarningBanner `single` mode shows only the most urgent alert
 * - Expenses "Unsettled" card offers Settle Up with a confirmation
 * - Header Bubby (where the streak chip was) shows who fed it today, no counts
 */

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CategoryLimitWarningBanner } from "../src/components/budget/CategoryLimitWarningBanner";
import { BubbyAvatarButton } from "../src/components/bubby/BubbyAvatarButton";
import { onAppEvent } from "../src/lib/appEvents";
import { readBubbyStore } from "../src/lib/bubby/storage";
import { ExpensesPage } from "../src/pages/ExpensesPage";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { AuthProvider } from "../src/context/AuthContext";
import { financeService } from "../src/services/financeService";
import { mockMembers } from "../src/data/mockSeedData";
import { toSgtDateString } from "../src/lib/bubby/dates";
import type { HouseholdOverview, MonthlyBudgetCategoryDetail } from "../src/types/finance";

vi.mock("../src/lib/soundEffects", () => ({
    playBudgetWarningSound: vi.fn(),
    playBudgetExceededSound: vi.fn(),
    playChaChingSound: vi.fn(),
    initAudioUnlock: vi.fn(),
}));

function spendable(id: string, name: string, allocated: number, spent: number): MonthlyBudgetCategoryDetail {
    return {
        id: `mbc-${id}`,
        monthly_budget_id: "mb-01",
        category_id: id,
        percentage: 0.2,
        allocated_amount: allocated,
        actualSpent: spent,
        remaining: allocated - spent,
        category: {
            id,
            household_id: "hh-01",
            name,
            color: "#10B981",
            icon: "utensils",
            is_system: true,
            group: "spendable",
        },
    };
}

describe("CategoryLimitWarningBanner single mode", () => {
    const categories = [
        spendable("cat-food", "Food", 800, 900), // over by 100
        spendable("cat-fun", "Lifestyle", 400, 700), // over by 300
        spendable("cat-transport", "Transport", 200, 180), // 90%
    ];

    it("shows only the worst overspend plus a +N more link", async () => {
        const onNavigate = vi.fn();
        await act(async () => {
            render(<CategoryLimitWarningBanner single categories={categories} onNavigateCategory={onNavigate} />);
        });

        expect(screen.getByText(/Lifestyle has exceeded cap/)).toBeInTheDocument();
        expect(screen.queryByText(/Food has exceeded cap/)).not.toBeInTheDocument();
        expect(screen.queryByTestId("category-limit-nearing-banner")).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId("category-limit-more"));
        expect(screen.getByText("+2 more")).toBeInTheDocument();
        expect(onNavigate).toHaveBeenCalled();
    });

    it("shows every alert when single is off", async () => {
        await act(async () => {
            render(<CategoryLimitWarningBanner categories={categories} />);
        });

        expect(screen.getByText(/Lifestyle has exceeded cap/)).toBeInTheDocument();
        expect(screen.getByText(/Food has exceeded cap/)).toBeInTheDocument();
        expect(screen.getByTestId("category-limit-nearing-banner")).toBeInTheDocument();
        expect(screen.queryByTestId("category-limit-more")).not.toBeInTheDocument();
    });
});

describe("Expenses Settle Up", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    async function renderExpensesWithBalance(netBalance: number) {
        const real = await financeService.getHouseholdOverview();
        const overview: HouseholdOverview = {
            ...real,
            settlementSummary: {
                netBalance,
                debtorId: netBalance > 0 ? real.members[1]?.id ?? null : null,
                creditorId: netBalance > 0 ? real.members[0]?.id ?? null : null,
                settlementText: netBalance > 0 ? "Rachel owes Yi Jia" : "All settled up",
                member1OwesMember2: 0,
                member2OwesMember1: netBalance,
            },
        };
        vi.spyOn(financeService, "getHouseholdOverview").mockResolvedValue(overview);
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={queryClient}>
                <HouseholdProvider>
                    <ExpensesPage />
                </HouseholdProvider>
            </QueryClientProvider>,
        );
        return overview;
    }

    it("confirms before settling and calls settleSharedExpenses", async () => {
        const overview = await renderExpensesWithBalance(120);
        const settleSpy = vi.spyOn(financeService, "settleSharedExpenses").mockResolvedValue();

        const settleBtn = await screen.findByRole("button", { name: /settle up/i });
        fireEvent.click(settleBtn);

        expect(await screen.findByText(/Mark all shared expenses as settled/)).toBeInTheDocument();
        expect(settleSpy).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Settle" }));
        });

        await waitFor(() => {
            expect(settleSpy).toHaveBeenCalledWith(overview.members[0].id, overview.members[1].id);
        });
    });

    it("hides Settle Up when nothing is owed", async () => {
        await renderExpensesWithBalance(0);
        await screen.findByText(/^Unsettled$/i);
        expect(screen.queryByRole("button", { name: /settle up/i })).not.toBeInTheDocument();
    });
});

describe("Header Bubby", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        vi.spyOn(financeService, "getExpenses").mockResolvedValue([]);
        vi.spyOn(financeService, "getAllAccountSnapshots").mockResolvedValue([]);
    });

    it("lights the logged-in partner's dot, shows no counts, and pets + opens the sheet on tap", async () => {
        const rachel = mockMembers.find((m) => m.display_name === "Rachel")!;
        const today = toSgtDateString();
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([
            { id: "r-0", household_id: "hh-01", member_id: rachel.id, checkin_date: today, type: "expense" as const },
        ]);

        await act(async () => {
            render(
                <AuthProvider initialAuthenticated initialPartner="rachel">
                    <HouseholdProvider defaultPerspective="household">
                        <BubbyAvatarButton />
                    </HouseholdProvider>
                </AuthProvider>,
            );
        });

        const button = screen.getByRole("button", { name: "Bubby" });
        await waitFor(() =>
            expect(screen.getByRole("img", { name: "Rachel, fed Bubby today" })).toHaveAttribute("data-fed", "true"),
        );
        expect(button.textContent ?? "").not.toMatch(/\d/);

        const opened = vi.fn();
        const off = onAppEvent("bubby:open-sheet", opened);
        fireEvent.click(button);
        off();
        expect(opened).toHaveBeenCalledTimes(1);
        expect(readBubbyStore().petDays?.[rachel.id]).toEqual([today]);
    });
});
