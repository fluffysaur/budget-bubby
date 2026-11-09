/**
 * Dashboard tests:
 * 1. UpcomingBillsWidget: recurring items with amounts, due timing, empty state, onViewAll
 * 2. DashboardPage: Left to Spend hero + upcoming bills only; net worth, settlement,
 *    goals and streak live elsewhere
 */

import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import {
    UpcomingBillsWidget,
    UpcomingBillRow,
} from "../src/components/dashboard/UpcomingBillsWidget";
import { LeftToSpendHero } from "../src/components/dashboard/LeftToSpendHero";
import { CategoryMeterCard } from "../src/components/dashboard/CategoryMeterCard";
import { DashboardPage } from "../src/pages/DashboardPage";
import { financeService } from "../src/services/financeService";
import type {
    Account,
    Expense,
    HouseholdMember,
    HouseholdOverview,
    MonthlyBudgetDetail,
    RecurringItem,
    SavingsGoal,
    SettlementSummary,
    CreditCardStatement,
} from "../src/types/finance";

const sampleMembers: HouseholdMember[] = [
    {
        id: "mem-001",
        household_id: "hh-001",
        user_id: null,
        display_name: "Yi Jia",
        email: "yijia@example.com",
        role: "owner",
        avatar_url: "👨",
        created_at: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "mem-002",
        household_id: "hh-001",
        user_id: null,
        display_name: "Rachel",
        email: "rachel@example.com",
        role: "member",
        avatar_url: "👩",
        created_at: "2026-01-01T00:00:00.000Z",
    },
];

const sampleSettlementSummary: SettlementSummary = {
    netBalance: 1234.5,
    debtorId: "mem-002",
    creditorId: "mem-001",
    debtorName: "Rachel",
    creditorName: "Yi Jia",
    settlementText: "Rachel owes Yi Jia S$1,234.50",
    member1OwesMember2: 400.0,
    member2OwesMember1: 1634.5,
};

const sampleGoals: SavingsGoal[] = [
    {
        id: "goal-01",
        household_id: "hh-001",
        owner_id: null,
        title: "HDB Down Payment",
        target_amount: 190000.0,
        saved_so_far: 100000.0,
        target_date: "2027-07-01",
        monthly_contribution: 10000.0,
        emoji: "🏠",
        status: "on_track",
        created_at: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "goal-02",
        household_id: "hh-001",
        owner_id: null,
        title: "Wedding Fund",
        target_amount: 55000.0,
        saved_so_far: 55000.0,
        target_date: "2027-05-01",
        monthly_contribution: 0.0,
        emoji: "💍",
        status: "achieved",
        created_at: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "goal-03",
        household_id: "hh-001",
        owner_id: null,
        title: "Renovation Fund",
        target_amount: 90000.0,
        saved_so_far: 15000.0,
        target_date: "2027-09-01",
        monthly_contribution: 1000.0,
        emoji: "🔨",
        status: "behind",
        created_at: "2026-01-01T00:00:00.000Z",
    },
];

const sampleItems: RecurringItem[] = [
    {
        id: "pol-01",
        household_id: "hh-001",
        owner_id: "mem-001",
        type: "insurance",
        name: "Manulife - Lifeready 25 Plus",
        amount: 3200.0,
        frequency: "annually",
        payment_month: 9,
        start_date: null,
        end_date: null,
        notes: "Annual premium renewed in September",
        monthly_amortized_amount: 266.67,
    },
    {
        id: "pol-02",
        household_id: "hh-001",
        owner_id: "mem-001",
        type: "insurance",
        name: "IncomeShield Preferred",
        amount: 1600.0,
        frequency: "annually",
        payment_month: 10,
        start_date: null,
        end_date: null,
        notes: "Annual premium renewed in October",
        monthly_amortized_amount: 133.33,
    },
    {
        id: "pol-03",
        household_id: "hh-001",
        owner_id: "mem-002",
        type: "tax",
        name: "IRAS Property Tax",
        amount: 1200.0,
        frequency: "annually",
        payment_month: 1,
        start_date: null,
        end_date: null,
        notes: null,
        monthly_amortized_amount: 100.0,
    },
];

