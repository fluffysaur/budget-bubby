/**
 * Roadmap engine types. Goals are claims on one household pool; the engine
 * checks, at each goal's deadline, whether the pool plus savings covers it.
 * See docs/plans/2026-11-18-roadmap.md.
 */

import type { CashFlowChange } from "./lifeEvents";

/** A goal as the engine sees it. */
export interface RoadmapGoalInput {
    id: string;
    title: string;
    emoji: string;
    targetAmount: number;
    /** 'YYYY-MM-DD' */
    targetDate: string;
    createdAt?: string;
    /** Goal-tagged spending so far (expenses with this `goal_id`). */
    spent: number;
    /** Marked Done (`status = "achieved"`); left out of the funding order. */
    done: boolean;
    /** "Use CPF OA": funded from household OA first, then the pool. */
    useCpfOa?: boolean;
    /** Most OA this goal may use; null or undefined means no cap. */
    cpfOaCap?: number | null;
    /** The household buffer: always first in the funding order. */
    isBuffer?: boolean;
}

/** Household CPF OA (all members combined). Never part of the pool. */
export interface RoadmapCpfOa {
    balance: number;
    /** Average monthly OA growth; 0 before 3 OA snapshots. */
    monthlyGrowth: number;
    /** 'YYYY-MM-DD' of the last OA update; OA growth starts here. */
    asOf: string;
    /** Dated changes to OA growth from items "Paid from CPF OA". */
    changes: CashFlowChange[];
}

/** The household pool: non-CPF balances minus unpaid card statements. */
export interface RoadmapPool {
    /** Cash + Other balances minus unpaid card statements. */
    liquid: number;
    /** Investment balances, before any haircut. */
    investments: number;
    /** 'YYYY-MM-DD' of the last balance update; the projection starts here. */
    asOf: string;
}

export interface TrimCandidate {
    categoryId: string;
    categoryName: string;
    /** Average monthly budgeted cap in the baseline window. */
    monthlyBudget: number;
    /** Average monthly actual spend in the baseline window. */
    monthlySpent: number;
    /** Unused budget headroom (max(0, monthlyBudget - monthlySpent)). */
    headroom: number;
}

export interface RoadmapInput {
    /** 'YYYY-MM-DD' */
    today: string;
    pool: RoadmapPool;
    /** Average monthly savings (salary only, no bonuses). */
    monthlySavings: number;
    goals: RoadmapGoalInput[];
    /** Investment discount for near goals, as a 0-1 fraction. Default 0.2. */
    haircutPct?: number;
    /** Goals due within this many months get the haircut. Default 24. */
    haircutMonths?: number;
    /** Net bonuses over the last 12 months, for the "+Bonus" trade-off. */
    typicalAnnualBonus?: number;
    /** Life events: dated changes to monthly savings. */
    cashFlowChanges?: CashFlowChange[];
    /** Household CPF OA, for goals with "Use CPF OA" on. */
    cpfOa?: RoadmapCpfOa | null;
    /** Spendable categories with headroom for the "Trim category" trade-off. */
    trimCandidates?: TrimCandidate[];
}

/** One edit to the plan. A scenario is a list of edits. */
export type ScenarioEdit =
    | { type: "delay"; goalId: string; months: number }
    | {
          type: "trim";
          categoryId: string;
          categoryName: string;
          monthlyAmount: number;
      }
    | { type: "lowerTarget"; goalId: string; targetAmount: number }
    | { type: "bonus" };

export type Scenario = readonly ScenarioEdit[];

export type RoadmapGoalStatus = "funded" | "on_track" | "short" | "overdue";

export interface RoadmapGoalResult {
    goal: RoadmapGoalInput;
    /** Position in the funding order (0 = funded first). */
    order: number;
    /** target - goal-tagged spend, never below 0. */
    stillNeeded: number;
    /** How much of `stillNeeded` today's pool and OA already cover. */
    fundedToday: number;
    /** Part of `stillNeeded` paid from CPF OA by the deadline (0 without the switch). */
    fromCpfOa: number;
    /** (spent + fundedToday) / target, 0-1. */
    progress: number;
    /** Whole months from today to the goal's date (0 when due or overdue). */
    monthsLeft: number;
    /** Cumulative pool claims below this goal (earlier goals' cash share). */
    claimStart: number;
    /** claimStart + this goal's cash share: what the pool must reach by the deadline. */
    claimEnd: number;
    /** Projected pool at the deadline (haircut applied for near goals). */
    available: number;
    /** max(0, claimEnd - available). */
    gap: number;
    /** available - claimEnd (negative when short). */
    margin: number;
    /** Extra savings a month that would close this goal's gap. */
    shortPerMonth: number;
    /** 'YYYY-MM' when the projected pool first covers claimEnd; null if never. */
    fillMonth: string | null;
    status: RoadmapGoalStatus;
}

export type RoadmapVerdict = "none" | "on_track" | "short";

export interface RoadmapResult {
    verdict: RoadmapVerdict;
    /** Largest gap across deadlines (0 when on track). */
    worstGap: number;
    /** Smallest spare margin across deadlines (0 when short or no goals). */
    spareMargin: number;
    /** Extra savings a month needed to close every gap. */
    shortfallPerMonth: number;
    /** Today's pool, with the haircut when any goal is inside the window. */
    poolToday: number;
    /** Today's pool at full value. */
    poolTodayFull: number;
    /** Whether `poolToday` is discounted. */
    haircutApplied: boolean;
    monthlySavings: number;
    asOf: string;
    /** Active goals in funding order. */
    goals: RoadmapGoalResult[];
    /** Goals marked Done. */
    done: RoadmapGoalInput[];
    /** Life events the projection applies. */
    lifeEvents: CashFlowChange[];
    /** Household OA and how much the plan draws from it; null with no OA. */
    cpfOa: (RoadmapCpfOa & { used: number }) | null;
}
