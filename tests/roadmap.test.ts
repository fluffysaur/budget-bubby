import { describe, it, expect } from "vitest";
import {
    computeBaseline,
    computePool,
    goalStatusChanges,
    layoutJar,
    poolAtDate,
    projectRoadmap,
    smallestDelayToTrack,
    suggestTradeOffs,
    toRoadmapGoals,
    typicalAnnualBonus,
    type BudgetHistoryRow,
    type RoadmapGoalInput,
    type RoadmapInput,
} from "../src/lib/roadmap";
import type {
    Account,
    AccountSnapshot,
    BonusEvent,
    Category,
    CreditCardStatement,
    Expense,
    SavingsGoal,
} from "../src/types/finance";

const TODAY = "2026-11-18";

function goal(
    id: string,
    targetAmount: number,
    targetDate: string,
    extra: Partial<RoadmapGoalInput> = {},
): RoadmapGoalInput {
    return {
        id,
        title: id,
        emoji: "🎯",
        targetAmount,
        targetDate,
        createdAt: "2026-01-01T00:00:00.000Z",
        spent: 0,
        done: false,
        ...extra,
    };
}

function input(
    goals: RoadmapGoalInput[],
    over: Partial<RoadmapInput> = {},
): RoadmapInput {
    return {
        today: TODAY,
        pool: { liquid: 50000, investments: 0, asOf: "2026-11-15" },
        monthlySavings: 2000,
        goals,
        ...over,
    };
}

describe("projectRoadmap", () => {
    const wedding = goal("wedding", 30000, "2027-05-01");
    const house = goal("house", 100000, "2028-11-01");

    it("checks each deadline against the cumulative claims", () => {
        const r = projectRoadmap(input([house, wedding]));
        expect(r.goals.map((g) => g.goal.id)).toEqual(["wedding", "house"]);

        const [w, h] = r.goals;
        expect(w.claimEnd).toBe(30000);
        expect(w.available).toBe(62000); // 50k + 6 months x 2k
        expect(w.status).toBe("funded");
        expect(w.fundedToday).toBe(30000);
        expect(w.progress).toBe(1);

        expect(h.claimStart).toBe(30000);
        expect(h.claimEnd).toBe(130000);
        expect(h.available).toBe(98000); // 50k + 24 x 2k
        expect(h.gap).toBe(32000);
        expect(h.status).toBe("short");
        expect(h.fundedToday).toBe(20000);
        expect(h.fillMonth).toBe("2030-03"); // 50k + 40 x 2k = 130k

        expect(r.verdict).toBe("short");
        expect(r.worstGap).toBe(32000);
        expect(r.shortfallPerMonth).toBe(1333.33);
        expect(r.spareMargin).toBe(0);
    });

    it("reports the smallest spare margin when on track", () => {
        const r = projectRoadmap(input([wedding]));
        expect(r.verdict).toBe("on_track");
        expect(r.spareMargin).toBe(32000);
        expect(r.shortfallPerMonth).toBe(0);
    });

    it("has no verdict without active goals", () => {
        const r = projectRoadmap(input([{ ...wedding, done: true }]));
        expect(r.verdict).toBe("none");
        expect(r.goals).toHaveLength(0);
        expect(r.done).toHaveLength(1);
    });

    it("subtracts goal-tagged spend from what is still needed", () => {
        const r = projectRoadmap(
            input([{ ...wedding, spent: 5000 }], {
                pool: { liquid: 10000, investments: 0, asOf: "2026-11-15" },
            }),
        );
        const [w] = r.goals;
        expect(w.stillNeeded).toBe(25000);
        expect(w.fundedToday).toBe(10000);
        expect(w.progress).toBeCloseTo(15000 / 30000);
    });

    it("discounts investments only for goals inside the window", () => {
        const near = goal("near", 40000, "2027-11-01");
        const far = goal("far", 100000, "2029-11-01");
        const r = projectRoadmap(
            input([near, far], {
                pool: { liquid: 10000, investments: 50000, asOf: TODAY },
                monthlySavings: 1000,
            }),
        );
        expect(r.haircutApplied).toBe(true);
        expect(r.poolToday).toBe(50000);
        expect(r.poolTodayFull).toBe(60000);
        expect(r.goals[0].available).toBe(62000); // 10k + 40k + 12k
        expect(r.goals[1].available).toBe(96000); // 10k + 50k + 36k
        expect(r.goals[1].gap).toBe(44000);
    });

    it("breaks date ties by created_at", () => {
        const a = goal("a", 1000, "2027-01-01", {
            createdAt: "2026-05-01T00:00:00Z",
        });
        const b = goal("b", 1000, "2027-01-01", {
            createdAt: "2026-02-01T00:00:00Z",
        });
        const r = projectRoadmap(input([a, b]));
        expect(r.goals.map((g) => g.goal.id)).toEqual(["b", "a"]);
    });

    it("flags overdue goals that are not done", () => {
        const r = projectRoadmap(input([goal("old", 1000, "2026-09-01")]));
        expect(r.goals[0].status).toBe("overdue");
        expect(r.goals[0].monthsLeft).toBe(0);
    });

    it("applies delay and bonus edits as scenarios", () => {
        const base = input([wedding, house], { typicalAnnualBonus: 24000 });
        expect(projectRoadmap(base, [{ type: "bonus" }]).verdict).toBe(
            "on_track",
        );
        expect(smallestDelayToTrack(base, "house")).toBe(16);
        const delayed = projectRoadmap(base, [
            { type: "delay", goalId: "house", months: 16 },
        ]);
        expect(delayed.verdict).toBe("on_track");
    });
});

