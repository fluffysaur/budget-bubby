/**
 * projectRoadmap: the one source of truth for the verdict, the Pool Jar, the
 * timeline, the Dashboard chip and goal alerts.
 *
 * A deadline check, not a month-by-month simulation. Goals are sorted by date
 * (ties by created_at). At each deadline d:
 *   pool(d) + savings until d (+ life events) >= still-needed of this goal
 *   and every earlier one.
 * The pool counts investments at a discount for goals due inside the haircut
 * window. Future savings are treated as cash.
 */

import { addMonths, monthsBetween } from "../dateUtils";
import { changesOver } from "./lifeEvents";
import type {
    RoadmapGoalInput,
    RoadmapGoalResult,
    RoadmapInput,
    RoadmapResult,
    Scenario,
} from "./types";

export const DEFAULT_HAIRCUT_PCT = 0.2;
export const DEFAULT_HAIRCUT_MONTHS = 24;
/** How far ahead to look for a fill month (50 years). */
const FILL_SEARCH_MONTHS = 600;

const round2 = (n: number) => Math.round(n * 100) / 100;
const month = (date: string) => date.slice(0, 7);

/** Applies scenario edits to a copy of the input. */
export function applyScenario(
    input: RoadmapInput,
    scenario: Scenario = [],
): { input: RoadmapInput; monthlySavings: number } {
    let goals = input.goals;
    let monthlySavings = input.monthlySavings;
    for (const edit of scenario) {
        if (edit.type === "delay") {
            goals = goals.map((g) =>
                g.id === edit.goalId
                    ? { ...g, targetDate: addMonths(g.targetDate, edit.months) }
                    : g,
            );
        } else if (edit.type === "bonus") {
            monthlySavings += Math.max(0, input.typicalAnnualBonus ?? 0) / 12;
        }
    }
    return { input: { ...input, goals }, monthlySavings };
}

/** Date order, ties broken by created_at, then id for a stable order. */
export function fundingOrder(goals: RoadmapGoalInput[]): RoadmapGoalInput[] {
    return [...goals].sort(
        (a, b) =>
            a.targetDate.localeCompare(b.targetDate) ||
            (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
            a.id.localeCompare(b.id),
    );
}

export function stillNeededFor(goal: RoadmapGoalInput): number {
    return round2(
        Math.max(0, (goal.targetAmount || 0) - Math.max(0, goal.spent || 0)),
    );
}

export function projectRoadmap(
    rawInput: RoadmapInput,
    scenario: Scenario = [],
): RoadmapResult {
    const { input, monthlySavings } = applyScenario(rawInput, scenario);
    const { today, pool } = input;
    const haircutPct = input.haircutPct ?? DEFAULT_HAIRCUT_PCT;
    const haircutMonths = input.haircutMonths ?? DEFAULT_HAIRCUT_MONTHS;
    const asOf = pool.asOf || today;
    const todayOffset = Math.max(0, monthsBetween(asOf, today));

    const investmentsAt = (monthsFromToday: number) =>
        monthsFromToday <= haircutMonths
            ? pool.investments * (1 - haircutPct)
            : pool.investments;
    const lifeEvents = input.cashFlowChanges ?? [];
    /** Projected pool `t` months after the last balance update. */
    const availableAt = (t: number) =>
        pool.liquid +
        investmentsAt(t - todayOffset) +
        monthlySavings * t +
        changesOver(lifeEvents, month(asOf), t);

    const active = fundingOrder(input.goals.filter((g) => !g.done));
    const done = input.goals.filter((g) => g.done);

    const poolTodayFull = round2(pool.liquid + pool.investments);
    const haircutApplied =
        pool.investments > 0 &&
        active.some(
            (g) =>
                Math.max(0, monthsBetween(today, g.targetDate)) <=
                haircutMonths,
        );
    const poolToday = round2(
        haircutApplied
            ? pool.liquid + pool.investments * (1 - haircutPct)
            : poolTodayFull,
    );

    let claimed = 0;
    let unfundedPool = Math.max(0, poolToday);
    const goals: RoadmapGoalResult[] = active.map((goal, order) => {
        const stillNeeded = stillNeededFor(goal);
        const overdue = month(goal.targetDate) < month(today);
        const deadline = overdue ? today : goal.targetDate;
        const monthsLeft = Math.max(0, monthsBetween(today, deadline));
        const t = Math.max(0, monthsBetween(asOf, deadline));

        const claimStart = round2(claimed);
        claimed += stillNeeded;
        const claimEnd = round2(claimed);

        const fundedToday = round2(Math.min(stillNeeded, unfundedPool));
        unfundedPool = Math.max(0, unfundedPool - fundedToday);

        const available = round2(availableAt(t));
        const margin = round2(available - claimEnd);
        const gap = round2(Math.max(0, -margin));
        const shortPerMonth = gap > 0 ? round2(gap / Math.max(t, 1)) : 0;

        let fillMonth: string | null = null;
        for (let m = 0; m <= FILL_SEARCH_MONTHS; m++) {
            if (availableAt(m) >= claimEnd) {
                fillMonth = addMonths(month(asOf), m);
                break;
            }
        }

        const target = Math.max(0, goal.targetAmount || 0);
        const covered = Math.max(0, goal.spent || 0) + fundedToday;
        const progress = target > 0 ? Math.min(1, covered / target) : 1;

        // Short wins over funded: negative savings can drain a covered goal.
        const status = overdue
            ? "overdue"
            : gap > 0
              ? "short"
              : fundedToday >= stillNeeded
                ? "funded"
                : "on_track";

        return {
            goal,
            order,
            stillNeeded,
            fundedToday,
            progress,
            monthsLeft,
            claimStart,
            claimEnd,
            available,
            gap,
            margin,
            shortPerMonth,
            fillMonth,
            status,
        };
    });

    const worstGap = goals.reduce((max, g) => Math.max(max, g.gap), 0);
    const shortfallPerMonth = goals.reduce(
        (max, g) => Math.max(max, g.shortPerMonth),
        0,
    );
    const spareMargin =
        goals.length > 0 && worstGap === 0
            ? goals.reduce((min, g) => Math.min(min, g.margin), Infinity)
            : 0;

    return {
        verdict:
            goals.length === 0 ? "none" : worstGap > 0 ? "short" : "on_track",
        worstGap: round2(worstGap),
        spareMargin: round2(spareMargin),
        shortfallPerMonth: round2(shortfallPerMonth),
        poolToday,
        poolTodayFull,
        haircutApplied,
        monthlySavings: round2(monthlySavings),
        asOf,
        goals,
        done,
        lifeEvents,
    };
}