const sampleAccounts: Account[] = [
    {
        id: "acc-01",
        household_id: "hh-001",
        owner_id: "mem-001",
        name: "DBS Multiplier",
        type: "Cash",
        balance: 25000.0,
        currency: "SGD",
        institution: "DBS",
        is_joint: false,
    },
    {
        id: "acc-02",
        household_id: "hh-001",
        owner_id: "mem-002",
        name: "OCBC 360",
        type: "Cash",
        balance: 20000.0,
        currency: "SGD",
        institution: "OCBC",
        is_joint: false,
    },
    {
        id: "acc-03",
        household_id: "hh-001",
        owner_id: "mem-001",
        name: "Joint House Account",
        type: "Cash",
        balance: 45000.0,
        currency: "SGD",
        institution: "UOB",
        is_joint: true,
    },
    {
        id: "acc-04",
        household_id: "hh-001",
        owner_id: "mem-001",
        name: "CPF Ordinary Account",
        type: "CPF",
        balance: 90000.0,
        currency: "SGD",
        institution: "CPF",
        is_joint: false,
    },
];

const sampleExpenses: Expense[] = [
    {
        id: "exp-01",
        household_id: "hh-001",
        payer_id: "mem-001",
        date: "2026-09-12",
        item: "FairPrice Xtra Groceries",
        amount: 180.0,
        is_shared: true,
        split_ratio: 0.5,
        settled: false,
    },
    {
        id: "exp-02",
        household_id: "hh-001",
        payer_id: "mem-002",
        date: "2026-09-10",
        item: "Uniqlo Clothes",
        amount: 95.0,
        is_shared: false,
        split_ratio: 0.5,
        settled: false,
    },
];

const sampleHouseholdOverview: HouseholdOverview = {
    household: {
        id: "hh-001",
        name: "Yi Jia & Rachel",
        currency: "SGD",
    },
    members: sampleMembers,
    totalAssets: 180000.0,
    trueNetWorth: 180000.0,
    settlementSummary: sampleSettlementSummary,
    activeGoals: sampleGoals,
    upcomingBills: sampleItems,
};

const sampleMonthlyBudget: MonthlyBudgetDetail = {
    budget: {
        id: "mb-01",
        household_id: "hh-001",
        owner_id: "mem-001",
        month: "2026-09",
        gross_salary: 6500.0,
        bonus: 0,
        cpf_deduction: 1300.0,
        taxes_deduction: 250.0,
        insurance_deduction: 350.0,
        after_deductions: 4600.0,
        is_locked: false,
    },
    categories: [
        {
            id: "mbc-01",
            monthly_budget_id: "mb-01",
            category_id: "cat-01",
            percentage: 0.3,
            allocated_amount: 1380.0,
            actualSpent: 450.0,
            remaining: 930.0,
            category: {
                id: "cat-01",
                household_id: "hh-001",
                name: "Food",
                color: "#F59E0B",
                icon: "utensils",
                is_system: true,
            },
        },
    ],
    disposablePool: 4600.0,
    totalSpent: 450.0,
    totalRemaining: 4150.0,
};

