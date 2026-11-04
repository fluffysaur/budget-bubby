/**
 * Reminder engine: fetches a member's data from a data source and runs the
 * rules. Has no dependency on the browser or the app's service singleton, so
 * the server-side send-reminders bundle can use it too.
 */

import { getCurrentMonth, formatISODate, formatMonth } from "../dateUtils";
import {
    checkDailyCheckinReminder,
    checkBalanceUpdateReminder,
    checkCreditCardDueReminders,
    checkMissingCreditCardStatements,
    checkPartnerSharedSpendReminders,
    checkSettlementReminder,
    checkCoupleStreakRiskReminder,
    checkBudgetLimitReminders,
    checkRecurringBillsReminders,
    checkGoalPacingReminders,
    checkMonthlyBudgetReviewReminder,
    DEFAULT_CC_DUE_REMINDER_DAYS,
    type AppReminder,
} from "./rules";
import type { NotificationPreferences } from "../../types/finance";
import type { FinanceService } from "../../services/financeService";

/** The finance service reads the reminder engine needs. */
export type ReminderDataSource = Pick<
    FinanceService,
    | "getNotificationPreferences"
    | "getNotificationLog"
    | "getStreakSummary"
    | "getAllAccountSnapshots"
    | "getCreditCardStatements"
    | "getCreditCards"
    | "getHouseholdOverview"
    | "getExpenses"
    | "getRecurringItems"
    | "getGoals"
    | "getDailyCheckins"
    | "getMonthlyBudget"
>;

/**
 * App path a reminder opens, from the bell or a tapped push.
 */
export function getReminderUrl(reminder: AppReminder): string {
    switch (reminder.actionType) {
        case "update_balances":
            return "/accounts";
        case "view_cc":
        case "view_expenses":
            return "/expenses";
        case "view_budget":
            return "/budget";
        case "view_recurring":
            return "/recurring";
        case "view_goals": {
            const goalId = reminder.data?.goalId;
            return typeof goalId === "string"
                ? `/goals?goalId=${encodeURIComponent(goalId)}`
                : "/goals";
        }
        case "check_in":
        case "view_settlement":
        default:
            return "/";
    }
}

/**
 * CC due reminder offsets. Rows saved before cc_due_reminder_days existed
 * fall back to the legacy single lead time.
 */
export function getCcDueReminderDays(prefs: NotificationPreferences): number[] {
    if (Array.isArray(prefs.cc_due_reminder_days))
        return prefs.cc_due_reminder_days;
    if (prefs.cc_due_days_before) return [prefs.cc_due_days_before];
    return DEFAULT_CC_DUE_REMINDER_DAYS;
}

export interface ComputeRemindersOptions {
    memberId?: string;
    currentHour?: number;
    referenceDate?: Date;
}

/**
 * Computes all active, non-dismissed reminders for a member from any data
 * source: the app's finance service in the browser, or the Supabase service
 * with a server client in the send-reminders function. Throws on fetch errors.
 */
export async function computeRemindersFrom(
    source: ReminderDataSource,
    options?: ComputeRemindersOptions,
): Promise<AppReminder[]> {
    const memberId = options?.memberId || "mem-00000000-0011";
    const referenceDate = options?.referenceDate;
    const currentMonth = referenceDate
        ? formatMonth(referenceDate)
        : getCurrentMonth();
    const todayStr = referenceDate ? formatISODate(referenceDate) : undefined;

    const [
        prefs,
        log,
        streak,
        snapshots,
        statements,
        cards,
        overview,
        expenses,
        recurringItems,
        goals,
        allCheckins,
        monthlyBudget,
    ] = await Promise.all([
        source.getNotificationPreferences(memberId),
        source.getNotificationLog(memberId),
        source.getStreakSummary(memberId),
        source.getAllAccountSnapshots(memberId),
        source.getCreditCardStatements(),
        source.getCreditCards(),
        source.getHouseholdOverview(),
        source.getExpenses(),
        source.getRecurringItems(),
        source.getGoals(),
        source.getDailyCheckins(),
        source.getMonthlyBudget(currentMonth, memberId),
    ]);

    const members = overview.members || [];
    const candidates: (AppReminder | null)[] = [];
    const ccDueDays = getCcDueReminderDays(prefs);

    if (prefs.streak_and_logging) {
        candidates.push(
            checkDailyCheckinReminder(
                streak,
                options?.currentHour,
                memberId,
                todayStr,
                prefs.checkin_time,
            ),
        );
    }

    if (prefs.monthly_balance_updates) {
        candidates.push(
            checkBalanceUpdateReminder(snapshots, referenceDate, memberId),
        );
    }

    if (prefs.cc_payment_due) {
        candidates.push(
            ...checkCreditCardDueReminders(
                statements,
                todayStr,
                ccDueDays,
                memberId,
            ),
        );
    }

    if (prefs.cc_missing_statement) {
        candidates.push(
            ...checkMissingCreditCardStatements(
                cards,
                statements,
                referenceDate,
                memberId,
            ),
        );
    }

    if (prefs.partner_shared_spend) {
        candidates.push(
            ...checkPartnerSharedSpendReminders(
                expenses,
                members,
                memberId,
                todayStr,
            ),
            checkSettlementReminder(
                overview.settlementSummary,
                prefs.settlement_threshold_sgd || 200,
                referenceDate,
                memberId,
            ),
            checkCoupleStreakRiskReminder(
                allCheckins,
                members,
                memberId,
                options?.currentHour,
                todayStr,
                prefs.checkin_time,
            ),
        );
    }

    if (prefs.budget_limit_alerts) {
        candidates.push(
            ...checkBudgetLimitReminders(
                monthlyBudget,
                prefs.budget_warning_pct || 80,
                memberId,
            ),
        );
    }

    if (prefs.recurring_bills_due) {
        candidates.push(
            ...checkRecurringBillsReminders(
                recurringItems,
                referenceDate,
                memberId,
            ),
        );
    }

    if (prefs.goal_pacing_alerts) {
        candidates.push(...checkGoalPacingReminders(goals, referenceDate));
    }

    if (prefs.monthly_budget_review) {
        candidates.push(
            checkMonthlyBudgetReviewReminder(
                monthlyBudget,
                referenceDate,
                memberId,
            ),
        );
    }

    const dismissed = new Set(
        log
            .filter((entry) => entry.dismissed_at)
            .map((entry) => entry.reminder_key),
    );
    return candidates.filter(
        (r): r is AppReminder => r !== null && !dismissed.has(r.id),
    );
}
