/**
 * The household Roadmap: gathers the pool, baseline savings and goals, and
 * runs the engine. Always the household plan; it ignores the perspective
 * switch. Every Roadmap surface (verdict, Pool Jar, goal cards, Dashboard
 * chip) reads this one result.
 */

import { useMemo } from "react";
import {
    useAccountSnapshotsQuery,
    useAccountsQuery,
    useAllExpensesQuery,
    useBonusEventsQuery,
    useBudgetHistoryQuery,
    useCategoriesQuery,
    useCreditCardStatementsQuery,
    useGoalsQuery,
    useRecurringItemsQuery,
} from "./useFinanceQueries";
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
}

export function useRoadmap(): RoadmapState {
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

    const input = useMemo(
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
            }),
        [
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
                bonusEvents,
                planPerMonth: baseline.monthlySavings,
            }),
        [history, expenses, bonusEvents, baseline.monthlySavings],
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
    };
}