describe("UpcomingBillsWidget", () => {
    it("renders upcoming recurring items with formatted amounts and renewal status", () => {
        render(<UpcomingBillsWidget recurringItems={sampleItems} />);

        expect(
            screen.getByText("Manulife - Lifeready 25 Plus"),
        ).toBeInTheDocument();
        expect(screen.getByText("IncomeShield Preferred")).toBeInTheDocument();
        expect(screen.getByText("S$3,200.00")).toBeInTheDocument();
        expect(screen.getByText("S$1,600.00")).toBeInTheDocument();
    });

    it('sorts by next due date and shows "Due in X days" with clamped due days', () => {
        const items: RecurringItem[] = [
            {
                ...sampleItems[0],
                id: "far",
                name: "Far Renewal",
                payment_month: 9,
                due_day: 1,
            },
            {
                ...sampleItems[0],
                id: "bill-31",
                type: "bill",
                name: "SP Utilities",
                frequency: "monthly",
                payment_month: null,
                amount: 90,
                monthly_amortized_amount: 90,
                due_day: 31,
            },
            {
                ...sampleItems[0],
                id: "dec",
                name: "Dec Renewal",
                payment_month: 12,
                due_day: 10,
            },
        ];
        render(
            <UpcomingBillsWidget
                recurringItems={items}
                referenceDate={new Date(2026, 10, 25)}
            />,
        );

        // Day 31 clamps to 30 Nov -> 5 days; Dec 10 -> 15 days; Sep -> far away
        expect(screen.getByText("Due in 5 days")).toBeInTheDocument();
        expect(screen.getByText("Due in 15 days")).toBeInTheDocument();
        expect(screen.getByText("Due in September")).toBeInTheDocument();
        expect(screen.getByText("Bill")).toBeInTheDocument();

        const names = screen
            .getAllByText(/SP Utilities|Dec Renewal|Far Renewal/)
            .map((el) => el.textContent);
        expect(names).toEqual(["SP Utilities", "Dec Renewal", "Far Renewal"]);
    });

    it("lists unpaid card statements by due date and hides paid ones", () => {
        const stmt = (
            id: string,
            name: string,
            due: string,
            paid: boolean,
        ): CreditCardStatement => ({
            id,
            card_id: `card-${id}`,
            household_id: "hh-001",
            month: "2026-11",
            statement_amount: 250,
            due_date: due,
            is_paid: paid,
            card: {
                id: `card-${id}`,
                household_id: "hh-001",
                owner_id: "mem-001",
                name,
                bank: "Test Bank",
                billing_day: 1,
                due_day: 20,
                color: "#000000",
                is_active: true,
            },
        });
        render(
            <UpcomingBillsWidget
                recurringItems={[]}
                creditCardStatements={[
                    stmt("b", "Later Card", "2026-11-30", false),
                    stmt("a", "Sooner Card", "2026-11-27", false),
                    stmt("c", "Paid Card", "2026-11-26", true),
                    stmt("d", "Late Card", "2026-11-23", false),
                ]}
                referenceDate={new Date(2026, 10, 25)}
            />,
        );

        expect(screen.queryByText("Paid Card")).not.toBeInTheDocument();
        expect(screen.getByText("Overdue by 2 days")).toBeInTheDocument();
        expect(screen.getByText("Overdue by 2 days").className).toContain(
            "text-(--accent-coral-ink)",
        );
        expect(screen.getByText("Due in 2 days")).toBeInTheDocument();
        const names = screen
            .getAllByText(/Late Card|Sooner Card|Later Card/)
            .map((el) => el.textContent);
        expect(names).toEqual(["Late Card", "Sooner Card", "Later Card"]);
    });

    it("makes card rows tappable when onOpenCard is given", () => {
        const onOpenCard = vi.fn();
        render(
            <UpcomingBillsWidget
                recurringItems={[]}
                onOpenCard={onOpenCard}
                creditCardStatements={[
                    {
                        id: "t",
                        card_id: "card-t",
                        household_id: "hh-001",
                        month: "2026-11",
                        statement_amount: 100,
                        due_date: "2026-11-27",
                        is_paid: false,
                        card: {
                            id: "card-t",
                            household_id: "hh-001",
                            owner_id: "mem-001",
                            name: "Tap Card",
                            bank: "Test Bank",
                            billing_day: 1,
                            due_day: 20,
                            color: "#000000",
                            is_active: true,
                        },
                    },
                ]}
                referenceDate={new Date(2026, 10, 25)}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /Tap Card/ }));
        expect(onOpenCard).toHaveBeenCalledTimes(1);
    });

    it("hides card statements with nothing to pay", () => {
        render(
            <UpcomingBillsWidget
                recurringItems={[]}
                creditCardStatements={[
                    {
                        id: "z",
                        card_id: "card-z",
                        household_id: "hh-001",
                        month: "2026-11",
                        statement_amount: 0,
                        due_date: "2026-11-27",
                        is_paid: false,
                        card: {
                            id: "card-z",
                            household_id: "hh-001",
                            owner_id: "mem-001",
                            name: "Zero Card",
                            bank: "Test Bank",
                            billing_day: 1,
                            due_day: 20,
                            color: "#000000",
                            is_active: true,
                        },
                    },
                ]}
                referenceDate={new Date(2026, 10, 25)}
            />,
        );
        expect(screen.queryByText("Zero Card")).not.toBeInTheDocument();
    });

    it("renders empty state when no upcoming bills", () => {
        render(<UpcomingBillsWidget recurringItems={[]} />);
        expect(screen.getByText(/nothing due/i)).toBeInTheDocument();
    });

    it("calls onViewAll callback when View All button is clicked", () => {
        const onViewAll = vi.fn();
        render(
            <UpcomingBillsWidget
                recurringItems={sampleItems}
                onViewAll={onViewAll}
            />,
        );

        const viewAllBtn = screen.getByRole("button", { name: /view all/i });
        fireEvent.click(viewAllBtn);
        expect(onViewAll).toHaveBeenCalledTimes(1);
    });

    it("wraps item name in min-w-0 flex-1 container and renders responsive compact badge", () => {
        const items: RecurringItem[] = [
            {
                ...sampleItems[0],
                id: "sub-01",
                type: "subscription",
                name: "Spotify Family Subscription With Very Long Name",
                amount: 17.98,
                monthly_amortized_amount: 17.98,
                frequency: "monthly",
                due_day: 15,
            },
        ];
        render(
            <UpcomingBillsWidget
                recurringItems={items}
                referenceDate={new Date(2026, 10, 1)}
            />,
        );

        const nameEl = screen.getByText(
            "Spotify Family Subscription With Very Long Name",
        );
        // Name element's parent container should have flex-1 min-w-0 to prevent being crowded out
        const nameContainer = nameEl.closest(".min-w-0.flex-1");
        expect(nameContainer).not.toBeNull();

        // Verify compact badge rendering for subscription type
        const mobileText = screen.getByText("Sub");
        const desktopText = screen.getByText("Subscription");
        expect(mobileText).toHaveClass("sm:hidden");
        expect(desktopText).toHaveClass("hidden", "sm:inline");
    });
});

