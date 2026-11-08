/**
 * Shared helpers for spreading an amount across savings goals.
 * Used by the bonus split step; works in whole cents so shares always sum
 * exactly to the amount.
 */

import type { BonusGoalContribution, SavingsGoal } from "../types/finance";

export type GoalDistributionMode = "even" | "gap" | "single";

/** Amount still needed to reach the goal's target (never negative). */
export function goalGap(
    goal: Pick<SavingsGoal, "target_amount" | "saved_so_far">,
): number {
    return Math.max(
        0,
        Math.round((goal.target_amount - goal.saved_so_far) * 100) / 100,
    );
}

/** A goal can take more money while it is not achieved and below target. */
export function isGoalFundable(
    goal: Pick<SavingsGoal, "status" | "target_amount" | "saved_so_far">,
): boolean {
    return goal.status !== "achieved" && goal.saved_so_far < goal.target_amount;
}

/** Splits `totalCents` by `weights`; the last weighted entry absorbs the remainder. */
function splitCents(totalCents: number, weights: number[]): number[] {
    const weightSum = weights.reduce((s, w) => s + w, 0);
    if (weightSum <= 0 || totalCents <= 0) return weights.map(() => 0);
    const lastIdx = weights.reduce((last, w, idx) => (w > 0 ? idx : last), -1);
    let assigned = 0;
    return weights.map((w, idx) => {
        if (w <= 0) return 0;
        if (idx === lastIdx) return totalCents - assigned;
        const share = Math.floor((totalCents * w) / weightSum);
        assigned += share;
        return share;
    });
}

/**
 * Distributes `amount` across the given goals.
 * - even: equal shares
 * - gap: weighted by what each goal still needs (zero-gap goals get nothing)
 * - single: everything to `singleId`, or the first fundable goal
 * Achieved goals are excluded. The cent remainder goes to the last goal.
 */
export function distributeGoalShare(
    amount: number,
    goals: SavingsGoal[],
    mode: GoalDistributionMode,
    singleId?: string,
): BonusGoalContribution[] {
    const eligible = goals.filter(isGoalFundable);
    const totalCents = Math.round(Math.max(0, amount) * 100);
    if (eligible.length === 0 || totalCents <= 0) return [];

    let weights: number[];
    if (mode === "single") {
        const targetId =
            singleId && eligible.some((g) => g.id === singleId)
                ? singleId
                : eligible[0].id;
        weights = eligible.map((g) => (g.id === targetId ? 1 : 0));
    } else if (mode === "gap") {
        weights = eligible.map((g) => goalGap(g));
    } else {
        weights = eligible.map(() => 1);
    }

    const cents = splitCents(totalCents, weights);
    return eligible
        .map((g, idx) => ({ goal_id: g.id, amount: cents[idx] / 100 }))
        .filter((c) => c.amount > 0);
}
