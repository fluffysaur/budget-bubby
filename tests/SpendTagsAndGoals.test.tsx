/**
 * Spend Tags & Sinking Fund Goals Drawdown
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpendTagChips } from "../src/components/expenses/SpendTagChips";
import { GoalCard } from "../src/components/goals/GoalCard";
import { ExpenseFormModal } from "../src/components/expenses/ExpenseFormModal";
import { financeService } from "../src/services/financeService";
import { mockFinanceService } from "../src/services/mockFinanceService";
import { formatSGD } from "../src/lib/currency";
import type {
    Expense,
    SavingsGoal,
    HouseholdMember,
} from "../src/types/finance";

const testMembers: HouseholdMember[] = [
    {
        id: "mem-00000000-0011",
        household_id: "hh-00000000-0001",
        display_name: "Alex",
        role: "owner",
    },
    {
        id: "mem-00000000-0012",
        household_id: "hh-00000000-0001",
        display_name: "Sam",
        role: "member",
    },
];

describe("Big-Ticket Goals Sinking Fund & Drawdown", () => {
    beforeEach(() => {
        mockFinanceService.resetData();
    });

    const weddingGoal: SavingsGoal = {
        id: "goal-00000000-0501",
        household_id: "hh-00000000-0001",
        title: "Wedding",
        target_amount: 55000.0,
        target_date: "2027-05-01",
        emoji: "💍",
        status: "achieved",
    };

    const weddingLinkedExpenses: Expense[] = [
        {
            id: "exp-w1",
            household_id: "hh-00000000-0001",
            payer_id: "mem-00000000-0011",
            category_id: "cat-00000000-0102",
            date: "2026-10-15",
            item: "Grand Ballroom Deposit",
            amount: 5000.0,
            is_shared: true,
            split_ratio: 0.5,
            settled: true,
            goal_id: "goal-00000000-0501",
            tags: ["Wedding"],
        },
    ];

    it("GoalCard displays Target Amount, Covered Today, Goal-Funded Spend and Pace", () => {
        render(
            <GoalCard
                goal={weddingGoal}
                linkedExpenses={weddingLinkedExpenses}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /breakdown/i }));

        // Breakdown metric labels
        expect(screen.getByText("Target Amount")).toBeInTheDocument();
        expect(screen.getByText("Covered Today")).toBeInTheDocument();
        expect(screen.getByText("Goal Spend")).toBeInTheDocument();
        expect(screen.getByText("Pace")).toBeInTheDocument();
        expect(screen.queryByText("Total Saved")).not.toBeInTheDocument();

        // Target Amount: 55,000
        expect(screen.getAllByText("S$55,000").length).toBeGreaterThanOrEqual(
            1,
        );
        // Goal-funded spend: 5,000 appears in metric card and in linked expenses
        expect(
            screen.getAllByText(formatSGD(5000.0)).length,
        ).toBeGreaterThanOrEqual(1);

        // Linked goal expenses list
        expect(screen.getByText("Spends (1)")).toBeInTheDocument();
        expect(screen.getByText("Grand Ballroom Deposit")).toBeInTheDocument();

        // "+ Spend from Goal" button
        expect(
            screen.getByRole("button", { name: /\+ Spend from Wedding/i }),
        ).toBeInTheDocument();
    });

    it("spends from a goal via the Add Expense form with the goal pre-selected", async () => {
        const addSpy = vi.spyOn(financeService, "addExpense");
        const onExpenseAdded = vi.fn();
        const onClose = vi.fn();
        const otherGoal: SavingsGoal = {
            ...weddingGoal,
            id: "goal-other",
            title: "Japan Trip",
            emoji: "✈️",
        };

        render(
            <ExpenseFormModal
                isOpen={true}
                onClose={onClose}
                initialGoalId={weddingGoal.id}
                goals={[otherGoal, weddingGoal]}
                members={testMembers}
                onExpenseAdded={onExpenseAdded}
            />,
        );

        // Same Add Expense form, Goal funding on, the goal picked, no auto-tag
        expect(
            screen.getByRole("heading", { name: "Add Expense" }),
        ).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /goal/i })).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(
            screen.getByRole("button", { name: /wedding/i }),
        ).toHaveAttribute("aria-pressed", "true");
        expect(screen.queryByText("#Wedding")).not.toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText("0.00"), {
            target: { value: "2500" },
        });
        fireEvent.change(screen.getByLabelText(/^Description$/i), {
            target: { value: "Wedding Photographer Deposit" },
        });
        fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));

        await waitFor(() => {
            expect(onExpenseAdded).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
        expect(addSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                goal_id: weddingGoal.id,
                category_id: null,
                tags: undefined,
            }),
        );

        // Spending from a goal no longer moves the stored goal balance
        const goals = await financeService.getGoals();
        const updatedWedding = goals.find((g) => g.id === "goal-00000000-0501");
        expect(updatedWedding).toBeDefined();
    });

    it("excludes goal-funded spend from blowing up normal monthly spendable category caps", async () => {
        // Add an expense without goal_id (Food: 50)
        await financeService.addExpense({
            payer_id: testMembers[0].id,
            category_id: "cat-00000000-0101", // Food
            date: "2026-10-10",
            item: "Normal Lunch",
            amount: 50.0,
            is_shared: false,
        });

        // Add a goal-funded big-ticket expense (Food/Catering: 3000)
        await financeService.addExpense({
            payer_id: testMembers[0].id,
            category_id: "cat-00000000-0101", // Food
            date: "2026-10-12",
            item: "Wedding Banquet Catering",
            amount: 3000.0,
            is_shared: false,
            goal_id: "goal-00000000-0501", // Linked to Wedding
            tags: ["Wedding"],
        });

        // Fetch monthly budget detail for 2026-10
        const budgetDetail = await financeService.getMonthlyBudget(
            "2026-10",
            testMembers[0].id,
        );
        const foodCategory = budgetDetail.categories.find(
            (c) => c.category_id === "cat-00000000-0101",
        );

        expect(foodCategory).toBeDefined();
        // The actualSpent for Food must NOT include the $3,000 goal-funded spend
        // It should only include the normal food spend ($50 + any prior non-goal seed food for Oct)
        expect(foodCategory?.actualSpent).toBeLessThan(1000);
    });

    it("merges legacy #-prefixed tags with unprefixed tags without double ##", () => {
        const mixedExpenses: Expense[] = [
            {
                id: "e-hash-1",
                household_id: "hh-1",
                payer_id: "m1",
                category_id: "cat-food",
                date: "2026-11-01",
                item: "Bali Accoms",
                amount: 105.78,
                is_shared: false,
                split_ratio: 0,
                settled: false,
                tags: ["#BaliTrip"],
            },
            {
                id: "e-hash-2",
                household_id: "hh-1",
                payer_id: "m1",
                category_id: "cat-food",
                date: "2026-11-01",
                item: "Income Insurance",
                amount: 20.2,
                is_shared: false,
                split_ratio: 0,
                settled: false,
                tags: ["BaliTrip"],
            },
        ];

        render(
            <SpendTagChips
                expenses={mixedExpenses}
                activeTag="#BaliTrip"
                onSelectTag={vi.fn()}
            />,
        );

        expect(screen.getAllByRole("button")).toHaveLength(1);
        expect(screen.getByTestId("tag-chip-BaliTrip")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        expect(screen.queryByText(/##/)).not.toBeInTheDocument();
    });
});
