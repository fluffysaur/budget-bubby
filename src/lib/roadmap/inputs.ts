/**
 * Builds the engine input from app data. Shared by the Roadmap UI and the
 * reminder engine so both reach the same verdict.
 */

import { addMonths } from "../dateUtils";
import { computePool } from "./pool";
import type {
    Account,
    AccountSnapshot,
    BonusEvent,
    CreditCardStatement,
    Expense,
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

export interface BuildRoadmapInputOptions {
    today: string;
    accounts: Account[];
    snapshots: AccountSnapshot[];
    statements: CreditCardStatement[];
    goals: SavingsGoal[];
    expenses: Expense[];
    monthlySavings: number;
    bonusEvents?: BonusEvent[];
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
    pool,
}: BuildRoadmapInputOptions): RoadmapInput {
    return {
        today,
        pool: pool ?? computePool(accounts, snapshots, statements, today),
        monthlySavings,
        goals: toRoadmapGoals(goals, expenses),
        typicalAnnualBonus: typicalAnnualBonus(bonusEvents, today),
    };
}
