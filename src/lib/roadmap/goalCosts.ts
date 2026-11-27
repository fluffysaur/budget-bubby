/**
 * Goal costs: the Projection card lists only changes tied to a goal (childcare
 * after a Baby Fund). Every other change still feeds the forecast; it is
 * summarised in one line instead of listed.
 */

import type { CashFlowChange } from "./lifeEvents";

export interface GoalCostRow {
    change: CashFlowChange;
    /** Title of the linked goal, or null when the goal is not found. */
    goalTitle: string | null;
}

export interface GoalCostsSummary {
    /** Changes linked to a goal, soonest first. */
    linked: GoalCostRow[];
    /** How many other changes the forecast still counts. */
    otherCount: number;
    /** Their combined change to monthly savings (negative = cost). */
    otherMonthly: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeGoalCosts(
    changes: readonly CashFlowChange[],
    goals: readonly { id: string; title: string }[],
): GoalCostsSummary {
    const titles = new Map(goals.map((g) => [g.id, g.title]));
    const linked: GoalCostRow[] = [];
    let otherCount = 0;
    let otherMonthly = 0;
    for (const change of changes) {
        if (change.goalId) {
            linked.push({
                change,
                goalTitle: titles.get(change.goalId) ?? null,
            });
        } else {
            otherCount += 1;
            otherMonthly += change.monthlyDelta;
        }
    }
    return { linked, otherCount, otherMonthly: round2(otherMonthly) };
}

/** "Also counts 3 other recurring changes", or null when there are none. */
export function otherChangesLabel(count: number): string | null {
    if (count <= 0) return null;
    return `Also counts ${count} other recurring ${count === 1 ? "change" : "changes"}`;
}
