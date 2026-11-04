/**
 * Reminder rules for Budget Bubby.
 *
 * Pure functions: each takes data and an optional Singapore-time reference
 * date and returns the reminders that are currently true. No fetching, no
 * browser APIs, so the server can reuse them later.
 *
 * Each reminder `id` is its once-per-cycle key: a push fires once per id, and
 * the id changes when a new cycle starts (new day, month, due date or level).
 *
 * Reference dates follow `getSingaporeDate()`: the Date's local fields hold
 * Singapore wall-clock time.
 */

import {
    getSingaporeDate,
    getNextDueDate,
    getDaysUntilDue,
    formatDueInDays,
    formatISODate,
    formatMonth,
    formatShortMonth,
} from "../dateUtils";
import { formatSGD } from "../currency";
import { isSpendableCategory } from "../financialFormulas";
import type {
    StreakSummary,
    AccountSnapshot,
    CreditCardStatement,
    CreditCard,
    Expense,
    HouseholdMember,
    SettlementSummary,
    DailyCheckin,
    MonthlyBudgetDetail,
    RecurringItem,
    SavingsGoal,
} from "../../types/finance";

export type ReminderType =
    | "daily_checkin"
    | "balance_update"
    | "credit_card_due"
    | "credit_card_missing_stmt"
    | "partner_shared_spend"
    | "settlement_due"
    | "couple_streak_risk"
    | "budget_limit"
    | "recurring_bill_due"
    | "goal_pacing"
    | "monthly_budget_review";

export type ReminderActionType =
    | "check_in"
    | "update_balances"
    | "view_cc"
    | "view_expenses"
    | "view_settlement"
    | "view_budget"
    | "view_recurring"
    | "view_goals";

export interface AppReminder {
    id: string;
    type: ReminderType;
    title: string;
    message: string;
    severity: "info" | "warning" | "alert";
    actionLabel: string;
    actionType: ReminderActionType;
    data?: Record<string, unknown>;
    createdAt?: string;
}

/** Annual items: remind from this many days before the due date. */
export const RECURRING_ANNUAL_REMINDER_DAYS = 30;
/** Monthly items: remind from this many days before the due date. */
export const RECURRING_MONTHLY_REMINDER_DAYS = 3;

const DAY_MS = 1000 * 60 * 60 * 24;

function sgNow(referenceDate?: Date): Date {
    return referenceDate || getSingaporeDate();
}

function sgToday(referenceDate?: Date): string {
    return formatISODate(sgNow(referenceDate));
}

function sgMonth(referenceDate?: Date): string {
    return formatMonth(sgNow(referenceDate));
}

function memberPrefix(memberId?: string): string {
    return memberId ? `${memberId}-` : "";
}

function daysBetween(fromDate: string, toDate: string): number {
    const fromMs = new Date(fromDate + "T12:00:00").getTime();
    const toMs = new Date(toDate + "T12:00:00").getTime();
    return Math.round((toMs - fromMs) / DAY_MS);
}

/**
 * 1. Daily spend check-in, from 18:00 when not yet checked in today.
 */
export function checkDailyCheckinReminder(
    streak: StreakSummary,
    currentHour?: number,
    memberId?: string,
    todayStr?: string,
): AppReminder | null {
    if (streak.checkedInToday) return null;

    const hour = currentHour !== undefined ? currentHour : getSingaporeDate().getHours();
    if (hour < 18) return null;

    const today = todayStr || sgToday();
    const days = streak.currentStreak || 0;

    return {
        id: `reminder-daily-checkin-${memberPrefix(memberId)}${today}`,
        type: "daily_checkin",
        title: "Log Today's Spend",
        message: days > 0 ? `Keep your ${days}-day streak.` : "Check in to start a streak.",
        severity: "warning",
        actionLabel: "Add Expense",
        actionType: "check_in",
        createdAt: new Date().toISOString(),
    };
}

/**
 * 2. Account balance snapshots due (1st or last 4 days of month).
 */
export function checkBalanceUpdateReminder(
    snapshots: AccountSnapshot[],
    referenceDate?: Date,
    memberId?: string,
): AppReminder | null {
    const d = sgNow(referenceDate);
    const day = d.getDate();
    const currentMonth = sgMonth(referenceDate);

    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const isFirstOrLastDays = day === 1 || day >= lastDay - 3;
    if (!isFirstOrLastDays) return null;

    if (snapshots.some((s) => s.snapshot_date.startsWith(currentMonth))) return null;

    return {
        id: `reminder-balance-update-${memberPrefix(memberId)}${currentMonth}`,
        type: "balance_update",
        title: "Update Balances",
        message: `No snapshot for ${formatShortMonth(currentMonth)}.`,
        severity: "info",
        actionLabel: "Update",
        actionType: "update_balances",
        createdAt: new Date().toISOString(),
    };
}

