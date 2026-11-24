/**
 * The household Roadmap: gathers the pool, baseline savings and goals, and
 * runs the engine. Always the household plan; it ignores the perspective
 * switch. Every Roadmap surface (verdict, Pool Jar, goal cards, Dashboard
 * chip) reads this one result.
 */

import { useCallback, useMemo, useState } from "react";
import { useAccountSnapshotsQuery, useAccountsQuery } from "./finance/accounts";
import {
    useHouseholdOverviewQuery,
    useBudgetHistoryQuery,
    useRecurringItemsQuery,
} from "./finance/budget";
import { useCreditCardStatementsQuery } from "./finance/cards";
import { useCategoriesQuery } from "./finance/categories";
import { useAllExpensesQuery } from "./finance/expenses";
import { useGoalsQuery } from "./finance/goals";
import { useBonusEventsQuery } from "./finance/settleUps";
import { getTodayDateString } from "../lib/dateUtils";
import {
    baselineCoveredThrough,
    baselineMonths,
    buildRoadmapInput,
    poolHistory,
    projectPool,
    realityCheck,
    computeBaseline,
    projectRoadmap,
    suggestTradeOffs,
    type BaselineResult,
    type HistoryPoint,
    type ProjectionPoint,
    type RealityCheck,
    type RoadmapGoalResult,
    type RoadmapInput,
    type RoadmapResult,
    type TradeOff,
} from "../lib/roadmap";
import type {
    Account,
    AccountSnapshot,
    BonusEvent,
    Category,
    CreditCardStatement,
    Expense,
    MonthlyBudgetHistoryRow,
    RecurringItem,
    SavingsGoal,
} from "../types/finance";

const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_SNAPSHOTS: AccountSnapshot[] = [];
const EMPTY_STATEMENTS: CreditCardStatement[] = [];
const EMPTY_GOALS: SavingsGoal[] = [];
const EMPTY_EXPENSES: Expense[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_RECURRING: RecurringItem[] = [];
const EMPTY_ROWS: MonthlyBudgetHistoryRow[] = [];
const EMPTY_BONUSES: BonusEvent[] = [];

const INCLUDE_BONUSES_STORAGE_KEY = "budget_bubby_roadmap_include_bonuses_v1";

function getStoredIncludeBonuses(): boolean {
    if (typeof window === "undefined" || !window.localStorage) return false;
    try {
        return window.localStorage.getItem(INCLUDE_BONUSES_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

export interface RoadmapState {
    isLoading: boolean;
    input: RoadmapInput;
    result: RoadmapResult;
    baseline: BaselineResult;
    tradeOffs: TradeOff[];
    /** Engine result per goal id (active goals only). */
    byGoalId: Map<string, RoadmapGoalResult>;
    /** Monthly pool history, gaps filled by straight lines. */
    history: HistoryPoint[];
    /** Pool projection from the last balance update. */
    projection: ProjectionPoint[];
    /** Actual pool growth vs the plan's savings. */
    reality: RealityCheck;
    /** Whether average bonuses over the last 12 months are included in the plan. */
    includeBonuses: boolean;
    /** Whether there are bonuses in the last 12 months to toggle. */
    hasBonuses: boolean;
    toggleIncludeBonuses: () => void;
}

export function useRoadmap(): RoadmapState {
    const [includeBonuses, setIncludeBonuses] = useState<boolean>(
        getStoredIncludeBonuses,
    );
    const toggleIncludeBonuses = useCallback(() => {
        setIncludeBonuses((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(
                    INCLUDE_BONUSES_STORAGE_KEY,
                    next ? "1" : "0",
                );
            } catch {
                // Ignore storage errors
            }
            return next;
        });
    }, []);
    const today = getTodayDateString();
    const months = useMemo(() => baselineMonths(today), [today]);

    const accountsQ = useAccountsQuery("household");
    const snapshotsQ = useAccountSnapshotsQuery("household");
    const statementsQ = useCreditCardStatementsQuery();
    const goalsQ = useGoalsQuery();
    const expensesQ = useAllExpensesQuery();
    const categoriesQ = useCategoriesQuery();
    const recurringQ = useRecurringItemsQuery();
    const historyQ = useBudgetHistoryQuery(months);
    const bonusQ = useBonusEventsQuery();
    const householdQ = useHouseholdOverviewQuery();
    const household = householdQ.data?.household ?? null;

    const accounts = accountsQ.data ?? EMPTY_ACCOUNTS;
    const snapshots = snapshotsQ.data ?? EMPTY_SNAPSHOTS;
    const statements = statementsQ.data ?? EMPTY_STATEMENTS;
    const goals = goalsQ.data ?? EMPTY_GOALS;
    const expenses = expensesQ.data ?? EMPTY_EXPENSES;
    const categories = categoriesQ.data ?? EMPTY_CATEGORIES;
    const recurringItems = recurringQ.data ?? EMPTY_RECURRING;
    const rows = historyQ.data ?? EMPTY_ROWS;
    const bonusEvents = bonusQ.data?.events ?? EMPTY_BONUSES;

    const isLoading =
        (goalsQ.isPending && !goalsQ.data) ||
        (accountsQ.isPending && !accountsQ.data);

    const baseline = useMemo(
        () =>
            computeBaseline({
                today,
                rows,
                categories,
                expenses,
                recurringItems,
            }),
        [today, rows, categories, expenses, recurringItems],
    );

    const baseInput = useMemo(
        () =>
            buildRoadmapInput({
                today,
                accounts,
                snapshots,
                statements,
                goals,
                expenses,
                monthlySavings: baseline.monthlySavings,
                bonusEvents,
                recurringItems,
                coveredThrough: baselineCoveredThrough(baseline, today),
                household,
                trimCandidates: baseline.trimCandidates,
            }),
        [
            household,
            today,
            accounts,
            snapshots,
            statements,
            goals,
            expenses,
            baseline,
            bonusEvents,
            recurringItems,
        ],
    );

    const hasBonuses = (baseInput.typicalAnnualBonus ?? 0) > 0;
    const input = useMemo(() => {
        if (!includeBonuses || !hasBonuses) return baseInput;
        return {
            ...baseInput,
            monthlySavings:
                baseInput.monthlySavings +
                Math.max(0, baseInput.typicalAnnualBonus ?? 0) / 12,
            typicalAnnualBonus: 0,
        };
    }, [baseInput, includeBonuses, hasBonuses]);

    const result = useMemo(() => projectRoadmap(input), [input]);
    const tradeOffs = useMemo(() => suggestTradeOffs(input), [input]);
    const byGoalId = useMemo(
        () => new Map(result.goals.map((g) => [g.goal.id, g])),
        [result],
    );

    const history = useMemo(
        () => poolHistory(accounts, snapshots, statements),
        [accounts, snapshots, statements],
    );
    const projection = useMemo(() => projectPool(input), [input]);
    const reality = useMemo(
        () =>
            realityCheck({
                history,
                expenses,
                bonusEvents: includeBonuses ? EMPTY_BONUSES : bonusEvents,
                planPerMonth: input.monthlySavings,
            }),
        [history, expenses, bonusEvents, includeBonuses, input.monthlySavings],
    );

    return {
        isLoading,
        input,
        result,
        baseline,
        tradeOffs,
        byGoalId,
        history,
        projection,
        reality,
        includeBonuses,
        hasBonuses,
        toggleIncludeBonuses,
    };
}