describe("suggestTradeOffs", () => {
    it("offers a delay and the bonus when short", () => {
        const t = suggestTradeOffs(
            input(
                [
                    goal("wedding", 30000, "2027-05-01"),
                    goal("house", 100000, "2028-11-01"),
                ],
                { typicalAnnualBonus: 24000 },
            ),
        );
        expect(t).toEqual([
            {
                edit: { type: "delay", goalId: "house", months: 16 },
                goalId: "house",
                verdict: "on_track",
                shortfallPerMonth: 0,
            },
            {
                edit: { type: "bonus" },
                verdict: "on_track",
                shortfallPerMonth: 0,
            },
        ]);
    });

    it("offers nothing when on track", () => {
        expect(
            suggestTradeOffs(input([goal("w", 1000, "2027-05-01")])),
        ).toEqual([]);
    });
});

const account = (
    id: string,
    type: Account["type"],
    balance: number,
): Account => ({
    id,
    household_id: "hh",
    owner_id: "m1",
    name: id,
    type,
    balance,
    currency: "SGD",
    is_joint: false,
});

const snap = (
    account_id: string,
    snapshot_date: string,
    balance: number,
): AccountSnapshot => ({
    id: `${account_id}-${snapshot_date}`,
    account_id,
    household_id: "hh",
    balance,
    snapshot_date,
});

const statement = (amount: number, month: string): CreditCardStatement => ({
    id: `s-${month}`,
    card_id: "c",
    household_id: "hh",
    month,
    statement_amount: amount,
    due_date: `${month}-25`,
    is_paid: false,
});

describe("pool", () => {
    const accounts = [
        account("cash", "Cash", 20000),
        account("inv", "Investment", 30000),
        account("cpf", "CPF", 90000),
        account("other", "Other", 1000),
    ];

    it("excludes CPF and subtracts unpaid statements", () => {
        const pool = computePool(
            accounts,
            [snap("cash", "2026-11-10", 20000), snap("cpf", "2026-11-12", 1)],
            [statement(1500, "2026-10")],
            TODAY,
        );
        expect(pool).toEqual({
            liquid: 19500,
            investments: 30000,
            asOf: "2026-11-10",
        });
    });

    it("values the pool at an earlier update from snapshots", () => {
        const pool = poolAtDate(
            accounts,
            [
                snap("cash", "2026-10-01", 15000),
                snap("cash", "2026-11-01", 20000),
                snap("inv", "2026-10-01", 25000),
            ],
            [],
            "2026-10-15",
        );
        expect(pool).toEqual({
            liquid: 15000,
            investments: 25000,
            asOf: "2026-10-15",
        });
    });
});

const cat = (id: string, name: string, group: Category["group"]): Category => ({
    id,
    household_id: "hh",
    name,
    color: "#000",
    icon: "x",
    is_system: false,
    group,
});

const CATEGORIES = [
    cat("food", "Food", "spendable"),
    cat("inv", "Investments", "allocation"),
    cat("tith", "Tithing", "allocation"),
];

function row(month: string): BudgetHistoryRow {
    return {
        budget: {
            id: `b-${month}`,
            household_id: "hh",
            owner_id: "m1",
            month,
            gross_salary: 6000,
            bonus: 0,
            cpf_deduction: 0,
            taxes_deduction: 0,
            insurance_deduction: 0,
            after_deductions: 3500,
            is_locked: true,
        },
        categories: [
            ["food", 1000],
            ["inv", 2000],
            ["tith", 500],
        ].map(([category_id, allocated_amount]) => ({
            id: `${month}-${category_id}`,
            monthly_budget_id: `b-${month}`,
            category_id: category_id as string,
            percentage: 0,
            allocated_amount: allocated_amount as number,
        })),
    };
}

const expense = (
    date: string,
    amount: number,
    extra: Partial<Expense> = {},
): Expense => ({
    id: `${date}-${amount}`,
    household_id: "hh",
    payer_id: "m1",
    category_id: "food",
    date,
    item: "x",
    amount,
    is_shared: false,
    split_ratio: 0.5,
    settled: false,
    ...extra,
});

