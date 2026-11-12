import { describe, it, expect } from "vitest";
import {
    calculateCPFAndNetPay,
    calculateDisposableBudget,
    calculateCategoryAllocations,
    calculateSharedExpenseSettlement,
    calculateGoalPacing,
    sumGoalDepositsForMonth,
    withDerivedGoalStatus,
    calculateSpendablePacing,
    detectUnspentMonthEndSurplus,
    isBufferCategory,
    isSavingsCategory,
    isLoggableCategory,
    computeBufferRemainder,
    computeSavingsBreakdown,
    computeBufferAbsorption,
} from "../src/lib/financialFormulas";
import type {
    Expense,
    Category,
    GoalDeposit,
    SavingsGoal,
} from "../src/types/finance";

describe("financialFormulas", () => {
    describe("calculateCPFAndNetPay", () => {
        it("calculates 20% employee CPF deduction and take-home pay for standard gross salary", () => {
            const result = calculateCPFAndNetPay(5000);
            expect(result.cpfDeduction).toBe(1000);
            expect(result.takeHomePay).toBe(4000);
        });

        it("handles gross salary with bonus", () => {
            const result = calculateCPFAndNetPay(6000, 0.2, 2000);
            expect(result.cpfDeduction).toBe(1200);
            expect(result.takeHomePay).toBe(6800); // 6000 - 1200 + 2000
        });

        it("supports custom CPF rates", () => {
            const result = calculateCPFAndNetPay(4000, 0.05, 0);
            expect(result.cpfDeduction).toBe(200);
            expect(result.takeHomePay).toBe(3800);
        });

        it("handles zero salary", () => {
            const result = calculateCPFAndNetPay(0);
            expect(result.cpfDeduction).toBe(0);
            expect(result.takeHomePay).toBe(0);
        });

        it("rounds cents accurately", () => {
            const result = calculateCPFAndNetPay(3333.33, 0.2);
            expect(result.cpfDeduction).toBe(666.67);
            expect(result.takeHomePay).toBe(2666.66);
        });
    });

    describe("calculateDisposableBudget", () => {
        it("deducts amortized taxes and insurance from take-home pay", () => {
            const disposable = calculateDisposableBudget(4000, 200, 150);
            expect(disposable).toBe(3650);
        });

        it("returns take-home pay unchanged when there are no deductions", () => {
            const disposable = calculateDisposableBudget(5000, 0, 0);
            expect(disposable).toBe(5000);
        });

        it("handles floating point cent precision cleanly", () => {
            const disposable = calculateDisposableBudget(3650.55, 120.25, 80.1);
            expect(disposable).toBe(3450.2);
        });
    });

    describe("calculateCategoryAllocations", () => {
        it("allocates pool across specified percentage targets", () => {
            const targets = [
                { categoryId: "cat-food", percentage: 0.15 },
                { categoryId: "cat-lifestyle", percentage: 0.15 },
                { categoryId: "cat-invest", percentage: 0.35 },
                { categoryId: "cat-savings", percentage: 0.15 },
                { categoryId: "cat-tithing", percentage: 0.1 },
                { categoryId: "cat-transport", percentage: 0.05 },
                { categoryId: "cat-buffer", percentage: 0.05 },
            ];

            const allocations = calculateCategoryAllocations(3000, targets);

            expect(allocations).toHaveLength(7);
            expect(
                allocations.find((a) => a.categoryId === "cat-food")
                    ?.allocatedAmount,
            ).toBe(450);
            expect(
                allocations.find((a) => a.categoryId === "cat-lifestyle")
                    ?.allocatedAmount,
            ).toBe(450);
            expect(
                allocations.find((a) => a.categoryId === "cat-invest")
                    ?.allocatedAmount,
            ).toBe(1050);
            expect(
                allocations.find((a) => a.categoryId === "cat-savings")
                    ?.allocatedAmount,
            ).toBe(450);
            expect(
                allocations.find((a) => a.categoryId === "cat-tithing")
                    ?.allocatedAmount,
            ).toBe(300);
            expect(
                allocations.find((a) => a.categoryId === "cat-transport")
                    ?.allocatedAmount,
            ).toBe(150);
            expect(
                allocations.find((a) => a.categoryId === "cat-buffer")
                    ?.allocatedAmount,
            ).toBe(150);

            const totalAllocated = allocations.reduce(
                (sum, a) => sum + a.allocatedAmount,
                0,
            );
            expect(totalAllocated).toBe(3000);
        });

        it("returns empty array when targets array is empty", () => {
            expect(calculateCategoryAllocations(3000, [])).toEqual([]);
        });
    });

    describe("calculateSharedExpenseSettlement", () => {
        const member1 = "member-yijia";
        const member2 = "member-rachel";

        it("calculates Splitwise-style settlement: Yi Jia paid $100 shared, Rachel paid $40 shared -> Rachel owes Yi Jia $30", () => {
            const expenses: Expense[] = [
                {
                    id: "exp-1",
                    household_id: "hh-1",
                    payer_id: member1,
                    category_id: "cat-groceries",
                    date: "2026-09-10",
                    item: "FairPrice Groceries",
                    amount: 100,
                    is_shared: true,
                    split_ratio: 0.5,
                    settled: false,
                    created_at: "2026-09-10T10:00:00Z",
                },
                {
                    id: "exp-2",
                    household_id: "hh-1",
                    payer_id: member2,
                    category_id: "cat-dining",
                    date: "2026-09-11",
                    item: "Cafe Brunch",
                    amount: 40,
                    is_shared: true,
                    split_ratio: 0.5,
                    settled: false,
                    created_at: "2026-09-11T12:00:00Z",
                },
            ];

            const settlement = calculateSharedExpenseSettlement(
                expenses,
                member1,
                member2,
            );

            // Yi Jia paid 100 -> Rachel owes 50
            // Rachel paid 40 -> Yi Jia owes 20
            // Net: Rachel owes Yi Jia 30
            expect(settlement.netBalance).toBe(30);
            expect(settlement.debtorId).toBe(member2);
            expect(settlement.creditorId).toBe(member1);
            expect(settlement.member1OwesMember2).toBe(20);
            expect(settlement.member2OwesMember1).toBe(50);
            expect(settlement.settlementText).toContain("owes");
        });

        it("returns zero net balance when shared expenses are equal", () => {
            const expenses: Expense[] = [
                {
                    id: "exp-1",
                    household_id: "hh-1",
                    payer_id: member1,
                    date: "2026-09-01",
                    item: "Electricity bill",
                    amount: 120,
                    is_shared: true,
                    split_ratio: 0.5,
                    settled: false,
                    created_at: "2026-09-01T10:00:00Z",
                },
                {
                    id: "exp-2",
                    household_id: "hh-1",
                    payer_id: member2,
                    date: "2026-09-02",
                    item: "Water bill",
                    amount: 120,
                    is_shared: true,
                    split_ratio: 0.5,
                    settled: false,
                    created_at: "2026-09-02T10:00:00Z",
                },
            ];

            const settlement = calculateSharedExpenseSettlement(
                expenses,
                member1,
                member2,
            );
            expect(settlement.netBalance).toBe(0);
            expect(settlement.debtorId).toBeNull();
            expect(settlement.creditorId).toBeNull();
            expect(settlement.settlementText).toBe("All settled up");
        });

        it("ignores settled and non-shared expenses", () => {
            const expenses: Expense[] = [
                {
                    id: "exp-1",
                    household_id: "hh-1",
                    payer_id: member1,
                    date: "2026-09-01",
                    item: "Personal game",
                    amount: 100,
                    is_shared: false, // NOT shared
                    split_ratio: 0.5,
                    settled: false,
                    created_at: "2026-09-01T10:00:00Z",
                },
                {
                    id: "exp-2",
                    household_id: "hh-1",
                    payer_id: member1,
                    date: "2026-08-15",
                    item: "Old groceries",
                    amount: 80,
                    is_shared: true,
                    split_ratio: 0.5,
                    settled: true, // ALREADY settled
                    created_at: "2026-08-15T10:00:00Z",
                },
            ];

            const settlement = calculateSharedExpenseSettlement(
                expenses,
                member1,
                member2,
            );
            expect(settlement.netBalance).toBe(0);
            expect(settlement.debtorId).toBeNull();
            expect(settlement.settlementText).toBe("All settled up");
        });

        it("respects custom split ratio", () => {
            const expenses: Expense[] = [
                {
                    id: "exp-1",
                    household_id: "hh-1",
                    payer_id: member1,
                    date: "2026-09-01",
                    item: "Hotel Booking",
                    amount: 1000,
                    is_shared: true,
                    split_ratio: 0.3, // partner pays 30%
                    settled: false,
                    created_at: "2026-09-01T10:00:00Z",
                },
            ];

            const settlement = calculateSharedExpenseSettlement(
                expenses,
                member1,
                member2,
            );
            expect(settlement.netBalance).toBe(300);
            expect(settlement.debtorId).toBe(member2);
            expect(settlement.creditorId).toBe(member1);
        });
    });

    describe("calculateGoalPacing", () => {
        const referenceDate = "2026-09-15";

        it('returns "achieved" when savedSoFar reaches targetAmount', () => {
            const result = calculateGoalPacing(
                10000,
                10000,
                "2027-09-15",
                500,
                referenceDate,
            );
            expect(result.status).toBe("achieved");
            expect(result.neededPerMonth).toBe(0);
            expect(result.shortfallThisMonth).toBe(0);

            const over = calculateGoalPacing(
                10000,
                12000,
                "2027-09-15",
                0,
                referenceDate,
            );
            expect(over.status).toBe("achieved");
        });

        it("stays on track mid-month while this month's pace is still being met", () => {
            // 12 months left, 12000 to go => 1000 required; nothing deposited yet
            const result = calculateGoalPacing(
                12000,
                0,
                "2027-09-15",
                0,
                referenceDate,
                null,
            );
            expect(result.monthsRemaining).toBe(12);
            expect(result.neededPerMonth).toBe(1000);
            expect(result.carriedShortfall).toBe(0);
            expect(result.shortfallThisMonth).toBe(1000);
            expect(result.status).toBe("on_track");
        });

        it("is on track when last month's pace was met", () => {
            // saved 1000, all deposited last month; last month required 12000/13 = 923.08
            const result = calculateGoalPacing(
                12000,
                1000,
                "2027-09-15",
                0,
                referenceDate,
                1000,
            );
            expect(result.carriedShortfall).toBe(0);
            expect(result.status).toBe("on_track");
        });

        it("is behind in the new month after last month's pace was missed", () => {
            // saved 400 (all last month); last month required 12000/13 = 923.08 => short 523.08
            const result = calculateGoalPacing(
                12000,
                400,
                "2027-09-15",
                0,
                referenceDate,
                400,
            );
            expect(result.carriedShortfall).toBe(523.08);
            // this month: (12000 - 0... month-start saved 400) 11600 / 12 = 966.67
            expect(result.neededPerMonth).toBe(966.67);
            expect(result.shortfallThisMonth).toBe(1489.75);
            expect(result.status).toBe("behind");
        });

        it("clears behind once catch-up deposits cover the carried shortfall plus this month's pace", () => {
            const partial = calculateGoalPacing(
                12000,
                1400,
                "2027-09-15",
                1000,
                referenceDate,
                400,
            );
            expect(partial.status).toBe("behind");

            const caughtUp = calculateGoalPacing(
                12000,
                1900,
                "2027-09-15",
                1500,
                referenceDate,
                400,
            );
            expect(caughtUp.shortfallThisMonth).toBe(0);
            expect(caughtUp.status).toBe("on_track");
        });

        it("a goal created this month is never behind", () => {
            const result = calculateGoalPacing(
                12000,
                0,
                "2027-09-15",
                0,
                referenceDate,
                null,
            );
            expect(result.status).toBe("on_track");
        });

        it("enforces a minimum of 1 month remaining", () => {
            const result = calculateGoalPacing(
                5000,
                2000,
                "2026-09-01",
                0,
                referenceDate,
                null,
            );
            expect(result.monthsRemaining).toBe(1);
            expect(result.neededPerMonth).toBe(3000);
            expect(result.status).toBe("on_track");
        });
    });

    describe("goal deposit ledger helpers", () => {
        const dep = (
            goal_id: string,
            amount: number,
            deposited_at: string,
        ): GoalDeposit => ({
            id: `${goal_id}-${deposited_at}-${amount}`,
            household_id: "hh-1",
            goal_id,
            amount,
            source: "quick_deposit",
            deposited_at,
        });

        it("sums only the goal's deposits in the reference month", () => {
            const deposits = [
                dep("g1", 100, "2026-09-02"),
                dep("g1", 50.5, "2026-09-30"),
                dep("g1", 999, "2026-08-31"),
                dep("g2", 400, "2026-09-10"),
            ];
            expect(sumGoalDepositsForMonth(deposits, "g1", "2026-09-15")).toBe(
                150.5,
            );
            expect(sumGoalDepositsForMonth(deposits, "g1", "2026-10-01")).toBe(
                0,
            );
        });

        it("rolls over to behind only once a month closes short", () => {
            const goal = {
                id: "g1",
                household_id: "hh-1",
                title: "Trip",
                target_amount: 12000,
                saved_so_far: 400,
                target_date: "2027-09-15",
                emoji: "x",
                status: "on_track",
                created_at: "2026-09-01T00:00:00.000Z",
            } as SavingsGoal;
            const deposits = [dep("g1", 400, "2026-09-05")];
            // Mid-September: pace unmet but the month is still open
            expect(
                withDerivedGoalStatus([goal], deposits, "2026-09-15")[0].status,
            ).toBe("on_track");
            // October: September closed short
            expect(
                withDerivedGoalStatus([goal], deposits, "2026-10-01")[0].status,
            ).toBe("behind");
        });
    });

    describe("calculateSpendablePacing", () => {
        const mockCategories: Category[] = [
            {
                id: "cat-food",
                household_id: "hh-1",
                name: "Food",
                color: "#F59E0B",
                icon: "utensils",
                is_system: true,
                group: "spendable",
            },
            {
                id: "cat-lifestyle",
                household_id: "hh-1",
                name: "Lifestyle",
                color: "#EC4899",
                icon: "sparkles",
                is_system: true,
                group: "spendable",
            },
            {
                id: "cat-invest",
                household_id: "hh-1",
                name: "Investments",
                color: "#10B981",
                icon: "trending-up",
                is_system: true,
                group: "allocation",
            },
            {
                id: "cat-savings",
                household_id: "hh-1",
                name: "Savings",
                color: "#6366F1",
                icon: "piggy-bank",
                is_system: true,
                group: "allocation",
            },
        ];

        it("calculates dynamic daily pace and remaining spendable for active month", () => {
            const expenses: Expense[] = [
                {
                    id: "e1",
                    household_id: "hh-1",
                    payer_id: "m1",
                    category_id: "cat-food",
                    amount: 300,
                    date: "2026-10-05",
                    is_shared: false,
                    item: "Groceries",
                    split_ratio: 0.5,
                    settled: false,
                },
                {
                    id: "e2",
                    household_id: "hh-1",
                    payer_id: "m1",
                    category_id: "cat-lifestyle",
                    amount: 200,
                    date: "2026-10-10",
                    is_shared: false,
                    item: "Shopping",
                    split_ratio: 0.5,
                    settled: false,
                },
                // Goal-funded expense should be excluded
                {
                    id: "e3",
                    household_id: "hh-1",
                    payer_id: "m1",
                    category_id: "cat-lifestyle",
                    amount: 500,
                    date: "2026-10-12",
                    is_shared: false,
                    goal_id: "goal-wedding",
                    item: "Wedding Ring",
                    split_ratio: 0.5,
                    settled: false,
                },
                // Allocation category expense should be excluded
                {
                    id: "e4",
                    household_id: "hh-1",
                    payer_id: "m1",
                    category_id: "cat-invest",
                    amount: 1000,
                    date: "2026-10-15",
                    is_shared: false,
                    item: "Stocks",
                    split_ratio: 0.5,
                    settled: false,
                },
            ];

            // October has 31 days. Suppose today is 2026-10-11 => 31 - 11 + 1 = 21 days remaining
            const pacing = calculateSpendablePacing({
                month: "2026-10",
                todayDate: "2026-10-11",
                monthlyCap: 1550,
                expenses,
                categories: mockCategories,
            });

            expect(pacing.spendableAllocated).toBe(1550);
            expect(pacing.spendableSpent).toBe(500); // 300 + 200
            expect(pacing.spendableRemaining).toBe(1050); // 1550 - 500
            expect(pacing.daysInMonth).toBe(31);
            expect(pacing.dayOfMonth).toBe(11);
            expect(pacing.daysRemaining).toBe(21);
            // dynamicDailyPace = 1050 / 21 = 50
            expect(pacing.dynamicDailyPace).toBe(50);
            expect(pacing.isCurrentMonth).toBe(true);
            expect(pacing.pacingStatus).toBe("safe");
        });

        it("handles personal perspective with 50/50 shared split accurately", () => {
            const expenses: Expense[] = [
                // Personal 100%
                {
                    id: "e1",
                    household_id: "hh-1",
                    payer_id: "m1",
                    category_id: "cat-food",
                    amount: 100,
                    date: "2026-10-05",
                    is_shared: false,
                    item: "Lunch",
                    split_ratio: 0.5,
                    settled: false,
                },
                // Shared paid by m1 (50% share = 100)
                {
                    id: "e2",
                    household_id: "hh-1",
                    payer_id: "m1",
                    category_id: "cat-food",
                    amount: 200,
                    date: "2026-10-06",
                    is_shared: true,
                    split_ratio: 0.5,
                    item: "Dinner",
                    settled: false,
                },
                // Shared paid by partner m2 (m1 share = 50)
                {
                    id: "e3",
                    household_id: "hh-1",
                    payer_id: "m2",
                    category_id: "cat-food",
                    amount: 100,
                    date: "2026-10-07",
                    is_shared: true,
                    split_ratio: 0.5,
                    item: "Groceries",
                    settled: false,
                },
            ];

            const pacing = calculateSpendablePacing({
                month: "2026-10",
                todayDate: "2026-10-11",
                memberId: "m1",
                perspective: "m1",
                monthlyCap: 1000,
                expenses,
                categories: mockCategories,
            });

            // m1 spent: 100 + 100 + 50 = 250
            expect(pacing.spendableSpent).toBe(250);
            expect(pacing.spendableRemaining).toBe(750);
        });

        it("reports zero daily pace and completed surplus when viewing past month", () => {
            const expenses: Expense[] = [
                {
                    id: "e1",
                    household_id: "hh-1",
                    payer_id: "m1",
                    category_id: "cat-food",
                    amount: 800,
                    date: "2026-08-15",
                    is_shared: false,
                    item: "Meals",
                    split_ratio: 0.5,
                    settled: false,
                },
            ];

            const pacing = calculateSpendablePacing({
                month: "2026-08",
                todayDate: "2026-10-15",
                monthlyCap: 1000,
                expenses,
                categories: mockCategories,
            });

            expect(pacing.isCurrentMonth).toBe(false);
            expect(pacing.daysRemaining).toBe(0);
            expect(pacing.dynamicDailyPace).toBe(0);
            expect(pacing.spendableRemaining).toBe(200);
        });

        it("flags warning when spent >= 85% and exceeded when remaining < 0", () => {
            const warningPacing = calculateSpendablePacing({
                month: "2026-10",
                todayDate: "2026-10-15",
                monthlyCap: 1000,
                expenses: [
                    {
                        id: "e1",
                        household_id: "hh-1",
                        payer_id: "m1",
                        category_id: "cat-food",
                        amount: 900,
                        date: "2026-10-10",
                        is_shared: false,
                        item: "Meals",
                        split_ratio: 0.5,
                        settled: false,
                    },
                ],
                categories: mockCategories,
            });
            expect(warningPacing.pacingStatus).toBe("warning");

            const exceededPacing = calculateSpendablePacing({
                month: "2026-10",
                todayDate: "2026-10-15",
                monthlyCap: 1000,
                expenses: [
                    {
                        id: "e1",
                        household_id: "hh-1",
                        payer_id: "m1",
                        category_id: "cat-food",
                        amount: 1100,
                        date: "2026-10-10",
                        is_shared: false,
                        item: "Meals",
                        split_ratio: 0.5,
                        settled: false,
                    },
                ],
                categories: mockCategories,
            });
            expect(exceededPacing.pacingStatus).toBe("exceeded");
            expect(exceededPacing.spendableRemaining).toBe(-100);
        });
    });

    describe("detectUnspentMonthEndSurplus", () => {
        const mockCategories: Category[] = [
            {
                id: "cat-food",
                household_id: "hh-1",
                name: "Food",
                color: "#F59E0B",
                icon: "utensils",
                is_system: true,
                group: "spendable",
            },
        ];

        it("detects unspent surplus from the previous month", () => {
            const expenses: Expense[] = [
                {
                    id: "e1",
                    household_id: "hh-1",
                    payer_id: "m1",
                    category_id: "cat-food",
                    amount: 800,
                    date: "2026-09-10",
                    is_shared: false,
                    item: "Meals",
                    split_ratio: 0.5,
                    settled: false,
                },
            ];

            const result = detectUnspentMonthEndSurplus({
                currentMonth: "2026-10",
                lastMonth: "2026-09",
                monthlyCap: 1200,
                expenses,
                categories: mockCategories,
            });

            expect(result.hasUnspentSurplus).toBe(true);
            expect(result.surplusAmount).toBe(400); // 1200 - 800
            expect(result.lastMonth).toBe("2026-09");
        });

        it("returns false when previous month was overspent or fully spent", () => {
            const expenses: Expense[] = [
                {
                    id: "e1",
                    household_id: "hh-1",
                    payer_id: "m1",
                    category_id: "cat-food",
                    amount: 1300,
                    date: "2026-09-10",
                    is_shared: false,
                    item: "Meals",
                    split_ratio: 0.5,
                    settled: false,
                },
            ];

            const result = detectUnspentMonthEndSurplus({
                currentMonth: "2026-10",
                lastMonth: "2026-09",
                monthlyCap: 1200,
                expenses,
                categories: mockCategories,
            });

            expect(result.hasUnspentSurplus).toBe(false);
            expect(result.surplusAmount).toBe(0);
        });

        it("returns nothing while queries are loading or when there is no base profile", () => {
            const whileLoading = detectUnspentMonthEndSurplus({
                currentMonth: "2026-10",
                lastMonth: "2026-09",
                monthlyCap: 1200,
                expenses: [],
                categories: mockCategories,
                queriesReady: false,
            });
            expect(whileLoading.hasUnspentSurplus).toBe(false);
            expect(whileLoading.surplusAmount).toBe(0);

            const noProfiles = detectUnspentMonthEndSurplus({
                currentMonth: "2026-10",
                lastMonth: "2026-09",
                expenses: [],
                categories: mockCategories,
                baseProfiles: [],
                baseAllocations: [],
                queriesReady: true,
            });
            expect(noProfiles.hasUnspentSurplus).toBe(false);
            expect(noProfiles.surplusAmount).toBe(0);

            const noCapOrProfile = detectUnspentMonthEndSurplus({
                currentMonth: "2026-10",
                lastMonth: "2026-09",
                expenses: [],
                categories: mockCategories,
            });
            expect(noCapOrProfile.hasUnspentSurplus).toBe(false);
            expect(noCapOrProfile.surplusAmount).toBe(0);
        });

        it("uses monthlyBudget.spendableRemaining when monthlyBudget is provided", () => {
            const result = detectUnspentMonthEndSurplus({
                currentMonth: "2026-10",
                lastMonth: "2026-09",
                expenses: [],
                categories: mockCategories,
                baseProfiles: [
                    {
                        id: "prof-1",
                        household_id: "hh-1",
                        owner_id: "m1",
                        gross_salary: 6000,
                        cpf_employee_rate: 0.2,
                        tithing_enabled: false,
                    },
                ],
                monthlyBudget: {
                    budget: {
                        id: "mb-1",
                        household_id: "hh-1",
                        owner_id: "m1",
                        month: "2026-09",
                        gross_salary: 6000,
                        bonus: 0,
                        cpf_deduction: 1200,
                        taxes_deduction: 0,
                        insurance_deduction: 0,
                        after_deductions: 4800,
                        is_locked: false,
                    },
                    categories: [],
                    disposablePool: 4800,
                    totalSpent: 4000,
                    totalRemaining: 800,
                    spendableAllocated: 1800,
                    spendableSpent: 1125,
                    spendableRemaining: 675,
                },
                queriesReady: true,
            });

            expect(result.hasUnspentSurplus).toBe(true);
            expect(result.surplusAmount).toBe(675);
            expect(result.lastMonth).toBe("2026-09");
        });
    });
});

