import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

vi.mock("../src/lib/soundEffects", () => ({
    playChaChingSound: vi.fn(),
    playSoftPop: vi.fn(),
    playSuccessSound: vi.fn(),
    playBudgetWarningSound: vi.fn(),
    playBudgetExceededSound: vi.fn(),
    initAudioUnlock: vi.fn(),
    isSoundEffectsEnabled: () => true,
}));

import {
    countConsecutiveLoggedDays,
    evaluateSpendablePostLog,
} from "../src/lib/honestLog";
import { CategoryLimitWarningBanner } from "../src/components/budget/CategoryLimitWarningBanner";
import { DelightHost } from "../src/components/bubby/DelightHost";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { financeService } from "../src/services/financeService";
import { queryClient } from "../src/lib/queryClient";
import { keys } from "../src/lib/queryKeys";
import { mockMembers } from "../src/data/mockSeedData";
import { toSgtDateString } from "../src/lib/bubby/dates";
import { resetFeedbackState } from "../src/lib/delight/feedback";
import { resetActivityCheckinState } from "../src/lib/bubby/activity";
import { emitAppEvent } from "../src/lib/appEvents";
import * as soundEffects from "../src/lib/soundEffects";
import type {
    DailyCheckin,
    Expense,
    MonthlyBudgetCategoryDetail,
    MonthlyBudgetDetail,
} from "../src/types/finance";
import { withText } from "./helpers/textContent";

const [YJ] = mockMembers;
const TODAY = toSgtDateString();
const CURRENT_MONTH = TODAY.slice(0, 7);

function makeCategory(
    id: string,
    name: string,
    allocated: number,
    spent: number,
    group: "spendable" | "allocation" = "spendable",
): MonthlyBudgetCategoryDetail {
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
            group,
        },
    };
}

describe("honestLog helpers", () => {
    it("evaluates spendable post-log across under 90%, crunch, total over, and Buffer coverage", () => {
        const cats = [
            makeCategory("cat-food", "Food", 500, 400),
            makeCategory("cat-buffer", "Buffer", 200, 0),
            makeCategory("cat-savings", "Savings", 500, 500, "allocation"),
        ];

        // Under 90%: 400 + 50 = 450 / 700 (64.3%) -> not honest-log crunch yet
        const safe = evaluateSpendablePostLog(cats, {
            category_id: "cat-food",
            amount: 50,
        });
        expect(safe.isHonestLog).toBe(false);
        expect(safe.isTotalOver).toBe(false);
        expect(safe.totalNewRemaining).toBe(250);

        // Crunch (>= 90% used, <= 10% left) AND Food covered by Buffer (520 / 500, Buffer has 200)
        // Total spendable: 700, spent: 400 + 250 = 650 (50 left <= 70)
        const crunch = evaluateSpendablePostLog(cats, {
            category_id: "cat-food",
            amount: 250,
        });
        expect(crunch.isHonestLog).toBe(true);
        expect(crunch.isTotalOver).toBe(false);
        expect(crunch.projectedCategoryStatus).toBe("covered");

        // Total over: 400 + 350 = 750 / 700 -> 50 over, partially covered by Buffer
        const over = evaluateSpendablePostLog(cats, {
            category_id: "cat-food",
            amount: 350,
        });
        expect(over.isHonestLog).toBe(true);
        expect(over.isTotalOver).toBe(true);
        expect(over.totalOverAmount).toBe(50);
        expect(over.projectedCategoryStatus).toBe("partially_covered");

        // Allocation categories do not count toward spendable crunch
        const alloc = evaluateSpendablePostLog(cats, {
            category_id: "cat-savings",
            amount: 500,
        });
        expect(alloc.isHonestLog).toBe(false);
        expect(alloc.isTotalOver).toBe(false);
    });

    it("counts consecutive logged days from today or yesterday and breaks on gaps", () => {
        const makeCheckin = (date: string, member = "m1"): DailyCheckin => ({
            id: `${member}-${date}`,
            household_id: "hh-01",
            member_id: member,
            checkin_date: date,
            type: "expense",
        });

        expect(countConsecutiveLoggedDays([], "m1", "2026-11-24")).toBe(0);

        // Streak ending today
        expect(
            countConsecutiveLoggedDays(
                [
                    makeCheckin("2026-11-24"),
                    makeCheckin("2026-11-23"),
                    makeCheckin("2026-11-22"),
                    makeCheckin("2026-11-20"), // gap on 21
                ],
                "m1",
                "2026-11-24",
            ),
        ).toBe(3);

        // Active streak ending yesterday (today not logged yet)
        expect(
            countConsecutiveLoggedDays(
                [makeCheckin("2026-11-23"), makeCheckin("2026-11-22")],
                "m1",
                "2026-11-24",
            ),
        ).toBe(2);

        // Gap on both today and yesterday -> 0
        expect(
            countConsecutiveLoggedDays(
                [makeCheckin("2026-11-22")],
                "m1",
                "2026-11-24",
            ),
        ).toBe(0);
    });
});