/**
 * Picks the reminder stage for a due date: the most urgent configured offset
 * already reached, or "overdue". Returns null when outside every offset.
 */
export function getDueStage(daysUntilDue: number, offsets: number[]): string | null {
    if (daysUntilDue < 0) return "overdue";
    const reached = offsets.filter((o) => o >= 0 && daysUntilDue <= o);
    if (reached.length === 0) return null;
    return `d${Math.min(...reached)}`;
}

function ccDueTitle(cardName: string, days: number): string {
    if (days < 0) return `${cardName} Overdue`;
    if (days === 0) return `${cardName} Due Today`;
    if (days === 1) return `${cardName} Due Tomorrow`;
    return `${cardName} Due in ${days} Days`;
}

/**
 * 3. Unpaid credit card statements. One reminder per stage: each configured
 * offset (days before due) reached, plus one day overdue.
 */
export function checkCreditCardDueReminders(
    statements: CreditCardStatement[],
    todayStr?: string,
    dueDaysBefore: number | number[] = 5,
    memberId?: string,
): AppReminder[] {
    const today = todayStr || sgToday();
    const offsets = Array.isArray(dueDaysBefore) ? dueDaysBefore : [dueDaysBefore];
    const reminders: AppReminder[] = [];

    for (const stmt of statements) {
        if (stmt.is_paid || !stmt.due_date) continue;
        // Card owner only
        if (memberId && stmt.card?.owner_id && stmt.card.owner_id !== memberId) continue;

        const days = daysBetween(today, stmt.due_date);
        if (days < -1) continue;
        const stage = getDueStage(days, offsets);
        if (!stage) continue;

        const cardName = stmt.card?.name || "Card";

        reminders.push({
            id: `reminder-cc-due-${stmt.id}-${stage}`,
            type: "credit_card_due",
            title: ccDueTitle(cardName, days),
            message: `${formatSGD(stmt.statement_amount ?? 0)} statement`,
            severity: days <= 2 ? "alert" : "warning",
            actionLabel: "View Bill",
            actionType: "view_cc",
            data: {
                statementId: stmt.id,
                cardId: stmt.card_id,
                dueDate: stmt.due_date,
                daysUntilDue: days,
            },
            createdAt: new Date().toISOString(),
        });
    }

    return reminders;
}

/**
 * 4. Cards whose billing day has passed this month with no statement logged.
 */
export function checkMissingCreditCardStatements(
    cards: CreditCard[],
    statements: CreditCardStatement[],
    referenceDate?: Date,
    memberId?: string,
): AppReminder[] {
    const day = sgNow(referenceDate).getDate();
    const currentMonth = sgMonth(referenceDate);
    const reminders: AppReminder[] = [];

    for (const card of cards) {
        if (!card.is_active) continue;
        if (memberId && card.owner_id && card.owner_id !== memberId) continue;
        if (day < card.billing_day) continue;

        const hasStatement = statements.some(
            (s) => s.card_id === card.id && s.month === currentMonth,
        );
        if (hasStatement) continue;

        reminders.push({
            id: `reminder-cc-missing-${card.id}-${currentMonth}`,
            type: "credit_card_missing_stmt",
            title: `${card.name} Statement Needed`,
            message: `Cycle closed on day ${card.billing_day}.`,
            severity: "info",
            actionLabel: "Add Statement",
            actionType: "view_cc",
            data: { cardId: card.id, month: currentMonth },
            createdAt: new Date().toISOString(),
        });
    }

    return reminders;
}

/**
 * 5. Unsettled shared spend the partner logged in the last 3 days.
 * One daily summary per partner instead of one reminder per expense.
 */
export function checkPartnerSharedSpendReminders(
    expenses: Expense[],
    members: HouseholdMember[],
    activeMemberId: string,
    todayStr?: string,
): AppReminder[] {
    const today = todayStr || sgToday();
    const byPayer = new Map<string, Expense[]>();

    for (const exp of expenses) {
        if (!exp.is_shared || exp.settled || exp.payer_id === activeMemberId) continue;
        const age = daysBetween(exp.date, today);
        if (age < 0 || age > 3) continue;
        const list = byPayer.get(exp.payer_id) ?? [];
        list.push(exp);
        byPayer.set(exp.payer_id, list);
    }

    const reminders: AppReminder[] = [];
    for (const [payerId, list] of byPayer) {
        const partnerName = members.find((m) => m.id === payerId)?.display_name || "Partner";
        const yourShare = list.reduce(
            (sum, exp) => sum + exp.amount * (1 - (exp.split_ratio ?? 0.5)),
            0,
        );
        const latest = list.reduce((a, b) => ((a.created_at || "") >= (b.created_at || "") ? a : b));

        reminders.push({
            id: `reminder-partner-spend-${activeMemberId}-${payerId}-${today}`,
            type: "partner_shared_spend",
            title:
                list.length === 1
                    ? `${partnerName} Logged ${list[0].item}`
                    : `${partnerName} Logged ${list.length} Expenses`,
            message: `Your share: ${formatSGD(yourShare)}`,
            severity: "info",
            actionLabel: "View",
            actionType: "view_expenses",
            data: { expenseIds: list.map((e) => e.id), payerId },
            createdAt: latest.created_at || new Date().toISOString(),
        });
    }

    return reminders;
}

