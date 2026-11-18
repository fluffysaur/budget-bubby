import { describe, it, expect } from "vitest";
import {
    bufferTarget,
    buildRoadmapInput,
    clampBufferMonths,
    computeBaseline,
    emojiForTag,
    fundingOrder,
    haircutFromHousehold,
    normalizeGoalTags,
    normalizeHouseholdSettings,
    projectRoadmap,
    toRoadmapGoals,
    type RoadmapGoalInput,
    type RoadmapInput,
} from "../src/lib/roadmap";
import type { Account, SavingsGoal } from "../src/types/finance";

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
        pool: { liquid: 10000, investments: 0, asOf: "2026-11-15" },
        monthlySavings: 1000,
        goals,
        ...over,
    };
}

describe("goal tags", () => {
    it("trims, de-duplicates case-insensitively and caps the list", () => {
        expect(
            normalizeGoalTags(["  Housing ", "housing", "", "BTO   flat"]),
        ).toEqual(["Housing", "BTO flat"]);
        expect(
            normalizeGoalTags(["a", "b", "c", "d", "e", "f", "g"]),
        ).toHaveLength(6);
        expect(normalizeGoalTags(undefined)).toEqual([]);
    });

    it("maps a suggested tag to its default emoji only", () => {
        expect(emojiForTag("wedding")).toBe("💍");
        expect(emojiForTag("Sabbatical")).toBeUndefined();
    });
});

describe("buffer goal", () => {
    it("targets N months of average spending, clamped to 1-24", () => {
        expect(bufferTarget(6, 3210.4)).toBe(19262);
        expect(bufferTarget(40, 1000)).toBe(24000);
        expect(clampBufferMonths(0)).toBe(1);
        expect(bufferTarget(3, -50)).toBe(0);
    });

    it("is always first in the funding order, whatever its date", () => {
        const order = fundingOrder([
            goal("wedding", 5000, "2027-03-01"),
            goal("buffer", 8000, "2028-01-01", { isBuffer: true }),
            goal("car", 2000, "2026-12-01"),
        ]).map((g) => g.id);
        expect(order).toEqual(["buffer", "car", "wedding"]);
    });

    it("claims the pool before earlier-dated goals", () => {
        const result = projectRoadmap(
            input([
                goal("car", 5000, "2026-12-01"),
                goal("buffer", 10000, "2027-11-01", { isBuffer: true }),
            ]),
        );
        const [buffer, car] = result.goals;
        expect(buffer.goal.id).toBe("buffer");
        expect(buffer.fundedToday).toBe(10000);
        expect(car.claimStart).toBe(10000);
        expect(car.fundedToday).toBe(0);
        expect(car.status).toBe("short");
    });

    it("reads goal_type from the stored goal", () => {
        const stored = {
            id: "b",
            household_id: "h",
            title: "Buffer",
            target_amount: 9000,
            saved_so_far: 0,
            target_date: "2027-06-01",
            emoji: "🛟",
            status: "on_track",
            goal_type: "buffer",
            buffer_months: 3,
        } as SavingsGoal;
        expect(toRoadmapGoals([stored], [])[0].isBuffer).toBe(true);
        expect(
            toRoadmapGoals([{ ...stored, goal_type: undefined }], [])[0]
                .isBuffer,
        ).toBe(false);
    });
});

describe("haircut settings", () => {
    it("falls back to 20% / 24 months without household settings", () => {
        expect(haircutFromHousehold(null)).toEqual({
            haircutPct: 0.2,
            haircutMonths: 24,
        });
    });

    it("converts stored percent to a fraction and clamps", () => {
        expect(
            haircutFromHousehold({
                investment_haircut_pct: 35,
                investment_haircut_months: 12,
            }),
        ).toEqual({ haircutPct: 0.35, haircutMonths: 12 });
        expect(
            normalizeHouseholdSettings({
                investment_haircut_pct: 140,
                investment_haircut_months: -3,
            }),
        ).toEqual({
            investment_haircut_pct: 100,
            investment_haircut_months: 0,
        });
    });

    it("feeds the household haircut into the engine input", () => {
        const accounts = [
            {
                id: "inv",
                household_id: "h",
                name: "Brokerage",
                type: "Investment",
                balance: 10000,
                updated_at: "2026-11-15T00:00:00.000Z",
            },
        ] as Account[];
        const built = buildRoadmapInput({
            today: TODAY,
            accounts,
            snapshots: [],
            statements: [],
            goals: [],
            expenses: [],
            monthlySavings: 0,
            household: {
                investment_haircut_pct: 50,
                investment_haircut_months: 6,
            },
        });
        expect(built.haircutPct).toBe(0.5);
        expect(built.haircutMonths).toBe(6);

        const near = goal("near", 1000, "2027-02-01");
        const far = goal("far", 1000, "2027-08-01");
        const pool = { liquid: 0, investments: 10000, asOf: TODAY };
        const settings = { haircutPct: 0.5, haircutMonths: 6 };
        expect(
            projectRoadmap(input([near], { pool, ...settings })).poolToday,
        ).toBe(5000);
        expect(
            projectRoadmap(input([far], { pool, ...settings })).poolToday,
        ).toBe(10000);
    });
});

describe("average monthly spend", () => {
    it("is 0 with no budgets or expenses", () => {
        expect(
            computeBaseline({
                today: TODAY,
                rows: [],
                categories: [],
                expenses: [],
                recurringItems: [],
            }).averageMonthlySpend,
        ).toBe(0);
    });
});
