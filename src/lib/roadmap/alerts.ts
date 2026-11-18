/**
 * Goal alerts fire only when a goal's status changes (on track <-> short).
 * The check runs at each balance update: the plan valued at the latest update
 * is compared with the plan valued at the update before it, so the result is
 * stable between updates. Callers key alerts by goal and update month, so a
 * goal gets at most one alert a month.
 */

import { balanceUpdateDates, poolAtDate } from "./pool";
import { projectRoadmap } from "./project";
import type {
    Account,
    AccountSnapshot,
    CreditCardStatement,
} from "../../types/finance";
import type { RoadmapGoalResult, RoadmapInput } from "./types";

export type GoalPlanStatus = "on_track" | "short";

export interface GoalStatusChange {
    goal: RoadmapGoalResult;
    from: GoalPlanStatus;
    to: GoalPlanStatus;
    /** 'YYYY-MM' of the balance update that changed it. */
    month: string;
}

const planStatus = (g: RoadmapGoalResult): GoalPlanStatus | null =>
    g.status === "overdue" ? null : g.status === "short" ? "short" : "on_track";

export function goalStatusChanges(
    input: RoadmapInput,
    accounts: Account[],
    snapshots: AccountSnapshot[],
    statements: CreditCardStatement[],
): GoalStatusChange[] {
    const dates = balanceUpdateDates(accounts, snapshots);
    if (dates.length < 2) return [];
    const latest = dates[dates.length - 1];
    const previous = dates[dates.length - 2];

    const now = projectRoadmap({
        ...input,
        pool: poolAtDate(accounts, snapshots, statements, latest),
    });
    const before = projectRoadmap({
        ...input,
        pool: poolAtDate(accounts, snapshots, statements, previous),
    });
    const beforeById = new Map(before.goals.map((g) => [g.goal.id, g]));

    const changes: GoalStatusChange[] = [];
    for (const g of now.goals) {
        const prev = beforeById.get(g.goal.id);
        const to = planStatus(g);
        const from = prev ? planStatus(prev) : null;
        if (to && from && to !== from) {
            changes.push({ goal: g, from, to, month: latest.slice(0, 7) });
        }
    }
    return changes;
}