describe("buffer and savings helpers", () => {
    const cat = (name: string, group?: "spendable" | "allocation") => ({
        id: name,
        household_id: "hh",
        name,
        color: "#000",
        icon: "tag",
        is_system: false,
        group,
    });

    it("recognises Buffer and Savings by name", () => {
        expect(isBufferCategory(cat("Buffer"))).toBe(true);
        expect(isBufferCategory("  buffer ")).toBe(true);
        expect(isBufferCategory(cat("Food"))).toBe(false);
        expect(isSavingsCategory(cat("Savings"))).toBe(true);
        expect(isSavingsCategory("Emergency Savings")).toBe(true);
        expect(isSavingsCategory(cat("Investments"))).toBe(false);
        expect(isSavingsCategory(null)).toBe(false);
    });

    it("excludes only Savings from loggable categories", () => {
        expect(isLoggableCategory(cat("Savings", "allocation"))).toBe(false);
        expect(isLoggableCategory(cat("Buffer", "spendable"))).toBe(true);
        expect(isLoggableCategory(cat("Tithing", "allocation"))).toBe(true);
    });

    it("computes the buffer remainder, clamped at zero", () => {
        expect(computeBufferRemainder([40, 30, 10])).toBe(20);
        expect(computeBufferRemainder([])).toBe(100);
        expect(computeBufferRemainder([70, 40])).toBe(0);
        expect(computeBufferRemainder([33.3333, 33.3333])).toBeCloseTo(
            33.3334,
            4,
        );
    });

    it("splits savings into base, excess and total", () => {
        expect(
            computeSavingsBreakdown({
                baseSavings: 500,
                spendableAllocated: 2000,
                spendableSpent: 1500,
            }),
        ).toEqual({ base: 500, excess: 500, total: 1000 });
    });

    it("lets excess go negative when spending exceeds the spendable cap", () => {
        expect(
            computeSavingsBreakdown({
                baseSavings: 500,
                spendableAllocated: 2000,
                spendableSpent: 2300,
            }),
        ).toEqual({ base: 500, excess: -300, total: 200 });
    });

    describe("computeBufferAbsorption", () => {
        it("handles empty or no buffer category gracefully", () => {
            const categories = [
                {
                    category_id: "c1",
                    category: {
                        id: "c1",
                        name: "Food",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 500,
                    actualSpent: 600,
                },
            ];
            const result = computeBufferAbsorption(categories);
            expect(result.hasBuffer).toBe(false);
            expect(result.totalOverages).toBe(100);
            expect(result.totalAbsorbed).toBe(0);
            expect(result.totalUncovered).toBe(100);
            expect(result.isDepleted).toBe(false);
            expect(result.categoryBreakdown["c1"]).toEqual({
                categoryId: "c1",
                categoryName: "Food",
                allocated: 500,
                actual: 600,
                overage: 100,
                absorbed: 0,
                uncovered: 100,
                status: "uncovered",
            });
        });

        it("fully absorbs single category overspending within buffer capacity", () => {
            const categories = [
                {
                    category_id: "c-food",
                    category: {
                        id: "c-food",
                        name: "Food",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 500,
                    actualSpent: 600,
                },
                {
                    category_id: "c-buf",
                    category: {
                        id: "c-buf",
                        name: "Buffer",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 300,
                    actualSpent: 50,
                },
            ];
            const result = computeBufferAbsorption(categories);
            expect(result.hasBuffer).toBe(true);
            expect(result.bufferAllocated).toBe(300);
            expect(result.bufferDirectSpent).toBe(50);
            expect(result.bufferAvailableBeforeAbsorption).toBe(250);
            expect(result.totalOverages).toBe(100);
            expect(result.totalAbsorbed).toBe(100);
            expect(result.totalUncovered).toBe(0);
            expect(result.bufferRemaining).toBe(150);
            expect(result.isDepleted).toBe(false);

            expect(result.categoryBreakdown["c-food"]).toEqual({
                categoryId: "c-food",
                categoryName: "Food",
                allocated: 500,
                actual: 600,
                overage: 100,
                absorbed: 100,
                uncovered: 0,
                status: "covered",
            });
            expect(result.cushionBreakdown).toEqual([
                {
                    categoryId: "c-food",
                    categoryName: "Food",
                    absorbedAmount: 100,
                },
            ]);
        });

        it("fully absorbs multiple category overspendings", () => {
            const categories = [
                {
                    category_id: "c-food",
                    category: {
                        id: "c-food",
                        name: "Food",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 400,
                    actualSpent: 480,
                },
                {
                    category_id: "c-transport",
                    category: {
                        id: "c-transport",
                        name: "Transport",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 200,
                    actualSpent: 260,
                },
                {
                    category_id: "c-life",
                    category: {
                        id: "c-life",
                        name: "Lifestyle",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 300,
                    actualSpent: 250,
                },
                {
                    category_id: "c-buf",
                    category: {
                        id: "c-buf",
                        name: "Buffer",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 500,
                    actualSpent: 100,
                },
            ];
            const result = computeBufferAbsorption(categories);
            expect(result.totalOverages).toBe(140); // 80 + 60
            expect(result.totalAbsorbed).toBe(140);
            expect(result.totalUncovered).toBe(0);
            expect(result.bufferRemaining).toBe(260); // 500 - 100 - 140
            expect(result.isDepleted).toBe(false);

            expect(result.categoryBreakdown["c-food"].status).toBe("covered");
            expect(result.categoryBreakdown["c-food"].absorbed).toBe(80);
            expect(result.categoryBreakdown["c-transport"].status).toBe(
                "covered",
            );
            expect(result.categoryBreakdown["c-transport"].absorbed).toBe(60);
            expect(result.categoryBreakdown["c-life"].status).toBe("normal");
            expect(result.categoryBreakdown["c-life"].absorbed).toBe(0);
        });

        it("handles partial depletion when overages exceed buffer capacity", () => {
            const categories = [
                {
                    category_id: "c-food",
                    category: {
                        id: "c-food",
                        name: "Food",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 500,
                    actualSpent: 600, // 100 overage (2/3 of 150)
                },
                {
                    category_id: "c-transport",
                    category: {
                        id: "c-transport",
                        name: "Transport",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 200,
                    actualSpent: 250, // 50 overage (1/3 of 150)
                },
                {
                    category_id: "c-buf",
                    category: {
                        id: "c-buf",
                        name: "Buffer",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 100,
                    actualSpent: 20, // 80 available
                },
            ];
            const result = computeBufferAbsorption(categories);
            expect(result.totalOverages).toBe(150);
            expect(result.totalAbsorbed).toBe(80);
            expect(result.totalUncovered).toBe(70);
            expect(result.bufferRemaining).toBe(0);
            expect(result.isDepleted).toBe(true);

            const food = result.categoryBreakdown["c-food"];
            expect(food.status).toBe("partially_covered");
            expect(food.absorbed).toBe(53.33);
            expect(food.uncovered).toBe(46.67);

            const transport = result.categoryBreakdown["c-transport"];
            expect(transport.status).toBe("partially_covered");
            expect(transport.absorbed).toBe(26.67);
            expect(transport.uncovered).toBe(23.33);

            // Cent rounding check
            expect(food.absorbed + transport.absorbed).toBe(80);
            expect(food.uncovered + transport.uncovered).toBe(70);
        });

        it("handles completely depleted buffer (0 available before absorption)", () => {
            const categories = [
                {
                    category_id: "c-food",
                    category: {
                        id: "c-food",
                        name: "Food",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 500,
                    actualSpent: 550,
                },
                {
                    category_id: "c-buf",
                    category: {
                        id: "c-buf",
                        name: "Buffer",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 100,
                    actualSpent: 100, // 0 available
                },
            ];
            const result = computeBufferAbsorption(categories);
            expect(result.totalAbsorbed).toBe(0);
            expect(result.totalUncovered).toBe(50);
            expect(result.bufferRemaining).toBe(0);
            expect(result.isDepleted).toBe(true);
            expect(result.categoryBreakdown["c-food"].status).toBe("uncovered");
            expect(result.categoryBreakdown["c-food"].uncovered).toBe(50);
        });

        it("handles buffer that was directly overspent", () => {
            const categories = [
                {
                    category_id: "c-food",
                    category: {
                        id: "c-food",
                        name: "Food",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 500,
                    actualSpent: 550,
                },
                {
                    category_id: "c-buf",
                    category: {
                        id: "c-buf",
                        name: "Buffer",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 100,
                    actualSpent: 120, // -20 remaining directly
                },
            ];
            const result = computeBufferAbsorption(categories);
            expect(result.bufferAvailableBeforeAbsorption).toBe(0);
            expect(result.bufferRemaining).toBe(-20);
            expect(result.isDepleted).toBe(true);
            expect(result.totalAbsorbed).toBe(0);
            expect(result.categoryBreakdown["c-food"].status).toBe("uncovered");
        });

        it("ignores allocation/savings categories when calculating overages", () => {
            const categories = [
                {
                    category_id: "c-savings",
                    category: {
                        id: "c-savings",
                        name: "Emergency Savings",
                        group: "allocation",
                    } as Category,
                    allocated_amount: 500,
                    actualSpent: 700, // funded/transferred more, not an overage
                },
                {
                    category_id: "c-buf",
                    category: {
                        id: "c-buf",
                        name: "Buffer",
                        group: "spendable",
                    } as Category,
                    allocated_amount: 200,
                    actualSpent: 0,
                },
            ];
            const result = computeBufferAbsorption(categories);
            expect(result.totalOverages).toBe(0);
            expect(result.totalAbsorbed).toBe(0);
            expect(result.bufferRemaining).toBe(200);
            expect(result.isDepleted).toBe(false);
        });
    });
});