describe("CategoryLimitWarningBanner calm framing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    it("renders calm neutral slate toast and banner when Buffer covers category overage, with zero alarm sounds", () => {
        const cats = [
            makeCategory("cat-food", "Food", 500, 490),
            makeCategory("cat-buffer", "Buffer", 200, 0),
        ];

        const { rerender } = render(
            <CategoryLimitWarningBanner categories={cats} />,
        );

        act(() => {
            window.dispatchEvent(
                new CustomEvent("expenseAdded", {
                    detail: {
                        id: "exp-1",
                        household_id: "hh-01",
                        payer_id: "m1",
                        category_id: "cat-food",
                        date: TODAY,
                        item: "Ramen",
                        amount: 25,
                        is_shared: false,
                        split_ratio: 0,
                        settled: false,
                    } satisfies Expense,
                }),
            );
        });

        expect(soundEffects.playBudgetExceededSound).not.toHaveBeenCalled();
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Logged!")).toBeInTheDocument();
        expect(
            screen.getByText(/Food is S\$15\.00 over — covered by Buffer/i),
        ).toBeInTheDocument();

        // Persistent banner when Buffer already covers Food
        const coveredCats = [
            makeCategory("cat-food", "Food", 500, 515),
            makeCategory("cat-buffer", "Buffer", 200, 0),
        ];
        rerender(<CategoryLimitWarningBanner categories={coveredCats} />);
        expect(
            screen.getByTestId("category-limit-covered-banner"),
        ).toBeInTheDocument();
        expect(
            screen.getAllByText(
                withText(/Food is S\$15\.00 over — covered by Buffer/i),
            ).length,
        ).toBeGreaterThanOrEqual(1);
    });

    it("renders soft-amber Honest log toast and From Next Month banner when total spendable goes negative", () => {
        const cats = [
            makeCategory("cat-food", "Food", 500, 490),
            makeCategory("cat-transport", "Transport", 100, 95),
        ];

        const { rerender } = render(
            <CategoryLimitWarningBanner categories={cats} />,
        );

        act(() => {
            window.dispatchEvent(
                new CustomEvent("expenseAdded", {
                    detail: {
                        id: "exp-2",
                        household_id: "hh-01",
                        payer_id: "m1",
                        category_id: "cat-food",
                        date: TODAY,
                        item: "Coffee",
                        amount: 20,
                        is_shared: false,
                        split_ratio: 0,
                        settled: false,
                    } satisfies Expense,
                }),
            );
        });

        expect(soundEffects.playBudgetExceededSound).not.toHaveBeenCalled();
        expect(screen.getByText("Honest log")).toBeInTheDocument();
        expect(
            screen.getByText(/S\$5\.00 into next month/i),
        ).toBeInTheDocument();

        const overCats = [
            makeCategory("cat-food", "Food", 500, 510),
            makeCategory("cat-transport", "Transport", 100, 95),
        ];
        rerender(<CategoryLimitWarningBanner categories={overCats} />);
        expect(
            screen.getByTestId("category-limit-exceeded-banner"),
        ).toBeInTheDocument();
        expect(screen.getByText(/From Next Month \(1\)/i)).toBeInTheDocument();
    });
});

describe("DelightHost honest-log milestone", () => {
    beforeEach(() => {
        localStorage.clear();
        queryClient.clear();
        vi.restoreAllMocks();
        resetFeedbackState();
        resetActivityCheckinState();
    });

    it("fires honest-log milestone once per day when spendable is <= 10% left or over", async () => {
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([]);
        vi.spyOn(financeService, "getExpenses").mockResolvedValue([]);
        vi.spyOn(financeService, "getAllAccountSnapshots").mockResolvedValue(
            [],
        );
        vi.spyOn(financeService, "getCreditCardStatements").mockResolvedValue(
            [],
        );
        vi.spyOn(financeService, "getGoals").mockResolvedValue([]);
        vi.spyOn(financeService, "getCategories").mockResolvedValue([]);
        vi.spyOn(financeService, "getBaseProfiles").mockResolvedValue([]);
        vi.spyOn(financeService, "getBaseAllocations").mockResolvedValue([]);
        vi.spyOn(financeService, "getMonthlyBudget").mockResolvedValue({
            budget: { household_id: "hh-01", is_locked: false },
            categories: [],
            uncategorizedRecurringItems: [],
        } as never);
        vi.spyOn(financeService, "recordDailyCheckin").mockResolvedValue(
            {} as DailyCheckin,
        );

        const budgetDetail: MonthlyBudgetDetail = {
            budget: {
                id: "mb-01",
                household_id: "hh-01",
                owner_id: YJ.id,
                month: CURRENT_MONTH,
                gross_salary: 5000,
                bonus: 0,
                cpf_deduction: 1000,
                taxes_deduction: 0,
                insurance_deduction: 0,
                after_deductions: 4000,
                is_locked: false,
            },
            categories: [makeCategory("cat-food", "Food", 1000, 950)],
            disposablePool: 4000,
            totalSpent: 950,
            totalRemaining: 50,
            uncategorizedRecurringItems: [],
        };
        queryClient.setQueryData(
            keys.budget.detail(CURRENT_MONTH, "household", undefined, [YJ.id]),
            budgetDetail,
        );

        await act(async () => {
            render(
                <HouseholdProvider>
                    <DelightHost />
                </HouseholdProvider>,
            );
        });

        await waitFor(() =>
            expect(financeService.getDailyCheckins).toHaveBeenCalled(),
        );

        await act(async () => {
            emitAppEvent("expenseAdded", {
                id: "exp-crunch-1",
                household_id: "hh-01",
                payer_id: YJ.id,
                category_id: "cat-food",
                date: TODAY,
                item: "Dinner",
                amount: 60,
                is_shared: false,
                split_ratio: 0,
                settled: false,
                source: "form",
            });
        });

        expect(screen.getByText("Honest log! 🐧")).toBeInTheDocument();
        expect(
            screen.getByText("Logged over budget — streak intact"),
        ).toBeInTheDocument();
    });
});
