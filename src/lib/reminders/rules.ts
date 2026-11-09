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
    clampDueDay,
} from "../dateUtils";
import { formatSGD } from "../currency";
import { isSpendableCategory } from "../financialFormulas";
import { getUnpaidCardCycles } from "../creditCardCycles";
import { collectFeedEvents } from "../bubby/sources";
import { deriveCondition, type BubbyMood } from "../bubby/body";
import type {
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
    InboxSummary,
} from "../../types/finance";

export type ReminderType =
    | "daily_checkin"
    | "balance_update"
    | "credit_card_due"
    | "credit_card_missing_stmt"
    | "partner_shared_spend"
    | "settlement_due"
    | "budget_limit"
    | "recurring_bill_due"
    | "goal_pacing"
    | "monthly_budget_review"
    | "inbox_pending";

export type ReminderActionType =
    | "check_in"
    | "update_balances"
    | "view_cc"
    | "view_expenses"
    | "view_settlement"
    | "view_budget"
    | "view_recurring"
    | "view_goals"
    | "view_inbox";

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

/** Default reminder timing ("HH:MM", Singapore time). */
export const DEFAULT_CHECKIN_TIME = "18:00";
export const DEFAULT_QUIET_HOURS_START = "22:00";
export const DEFAULT_QUIET_HOURS_END = "08:00";
/** Default CC due reminder offsets in days before due (0 = due day). */
export const DEFAULT_CC_DUE_REMINDER_DAYS = [7, 3, 1, 0];

/** "HH:MM" (or "HH:MM:SS") to minutes after midnight. Invalid input returns null. */
export function timeToMinutes(time: string | undefined | null): number | null {
    const match = time?.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
}

/**
 * Minutes after midnight in Singapore time. A given `currentHour` is
 * treated as the start of that hour.
 */
export function currentMinutes(
    currentHour?: number,
    referenceDate?: Date,
): number {
    if (currentHour !== undefined) return currentHour * 60;
    const d = sgNow(referenceDate);
    return d.getHours() * 60 + d.getMinutes();
}

/** True when `minutes` falls in [start, end), wrapping past midnight. */
export function isWithinQuietHours(
    minutes: number,
    start: string = DEFAULT_QUIET_HOURS_START,
    end: string = DEFAULT_QUIET_HOURS_END,
): boolean {
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    if (startMin === null || endMin === null || startMin === endMin)
        return false;
    if (startMin < endMin) return minutes >= startMin && minutes < endMin;
    return minutes >= startMin || minutes < endMin;
}

function isPastCheckinTime(
    currentHour: number | undefined,
    checkinTime: string,
): boolean {
    const target =
        timeToMinutes(checkinTime) ??
        (timeToMinutes(DEFAULT_CHECKIN_TIME) as number);
    return currentMinutes(currentHour) >= target;
}

function sgNow(referenceDate?: Date | string): Date {
    if (!referenceDate) return getSingaporeDate();
    if (typeof referenceDate === "string") {
        const isoString = referenceDate.includes("T")
            ? referenceDate
            : `${referenceDate}T12:00:00+08:00`;
        const parsed = new Date(isoString);
        if (isNaN(parsed.getTime())) return new Date(referenceDate);
        const sgTimeString = parsed.toLocaleString("en-US", {
            timeZone: "Asia/Singapore",
        });
        return new Date(sgTimeString);
    }
    return referenceDate;
}

function sgToday(referenceDate?: Date | string): string {
    return formatISODate(sgNow(referenceDate));
}

