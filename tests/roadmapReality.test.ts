import { describe, it, expect } from "vitest";
import {
    baselineCoveredThrough,
    changesOver,
    lifeEventsFromRecurring,
    poolHistory,
    projectPool,
    projectRoadmap,
    realityCheck,
    type RoadmapGoalInput,
    type RoadmapInput,
} from "../src/lib/roadmap";
import type {
    Account,
    AccountSnapshot,
    BonusEvent,
    Expense,
    RecurringItem,
} from "../src/types/finance";

const TODAY = "2026-11-18";

const goal = (
    id: string,
    targetAmount: number,
    targetDate: string,
): RoadmapGoalInput => ({
    id,
    title: id,
    emoji: "🎯",
    targetAmount,
    targetDate,
    spent: 0,
    done: false,
});

const input = (over: Partial<RoadmapInput> = {}): RoadmapInput => ({
    today: TODAY,
    pool: { liquid: 50000, investments: 0, asOf: "2026-11-15" },
    monthlySavings: 2000,
    goals: [],
    ...over,
});

const recurring = (
    id: string,
    over: Partial<RecurringItem> = {},
): RecurringItem => ({
    id,
    household_id: "hh",
    owner_id: "m1",
    type: "bill",
    name: id,
    amount: 1000,
    frequency: "monthly",
    start_date: null,
    end_date: null,
    monthly_amortized_amount: 0,
    ...over,
});

describe("lifeEventsFromRecurring", () => {
    it("turns a future start into a dated cost", () => {
        const [c] = lifeEventsFromRecurring(
            [recurring("Childcare", { start_date: "2027-03-01" })],
            "2026-10",
        );
        expect(c).toMatchObject({
            kind: "starts",
            startMonth: "2027-03",
            endMonth: null,
            monthlyDelta: -1000,
        });
    });

    it("drops a change once the baseline window covers its start", () => {
        const items = [recurring("Gym", { start_date: "2026-09-01" })];
        expect(lifeEventsFromRecurring(items, "2026-10")).toEqual([]);
        expect(lifeEventsFromRecurring(items, "2026-08")).toHaveLength(1);
    });

    it("turns a future end of a current cost into extra saving", () => {
        const [c] = lifeEventsFromRecurring(
            [recurring("Rent", { amount: 2500, end_date: "2027-06-30" })],
            "2026-10",
        );
        expect(c).toMatchObject({
            kind: "ends",
            startMonth: "2027-07",
            monthlyDelta: 2500,
        });
    });

    it("ignores deductions and free items, and amortises annual ones", () => {
        const changes = lifeEventsFromRecurring(
            [
                recurring("Tax", { type: "tax", start_date: "2027-01-01" }),
                recurring("Free", { amount: 0, start_date: "2027-01-01" }),
                recurring("Road tax", {
                    frequency: "annually",
                    amount: 1200,
                    monthly_amortized_amount: 100,
                    start_date: "2027-01-01",
                }),
            ],
            "2026-10",
        );
        expect(changes.map((c) => [c.name, c.monthlyDelta])).toEqual([
            ["Road tax", -100],
        ]);
    });
});

describe("changesOver", () => {
    const changes = lifeEventsFromRecurring(
        [
            recurring("Childcare", {
                start_date: "2027-03-01",
                end_date: "2027-05-31",
            }),
        ],
        "2026-10",
    );

    it("counts only the months inside the window and the change", () => {
        // Months after Nov 2026: Dec..Feb (0), Mar..May (3 x -1000), Jun (0)
        expect(changesOver(changes, "2026-11", 3)).toBe(0);
        expect(changesOver(changes, "2026-11", 5)).toBe(-2000);
        expect(changesOver(changes, "2026-11", 12)).toBe(-3000);
    });

    it("applies to future months only", () => {
        expect(changesOver(changes, "2027-04", 2)).toBe(-1000);
    });
});

