import { describe, it, expect } from "vitest";
import {
    baselineCoveredThrough,
    changesOver,
    lifeEventsFromRecurring,
    poolHistory,
    projectPool,
    projectRoadmap,
    realityCheck,
    type HistoryPoint,
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

const account = (id: string, type: Account["type"]): Account => ({
    id,
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
            { month: "2026-06", value: 10000, actual: true },
            { month: "2026-07", value: 12000, actual: false },
            { month: "2026-08", value: 14000, actual: false },
            { month: "2026-09", value: 16000, actual: true },
        ]);
    });
});

const point = (month: string, value: number, actual = true): HistoryPoint => ({
    month,
    value,
    actual,
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

describe("realityCheck", () => {
    const history = [
        point("2026-07", 10000),
        point("2026-08", 12000),
        point("2026-09", 7000), // venue deposit paid
        point("2026-10", 9000),
    ];

    it("is locked under 3 months of balance updates", () => {
        const r = realityCheck({
            history: [
                point("2026-09", 1),
                point("2026-10", 2, false),
                point("2026-11", 3),
            ],
            expenses: [],
            planPerMonth: 2000,
        });
        expect(r.status).toBe("locked");
        expect(r.updateMonths).toBe(2);
    });

    it("leaves out months with goal spending", () => {
        const r = realityCheck({
            history,
            expenses: [expense("2026-09-10", 5000, "wedding")],
            planPerMonth: 2000,
        });
        expect(r).toMatchObject({
            status: "ok",
            grewPerMonth: 2000,
            monthsUsed: ["2026-08", "2026-10"],
            differs: false,
        });
    });

    it("leaves out bonus months", () => {
        const bonus = { received_on: "2026-08-20" } as BonusEvent;
        const r = realityCheck({
            history,
            expenses: [expense("2026-09-10", 5000, "wedding")],
            bonusEvents: [bonus],
            planPerMonth: 2000,
        });
        expect(r.monthsUsed).toEqual(["2026-10"]);
    });

    it("warns when growth is more than 20% off the plan", () => {
        const below = realityCheck({
            history,
            expenses: [expense("2026-09-10", 5000, "wedding")],
            planPerMonth: 3000,
        });
        expect(below).toMatchObject({
            differs: true,
            direction: "below",
            deltaPct: -33,
        });

        const above = realityCheck({
            history,
            expenses: [expense("2026-09-10", 5000, "wedding")],
            planPerMonth: 1000,
        });
        expect(above).toMatchObject({
            differs: true,
            direction: "above",
            deltaPct: 100,
        });

        expect(
            realityCheck({
                history,
                expenses: [expense("2026-09-10", 5000, "wedding")],
                planPerMonth: 2400,
            }),
        ).toMatchObject({
            differs: false,
            direction: "match",
        });
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
