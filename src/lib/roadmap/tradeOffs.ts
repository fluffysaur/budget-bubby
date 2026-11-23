/**
 * Trade-offs are scenarios: one edit, one result ("Delay House 8 mo -> On track").
 * Phase 1 offers Delay and +Bonus.
 */

import { projectRoadmap } from "./project";
import type {
    RoadmapGoalResult,
    RoadmapInput,
    RoadmapVerdict,
    ScenarioEdit,
} from "./types";

/** Longest delay worth suggesting. */
const MAX_DELAY_MONTHS = 120;
/** How many short goals get a delay / lower-target suggestion. */
const MAX_GOAL_SUGGESTIONS = 2;

export interface TradeOff {
    edit: ScenarioEdit;
    /** The goal the edit changes, if any. */
    goalId?: string;
    verdict: RoadmapVerdict;
    /** Shortfall per month left after the edit. */
    shortfallPerMonth: number;
}

/** Smallest delay (in months) that puts the whole plan on track, or null. */
export function smallestDelayToTrack(
    input: RoadmapInput,
    goalId: string,
): number | null {
    for (let months = 1; months <= MAX_DELAY_MONTHS; months++) {
        const result = projectRoadmap(input, [
            { type: "delay", goalId, months },
        ]);
        if (result.verdict !== "short") return months;
    }
    return null;
}

/**
 * Highest cleanly-rounded target (>= goal.spent) for `goal` that resolves
 * the plan's shortfall, or null if none fits.
 */
export function highestFittingTarget(
    input: RoadmapInput,
    goalResult: RoadmapGoalResult,
    worstGap: number,
): number | null {
    const { goal } = goalResult;
    const minTarget = Math.ceil(Math.max(0, goal.spent));
    if (minTarget >= goal.targetAmount) return null;

    const step = goal.targetAmount >= 5000 ? 500 : 100;
    const raw = goal.targetAmount - Math.max(goalResult.gap, worstGap);
    const rounded = Math.floor(raw / step) * step;
    const candidates = [rounded, minTarget].filter(
        (t) => t >= minTarget && t < goal.targetAmount,
    );

    for (const targetAmount of candidates) {
        const result = projectRoadmap(input, [
            { type: "lowerTarget", goalId: goal.id, targetAmount },
        ]);
        if (result.verdict !== "short") return targetAmount;
    }
    return null;
}

/** Trade-offs worth showing. Empty unless the plan is short. */
export function suggestTradeOffs(input: RoadmapInput): TradeOff[] {
    const base = projectRoadmap(input);
    if (base.verdict !== "short") return [];

    const tradeOffs: TradeOff[] = [];
    const shortGoals = base.goals
        .filter((g) => g.status === "short" || g.status === "overdue")
        .filter((g) => g.gap > 0)
        .slice(0, MAX_GOAL_SUGGESTIONS);

    for (const g of shortGoals) {
        if (g.status === "overdue") continue;
        const months = smallestDelayToTrack(input, g.goal.id);
        if (months === null) continue;
        const edit: ScenarioEdit = { type: "delay", goalId: g.goal.id, months };
        const result = projectRoadmap(input, [edit]);
        tradeOffs.push({
            edit,
            goalId: g.goal.id,
            verdict: result.verdict,
            shortfallPerMonth: result.shortfallPerMonth,
        });
    }

    // Trim category with the most actual spending headroom
    const bestTrim = [...(input.trimCandidates ?? [])]
        .sort(
            (a, b) =>
                b.headroom - a.headroom ||
                a.categoryName.localeCompare(b.categoryName),
        )
        .find((c) => c.headroom >= 1);
    if (bestTrim) {
        const desired = Math.ceil(base.shortfallPerMonth / 10) * 10;
        const monthlyAmount = Math.min(
            Math.floor(bestTrim.headroom),
            Math.max(1, desired),
        );
        if (monthlyAmount > 0) {
            const edit: ScenarioEdit = {
                type: "trim",
                categoryId: bestTrim.categoryId,
                categoryName: bestTrim.categoryName,
                monthlyAmount,
            };
            const result = projectRoadmap(input, [edit]);
            tradeOffs.push({
                edit,
                verdict: result.verdict,
                shortfallPerMonth: result.shortfallPerMonth,
            });
        }
    }

    // Lower target for short goals
    for (const g of shortGoals) {
        if (g.status === "overdue") continue;
        const targetAmount = highestFittingTarget(input, g, base.worstGap);
        if (targetAmount === null) continue;
        const edit: ScenarioEdit = {
            type: "lowerTarget",
            goalId: g.goal.id,
            targetAmount,
        };
        const result = projectRoadmap(input, [edit]);
        tradeOffs.push({
            edit,
            goalId: g.goal.id,
            verdict: result.verdict,
            shortfallPerMonth: result.shortfallPerMonth,
        });
    }

    if ((input.typicalAnnualBonus ?? 0) > 0) {
        const edit: ScenarioEdit = { type: "bonus" };
        const result = projectRoadmap(input, [edit]);
        tradeOffs.push({
            edit,
            verdict: result.verdict,
            shortfallPerMonth: result.shortfallPerMonth,
        });
    }

    return tradeOffs;
}
