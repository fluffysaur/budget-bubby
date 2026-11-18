/**
 * Net worth reality check (decision 26): compares how the pool actually grew
 * with the plan's monthly savings, and projects it forward.
 *
 * - History is the pool (non-CPF net worth, full value) at the last balance
 *   update of each month. Months without an update are filled by straight
 *   lines between their neighbours.
 * - Unlocks at 3+ months with a balance update.
 * - Growth leaves out months with goal-tagged spending (a venue deposit is
 *   not a savings miss) and months with a bonus (the plan excludes bonuses).
 * - The projection adds monthly savings and life events, and drops by each
 *   goal's still-needed amount in its month. No investment returns.
 */

import { addMonths, monthsBetween } from "../dateUtils";
import { changesOver } from "./lifeEvents";
import { balanceUpdateDates, poolAtDate } from "./pool";
import { fundingOrder, stillNeededFor } from "./project";
import type {
    Account,
    AccountSnapshot,
    BonusEvent,
    CreditCardStatement,
    Expense,
} from "../../types/finance";
import type { RoadmapInput } from "./types";

export const REALITY_MIN_MONTHS = 3;
/** Growth and plan differ by more than this share of the plan: warn. */
export const REALITY_WARN_RATIO = 0.2;
/** Months to show past the last goal. */
const PROJECTION_TAIL_MONTHS = 3;
const PROJECTION_MAX_MONTHS = 360;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface HistoryPoint {
    /** 'YYYY-MM' */
    month: string;
    value: number;
    /** False when filled in between two balance updates. */
    actual: boolean;
}

/** Monthly pool history at full value, gaps filled by straight lines. */
export function poolHistory(
    accounts: Account[],
    snapshots: AccountSnapshot[],
    statements: CreditCardStatement[],
): HistoryPoint[] {
    const lastDateByMonth = new Map<string, string>();
    for (const date of balanceUpdateDates(accounts, snapshots)) {
        lastDateByMonth.set(date.slice(0, 7), date); // dates are sorted
    }
    const actual = [...lastDateByMonth.entries()].map(([month, date]) => {
        const pool = poolAtDate(accounts, snapshots, statements, date);
        return { month, value: round2(pool.liquid + pool.investments) };
    });

    const points: HistoryPoint[] = [];
    actual.forEach((p, i) => {
        const prev = actual[i - 1];
        if (prev) {
            const gap = monthsBetween(prev.month, p.month);
            for (let k = 1; k < gap; k++) {
                points.push({
                    month: addMonths(prev.month, k),
                    value: round2(
                        prev.value + ((p.value - prev.value) * k) / gap,
                    ),
                    actual: false,
                });
            }
        }
        points.push({ ...p, actual: true });
    });
    return points;
}

export type RealityStatus = "locked" | "no_months" | "ok";
export type RealityDirection = "above" | "below" | "match";

export interface RealityCheck {
    status: RealityStatus;
    /** Months with a balance update. */
    updateMonths: number;
    /** Average monthly pool growth over the months used. */
    grewPerMonth: number;
    /** The plan's monthly savings. */
    planPerMonth: number;
    /** Months whose growth was averaged. */
    monthsUsed: string[];
    /** Growth differs from the plan by more than ~20%. */
    differs: boolean;
    /** Direction when `differs` is true; "match" otherwise. */
    direction: RealityDirection;
    /** Percentage difference vs plan (rounded integer, e.g. 25 or -33). */
    deltaPct: number;
}

export interface RealityCheckInput {
    history: HistoryPoint[];
    expenses: Expense[];
    bonusEvents?: BonusEvent[];
    planPerMonth: number;
}

export function realityCheck({
    history,
    expenses,
    bonusEvents = [],
    planPerMonth,
}: RealityCheckInput): RealityCheck {
    const updateMonths = history.filter((p) => p.actual).length;
    const base = {
        updateMonths,
        grewPerMonth: 0,
        planPerMonth: round2(planPerMonth),
        monthsUsed: [] as string[],
        differs: false,
        direction: "match" as RealityDirection,
        deltaPct: 0,
    };
    if (updateMonths < REALITY_MIN_MONTHS) return { ...base, status: "locked" };

    const skip = new Set<string>();
    for (const e of expenses) {
        if (e.goal_id && (Number(e.amount) || 0) > 0)
            skip.add(e.date.slice(0, 7));
    }
    for (const b of bonusEvents) skip.add(b.received_on.slice(0, 7));

    const deltas: Array<{ month: string; delta: number }> = [];
    for (let i = 1; i < history.length; i++) {
        const { month, value } = history[i];
        if (skip.has(month)) continue;
        deltas.push({ month, delta: value - history[i - 1].value });
    }
    if (deltas.length === 0) return { ...base, status: "no_months" };

    const grewPerMonth = round2(
        deltas.reduce((s, d) => s + d.delta, 0) / deltas.length,
    );
    const differs =
        Math.abs(grewPerMonth - planPerMonth) >
        REALITY_WARN_RATIO * Math.abs(planPerMonth);
    const direction: RealityDirection = !differs
        ? "match"
        : grewPerMonth > planPerMonth
          ? "above"
          : "below";
    const deltaPct =
        Math.abs(planPerMonth) > 0
            ? Math.round(
                  ((grewPerMonth - planPerMonth) / Math.abs(planPerMonth)) *
                      100,
              )
            : 0;
    return {
        ...base,
        status: "ok",
        grewPerMonth,
        monthsUsed: deltas.map((d) => d.month),
        differs,
        direction,
        deltaPct,
    };
}

export interface ProjectionMilestone {
    goalId: string;
    emoji: string;
    title: string;
    amount: number;
}

export interface ProjectionPoint {
    /** 'YYYY-MM' */
    month: string;
    value: number;
    /** Goals paid in this month. */
    milestones: ProjectionMilestone[];
}

/**
 * Month-by-month pool from the last balance update to just past the last
 * goal: savings and life events in, each goal's still-needed amount out in
 * its month. Starts with the pool today at full value.
 */
export function projectPool(input: RoadmapInput): ProjectionPoint[] {
    const asOfMonth = (input.pool.asOf || input.today).slice(0, 7);
    const todayMonth = input.today.slice(0, 7);
    const goals = fundingOrder(input.goals.filter((g) => !g.done)).filter(
        (g) => g.targetDate.slice(0, 7) >= todayMonth,
    );
    const lastGoal = goals.at(-1)?.targetDate.slice(0, 7) ?? asOfMonth;
    const span = Math.min(
        PROJECTION_MAX_MONTHS,
        Math.max(0, monthsBetween(asOfMonth, lastGoal)) +
            PROJECTION_TAIL_MONTHS,
    );

    const byMonth = new Map<string, ProjectionMilestone[]>();
    for (const g of goals) {
        const m = g.targetDate.slice(0, 7);
        const list = byMonth.get(m) ?? [];
        list.push({
            goalId: g.id,
            emoji: g.emoji,
            title: g.title,
            amount: stillNeededFor(g),
        });
        byMonth.set(m, list);
    }

    const start = input.pool.liquid + input.pool.investments;
    let paid = 0;
    const points: ProjectionPoint[] = [];
    for (let t = 0; t <= span; t++) {
        const month = addMonths(asOfMonth, t);
        const milestones = byMonth.get(month) ?? [];
        paid += milestones.reduce((s, m) => s + m.amount, 0);
        points.push({
            month,
            value: round2(
                start +
                    input.monthlySavings * t +
                    changesOver(input.cashFlowChanges, asOfMonth, t) -
                    paid,
            ),
            milestones,
        });
    }
    return points;
}