function sgMonth(referenceDate?: Date | string): string {
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

/** Bubby's gentle lines, by visual mood (never a mood word). */
export const BUBBY_REMINDER_LINES: Record<
    Exclude<BubbyMood, "normal">,
    string
> = {
    rumbly: "Bubby's tummy is rumbling 🐧",
    teary: "Bubby's eyes are a little watery 🐧",
    missyou: "Bubby misses you 🐧",
};

/**
 * 1. Bubby nudge: from the member's check-in time (default 18:00), once a
 * day, only while Bubby looks hungry (3+ days since anyone in the household
 * logged). Never sent while Bubby is normal. With items waiting in the
 * inbox, the line points there instead.
 */
export function checkBubbyReminder(
    allCheckins: DailyCheckin[],
    expenses: Expense[],
    currentHour?: number,
    memberId?: string,
    todayStr?: string,
    checkinTime: string = DEFAULT_CHECKIN_TIME,
    inboxPending = 0,
): AppReminder | null {
    if (!isPastCheckinTime(currentHour, checkinTime)) return null;

    const today = todayStr || sgToday();
    const events = collectFeedEvents({
        checkins: allCheckins,
        expenses,
        snapshots: [],
        bonusEvents: [],
        store: {},
    });
    const { mood } = deriveCondition(events, today);
    if (mood === "normal") return null;

    return {
        id: `reminder-daily-checkin-${memberPrefix(memberId)}${today}`,
        type: "daily_checkin",
        title: "Bubby",
        message:
            inboxPending > 0
                ? `${inboxPending} to sort — Bubby's waiting 🐧`
                : BUBBY_REMINDER_LINES[mood],
        severity: "info",
        actionLabel: inboxPending > 0 ? "Sort Inbox" : "Add Expense",
        actionType: "check_in",
        createdAt: new Date().toISOString(),
    };
}

/** Oldest pending item older than this makes the inbox nudge a warning. */
export const INBOX_STALE_DAYS = 3;

/**
 * 1b. Inbox has captured purchases to sort, from the check-in time. Shows
 * totals only (no merchant names) for lock-screen privacy.
 */
export function checkInboxReminder(
    summary: InboxSummary | null | undefined,
    currentHour?: number,
    memberId?: string,
    todayStr?: string,
    checkinTime: string = DEFAULT_CHECKIN_TIME,
    referenceDate?: Date,
): AppReminder | null {
    if (!summary?.available || summary.pendingCount <= 0) return null;
    if (!isPastCheckinTime(currentHour, checkinTime)) return null;

    const today = todayStr || sgToday();
    const count = summary.pendingCount;
    const oldestMs = summary.oldestCapturedAt
        ? new Date(summary.oldestCapturedAt).getTime()
        : NaN;
    const nowMs = (referenceDate ?? new Date()).getTime();
    const isStale =
        !Number.isNaN(oldestMs) && nowMs - oldestMs > INBOX_STALE_DAYS * DAY_MS;

    return {
        id: `reminder-inbox-${memberPrefix(memberId)}${today}`,
        type: "inbox_pending",
        title:
            count === 1 ? "1 Purchase to Sort" : `${count} Purchases to Sort`,
        message: `${formatSGD(summary.pendingTotalSgd)} waiting.`,
        severity: isStale ? "warning" : "info",
        actionLabel: "Sort Now",
        actionType: "view_inbox",
        data: { pendingCount: count },
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

    if (snapshots.some((s) => s.snapshot_date.startsWith(currentMonth)))
        return null;

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
export function getDueStage(
    daysUntilDue: number,
    offsets: number[],
): string | null {
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
    const offsets = Array.isArray(dueDaysBefore)
        ? dueDaysBefore
        : [dueDaysBefore];
    const reminders: AppReminder[] = [];

    for (const stmt of statements) {
        if (stmt.is_paid || !stmt.due_date) continue;
        // Card owner only
        if (memberId && stmt.card?.owner_id && stmt.card.owner_id !== memberId)
            continue;

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
 * 3b. Computed card cycles with no logged statement. Same stages as
 * checkCreditCardDueReminders, but driven by card config so nothing needs
 * to be pre-logged.
 */
export function checkPendingCreditCardDueReminders(
    cards: CreditCard[],
    statements: CreditCardStatement[],
    todayStr?: string,
    dueDaysBefore: number | number[] = 5,
    memberId?: string,
): AppReminder[] {
    const today = todayStr || sgToday();
    const offsets = Array.isArray(dueDaysBefore)
        ? dueDaysBefore
        : [dueDaysBefore];
    const reminders: AppReminder[] = [];

    for (const cycle of getUnpaidCardCycles(
        cards,
        statements,
        today,
        memberId,
    )) {
        if (cycle.status !== "pending") continue;
        const days = cycle.daysUntilDue;
        if (days < -1) continue;
        const stage = getDueStage(days, offsets);
        if (!stage) continue;

        reminders.push({
            id: `reminder-cc-due-${cycle.card.id}-${cycle.month}-${stage}`,
            type: "credit_card_due",
            title: ccDueTitle(cycle.card.name, days),
            message: "Statement pending",
            severity: days <= 2 ? "alert" : "warning",
            actionLabel: "Mark Paid",
            actionType: "view_cc",
            data: {
                cardId: cycle.card.id,
                month: cycle.month,
                dueDate: cycle.dueDate,
                daysUntilDue: days,
            },
            createdAt: new Date().toISOString(),
        });
    }

    return reminders;
}

/**
 * 4. "Statement Ready": cards whose billing day has passed this month with no
 * statement logged yet. The bill can be marked paid without logging it first.
 */
export function checkMissingCreditCardStatements(
    cards: CreditCard[],
    statements: CreditCardStatement[],
    referenceDate?: Date | string,
    memberId?: string,
): AppReminder[] {
    const now = sgNow(referenceDate);
    const day = now.getDate();
    const currentMonth = sgMonth(now);
    const reminders: AppReminder[] = [];

    for (const card of cards) {
        if (!card.is_active) continue;
        if (memberId && card.owner_id && card.owner_id !== memberId) continue;
        const effectiveBillingDay = clampDueDay(
            card.billing_day,
            now.getFullYear(),
            now.getMonth() + 1,
        );
        if (day < effectiveBillingDay) continue;

        const hasStatement = statements.some(
            (s) => s.card_id === card.id && s.month === currentMonth,
        );
        if (hasStatement) continue;

        reminders.push({
            id: `reminder-cc-missing-${card.id}-${currentMonth}`,
            type: "credit_card_missing_stmt",
            title: `${card.name} Statement Ready`,
            message: `Cycle closed on day ${effectiveBillingDay}.`,
            severity: "info",
            actionLabel: "View Bill",
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
        if (!exp.is_shared || exp.settled || exp.payer_id === activeMemberId)
            continue;
        const age = daysBetween(exp.date, today);
        if (age < 0 || age > 3) continue;
        const list = byPayer.get(exp.payer_id) ?? [];
        list.push(exp);
        byPayer.set(exp.payer_id, list);
    }

    const reminders: AppReminder[] = [];
    for (const [payerId, list] of byPayer) {
        const partnerName =
            members.find((m) => m.id === payerId)?.display_name || "Partner";
        const yourShare = list.reduce(
            (sum, exp) => sum + exp.amount * (1 - (exp.split_ratio ?? 0.5)),
            0,
        );
        const latest = list.reduce((a, b) =>
            (a.created_at || "") >= (b.created_at || "") ? a : b,
        );

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
    } else if (
        activeMemberId &&
        activeMemberId === settlementSummary.creditorId
    ) {
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
            p.frequency === "monthly"
                ? RECURRING_MONTHLY_REMINDER_DAYS
                : RECURRING_ANNUAL_REMINDER_DAYS;
        if (days > windowDays) continue;

        // "Due in 5 days" -> "Due in 5 Days"; annual items say "Renews" instead
        const dueLabel = formatDueInDays(days).replace(
            /\b(today|tomorrow|days)\b/,
            (w) => w.charAt(0).toUpperCase() + w.slice(1),
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
    if (
        sgNow(referenceDate).getDate() > 5 ||
        monthlyBudgetDetail.budget.is_locked
    )
        return null;

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