describe("computeBaseline", () => {
    const months = ["2026-08", "2026-09", "2026-10"];

    it("averages savings allocations plus underspend over complete months", () => {
        const b = computeBaseline({
            today: TODAY,
            rows: months.map(row),
            categories: CATEGORIES,
            expenses: [
                ...months.map((m) => expense(`${m}-05`, 800)),
                // Goal-tagged spend is not day-to-day spending.
                expense("2026-10-06", 5000, { goal_id: "g" }),
            ],
            recurringItems: [],
        });
        expect(b.source).toBe("actual");
        // 2000 invested + (1000 cap - 800 spent); tithing is not savings.
        expect(b.monthlySavings).toBe(2200);
        expect(b.months).toEqual(months);
        // Buffer sizing: goal-tagged spend is left out.
        expect(b.averageMonthlySpend).toBe(800);
    });

    it("falls back to budgeted savings with under 3 months", () => {
        const b = computeBaseline({
            today: TODAY,
            rows: [row("2026-10"), row("2026-11")],
            categories: CATEGORIES,
            expenses: [expense("2026-10-05", 800)],
            recurringItems: [],
        });
        expect(b.source).toBe("estimate");
        expect(b.monthlySavings).toBe(2000);
        expect(b.months).toEqual(["2026-11"]);
        // One logged month beats the budgeted cap.
        expect(b.averageMonthlySpend).toBe(800);
    });

    it("carries a member's latest budget into months they have no row", () => {
        const partner = row("2026-10");
        partner.budget = { ...partner.budget, id: "b-p", owner_id: "m2" };
        const b = computeBaseline({
            today: TODAY,
            rows: [row("2026-11"), partner],
            categories: CATEGORIES,
            expenses: [],
            recurringItems: [],
        });
        expect(b.source).toBe("estimate");
        expect(b.monthlySavings).toBe(4000);
        // Nothing logged yet: the budgeted spending cap.
        expect(b.averageMonthlySpend).toBe(2000);
    });

    it("has no baseline without a budget", () => {
        const b = computeBaseline({
            today: TODAY,
            rows: [],
            categories: CATEGORIES,
            expenses: [],
            recurringItems: [],
        });
        expect(b.source).toBe("none");
        expect(b.monthlySavings).toBe(0);
    });
});

describe("inputs", () => {
    it("maps goals with spend and done state", () => {
        const goals = [
            {
                id: "g1",
                household_id: "hh",
                title: "Wedding",
                target_amount: 30000,
                saved_so_far: 999,
                target_date: "2027-05-01",
                emoji: "💍",
                status: "achieved",
            },
        ] as SavingsGoal[];
        const [g] = toRoadmapGoals(goals, [
            expense("2026-10-01", 2000, { goal_id: "g1" }),
        ]);
        expect(g.spent).toBe(2000);
        expect(g.done).toBe(true);
    });

    it("sums net bonuses from the last 12 months", () => {
        const ev = (received_on: string, net: number) =>
            ({ received_on, net }) as BonusEvent;
        expect(
            typicalAnnualBonus(
                [
                    ev("2025-11-01", 9999),
                    ev("2026-03-01", 8000),
                    ev("2026-11-01", 2000),
                ],
                TODAY,
            ),
        ).toBe(10000);
    });
});

describe("layoutJar", () => {
    it("sizes bands by amount and maps levels inside them", () => {
        const j = layoutJar({ bands: [100, 100], maxLevel: 150, height: 200 });
        expect(j.bands.map((b) => b.height)).toEqual([100, 100]);
        expect(j.toPx(150)).toBe(150);
        expect(j.headroom).toBeNull();
    });

    it("gives small bands a minimum height and breaks a huge one", () => {
        const j = layoutJar({ bands: [1000, 10], maxLevel: 0, height: 200 });
        expect(j.bands[0].broken).toBe(true);
        expect(j.bands[0].height).toBe(100);
        expect(j.bands[1].height).toBeGreaterThanOrEqual(44);
        expect(j.toPx(1005)).toBeCloseTo(150);
    });

    it("adds headroom when the level is above every claim", () => {
        const j = layoutJar({ bands: [100], maxLevel: 300, height: 200 });
        expect(j.headroom).not.toBeNull();
        expect(j.toPx(300)).toBeCloseTo(200);
    });
});

describe("goalStatusChanges", () => {
    const accounts = [account("cash", "Cash", 60000)];
    const goals = [goal("house", 100000, "2028-11-01")];

    it("reports a goal that turned short at the latest update", () => {
        const changes = goalStatusChanges(
            input(goals, { monthlySavings: 2000 }),
            accounts,
            [
                snap("cash", "2026-10-01", 60000),
                snap("cash", "2026-11-01", 40000),
            ],
            [],
        );
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            from: "on_track",
            to: "short",
            month: "2026-11",
        });
    });

    it("stays quiet without a status change or a previous update", () => {
        expect(
            goalStatusChanges(
                input(goals),
                accounts,
                [
                    snap("cash", "2026-10-01", 60000),
                    snap("cash", "2026-11-01", 61000),
                ],
                [],
            ),
        ).toEqual([]);
        expect(
            goalStatusChanges(
                input(goals),
                accounts,
                [snap("cash", "2026-11-01", 1)],
                [],
            ),
        ).toEqual([]);
    });
});
