/**
 * Trade-offs are scenarios: one edit, one result ("Delay House 8 mo -> On track").
 * Phase 1 offers Delay and +Bonus.
 */

import { projectRoadmap } from "./project";
import type { RoadmapInput, RoadmapVerdict, ScenarioEdit } from "./types";

/** Longest delay worth suggesting. */
const MAX_DELAY_MONTHS = 120;
/** How many short goals get a delay suggestion. */
const MAX_DELAY_SUGGESTIONS = 2;

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

/** Trade-offs worth showing. Empty unless the plan is short. */
export function suggestTradeOffs(input: RoadmapInput): TradeOff[] {
    const base = projectRoadmap(input);
    if (base.verdict !== "short") return [];

    const tradeOffs: TradeOff[] = [];
    const shortGoals = base.goals
        .filter((g) => g.status === "short" || g.status === "overdue")
        .filter((g) => g.gap > 0)
        .slice(0, MAX_DELAY_SUGGESTIONS);
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
