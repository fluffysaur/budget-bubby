import { describe, expect, it } from "vitest";
import {
    applyScenario,
    applyTrimTradeOff,
    computeTrimCandidates,
    lifeEventsFromRecurring,
    oaEventsFromRecurring,
    projectRoadmap,
    suggestTradeOffs,
    type RoadmapInput,
} from "../index";
import {
    getRecurringItemStatus,
    isRecurringItemActiveInMonth,
    resolveGoalLinkedStartDate,
    resolveRecurringStartDate,
} from "../../recurringItems";
import { mockFinanceService } from "../../../services/mockFinanceService";
import type {
    BaseBudgetProfile,
    BaseProfileAllocation,
    Category,
    Expense,
    MonthlyBudgetHistoryRow,
    RecurringItem,
    SavingsGoal,
} from "../../../types/finance";

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
    return {
        id: "g-house",
        household_id: "hh-1",
        owner_id: null,
        title: "House",
        target_amount: 80000,
        target_date: "2027-07-01",
        emoji: "🏠",
        status: "on_track",
        ...overrides,
    };
}

function makeRecurring(overrides: Partial<RecurringItem> = {}): RecurringItem {
    return {
        id: "rec-1",
        household_id: "hh-1",
        owner_id: "mem-1",
        type: "bill",
        name: "Mortgage",
        amount: 1800,
        frequency: "monthly",
        monthly_amortized_amount: 1800,
        due_day: 1,
        ...overrides,
    };
}

describe("goal-linked recurring items", () => {
    it("resolves effective start_date from linked goal and offset", () => {
        const goal = makeGoal({ id: "g-baby", target_date: "2027-06-15" });
        const goalsById = new Map([[goal.id, goal]]);

        expect(resolveGoalLinkedStartDate(goal.target_date, 0)).toBe(
            "2027-06-15",
        );
        expect(resolveGoalLinkedStartDate(goal.target_date, 9)).toBe(
            "2028-03-15",
        );

        const item = makeRecurring({
            goal_id: "g-baby",
            goal_offset_months: 9,
            start_date: "2027-01-01", // stale stored date overridden by goal
        });
        expect(resolveRecurringStartDate(item, goalsById)).toBe("2028-03-15");
        expect(isRecurringItemActiveInMonth(item, "2028-02", goalsById)).toBe(
            false,
        );
        expect(isRecurringItemActiveInMonth(item, "2028-03", goalsById)).toBe(
            true,
        );
        expect(getRecurringItemStatus(item, "2028-02", goalsById)).toBe(
            "upcoming",
        );
        expect(getRecurringItemStatus(item, "2028-03", goalsById)).toBe(
            "active",
        );
    });

    it("carries goalId and shifts linked life events & OA events on delay", () => {
        const house = makeGoal({ id: "g-house", target_date: "2027-07-01" });
        const cashItem = makeRecurring({
            id: "rec-cash",
            name: "Town Council",
            amount: 150,
            goal_id: "g-house",
            goal_offset_months: 3,
        });
        const oaItem = makeRecurring({
            id: "rec-oa",
            name: "Mortgage OA",
            amount: 1600,
            paid_from_cpf_oa: true,
            goal_id: "g-house",
            goal_offset_months: 0,
        });

        const cashEvents = lifeEventsFromRecurring(
            [cashItem, oaItem],
            "2026-11",
            [house],
        );
        expect(cashEvents).toHaveLength(1);
        expect(cashEvents[0]).toMatchObject({
            id: "rec-cash-starts",
            startMonth: "2027-10",
            goalId: "g-house",
            goalOffsetMonths: 3,
            monthlyDelta: -150,
        });

        const oaEvents = oaEventsFromRecurring(
            [cashItem, oaItem],
            "2026-11",
            [house],
        );
        expect(oaEvents).toHaveLength(1);
        expect(oaEvents[0]).toMatchObject({
            id: "rec-oa-starts",
            startMonth: "2027-07",
            goalId: "g-house",
            goalOffsetMonths: 0,
            monthlyDelta: -1600,
        });

        const input: RoadmapInput = {
            today: "2026-11-15",
            pool: { liquid: 20000, investments: 0, asOf: "2026-11-15" },
            monthlySavings: 2000,
            goals: [
                {
                    id: "g-house",
                    title: "House",
                    emoji: "🏠",
                    targetAmount: 80000,
                    targetDate: "2027-07-01",
                    spent: 0,
                    done: false,
                },
            ],
            cashFlowChanges: cashEvents,
            cpfOa: {
                balance: 50000,
                monthlyGrowth: 2000,
                asOf: "2026-11-15",
                changes: oaEvents,
            },
        };

        const delayed = applyScenario(input, [
            { type: "delay", goalId: "g-house", months: 6 },
        ]);
        expect(delayed.input.goals[0].targetDate).toBe("2028-01-01");
        expect(delayed.input.cashFlowChanges?.[0].startMonth).toBe("2028-04");
        expect(delayed.input.cpfOa?.changes[0].startMonth).toBe("2028-01");
    });
});

