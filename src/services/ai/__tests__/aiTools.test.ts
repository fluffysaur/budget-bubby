import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { financeService } from "../../financeService";
import {
    executeReadTool,
    buildProposedAction,
    executeProposedAction,
    isReadTool,
    isProposalTool,
    ProposalUnavailableError,
    UNKNOWN_PAYER_MESSAGE,
} from "../aiTools";

describe("aiTools", () => {
    const context = {
        perspective: "household",
        activeMemberId: "mem-1",
        todayIso: "2026-11-22",
    };

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("classifies read and proposal tools accurately", () => {
        expect(isReadTool("getHouseholdOverview")).toBe(true);
        expect(isReadTool("getGoals")).toBe(true);
        expect(isReadTool("proposeExpense")).toBe(false);

        expect(isProposalTool("proposeExpense")).toBe(true);
        expect(isProposalTool("proposeBalanceUpdate")).toBe(true);
        expect(isProposalTool("proposeBudgetAdjustment")).toBe(true);
        expect(isProposalTool("getAccounts")).toBe(false);
    });

    it("executes all 5 read tools against financeService", async () => {
        vi.spyOn(financeService, "getHouseholdOverview").mockResolvedValue({
            household: { id: "hh-1", name: "Demo Home", currency: "SGD" },
            members: [
                {
                    id: "mem-1",
                    household_id: "hh-1",
                    display_name: "Alex",
                    role: "owner",
                },
            ],
            totalAssets: 52000,
            trueNetWorth: 50000,
            settlementSummary: {
                netBalance: 0,
                debtorId: null,
                creditorId: null,
                settlementText: "All settled up",
                member1OwesMember2: 0,
                member2OwesMember1: 0,
            },
            activeGoals: [],
            upcomingBills: [],
        });
        vi.spyOn(financeService, "getAccounts").mockResolvedValue([
            {
                id: "acc-1",
                household_id: "hh-1",
                owner_id: "mem-1",
                name: "DBS Multiplier",
                type: "Cash",
                balance: 12000,
                currency: "SGD",
                is_joint: false,
            },
        ]);
        vi.spyOn(financeService, "getCategories").mockResolvedValue([
            {
                id: "cat-food",
                household_id: "hh-1",
                name: "Food & Dining",
                color: "#f97316",
                icon: "Utensils",
                is_system: false,
            },
        ]);
        vi.spyOn(financeService, "getExpenses").mockResolvedValue([
            {
                id: "exp-1",
                household_id: "hh-1",
                payer_id: "mem-1",
                category_id: "cat-food",
                date: "2026-11-20",
                item: "Chicken rice",
                amount: 6.5,
                is_shared: false,
                split_ratio: 0,
                settled: false,
            },
        ]);
        vi.spyOn(financeService, "getMonthlyBudget").mockResolvedValue({
            budget: {
                id: "mb-1",
                household_id: "hh-1",
                owner_id: "mem-1",
                month: "2026-11",
                gross_salary: 6000,
                bonus: 0,
                cpf_deduction: 1200,
                taxes_deduction: 200,
                insurance_deduction: 300,
                after_deductions: 4300,
                is_locked: false,
            },
            categories: [],
            disposablePool: 4300,
            totalSpent: 1500,
            totalRemaining: 2800,
        });
        vi.spyOn(financeService, "getGoals").mockResolvedValue([
            {
                id: "goal-1",
                household_id: "hh-1",
                title: "Emergency Fund",
                target_amount: 30000,
                target_date: "2027-12-01",
                emoji: "🛡️",
                status: "on_track",
            },
        ]);

        const overview = await executeReadTool(
            "getHouseholdOverview",
            {},
            context,
        );
        expect(overview.trueNetWorth).toBe(50000);

        const accounts = await executeReadTool("getAccounts", {}, context);
        expect(accounts.count).toBe(1);

        const expenses = await executeReadTool(
            "getExpenses",
            { month: "2026-11" },
            context,
        );
        expect(expenses.totalAmount).toBe(6.5);

        const budget = await executeReadTool(
            "getMonthlyBudget",
            { month: "2026-11" },
            context,
        );
        expect(budget.totalRemaining).toBe(2800);

        const goals = await executeReadTool("getGoals", {}, context);
        expect(goals.count).toBe(1);
    });

    describe("getExpenses goal spend", () => {
        const baseExpense = {
            household_id: "hh-1",
            payer_id: "mem-1",
            is_shared: false,
            split_ratio: 0,
            settled: false,
        };

        beforeEach(() => {
            vi.spyOn(financeService, "getCategories").mockResolvedValue([
                {
                    id: "cat-food",
                    household_id: "hh-1",
                    name: "Food & Dining",
                    color: "#f97316",
                    icon: "Utensils",
                    is_system: false,
                },
            ]);
            vi.spyOn(financeService, "getGoals").mockResolvedValue([
                {
                    id: "goal-wedding",
                    household_id: "hh-1",
                    title: "Wedding",
                    target_amount: 30000,
                    target_date: "2027-06-01",
                    emoji: "💍",
                    status: "on_track",
                },
            ]);
        });

        type ExpenseRow = { id: string };
        const rows = (result: Record<string, unknown>) =>
            result.expenses as ExpenseRow[];

        function mockExpenses() {
            return vi.spyOn(financeService, "getExpenses").mockResolvedValue([
                {
                    ...baseExpense,
                    id: "exp-food",
                    category_id: "cat-food",
                    date: "2026-11-20",
                    item: "Chicken rice",
                    amount: 6.5,
                },
                {
                    ...baseExpense,
                    id: "exp-venue",
                    category_id: null,
                    goal_id: "goal-wedding",
                    date: "2026-11-05",
                    item: "Venue deposit",
                    amount: 2000,
                },
                {
                    ...baseExpense,
                    id: "exp-misc",
                    category_id: null,
                    date: "2026-11-12",
                    item: "Old item",
                    amount: 15,
                },
            ]);
        }

        it("labels goal-funded expenses with the goal, not Uncategorized", async () => {
            mockExpenses();
            const result = await executeReadTool(
                "getExpenses",
                { month: "2026-11" },
                context,
            );
            const byId = Object.fromEntries(rows(result).map((e) => [e.id, e]));

            expect(byId["exp-venue"]).toMatchObject({
                category: null,
                goalId: "goal-wedding",
                goalName: "Wedding",
            });
            expect(byId["exp-food"]).toMatchObject({
                category: "Food & Dining",
                goalName: null,
            });
            expect(byId["exp-misc"]).toMatchObject({
                category: "Uncategorized",
                goalName: null,
            });
        });

        it("splits budget and goal spend totals", async () => {
            mockExpenses();
            const result = await executeReadTool(
                "getExpenses",
                { month: "2026-11" },
                context,
            );

            expect(result.totalAmount).toBe(2021.5);
            expect(result.goalSpendTotal).toBe(2000);
            expect(result.budgetSpendTotal).toBe(21.5);
        });

        it("sorts newest first by default and largest first with sortBy amount", async () => {
            mockExpenses();
            const byDate = await executeReadTool(
                "getExpenses",
                { month: "2026-11" },
                context,
            );
            expect(rows(byDate).map((e) => e.id)).toEqual([
                "exp-food",
                "exp-misc",
                "exp-venue",
            ]);

            const byAmount = await executeReadTool(
                "getExpenses",
                { month: "2026-11", sortBy: "amount", limit: 2 },
                context,
            );
            expect(rows(byAmount).map((e) => e.id)).toEqual([
                "exp-venue",
                "exp-misc",
            ]);
            expect(byAmount.totalCount).toBe(3);
        });

        it("passes goalId through to the finance service filter", async () => {
            const spy = mockExpenses();
            await executeReadTool(
                "getExpenses",
                { month: "2026-11", goalId: "goal-wedding" },
                context,
            );

            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ goalId: "goal-wedding" }),
            );
        });
    });

    it("builds a proposeExpense card without mutating, then saves and invalidates on confirm", async () => {
        vi.spyOn(financeService, "getHouseholdOverview").mockResolvedValue({
            household: { id: "hh-1", name: "Demo Home", currency: "SGD" },
            members: [
                {
                    id: "mem-1",
                    household_id: "hh-1",
                    display_name: "Alex",
                    role: "owner",
                },
            ],
            totalAssets: 52000,
            trueNetWorth: 50000,
            settlementSummary: {
                netBalance: 0,
                debtorId: null,
                creditorId: null,
                settlementText: "All settled up",
                member1OwesMember2: 0,
                member2OwesMember1: 0,
            },
            activeGoals: [],
            upcomingBills: [],
        });
        vi.spyOn(financeService, "getCategories").mockResolvedValue([
            {
                id: "cat-food",
                household_id: "hh-1",
                name: "Food & Dining",
                color: "#f97316",
                icon: "Utensils",
                is_system: false,
            },
        ]);
        const addExpenseSpy = vi
            .spyOn(financeService, "addExpense")
            .mockResolvedValue({
                id: "exp-new",
                household_id: "hh-1",
                payer_id: "mem-1",
                category_id: "cat-food",
                date: "2026-11-22",
                item: "Laksa",
                amount: 8.5,
                is_shared: false,
                split_ratio: 0,
                settled: false,
            });

        const proposal = await buildProposedAction(
            "proposeExpense",
            { item: "Laksa", amount: 8.5, categoryName: "Food" },
            context,
        );

        expect(proposal.type).toBe("proposeExpense");
        expect(proposal.status).toBe("pending");
        expect(addExpenseSpy).not.toHaveBeenCalled();

        const qc = new QueryClient();
        const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
        await executeProposedAction(proposal, qc);

        expect(addExpenseSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                item: "Laksa",
                amount: 8.5,
                category_id: "cat-food",
                payer_id: "mem-1",
            }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["finance", "expenses"],
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["finance", "monthly-budget"],
        });
    });

    it("refuses to propose an expense when it can't tell who paid", async () => {
        vi.spyOn(financeService, "getHouseholdOverview").mockResolvedValue({
            household: { id: "hh-1", name: "Demo Home", currency: "SGD" },
            members: [
                {
                    id: "mem-1",
                    household_id: "hh-1",
                    display_name: "Alex",
                    role: "owner",
                },
            ],
            totalAssets: 0,
            trueNetWorth: 0,
            settlementSummary: {
                netBalance: 0,
                debtorId: null,
                creditorId: null,
                settlementText: "All settled up",
                member1OwesMember2: 0,
                member2OwesMember1: 0,
            },
            activeGoals: [],
            upcomingBills: [],
        });
        vi.spyOn(financeService, "getCategories").mockResolvedValue([]);

        for (const activeMemberId of [undefined, "mem-unknown"]) {
            const attempt = buildProposedAction(
                "proposeExpense",
                { item: "Laksa", amount: 8.5 },
                { ...context, activeMemberId },
            );
            await expect(attempt).rejects.toBeInstanceOf(
                ProposalUnavailableError,
            );
            await expect(attempt).rejects.toThrow(UNKNOWN_PAYER_MESSAGE);
        }
    });

    it("executes confirmed balance update and budget adjustment", async () => {
        vi.spyOn(financeService, "getAccounts").mockResolvedValue([
            {
                id: "acc-1",
                household_id: "hh-1",
                owner_id: "mem-1",
                name: "DBS Multiplier",
                type: "Cash",
                balance: 10000,
                currency: "SGD",
                is_joint: false,
            },
        ]);
        const updateBalSpy = vi
            .spyOn(financeService, "updateAccountBalance")
            .mockResolvedValue({
                id: "acc-1",
                household_id: "hh-1",
                owner_id: "mem-1",
                name: "DBS Multiplier",
                type: "Cash",
                balance: 12500,
                currency: "SGD",
                is_joint: false,
            });
        vi.spyOn(financeService, "getMonthlyBudget").mockResolvedValue({
            budget: {
                id: "mb-1",
                household_id: "hh-1",
                owner_id: "mem-1",
                month: "2026-11",
                gross_salary: 6000,
                bonus: 0,
                cpf_deduction: 1200,
                taxes_deduction: 200,
                insurance_deduction: 300,
                after_deductions: 4300,
                is_locked: false,
            },
            categories: [],
            disposablePool: 4300,
            totalSpent: 1000,
            totalRemaining: 3300,
        });
        const updateBudgetSpy = vi
            .spyOn(financeService, "updateMonthlyBudget")
            .mockResolvedValue();

        const qc = new QueryClient();

        const balProposal = await buildProposedAction(
            "proposeBalanceUpdate",
            { accountName: "DBS", newBalance: 12500 },
            context,
        );
        expect(balProposal.type).toBe("proposeBalanceUpdate");
        if (balProposal.type === "proposeBalanceUpdate") {
            expect(balProposal.payload.accountId).toBe("acc-1");
            expect(balProposal.payload.previousBalance).toBe(10000);
        }
        await executeProposedAction(balProposal, qc);
        expect(updateBalSpy).toHaveBeenCalledWith(
            "acc-1",
            12500,
            undefined,
            "2026-11-22",
        );

        const budgetProposal = await buildProposedAction(
            "proposeBudgetAdjustment",
            { month: "2026-11", bonus: 2500 },
            context,
        );
        await executeProposedAction(budgetProposal, qc);
        expect(updateBudgetSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "mb-1",
                month: "2026-11",
                bonus: 2500,
            }),
        );
    });
});
