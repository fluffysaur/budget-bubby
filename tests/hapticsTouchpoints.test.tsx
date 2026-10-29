import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { haptics } from "../src/lib/haptics";
import { PullToRefresh } from "../src/components/ui/PullToRefresh";
import { DailyCheckinStreakBar } from "../src/components/dashboard/DailyCheckinStreakBar";
import { ExpenseSuccessCelebration } from "../src/components/expenses/ExpenseSuccessCelebration";
import { SurplusSweepModal } from "../src/components/budget/SurplusSweepModal";
import { QuickDepositModal } from "../src/components/goals/QuickDepositModal";
import { DeleteExpenseModal } from "../src/components/expenses/DeleteExpenseModal";
import { NotificationSettingsModal } from "../src/components/layout/NotificationSettingsModal";
import { CategoryLimitWarningBanner } from "../src/components/budget/CategoryLimitWarningBanner";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { financeService } from "../src/services/financeService";
import type { Expense, SavingsGoal, MonthlyBudgetCategoryDetail } from "../src/types/finance";

describe("Haptic Feedback Touchpoints Integration", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("triggers haptics.lightTap when PullToRefresh is pulled beyond threshold", async () => {
        const lightTapSpy = vi.spyOn(haptics, "lightTap");
        const onRefresh = vi.fn().mockResolvedValue(undefined);

        const { container } = render(
            <PullToRefresh onRefresh={onRefresh} threshold={64}>
                <div>Content</div>
            </PullToRefresh>,
        );

        const main = container.firstElementChild as HTMLElement;

        // Simulate touch pull past threshold
        fireEvent.touchStart(main, { touches: [{ clientY: 100 }] });
        fireEvent.touchMove(main, { touches: [{ clientY: 260 }] });
        await act(async () => {
            fireEvent.touchEnd(main);
        });

        expect(lightTapSpy).toHaveBeenCalledTimes(1);
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("triggers haptics.celebrate when 1-tap Daily Streak check-in is submitted", async () => {
        const celebrateSpy = vi.spyOn(haptics, "celebrate");
        vi.spyOn(financeService, "getStreakSummary").mockResolvedValue({
            currentStreak: 5,
            longestStreak: 10,
            checkedInToday: false,
            coupleStreak: 3,
            lastCheckinDate: "2026-10-28",
        });
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([]);
        vi.spyOn(financeService, "recordDailyCheckin").mockResolvedValue({
            id: "chk-1",
            household_id: "hh-1",
            member_id: "mem-1",
            checkin_date: "2026-10-29",
            type: "no_spend",
            created_at: new Date().toISOString(),
        });

        render(
            <HouseholdProvider>
                <DailyCheckinStreakBar memberId="mem-1" />
            </HouseholdProvider>,
        );

        const checkinBtn = await screen.findByTestId("no-spend-checkin-btn");
        expect(checkinBtn).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(checkinBtn);
        });

        expect(celebrateSpy).toHaveBeenCalledTimes(1);
    });

    it("triggers haptics.success when an expense celebration occurs", async () => {
        const successSpy = vi.spyOn(haptics, "success");
        const mockExpense: Expense = {
            id: "exp-1",
            household_id: "hh-1",
            amount: 15.5,
            item: "Laksa lunch",
            date: "2026-10-29",
            category_id: "cat-dining",
            payer_id: "mem-1",
            is_shared: true,
            split_ratio: 0.5,
            settled: false,
            created_at: new Date().toISOString(),
        };

        render(<ExpenseSuccessCelebration expense={mockExpense} />);

        expect(successSpy).toHaveBeenCalledTimes(1);
    });

    it("triggers haptics.sweep when unspent surplus is swept to goals", async () => {
        const sweepSpy = vi.spyOn(haptics, "sweep");
        const mockGoals: SavingsGoal[] = [
            {
                id: "goal-1",
                household_id: "hh-1",
                title: "Japan Trip",
                target_amount: 5000,
                saved_so_far: 2000,
                monthly_contribution: 200,
                emoji: "✈️",
                status: "on_track",
                target_date: "2026-12-31",
                created_at: new Date().toISOString(),
            },
        ];
        const onSweepComplete = vi.fn().mockResolvedValue(undefined);

        render(
            <SurplusSweepModal
                isOpen={true}
                onClose={vi.fn()}
                surplusAmount={500}
                month="2026-10"
                goals={mockGoals}
                onSweepComplete={onSweepComplete}
            />,
        );

        // Click "Split Evenly" preset to allocate the $500
        const splitEvenlyBtn = screen.getByRole("button", { name: /split evenly/i });
        fireEvent.click(splitEvenlyBtn);

        const sweepSubmitBtn = screen.getByRole("button", { name: /deposit .* into goals/i });
        await act(async () => {
            fireEvent.click(sweepSubmitBtn);
        });

        expect(onSweepComplete).toHaveBeenCalled();
        expect(sweepSpy).toHaveBeenCalledTimes(1);
    });

    it("triggers haptics.goalMilestone when depositing into a savings goal", async () => {
        const goalMilestoneSpy = vi.spyOn(haptics, "goalMilestone");
        const mockGoal: SavingsGoal = {
            id: "goal-1",
            household_id: "hh-1",
            title: "Emergency Fund",
            target_amount: 10000,
            saved_so_far: 4000,
            monthly_contribution: 500,
            emoji: "🛡️",
            status: "on_track",
            target_date: "2026-12-31",
            created_at: new Date().toISOString(),
        };
        vi.spyOn(financeService, "updateGoal").mockResolvedValue({
            ...mockGoal,
            saved_so_far: 4100,
        });

        render(
            <QuickDepositModal
                isOpen={true}
                onClose={vi.fn()}
                goal={mockGoal}
                onDepositSaved={vi.fn()}
            />,
        );

        // Tap preset "+S$100"
        const presetBtn = screen.getByRole("button", { name: /\+S\$100/i });
        fireEvent.click(presetBtn);

        const submitBtn = screen.getByRole("button", { name: /confirm deposit/i });
        await act(async () => {
            fireEvent.click(submitBtn);
        });

        expect(goalMilestoneSpy).toHaveBeenCalledTimes(1);
    });

    it("triggers haptics.destructive when confirming expense deletion", async () => {
        const destructiveSpy = vi.spyOn(haptics, "destructive");
        const mockExpense: Expense = {
            id: "exp-del-1",
            household_id: "hh-1",
            amount: 45,
            item: "Wrong entry",
            date: "2026-10-29",
            category_id: "cat-dining",
            payer_id: "mem-1",
            is_shared: true,
            split_ratio: 0.5,
            settled: false,
            created_at: new Date().toISOString(),
        };
        vi.spyOn(financeService, "deleteExpense").mockResolvedValue(undefined);

        render(
            <DeleteExpenseModal
                isOpen={true}
                onClose={vi.fn()}
                expense={mockExpense}
                onDeleted={vi.fn()}
            />,
        );

        const confirmDeleteBtn = screen.getByRole("button", { name: /confirm delete/i });
        await act(async () => {
            fireEvent.click(confirmDeleteBtn);
        });

        expect(destructiveSpy).toHaveBeenCalledTimes(1);
    });

    it("triggers haptics.warning and haptics.alert on category budget boundary crossings", async () => {
        const warningSpy = vi.spyOn(haptics, "warning");
        const alertSpy = vi.spyOn(haptics, "alert");

        const mockCategory: MonthlyBudgetCategoryDetail = {
            id: "mbc-1",
            monthly_budget_id: "mb-1",
            category_id: "cat-groceries",
            allocated_amount: 500,
            percentage: 20,
            actualSpent: 380, // 76%
            category: {
                id: "cat-groceries",
                name: "Groceries",
                household_id: "hh-1",
                is_system: false,
                icon: "shopping-cart",
                color: "#ffd166",
            },
        };

        render(
            <HouseholdProvider>
                <CategoryLimitWarningBanner categories={[mockCategory]} />
            </HouseholdProvider>,
        );

        // 1. Expense that crosses 80% (380 + 30 = 410 -> 82%)
        await act(async () => {
            window.dispatchEvent(
                new CustomEvent("expenseAdded", {
                    detail: {
                        id: "exp-w1",
                        category_id: "cat-groceries",
                        amount: 30,
                    },
                }),
            );
        });
        expect(warningSpy).toHaveBeenCalledTimes(1);

        // Update category state to reflect 410 spent
        mockCategory.actualSpent = 410;

        // 2. Expense that crosses 100% (410 + 100 = 510 -> 102%)
        await act(async () => {
            window.dispatchEvent(
                new CustomEvent("expenseAdded", {
                    detail: {
                        id: "exp-a1",
                        category_id: "cat-groceries",
                        amount: 100,
                    },
                }),
            );
        });
        expect(alertSpy).toHaveBeenCalledTimes(1);
    });

    it("allows toggling and testing haptics in NotificationSettingsModal", async () => {
        const celebrateSpy = vi.spyOn(haptics, "celebrate");
        const updateSpy = vi.spyOn(financeService, "updateNotificationPreferences");

        render(
            <HouseholdProvider>
                <NotificationSettingsModal isOpen={true} onClose={vi.fn()} memberId="mem-1" />
            </HouseholdProvider>,
        );

        // Vibrate test button exists
        const testVibrateBtn = await screen.findByRole("button", { name: /vibrate/i });
        fireEvent.click(testVibrateBtn);
        expect(celebrateSpy).toHaveBeenCalledTimes(1);

        // Haptic toggle switch
        const hapticToggle = screen.getByTestId("toggle-haptics-enabled");
        expect(hapticToggle).toHaveAttribute("aria-checked", "true");

        await act(async () => {
            fireEvent.click(hapticToggle);
        });

        expect(updateSpy).toHaveBeenCalledWith(
            "mem-1",
            expect.objectContaining({ haptics_enabled: false }),
        );
    });
});
