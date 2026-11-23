/**
 * Net worth reality check (decision 26): compares how the pool actually grew
 * with the plan's monthly savings, and projects it forward.
 *
 * - History is the pool (non-CPF net worth, full value) at the last balance
 *   update of each month. Months without an update are filled by straight
 *   lines between their neighbours, for the chart only.
 * - Growth is measured between consecutive real updates and never uses the
 *   filled-in months: total growth over clean intervals / months they span.
 * - An interval where a pool account is recorded for the first time is
 *   skipped: its balance already existed (or was moved in), it isn't savings.
 * - Goal-tagged spending inside an interval is added back (a venue deposit is
 *   not a savings miss), and bonuses are taken out (the plan excludes them).
 * - Unlocks at 2+ clean intervals.
 * - The projection adds monthly savings and life events, and drops by each
 *   goal's still-needed amount in its month. No investment returns.
 */

import { addMonths, monthsBetween } from "../dateUtils";
import { changesOver } from "./lifeEvents";
import { balanceUpdateDates, poolAtDate } from "./pool";
import { fundingOrder, projectRoadmap } from "./project";
import type {
    Account,
    AccountSnapshot,
    BonusEvent,
    CreditCardStatement,
    Expense,
} from "../../types/finance";
import type { RoadmapInput } from "./types";

/** Clean update-to-update intervals needed before the check unlocks. */
export const REALITY_MIN_INTERVALS = 2;
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
    /** 'YYYY-MM-DD' of the balance update (actual points only). */
    date?: string;
    /**
     * A pool account got its first-ever snapshot since the previous update
     * (actual points only).
     */
    newAccounts?: boolean;
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

    const poolIds = new Set(
        accounts.filter((a) => a.type !== "CPF").map((a) => a.id),
    );
    const firstSnapshot = new Map<string, string>();
    for (const s of snapshots) {
        if (!poolIds.has(s.account_id)) continue;
        const d = s.snapshot_date.slice(0, 10);
        const prev = firstSnapshot.get(s.account_id);
        if (!prev || d < prev) firstSnapshot.set(s.account_id, d);
    }
    const firstDates = [...firstSnapshot.values()];

    let prevDate = "";
    const actual = [...lastDateByMonth.entries()].map(([month, date]) => {
        const pool = poolAtDate(accounts, snapshots, statements, date);
        const newAccounts = firstDates.some((d) => d > prevDate && d <= date);
        prevDate = date;
        return {
            month,
            date,
            newAccounts,
            value: round2(pool.liquid + pool.investments),
        };
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

export type RealityStatus = "locked" | "ok";
export type RealityDirection = "above" | "below" | "match";

export interface RealityCheck {
    status: RealityStatus;
    /** Update-to-update intervals used (no newly recorded accounts). */
    cleanIntervals: number;
    /** Some interval was skipped because accounts were newly recorded. */
    resetByNewAccounts: boolean;
    /** Average monthly pool growth over the clean intervals. */
    grewPerMonth: number;
    /** The plan's monthly savings. */
    planPerMonth: number;
    /** Months spanned by the clean intervals. */
    monthsCovered: number;
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
    /** Bonuses to take out of growth; pass none when bonuses are included. */
    bonusEvents?: BonusEvent[];
    planPerMonth: number;
}

export function realityCheck({
    history,
    expenses,
    bonusEvents = [],
    planPerMonth,
}: RealityCheckInput): RealityCheck {
    const updates = history.filter(
        (p): p is HistoryPoint & { date: string } => p.actual && !!p.date,
    );

    let cleanIntervals = 0;
    let resetByNewAccounts = false;
    let monthsCovered = 0;
    let growth = 0;
    for (let i = 1; i < updates.length; i++) {
        const prev = updates[i - 1];
        const cur = updates[i];
        if (cur.newAccounts) {
            resetByNewAccounts = true;
            continue;
        }
        const inInterval = (d: string) => {
            const day = d.slice(0, 10);
            return day > prev.date && day <= cur.date;
        };
        const goalSpend = expenses
            .filter((e) => e.goal_id && inInterval(e.date))
            .reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0);
        const bonuses = bonusEvents
            .filter((b) => inInterval(b.received_on))
            .reduce((s, b) => s + (Number(b.net) || 0), 0);

        cleanIntervals += 1;
        monthsCovered += monthsBetween(prev.month, cur.month);
        growth += cur.value - prev.value + goalSpend - bonuses;
    }

    const base = {
        cleanIntervals,
        resetByNewAccounts,
        grewPerMonth: 0,
        planPerMonth: round2(planPerMonth),
        monthsCovered,
        differs: false,
        direction: "match" as RealityDirection,
        deltaPct: 0,
    };
    if (cleanIntervals < REALITY_MIN_INTERVALS || monthsCovered <= 0) {
        return { ...base, status: "locked" };
    }

    const grewPerMonth = round2(growth / monthsCovered);
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
 * goal: savings and life events in, each goal's cash share (still-needed
 * minus any CPF OA) out in its month. Starts with the pool today at full value.
 */
export function projectPool(input: RoadmapInput): ProjectionPoint[] {
    const cashShare = new Map(
        projectRoadmap(input).goals.map((g) => [
            g.goal.id,
            g.stillNeeded - g.fromCpfOa,
        ]),
    );
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
            amount: cashShare.get(g.id) ?? 0,
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