/**
 * 6. Settlement: once a month when the balance first crosses the threshold,
 * and once more at month-end (day 27+) while anything is owed.
 */
export function checkSettlementReminder(
    settlementSummary: SettlementSummary,
    thresholdSgd: number = 200,
    referenceDate?: Date,
    activeMemberId?: string,
): AppReminder | null {
    if (settlementSummary.netBalance <= 0) return null;

    const isMonthEnd = sgNow(referenceDate).getDate() >= 27;
    const exceeds = settlementSummary.netBalance >= thresholdSgd;
    if (!exceeds && !isMonthEnd) return null;

    const currentMonth = sgMonth(referenceDate);
    const amount = formatSGD(settlementSummary.netBalance);

    let title = "Settle Up";
    let message = `${amount} unsettled`;
    let actionLabel = "Settle Up";

    if (activeMemberId && activeMemberId === settlementSummary.debtorId) {
        title = `You Owe ${settlementSummary.creditorName || "Partner"}`;
        message = `${amount} to settle`;
    } else if (activeMemberId && activeMemberId === settlementSummary.creditorId) {
        title = `${settlementSummary.debtorName || "Partner"} Owes You`;
        message = `${amount} to settle`;
        actionLabel = "View";
    }

    const stage = isMonthEnd ? "monthend-" : "";

    return {
        id: `reminder-settlement-${stage}${memberPrefix(activeMemberId)}${currentMonth}`,
        type: "settlement_due",
        title,
        message,
        severity: exceeds ? "warning" : "info",
        actionLabel,
        actionType: "view_settlement",
        createdAt: new Date().toISOString(),
    };
}

/**
 * 7. Couple streak at risk: evening, active member checked in, partner hasn't.
 */
export function checkCoupleStreakRiskReminder(
    allCheckins: DailyCheckin[],
    members: HouseholdMember[],
    activeMemberId: string,
    currentHour?: number,
    todayStr?: string,
): AppReminder | null {
    if (members.length < 2) return null;

    const partner = members.find((m) => m.id !== activeMemberId);
    if (!partner) return null;

    const hour = currentHour !== undefined ? currentHour : getSingaporeDate().getHours();
    if (hour < 18) return null;

    const today = todayStr || sgToday();
    const activeCheckedIn = allCheckins.some(
        (c) => c.member_id === activeMemberId && c.checkin_date === today,
    );
    const partnerCheckedIn = allCheckins.some(
        (c) => c.member_id === partner.id && c.checkin_date === today,
    );
    if (!activeCheckedIn || partnerCheckedIn) return null;

    return {
        id: `reminder-couple-streak-risk-${activeMemberId}-${today}`,
        type: "couple_streak_risk",
        title: "Couple Streak at Risk",
        message: `${partner.display_name} hasn't checked in today.`,
        severity: "warning",
        actionLabel: "View Streak",
        actionType: "check_in",
        createdAt: new Date().toISOString(),
    };
}

/**
 * 8. Spendable categories nearing (>= warningPct) or over (>= 100%) cap.
 * One key per level per category per month.
 */
export function checkBudgetLimitReminders(
    monthlyBudgetDetail: MonthlyBudgetDetail,
    warningPct: number = 80,
    memberId?: string,
): AppReminder[] {
    const reminders: AppReminder[] = [];
    const month = monthlyBudgetDetail.budget.month;

    for (const c of monthlyBudgetDetail.categories) {
        if (!isSpendableCategory(c.category || c.category_id)) continue;
        const allocated = c.allocated_amount || 0;
        if (allocated <= 0) continue;

        const spent = c.actualSpent || 0;
        const percentage = (spent / allocated) * 100;
        const catName = c.category?.name || "Category";
        const base = {
            type: "budget_limit" as const,
            actionLabel: "View Budget",
            actionType: "view_budget" as const,
            data: { categoryId: c.category_id },
            createdAt: new Date().toISOString(),
        };

        if (percentage >= 100) {
            reminders.push({
                ...base,
                id: `reminder-budget-exceeded-${memberPrefix(memberId)}${c.category_id}-${month}`,
                title: `${catName} Over Budget`,
                message: `${formatSGD(spent - allocated)} over (${Math.round(percentage)}%)`,
                severity: "alert",
            });
        } else if (percentage >= warningPct) {
            reminders.push({
                ...base,
                id: `reminder-budget-nearing-${memberPrefix(memberId)}${c.category_id}-${month}`,
                title: `${catName} at ${Math.round(percentage)}%`,
                message: `${formatSGD(allocated - spent)} left`,
                severity: "warning",
            });
        }
    }

    return reminders;
}