describe("projectRoadmap with life events", () => {
    it("a new cost before the deadline can make the plan short", () => {
        const base = input({ goals: [goal("House", 98000, "2028-11-01")] });
        expect(projectRoadmap(base).verdict).toBe("on_track");
        const withChildcare = {
            ...base,
            cashFlowChanges: lifeEventsFromRecurring(
                [recurring("Childcare", { start_date: "2027-11-01" })],
                "2026-10",
            ),
        };
        const result = projectRoadmap(withChildcare);
        expect(result.verdict).toBe("short");
        // 13 months x S$1,000 of childcare before Nov 2028
        expect(result.worstGap).toBe(13000);
        expect(result.lifeEvents).toHaveLength(1);
    });
});

describe("baselineCoveredThrough", () => {
    it("is the newest averaged month, or this month for an estimate", () => {
        expect(
            baselineCoveredThrough(
                { source: "actual", months: ["2026-08", "2026-10", "2026-09"] },
                TODAY,
            ),
        ).toBe("2026-10");
        expect(
            baselineCoveredThrough(
                { source: "estimate", months: ["2026-09"] },
                TODAY,
            ),
        ).toBe("2026-11");
    });
});

const account = (
    id: string,
    type: Account["type"],
    is_new_account?: boolean,
): Account => ({
    id,
    is_new_account,
    household_id: "hh",
    owner_id: "m1",
    name: id,
    type,
    balance: 0,
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

describe("poolHistory", () => {
    it("takes each month's last update and fills gaps with straight lines", () => {
        const accounts = [account("cash", "Cash"), account("cpf", "CPF")];
        const history = poolHistory(
            accounts,
            [
                snap("cash", "2026-06-01", 9000),
                snap("cash", "2026-06-28", 10000),
                snap("cash", "2026-09-30", 16000),
                snap("cpf", "2026-09-30", 99999),
            ],
            [],
        );
        expect(history).toEqual([
            {
                month: "2026-06",
                date: "2026-06-28",
                value: 10000,
                actual: true,
                // First recorded on Jun 1 at 9000.
                untrackedOpening: 9000,
            },
            { month: "2026-07", value: 12000, actual: false },
            { month: "2026-08", value: 14000, actual: false },
            {
                month: "2026-09",
                date: "2026-09-30",
                value: 16000,
                actual: true,
                // The CPF account's first snapshot doesn't count.
                untrackedOpening: 0,
            },
        ]);
    });

    it("sums opening balances of accounts first recorded since the last update", () => {
        const history = poolHistory(
            [account("a", "Cash"), account("b", "Investment")],
            [
                snap("a", "2026-01-10", 1000),
                snap("a", "2026-02-10", 2000),
                snap("b", "2026-02-12", 5000),
                snap("a", "2026-03-10", 3000),
            ],
            [],
        );
        expect(history.map((p) => p.untrackedOpening)).toEqual([1000, 5000, 0]);
    });

    it("counts a new account from $0", () => {
        const history = poolHistory(
            [account("a", "Cash"), account("b", "Cash", true)],
            [snap("a", "2026-01-10", 1000), snap("b", "2026-02-12", 5000)],
            [],
        );
        expect(history.map((p) => p.untrackedOpening)).toEqual([1000, 0]);
    });
});

const expense = (date: string, amount: number, goal_id?: string): Expense => ({
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
    goal_id,
});

/** Pool history for one cash account with these [date, balance] updates. */
const cashHistory = (updates: Array<[string, number]>) =>
    poolHistory(
        [account("cash", "Cash")],
        updates.map(([d, b]) => snap("cash", d, b)),
        [],
    );

describe("realityCheck", () => {
    // Saves 2000 a month; a 5000 venue deposit goes out on Sep 10.
    const history = cashHistory([
        ["2026-07-20", 10000],
        ["2026-08-20", 12000],
        ["2026-09-20", 9000],
        ["2026-10-20", 11000],
    ]);
    const deposit = expense("2026-09-10", 5000, "wedding");

    it("is locked under 2 intervals", () => {
        const r = realityCheck({
            history: cashHistory([
                ["2026-09-20", 1],
                ["2026-11-20", 3],
            ]),
            expenses: [],
            planPerMonth: 2000,
        });
        expect(r.status).toBe("locked");
        expect(r.intervals).toBe(1);
    });

    it("never averages filled-in months", () => {
        // One 3-month interval and one 1-month interval.
        const r = realityCheck({
            history: cashHistory([
                ["2026-01-10", 10000],
                ["2026-04-10", 22000],
                ["2026-05-10", 26000],
            ]),
            expenses: [],
            planPerMonth: 4000,
        });
        expect(r).toMatchObject({
            status: "ok",
            intervals: 2,
            monthsCovered: 4,
            grewPerMonth: 4000,
        });
    });

    it("adds back goal spending inside an interval", () => {
        const r = realityCheck({
            history,
            // The Jul 1 one is before the first update, so it's ignored.
            expenses: [deposit, expense("2026-07-01", 999, "wedding")],
            planPerMonth: 2000,
        });
        expect(r).toMatchObject({
            status: "ok",
            grewPerMonth: 2000,
            monthsCovered: 3,
            differs: false,
        });
    });

    it("takes out bonuses inside an interval", () => {
        const bonus = { received_on: "2026-08-01", net: 3000 } as BonusEvent;
        const r = realityCheck({
            history,
            expenses: [deposit],
            bonusEvents: [bonus],
            planPerMonth: 2000,
        });
        expect(r.grewPerMonth).toBe(1000);
    });

    it("takes newly recorded accounts' openings out of growth", () => {
        // Saves 1000 a month. Existing accounts b and c are recorded in May;
        // in June, 30000 moves from a into a newly opened account d.
        const r = realityCheck({
            history: poolHistory(
                [
                    account("a", "Cash"),
                    account("b", "Cash"),
                    account("c", "Investment"),
                    account("d", "Cash", true),
                ],
                [
                    snap("a", "2026-01-20", 100000),
                    snap("a", "2026-05-20", 104000),
                    snap("b", "2026-05-20", 60000),
                    snap("c", "2026-05-20", 40000),
                    snap("a", "2026-06-20", 75000),
                    snap("d", "2026-06-20", 30000),
                ],
                [],
            ),
            expenses: [],
            planPerMonth: 1000,
        });
        expect(r).toMatchObject({
            status: "ok",
            intervals: 2,
            monthsCovered: 5,
            grewPerMonth: 1000,
            differs: false,
        });
    });

    it("reads an unflagged transfer into a new account as a dip", () => {
        // Same move as above, but d isn't marked as a new account.
        const r = realityCheck({
            history: poolHistory(
                [account("a", "Cash"), account("d", "Cash")],
                [
                    snap("a", "2026-01-20", 100000),
                    snap("a", "2026-02-20", 101000),
                    snap("a", "2026-03-20", 72000),
                    snap("d", "2026-03-20", 30000),
                ],
                [],
            ),
            expenses: [],
            planPerMonth: 1000,
        });
        expect(r.grewPerMonth).toBe(-14000);
    });

    it("warns when growth is more than 20% off the plan", () => {
        const below = realityCheck({
            history,
            expenses: [deposit],
            planPerMonth: 3000,
        });
        expect(below).toMatchObject({
            differs: true,
            direction: "below",
            deltaPct: -33,
        });

        const above = realityCheck({
            history,
            expenses: [deposit],
            planPerMonth: 1000,
        });
        expect(above).toMatchObject({
            differs: true,
            direction: "above",
            deltaPct: 100,
        });

        expect(
            realityCheck({ history, expenses: [deposit], planPerMonth: 2400 }),
        ).toMatchObject({ differs: false, direction: "match" });
    });
});

describe("projectPool", () => {
    it("adds savings and life events and dips at each goal", () => {
        const points = projectPool(
            input({
                pool: { liquid: 40000, investments: 10000, asOf: "2026-11-15" },
                goals: [goal("Wedding", 30000, "2027-02-01")],
                cashFlowChanges: lifeEventsFromRecurring(
                    [recurring("Childcare", { start_date: "2027-01-01" })],
                    "2026-10",
                ),
            }),
        );
        expect(points.map((p) => [p.month, p.value])).toEqual([
            ["2026-11", 50000],
            ["2026-12", 52000],
            ["2027-01", 53000], // +2000 - 1000 childcare
            ["2027-02", 24000], // +1000, then the wedding is paid
            ["2027-03", 25000],
            ["2027-04", 26000],
            ["2027-05", 27000],
        ]);
        expect(points[3].milestones.map((m) => m.title)).toEqual(["Wedding"]);
    });
});
