/**
 * Builds the engine input from app data. Shared by the Roadmap UI and the
 * reminder engine so both reach the same verdict.
 */

import { addMonths } from "../dateUtils";
import { lifeEventsFromRecurring } from "./lifeEvents";
import { computeCpfOa } from "./cpf";
import { computePool } from "./pool";
import type { BaselineResult } from "./baseline";
import type {
    Account,
    AccountSnapshot,
    BonusEvent,
    CreditCardStatement,
    Expense,
    RecurringItem,
    SavingsGoal,
} from "../../types/finance";
import type { RoadmapGoalInput, RoadmapInput, RoadmapPool } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Goal-tagged spend per goal id, at full amounts (the household plan). */
export function goalSpendById(expenses: Expense[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const e of expenses) {
        if (!e.goal_id) continue;
        map.set(
            e.goal_id,
            round2((map.get(e.goal_id) ?? 0) + (Number(e.amount) || 0)),
        );
    }
    return map;
}

export function toRoadmapGoals(
    goals: SavingsGoal[],
    expenses: Expense[],
): RoadmapGoalInput[] {
    const spend = goalSpendById(expenses);
    return goals.map((g) => ({
        id: g.id,
        title: g.title,
        emoji: g.emoji || "🎯",
        targetAmount: Number(g.target_amount) || 0,
        targetDate: g.target_date,
        createdAt: g.created_at,
        spent: spend.get(g.id) ?? 0,
        done: g.status === "achieved",
        useCpfOa: Boolean(g.use_cpf_oa),
        cpfOaCap:
            g.cpf_oa_cap != null && Number.isFinite(Number(g.cpf_oa_cap))
                ? Number(g.cpf_oa_cap)
                : null,
    }));
}

/** Net bonuses received in the 12 months up to `today`. */
export function typicalAnnualBonus(
    events: BonusEvent[],
    today: string,
): number {
    const since = addMonths(today.slice(0, 10), -12);
    return round2(
        events
            .filter((e) => e.received_on > since && e.received_on <= today)
            .reduce((s, e) => s + (Number(e.net) || 0), 0),
    );
}

/**
 * The last month the baseline already reflects: the newest averaged month,
 * or this month for an estimate (budgeted savings ignore recurring spend).
 */
export function baselineCoveredThrough(
    baseline: Pick<BaselineResult, "source" | "months">,
    today: string,
): string {
    const current = today.slice(0, 7);
    if (baseline.source !== "actual" || baseline.months.length === 0) {
        return current;
    }
    return [...baseline.months].sort().at(-1) ?? current;
}

export interface BuildRoadmapInputOptions {
    today: string;
    accounts: Account[];
    snapshots: AccountSnapshot[];
    statements: CreditCardStatement[];
    goals: SavingsGoal[];
    expenses: Expense[];
    monthlySavings: number;
    bonusEvents?: BonusEvent[];
    /** Recurring items, read for life events. */
    recurringItems?: RecurringItem[];
    /** Last month the baseline reflects ('YYYY-MM'); defaults to this month. */
    coveredThrough?: string;
    /** Overrides the live pool (e.g. the pool at an earlier update). */
    pool?: RoadmapPool;
}

export function buildRoadmapInput({
    today,
    accounts,
    snapshots,
    statements,
    goals,
    expenses,
    monthlySavings,
    bonusEvents = [],
    recurringItems = [],
    coveredThrough,
    pool,
}: BuildRoadmapInputOptions): RoadmapInput {
    return {
        today,
        pool: pool ?? computePool(accounts, snapshots, statements, today),
        monthlySavings,
        goals: toRoadmapGoals(goals, expenses),
        typicalAnnualBonus: typicalAnnualBonus(bonusEvents, today),
        cashFlowChanges: lifeEventsFromRecurring(
            recurringItems,
            coveredThrough ?? today.slice(0, 7),
        ),
        cpfOa: computeCpfOa(accounts, snapshots, recurringItems, today),
    };
}