/**
 * 9. Recurring items due soon, by due day (clamped to short months):
 * annual items within 30 days, monthly items within 3 days.
 */
export function checkRecurringBillsReminders(
    recurringItems: RecurringItem[],
    referenceDate?: Date,
    memberId?: string,
): AppReminder[] {
    const d = sgNow(referenceDate);
    const todayStr = formatISODate(d);
    const reminders: AppReminder[] = [];

    for (const p of recurringItems) {
        if (memberId && p.owner_id && p.owner_id !== memberId) continue;
        if (p.end_date && p.end_date < todayStr) continue;

        const dueDate = getNextDueDate(p, d);
        const days = getDaysUntilDue(p, d);
        if (!dueDate || days === null) continue;
        if (p.start_date && formatISODate(dueDate) < p.start_date) continue;

        const windowDays =
            p.frequency === "monthly" ? RECURRING_MONTHLY_REMINDER_DAYS : RECURRING_ANNUAL_REMINDER_DAYS;
        if (days > windowDays) continue;

        // "Due in 5 days" -> "Due in 5 Days"; annual items say "Renews" instead
        const dueLabel = formatDueInDays(days).replace(/\b(today|tomorrow|days)\b/, (w) =>
            w.charAt(0).toUpperCase() + w.slice(1),
        );
        const title =
            p.frequency === "monthly"
                ? `${p.name} ${dueLabel}`
                : `${p.name} ${dueLabel.replace(/^Due/, "Renews")}`;

        reminders.push({
            id: `reminder-recurring-${p.id}-${formatISODate(dueDate)}`,
            type: "recurring_bill_due",
            title,
            message: `${formatSGD(Number(p.amount))} ${p.type}`,
            severity: "info",
            actionLabel: "View Recurring",
            actionType: "view_recurring",
            data: { itemId: p.id, dueDate: formatISODate(dueDate) },
            createdAt: new Date().toISOString(),
        });
    }

    return reminders;
}

/**
 * 10. Savings goals behind pace (once a month) or achieved (once ever).
 * Shared across the household so both partners see them.
 */
export function checkGoalPacingReminders(
    goals: SavingsGoal[],
    referenceDate?: Date,
): AppReminder[] {
    const month = sgMonth(referenceDate);
    const reminders: AppReminder[] = [];

    for (const goal of goals) {
        const progress = `${formatSGD(goal.saved_so_far)} of ${formatSGD(goal.target_amount)}`;
        if (goal.status === "behind") {
            reminders.push({
                id: `reminder-goal-behind-${goal.id}-${month}`,
                type: "goal_pacing",
                title: `${goal.title} Behind Pace`,
                message: `${progress} saved`,
                severity: "warning",
                actionLabel: "View Goal",
                actionType: "view_goals",
                data: { goalId: goal.id },
                createdAt: new Date().toISOString(),
            });
        } else if (goal.status === "achieved") {
            reminders.push({
                id: `reminder-goal-achieved-${goal.id}`,
                type: "goal_pacing",
                title: `Goal Reached: ${goal.title}`,
                message: `${formatSGD(goal.target_amount)} saved`,
                severity: "info",
                actionLabel: "View Goal",
                actionType: "view_goals",
                data: { goalId: goal.id },
                createdAt: new Date().toISOString(),
            });
        }
    }

    return reminders;
}

/**
 * 11. Monthly budget not yet locked (days 1-5).
 */
export function checkMonthlyBudgetReviewReminder(
    monthlyBudgetDetail: MonthlyBudgetDetail,
    referenceDate?: Date,
    memberId?: string,
): AppReminder | null {
    if (sgNow(referenceDate).getDate() > 5 || monthlyBudgetDetail.budget.is_locked) return null;

    const month = monthlyBudgetDetail.budget.month;
    const shortMonth = formatShortMonth(month).split(" ")[0];

    return {
        id: `reminder-budget-review-${memberPrefix(memberId)}${month}`,
        type: "monthly_budget_review",
        title: `Review ${shortMonth} Budget`,
        message: "Lock in your allocations.",
        severity: "info",
        actionLabel: "Review",
        actionType: "view_budget",
        createdAt: new Date().toISOString(),
    };
}