describe("trim candidates & trade-offs", () => {
    const categories: Category[] = [
        {
            id: "cat-dining",
            household_id: "hh-1",
            name: "Dining",
            color: "#F59E0B",
            icon: "utensils",
            is_system: true,
            group: "spendable",
        },
        {
            id: "cat-transport",
            household_id: "hh-1",
            name: "Transport",
            color: "#3B82F6",
            icon: "car",
            is_system: true,
            group: "spendable",
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

    it("computes spendable category headroom sorted descending", () => {
        const months = ["2026-08", "2026-09", "2026-10"];
        const rows: MonthlyBudgetHistoryRow[] = months.map((m, idx) => ({
            budget: {
                id: `mb-${idx}`,
                household_id: "hh-1",
                owner_id: "mem-1",
                month: m,
                gross_salary: 5000,
                bonus: 0,
                cpf_deduction: 1000,
                taxes_deduction: 0,
                insurance_deduction: 0,
                after_deductions: 4000,
                is_locked: true,
            },
            categories: [
                {
                    id: `mbc-d-${idx}`,
                    monthly_budget_id: `mb-${idx}`,
                    category_id: "cat-dining",
                    percentage: 0.25,
                    allocated_amount: 1000,
                },
                {
                    id: `mbc-t-${idx}`,
                    monthly_budget_id: `mb-${idx}`,
                    category_id: "cat-transport",
                    percentage: 0.1,
                    allocated_amount: 400,
                },
            ],
        }));

        const expenses: Expense[] = months.flatMap((m, idx) => [
            {
                id: `e-d-${idx}`,
                household_id: "hh-1",
                payer_id: "mem-1",
                category_id: "cat-dining",
                date: `${m}-10`,
                item: "Dinner",
                amount: 600,
                is_shared: false,
                split_ratio: 0.5,
                settled: true,
            },
            {
                id: `e-t-${idx}`,
                household_id: "hh-1",
                payer_id: "mem-1",
                category_id: "cat-transport",
                date: `${m}-11`,
                item: "MRT",
                amount: 450, // overspent -> 0 headroom
                is_shared: false,
                split_ratio: 0.5,
                settled: true,
            },
        ]);

        const candidates = computeTrimCandidates({
            months,
            rows,
            categories,
            expenses,
            recurringItems: [],
        });

        expect(candidates).toEqual([
            {
                categoryId: "cat-dining",
                categoryName: "Dining",
                monthlyBudget: 1000,
                monthlySpent: 600,
                headroom: 400,
            },
        ]);
    });

    it("applies trim & lowerTarget scenarios and suggests both trade-offs", () => {
        const input: RoadmapInput = {
            today: "2026-11-15",
            pool: { liquid: 50000, investments: 0, asOf: "2026-11-15" },
            monthlySavings: 2000,
            goals: [
                {
                    id: "g-house",
                    title: "House",
                    emoji: "🏠",
                    targetAmount: 80000,
                    targetDate: "2027-11-15", // 12 months -> 50k + 24k = 74k (6k short, 500/mo short)
                    spent: 10000,
                    done: false,
                },
            ],
            trimCandidates: [
                {
                    categoryId: "cat-dining",
                    categoryName: "Dining",
                    monthlyBudget: 1000,
                    monthlySpent: 400,
                    headroom: 600,
                },
            ],
        };

        // 74k < 80k - 10k spent = 70k needed -> actually 50k + 24k = 74k >= 70k!
        // Let's use spent: 0 so stillNeeded = 80k, available = 74k -> gap = 6k, shortPerMonth = 500
        input.goals[0].spent = 0;

        const base = projectRoadmap(input);
        expect(base.verdict).toBe("short");
        expect(base.worstGap).toBe(6000);
        expect(base.shortfallPerMonth).toBe(500);

        const tradeOffs = suggestTradeOffs(input);
        const trimTradeOff = tradeOffs.find((t) => t.edit.type === "trim");
        expect(trimTradeOff).toBeDefined();
        expect(trimTradeOff?.edit).toEqual({
            type: "trim",
            categoryId: "cat-dining",
            categoryName: "Dining",
            monthlyAmount: 500,
        });
        expect(trimTradeOff?.verdict).toBe("on_track");

        const lowerTradeOff = tradeOffs.find(
            (t) => t.edit.type === "lowerTarget",
        );
        expect(lowerTradeOff).toBeDefined();
        expect(lowerTradeOff?.edit).toEqual({
            type: "lowerTarget",
            goalId: "g-house",
            targetAmount: 74000,
        });
        expect(lowerTradeOff?.verdict).toBe("on_track");
    });

    it("applyTrimTradeOff updates base profiles proportionally and shifts to Savings", async () => {
        const profiles: BaseBudgetProfile[] = [
            {
                id: "p1",
                household_id: "hh-1",
                owner_id: "m1",
                gross_salary: 5000,
                cpf_employee_rate: 0.2,
                tithing_enabled: false,
            },
            {
                id: "p2",
                household_id: "hh-1",
                owner_id: "m2",
                gross_salary: 5000,
                cpf_employee_rate: 0.2,
                tithing_enabled: false,
            },
        ];
        // Each member has after_deductions = 4000. Dining = 10% (400 each, 800 total).
        const allocsByProfile: Record<string, BaseProfileAllocation[]> = {
            p1: [
                {
                    id: "a1",
                    profile_id: "p1",
                    category_id: "cat-dining",
                    target_percentage: 0.1,
                },
                {
                    id: "a2",
                    profile_id: "p1",
                    category_id: "cat-savings",
                    target_percentage: 0.9,
                },
            ],
            p2: [
                {
                    id: "a3",
                    profile_id: "p2",
                    category_id: "cat-dining",
                    target_percentage: 0.1,
                },
                {
                    id: "a4",
                    profile_id: "p2",
                    category_id: "cat-savings",
                    target_percentage: 0.9,
                },
            ],
        };

        const updated: Record<string, BaseProfileAllocation[]> = {};
        await applyTrimTradeOff({
            categoryId: "cat-dining",
            monthlyAmount: 200, // 100 from each = 2.5% of 4000
            categories,
            baseProfiles: profiles,
            currentMonth: "2026-11",
            getBaseAllocations: async (pid) => allocsByProfile[pid],
            updateBaseProfile: async (prof, allocs) => {
                updated[prof.id] = allocs;
            },
        });

        expect(updated.p1.find((a) => a.category_id === "cat-dining")?.target_percentage).toBeCloseTo(0.075, 6);
        expect(updated.p1.find((a) => a.category_id === "cat-savings")?.target_percentage).toBeCloseTo(0.925, 6);
        expect(updated.p2.find((a) => a.category_id === "cat-dining")?.target_percentage).toBeCloseTo(0.075, 6);
        expect(updated.p2.find((a) => a.category_id === "cat-savings")?.target_percentage).toBeCloseTo(0.925, 6);
    });

    it("mockFinanceService syncs linked recurring start_date when goal target_date changes", async () => {
        const goals = await mockFinanceService.getGoals();
        const targetGoal = goals[0];
        const created = await mockFinanceService.addRecurringItem({
            owner_id: "mem-00000000-0011",
            type: "bill",
            name: "Linked Cost",
            amount: 300,
            frequency: "monthly",
            due_day: 1,
            goal_id: targetGoal.id,
            goal_offset_months: 6,
        });

        expect(created.start_date).toBe(
            resolveGoalLinkedStartDate(targetGoal.target_date, 6),
        );

        const newTargetDate = "2028-11-01";
        await mockFinanceService.updateGoal(targetGoal.id, {
            target_date: newTargetDate,
        });
        const allItems = await mockFinanceService.getRecurringItems();
        const refreshed = allItems.find((i) => i.id === created.id);
        expect(refreshed?.start_date).toBe("2029-05-01");
    });
});