describe("DashboardPage", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(financeService, "getHouseholdOverview").mockResolvedValue(
            sampleHouseholdOverview,
        );
        vi.spyOn(financeService, "getAccounts").mockResolvedValue(
            sampleAccounts,
        );
        vi.spyOn(financeService, "getGoals").mockResolvedValue(sampleGoals);
        vi.spyOn(financeService, "getRecurringItems").mockResolvedValue(
            sampleItems,
        );
        vi.spyOn(financeService, "getExpenses").mockResolvedValue(
            sampleExpenses,
        );
        vi.spyOn(financeService, "getMonthlyBudget").mockResolvedValue(
            sampleMonthlyBudget,
        );
        vi.spyOn(financeService, "getCreditCardStatements").mockResolvedValue(
            [],
        );
    });

    it("shows Left to Spend and upcoming bills only", async () => {
        await act(async () => {
            render(
                <HouseholdProvider initialPerspective="household">
                    <DashboardPage />
                </HouseholdProvider>,
            );
        });

        await waitFor(() => {
            expect(
                screen.getByRole("region", { name: "Left to Spend" }),
            ).toBeInTheDocument();
            expect(
                screen.getByText("Manulife - Lifeready 25 Plus"),
            ).toBeInTheDocument();
        });

        // Moved to their home pages
        expect(
            screen.queryByRole("region", { name: /net worth/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("region", { name: /settlement/i }),
        ).not.toBeInTheDocument();
        expect(screen.queryByText("HDB Down Payment")).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("daily-checkin-streak-bar"),
        ).not.toBeInTheDocument();
    });

    it("shows the combined household total in the Combined view", async () => {
        const budgetSpy = vi
            .spyOn(financeService, "getMonthlyBudget")
            .mockResolvedValue({
                ...sampleMonthlyBudget,
                spendableAllocated: 1000,
                spendableSpent: 250,
                spendableRemaining: 750,
            });

        await act(async () => {
            render(
                <HouseholdProvider initialPerspective="household">
                    <DashboardPage />
                </HouseholdProvider>,
            );
        });

        // Two members, each S$750 left => S$1,500 left in total
        await waitFor(() => {
            expect(
                screen.getByTestId("left-to-spend-amount"),
            ).toHaveTextContent("S$1,500.00");
        });
        const requestedMembers = new Set(budgetSpy.mock.calls.map((c) => c[1]));
        expect(requestedMembers.size).toBeGreaterThanOrEqual(2);
    });

    it("uses the same layout in a personal perspective", async () => {
        await act(async () => {
            render(
                <HouseholdProvider initialPerspective="yijia">
                    <DashboardPage />
                </HouseholdProvider>,
            );
        });

        await waitFor(() => {
            expect(
                screen.getByRole("region", { name: "Left to Spend" }),
            ).toBeInTheDocument();
        });
        expect(
            screen.queryByRole("region", { name: /personal accounts/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("region", { name: /recent transactions/i }),
        ).not.toBeInTheDocument();
    });

    it("navigates to Budget from the Left to Spend card", async () => {
        const onNavigateTab = vi.fn();
        await act(async () => {
            render(
                <HouseholdProvider initialPerspective="household">
                    <DashboardPage onNavigateTab={onNavigateTab} />
                </HouseholdProvider>,
            );
        });

        await waitFor(() => {
            fireEvent.click(screen.getByRole("button", { name: "Budget" }));
            expect(onNavigateTab).toHaveBeenCalledWith("budget");
        });
    });

    describe("LeftToSpendHero & CategoryMeterCard", () => {
        const mockSummary = {
            totalAllocated: 1000,
            totalSpent: 400,
            totalRemaining: 600,
            totalPct: 40,
            categories: [
                {
                    id: "cat-1",
                    name: "Groceries",
                    color: "#10b981",
                    spent: 100,
                    allocated: 200,
                    remaining: 100,
                    pct: 50,
                },
                {
                    id: "cat-2",
                    name: "Dining Out",
                    color: "#f59e0b",
                    spent: 120,
                    allocated: 150,
                    remaining: 30,
                    pct: 80,
                },
                {
                    id: "cat-3",
                    name: "Transport",
                    color: "#3b82f6",
                    spent: 50,
                    allocated: 100,
                    remaining: 50,
                    pct: 50,
                },
                {
                    id: "cat-4",
                    name: "Entertainment",
                    color: "#ec4899",
                    spent: 80,
                    allocated: 100,
                    remaining: 20,
                    pct: 80,
                },
                {
                    id: "cat-5",
                    name: "Shopping",
                    color: "#8b5cf6",
                    spent: 50,
                    allocated: 50,
                    remaining: 0,
                    pct: 100,
                },
            ],
        };

        it("renders summary amounts and expands categories when +N More is clicked", () => {
            const onBudget = vi.fn();
            render(
                <LeftToSpendHero
                    summary={mockSummary}
                    onNavigateBudget={onBudget}
                />,
            );

            expect(screen.getByText("Left to Spend")).toBeInTheDocument();
            expect(
                screen.getByTestId("left-to-spend-amount"),
            ).toHaveTextContent("S$600.00");
            expect(screen.getByText("Groceries")).toBeInTheDocument();
            expect(screen.getByText("Entertainment")).toBeInTheDocument();
            expect(screen.queryByText("Shopping")).not.toBeInTheDocument();

            const expandBtn = screen.getByRole("button", { name: "+1 More" });
            fireEvent.click(expandBtn);

            expect(screen.getByText("Shopping")).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: "Show Less" }),
            ).toBeInTheDocument();

            fireEvent.click(screen.getByRole("button", { name: "Show Less" }));
            expect(screen.queryByText("Shopping")).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole("button", { name: "Budget" }));
            expect(onBudget).toHaveBeenCalledTimes(1);
        });

        it("handles overspent state properly", () => {
            const overspentSummary = {
                ...mockSummary,
                totalRemaining: -50,
            };
            render(<LeftToSpendHero summary={overspentSummary} />);
            expect(screen.getByTestId("left-to-spend-amount")).toHaveClass(
                "text-(--accent-coral-ink)",
            );
        });

        it("renders CategoryMeterCard with correct tone and content", () => {
            render(
                <CategoryMeterCard
                    name="Coffee"
                    color="#f59e0b"
                    remaining={-15}
                    pct={120}
                />,
            );
            expect(screen.getByText("Coffee")).toBeInTheDocument();
            expect(screen.getByText("-S$15.00")).toBeInTheDocument();
        });
    });

    describe("UpcomingBillRow", () => {
        it("renders recurring item details and amortized annual rate", () => {
            render(<UpcomingBillRow item={sampleItems[0]} days={5} />);
            expect(
                screen.getByText("Manulife - Lifeready 25 Plus"),
            ).toBeInTheDocument();
            expect(screen.getByText("Due in 5 days")).toBeInTheDocument();
            expect(screen.getByText("S$3,200.00")).toBeInTheDocument();
            expect(screen.getByText("S$266.67")).toBeInTheDocument();
            expect(screen.getByText(/~.*\/mo/)).toBeInTheDocument();
        });
    });
});
