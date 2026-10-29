/**
 * Notification & Reminders Engine for Budget Bubby
 * 
 * Capabilities:
 * - Computes active reminders for:
 *   1. Daily Spend Check-in (streak & spend logging)
 *   2. Monthly Balance Update (account snapshots)
 *   3. Credit Card Payment Due (unpaid statement due within N days)
 *   4. Missing Credit Card Statement (card billing cycle closed without logged statement)
 *   5. Partner / Shared Spend (new shared spend logged by partner, settlement balance threshold, couple streak risk)
 *   6. Budget Limit Alerts (nearing/exceeded spendable category cap)
 *   7. Recurring Bills Due (insurance, tax, subscription renewals this month)
 *   8. Savings Goal Pacing (behind schedule or achieved)
 *   9. Monthly Budget Review (early month budget review prompt)
 * - Dispatches Service Worker PWA notifications when permitted
 * - Per-member preference filtering & persistent dismissal helpers
 */

import { financeService } from '../services/financeService';
import { getTodayDateString, getCurrentMonth, getSingaporeDate } from './dateUtils';
import { isSpendableCategory } from './financialFormulas';
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
  RecurringPolicy,
  SavingsGoal,
  NotificationPreferences,
} from '../types/finance';

export type ReminderType =
  | 'daily_checkin'
  | 'balance_update'
  | 'credit_card_due'
  | 'credit_card_missing_stmt'
  | 'partner_shared_spend'
  | 'settlement_due'
  | 'couple_streak_risk'
  | 'budget_limit'
  | 'recurring_bill_due'
  | 'goal_pacing'
  | 'monthly_budget_review';

export type ReminderActionType =
  | 'check_in'
  | 'update_balances'
  | 'view_cc'
  | 'view_expenses'
  | 'view_settlement'
  | 'view_budget'
  | 'view_recurring'
  | 'view_goals';

export interface AppReminder {
  id: string;
  type: ReminderType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'alert';
  actionLabel: string;
  actionType: ReminderActionType;
  data?: Record<string, unknown>;
  createdAt?: string;
}

// =============================================================================
// Dismissal Persistence Helpers
// =============================================================================

export function getDismissedReminderIds(memberId: string): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set();
  try {
    const stored = window.localStorage.getItem(`bb_notif_dismissed_${memberId}`);
    if (stored) return new Set(JSON.parse(stored));
  } catch {
    // ignore storage error
  }
  return new Set();
}

export function dismissReminderId(memberId: string, reminderId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = getDismissedReminderIds(memberId);
    current.add(reminderId);
    window.localStorage.setItem(`bb_notif_dismissed_${memberId}`, JSON.stringify(Array.from(current)));
  } catch {
    // ignore storage error
  }
}

export function clearDismissedReminders(memberId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(`bb_notif_dismissed_${memberId}`);
  } catch {
    // ignore storage error
  }
}

// =============================================================================
// Reminder Checker Functions
// =============================================================================

// In-flight concurrency lock to prevent double-firing in async execution / Strict Mode
const inFlightDispatches = new Set<string>();

export function clearInFlightDispatches(): void {
  inFlightDispatches.clear();
}

/**
 * 1. Checks if a daily spend check-in reminder should be issued nearing end of day (>= 18:00).
 */
export function checkDailyCheckinReminder(
  streak: StreakSummary,
  currentHour?: number,
  memberId?: string
): AppReminder | null {
  if (streak.checkedInToday) return null;

  const hour = currentHour !== undefined ? currentHour : getSingaporeDate().getHours();
  // Only trigger nearing end of day (>= 18:00) if not yet done
  if (hour < 18) return null;

  return {
    id: `reminder-daily-checkin-${memberId ? `${memberId}-` : ''}${getTodayDateString()}`,
    type: 'daily_checkin',
    title: 'Daily Spend Check-in (Evening)',
    message: "You haven't logged today's spend or checked in yet. Keep your streak alive tonight! 🔥",
    severity: 'warning',
    actionLabel: 'Check In Now',
    actionType: 'check_in',
    createdAt: new Date().toISOString(),
  };
}

/**
 * 2. Checks if account balance snapshots are due (1st or last 4 days of month).
 */
export function checkBalanceUpdateReminder(
  snapshots: AccountSnapshot[],
  referenceDate?: Date,
  memberId?: string
): AppReminder | null {
  const d = referenceDate || getSingaporeDate();
  const day = d.getDate();
  const currentMonth = referenceDate ? referenceDate.toISOString().slice(0, 7) : getCurrentMonth();
  
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const isFirstOrLastDays = day === 1 || day >= lastDay - 3;

  if (!isFirstOrLastDays) return null;

  const hasSnapshotThisMonth = snapshots.some((s) =>
    s.snapshot_date.startsWith(currentMonth)
  );

  if (hasSnapshotThisMonth) return null;

  return {
    id: `reminder-balance-update-${memberId ? `${memberId}-` : ''}${currentMonth}`,
    type: 'balance_update',
    title: 'Monthly Balance Update',
    message: `Account snapshots haven't been updated for ${currentMonth}. Update now to keep net worth accurate!`,
    severity: 'info',
    actionLabel: 'Update Balances',
    actionType: 'update_balances',
    createdAt: new Date().toISOString(),
  };
}

/**
 * 3. Checks for unpaid credit card statements due within N days (default 5).
 */
export function checkCreditCardDueReminders(
  statements: CreditCardStatement[],
  todayStr?: string,
  dueDaysBefore: number = 5,
  memberId?: string
): AppReminder[] {
  const today = todayStr || getTodayDateString();
  const todayMs = new Date(today + 'T12:00:00').getTime();
  const reminders: AppReminder[] = [];

  for (const stmt of statements) {
    if (stmt.is_paid || !stmt.due_date) continue;
    // Strict member scoping: if memberId is given and card has an owner, must match active user
    if (memberId && stmt.card?.owner_id && stmt.card.owner_id !== memberId) {
      continue;
    }

    const dueMs = new Date(stmt.due_date + 'T12:00:00').getTime();
    const diffDays = Math.ceil((dueMs - todayMs) / (1000 * 60 * 60 * 24));

    if (diffDays >= -1 && diffDays <= dueDaysBefore) {
      const dueLabel =
        diffDays === 0
          ? 'due today'
          : diffDays < 0
          ? 'past due'
          : `due in ${diffDays} day${diffDays === 1 ? '' : 's'}`;

      const cardName = stmt.card?.name || 'Credit card';
      const balanceStr = (stmt.statement_amount ?? 0).toFixed(2);

      reminders.push({
        id: `reminder-cc-due-${stmt.id}`,
        type: 'credit_card_due',
        title: 'Credit Card Payment Due',
        message: `${cardName} statement of SGD ${balanceStr} is ${dueLabel}!`,
        severity: diffDays <= 2 ? 'alert' : 'warning',
        actionLabel: 'View CC Bill',
        actionType: 'view_cc',
        data: {
          statementId: stmt.id,
          cardId: stmt.card_id,
          dueDate: stmt.due_date,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * 4. Checks for cards whose billing day has passed this month but have no statement logged yet.
 */
export function checkMissingCreditCardStatements(
  cards: CreditCard[],
  statements: CreditCardStatement[],
  referenceDate?: Date,
  memberId?: string
): AppReminder[] {
  const d = referenceDate || getSingaporeDate();
  const day = d.getDate();
  const currentMonth = referenceDate ? referenceDate.toISOString().slice(0, 7) : getCurrentMonth();
  const reminders: AppReminder[] = [];

  for (const card of cards) {
    if (!card.is_active) continue;
    // Strict member scoping: cards must belong to active user
    if (memberId && card.owner_id && card.owner_id !== memberId) {
      continue;
    }

    // Billing day has passed or is today in current month
    if (day >= card.billing_day) {
      const hasStatement = statements.some(
        (s) => s.card_id === card.id && s.month === currentMonth
      );

      if (!hasStatement) {
        reminders.push({
          id: `reminder-cc-missing-${card.id}-${currentMonth}`,
          type: 'credit_card_missing_stmt',
          title: 'Credit Card Statement Needed',
          message: `${card.name} cycle closed on day ${card.billing_day}. Log your ${currentMonth} statement amount!`,
          severity: 'info',
          actionLabel: 'Enter Statement',
          actionType: 'view_cc',
          data: {
            cardId: card.id,
            month: currentMonth,
          },
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return reminders;
}

/**
 * 5. Checks for unsettled shared expenses logged by the partner within the last 3 days.
 */
export function checkPartnerSharedSpendReminders(
  expenses: Expense[],
  members: HouseholdMember[],
  activeMemberId: string,
  todayStr?: string
): AppReminder[] {
  const today = todayStr || getTodayDateString();
  const todayMs = new Date(today + 'T12:00:00').getTime();
  const reminders: AppReminder[] = [];

  for (const exp of expenses) {
    if (!exp.is_shared || exp.settled || exp.payer_id === activeMemberId) continue;

    // Check if expense was incurred within the last 3 days
    const expMs = new Date(exp.date + 'T12:00:00').getTime();
    const diffDays = Math.round((todayMs - expMs) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 3) {
      const partner = members.find((m) => m.id === exp.payer_id);
      const partnerName = partner?.display_name || 'Partner';
      const yourShare = exp.amount * (1 - (exp.split_ratio ?? 0.5));

      reminders.push({
        id: `reminder-partner-spend-${activeMemberId}-${exp.id}`,
        type: 'partner_shared_spend',
        title: `${partnerName} Logged Shared Spend`,
        message: `${partnerName} paid SGD ${exp.amount.toFixed(2)} for ${exp.item} (your share: SGD ${yourShare.toFixed(2)}).`,
        severity: 'info',
        actionLabel: 'View Shared Spend',
        actionType: 'view_expenses',
        data: { expenseId: exp.id },
        createdAt: exp.created_at || new Date().toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * 6. Checks if running settlement balance exceeds threshold or month-end is approaching.
 * Notifies both members with directional context (debtor vs creditor).
 */
export function checkSettlementReminder(
  settlementSummary: SettlementSummary,
  thresholdSgd: number = 200,
  referenceDate?: Date,
  activeMemberId?: string
): AppReminder | null {
  if (settlementSummary.netBalance <= 0) return null;

  const d = referenceDate || getSingaporeDate();
  const isMonthEnd = d.getDate() >= 27;
  const exceeds = settlementSummary.netBalance >= thresholdSgd;

  if (!exceeds && !isMonthEnd) return null;

  const currentMonth = referenceDate ? referenceDate.toISOString().slice(0, 7) : getCurrentMonth();

  let message: string;
  let actionLabel: string = 'Settle Up';

  if (activeMemberId && settlementSummary.debtorId && activeMemberId === settlementSummary.debtorId) {
    const creditorName = settlementSummary.creditorName || 'your partner';
    message = `You owe ${creditorName} SGD ${settlementSummary.netBalance.toFixed(2)}. Time to settle up!`;
    actionLabel = 'Settle Up';
  } else if (activeMemberId && settlementSummary.creditorId && activeMemberId === settlementSummary.creditorId) {
    const debtorName = settlementSummary.debtorName || 'Your partner';
    message = `${debtorName} owes you SGD ${settlementSummary.netBalance.toFixed(2)}. Time to settle up!`;
    actionLabel = 'View Settlement';
  } else {
    message = `${settlementSummary.settlementText}. Net balance is SGD ${settlementSummary.netBalance.toFixed(2)}. Time to settle up!`;
  }

  return {
    id: `reminder-settlement-${activeMemberId ? `${activeMemberId}-` : ''}${currentMonth}-${Math.floor(settlementSummary.netBalance)}`,
    type: 'settlement_due',
    title: 'Shared Spend Settlement',
    message,
    severity: exceeds ? 'warning' : 'info',
    actionLabel,
    actionType: 'view_settlement',
    createdAt: new Date().toISOString(),
  };
}

/**
 * 7. Checks if the couple streak is at risk (evening reminder if active member checked in, but partner hasn't).
 */
export function checkCoupleStreakRiskReminder(
  allCheckins: DailyCheckin[],
  members: HouseholdMember[],
  activeMemberId: string,
  currentHour?: number,
  todayStr?: string
): AppReminder | null {
  if (members.length < 2) return null;

  const partner = members.find((m) => m.id !== activeMemberId);
  if (!partner) return null;

  const hour = currentHour !== undefined ? currentHour : getSingaporeDate().getHours();
  if (hour < 18) return null; // Only prompt in evening

  const today = todayStr || getTodayDateString();
  const activeCheckedIn = allCheckins.some(
    (c) => c.member_id === activeMemberId && c.checkin_date === today
  );
  const partnerCheckedIn = allCheckins.some(
    (c) => c.member_id === partner.id && c.checkin_date === today
  );

  if (activeCheckedIn && !partnerCheckedIn) {
    return {
      id: `reminder-couple-streak-risk-${activeMemberId}-${today}`,
      type: 'couple_streak_risk',
      title: 'Couple Streak At Risk! 🔥',
      message: `You've checked in today, but ${partner.display_name} hasn't yet! Nudge them before midnight to keep your couple streak alive.`,
      severity: 'warning',
      actionLabel: 'View Streak',
      actionType: 'check_in',
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * 8. Checks spendable budget categories nearing (>= warningPct) or exceeding (>= 100%) cap.
 */
export function checkBudgetLimitReminders(
  monthlyBudgetDetail: MonthlyBudgetDetail,
  warningPct: number = 80,
  memberId?: string
): AppReminder[] {
  const reminders: AppReminder[] = [];
  const month = monthlyBudgetDetail.budget.month;

  for (const c of monthlyBudgetDetail.categories) {
    if (!isSpendableCategory(c.category || c.category_id)) continue;
    const allocated = c.allocated_amount || 0;
    if (allocated <= 0) continue;

    const spent = c.actualSpent || 0;
    const percentage = (spent / allocated) * 100;
    const catName = c.category?.name || 'Category';

    if (percentage >= 100) {
      reminders.push({
        id: `reminder-budget-exceeded-${memberId ? `${memberId}-` : ''}${c.category_id}-${month}`,
        type: 'budget_limit',
        title: `${catName} Budget Exceeded!`,
        message: `${catName} has exceeded its cap (${Math.round(percentage)}% spent, SGD ${(spent - allocated).toFixed(2)} over).`,
        severity: 'alert',
        actionLabel: 'View Budget',
        actionType: 'view_budget',
        data: { categoryId: c.category_id },
        createdAt: new Date().toISOString(),
      });
    } else if (percentage >= warningPct) {
      reminders.push({
        id: `reminder-budget-nearing-${memberId ? `${memberId}-` : ''}${c.category_id}-${month}`,
        type: 'budget_limit',
        title: `${catName} Nearing Cap`,
        message: `${catName} is at ${Math.round(percentage)}% of cap (SGD ${(allocated - spent).toFixed(2)} left).`,
        severity: 'warning',
        actionLabel: 'View Budget',
        actionType: 'view_budget',
        data: { categoryId: c.category_id },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * 9. Checks for recurring annual insurance/tax/subscription policies due in the current month.
 */
export function checkRecurringBillsReminders(
  policies: RecurringPolicy[],
  referenceDate?: Date,
  memberId?: string
): AppReminder[] {
  const d = referenceDate || getSingaporeDate();
  const currentMonthNum = d.getMonth() + 1;
  const reminders: AppReminder[] = [];

  for (const p of policies) {
    // Strict member scoping: policies must belong to active user
    if (memberId && p.owner_id && p.owner_id !== memberId) {
      continue;
    }

    if (p.frequency === 'annually' && p.payment_month === currentMonthNum) {
      reminders.push({
        id: `reminder-recurring-${p.id}-${d.getFullYear()}-${currentMonthNum}`,
        type: 'recurring_bill_due',
        title: `Upcoming Renewal: ${p.name}`,
        message: `${p.name} (${p.type}) of SGD ${p.amount.toFixed(2)} is due this month.`,
        severity: 'info',
        actionLabel: 'View Policies',
        actionType: 'view_recurring',
        data: { policyId: p.id },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * 10. Checks savings goals pacing (behind schedule or achieved).
 * Shared across the household so both partners can celebrate or track progress.
 */
export function checkGoalPacingReminders(goals: SavingsGoal[]): AppReminder[] {
  const reminders: AppReminder[] = [];

  for (const goal of goals) {
    if (goal.status === 'behind') {
      reminders.push({
        id: `reminder-goal-behind-${goal.id}`,
        type: 'goal_pacing',
        title: `Goal Pacing Behind: ${goal.title}`,
        message: `${goal.emoji} ${goal.title} is behind target. Saved SGD ${goal.saved_so_far.toFixed(2)} of SGD ${goal.target_amount.toFixed(2)}.`,
        severity: 'warning',
        actionLabel: 'View Goal',
        actionType: 'view_goals',
        data: { goalId: goal.id },
        createdAt: new Date().toISOString(),
      });
    } else if (goal.status === 'achieved') {
      reminders.push({
        id: `reminder-goal-achieved-${goal.id}`,
        type: 'goal_pacing',
        title: `Goal Achieved! ${goal.emoji} ${goal.title}`,
        message: `Congratulations! You reached 100% of your SGD ${goal.target_amount.toFixed(2)} goal! 🎉`,
        severity: 'info',
        actionLabel: 'View Goal',
        actionType: 'view_goals',
        data: { goalId: goal.id },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * 11. Checks if current monthly budget has not been reviewed / locked yet (days 1-5).
 */
export function checkMonthlyBudgetReviewReminder(
  monthlyBudgetDetail: MonthlyBudgetDetail,
  referenceDate?: Date,
  memberId?: string
): AppReminder | null {
  const d = referenceDate || getSingaporeDate();
  if (d.getDate() > 5 || monthlyBudgetDetail.budget.is_locked) return null;

  const month = monthlyBudgetDetail.budget.month;

  return {
    id: `reminder-budget-review-${memberId ? `${memberId}-` : ''}${month}`,
    type: 'monthly_budget_review',
    title: 'Monthly Budget Review',
    message: `Plan your spending for ${month}! Review category allocations and lock in your targets.`,
    severity: 'info',
    actionLabel: 'Review Budget',
    actionType: 'view_budget',
    createdAt: new Date().toISOString(),
  };
}

// =============================================================================
// Core Notification Computing & Dispatching Engine
// =============================================================================

export interface ComputeRemindersOptions {
  memberId?: string;
  currentHour?: number;
  referenceDate?: Date;
}

/**
 * Computes all active in-app reminders based on current financial data and user preferences.
 */
export async function computeActiveReminders(
  options?: ComputeRemindersOptions
): Promise<AppReminder[]> {
  try {
    const memberId = options?.memberId || 'mem-00000000-0011';
    const currentMonth = options?.referenceDate
      ? options.referenceDate.toISOString().slice(0, 7)
      : getCurrentMonth();
    const todayStr = options?.referenceDate
      ? options.referenceDate.toISOString().slice(0, 10)
      : undefined;

    // Concurrently fetch financial data and member notification preferences
    const [
      prefs,
      streak,
      snapshots,
      statements,
      cards,
      overview,
      expenses,
      policies,
      goals,
      allCheckins,
      monthlyBudget,
    ] = await Promise.all([
      financeService.getNotificationPreferences(memberId),
      financeService.getStreakSummary(memberId),
      financeService.getAllAccountSnapshots(memberId),
      financeService.getCreditCardStatements(),
      financeService.getCreditCards(),
      financeService.getHouseholdOverview(),
      financeService.getExpenses(),
      financeService.getPolicies(),
      financeService.getGoals(),
      financeService.getDailyCheckins(),
      financeService.getMonthlyBudget(currentMonth, memberId),
    ]);

    const dismissedIds = getDismissedReminderIds(memberId);
    const reminders: AppReminder[] = [];

    // 1. Daily Spend Check-in
    if (prefs.streak_and_logging) {
      const dailyReminder = checkDailyCheckinReminder(streak, options?.currentHour, memberId);
      if (dailyReminder && !dismissedIds.has(dailyReminder.id)) {
        reminders.push(dailyReminder);
      }
    }

    // 2. Monthly Balance Update
    if (prefs.monthly_balance_updates) {
      const balanceReminder = checkBalanceUpdateReminder(snapshots, options?.referenceDate, memberId);
      if (balanceReminder && !dismissedIds.has(balanceReminder.id)) {
        reminders.push(balanceReminder);
      }
    }

    // 3. Credit Card Payment Due
    if (prefs.cc_payment_due) {
      const ccReminders = checkCreditCardDueReminders(
        statements,
        todayStr,
        prefs.cc_due_days_before || 5,
        memberId
      );
      for (const r of ccReminders) {
        if (!dismissedIds.has(r.id)) reminders.push(r);
      }
    }

    // 4. Missing Credit Card Statement
    if (prefs.cc_missing_statement) {
      const missingCcReminders = checkMissingCreditCardStatements(
        cards,
        statements,
        options?.referenceDate,
        memberId
      );
      for (const r of missingCcReminders) {
        if (!dismissedIds.has(r.id)) reminders.push(r);
      }
    }

    // 5. Partner / Shared Spend Reminders
    if (prefs.partner_shared_spend) {
      const members = overview.members || [];
      const sharedSpendReminders = checkPartnerSharedSpendReminders(
        expenses,
        members,
        memberId,
        todayStr
      );
      for (const r of sharedSpendReminders) {
        if (!dismissedIds.has(r.id)) reminders.push(r);
      }

      const settlementReminder = checkSettlementReminder(
        overview.settlementSummary,
        prefs.settlement_threshold_sgd || 200,
        options?.referenceDate,
        memberId
      );
      if (settlementReminder && !dismissedIds.has(settlementReminder.id)) {
        reminders.push(settlementReminder);
      }

      const coupleStreakRisk = checkCoupleStreakRiskReminder(
        allCheckins,
        members,
        memberId,
        options?.currentHour,
        todayStr
      );
      if (coupleStreakRisk && !dismissedIds.has(coupleStreakRisk.id)) {
        reminders.push(coupleStreakRisk);
      }
    }

    // 6. Budget Limit Warnings & Exceeded
    if (prefs.budget_limit_alerts) {
      const budgetReminders = checkBudgetLimitReminders(
        monthlyBudget,
        prefs.budget_warning_pct || 80,
        memberId
      );
      for (const r of budgetReminders) {
        if (!dismissedIds.has(r.id)) reminders.push(r);
      }
    }

    // 7. Recurring Bills & Renewals Due
    if (prefs.recurring_bills_due) {
      const billReminders = checkRecurringBillsReminders(policies, options?.referenceDate, memberId);
      for (const r of billReminders) {
        if (!dismissedIds.has(r.id)) reminders.push(r);
      }
    }

    // 8. Savings Goal Pacing & Achievements
    if (prefs.goal_pacing_alerts) {
      const goalReminders = checkGoalPacingReminders(goals);
      for (const r of goalReminders) {
        if (!dismissedIds.has(r.id)) reminders.push(r);
      }
    }

    // 9. Monthly Budget Review
    if (prefs.monthly_budget_review) {
      const reviewReminder = checkMonthlyBudgetReviewReminder(monthlyBudget, options?.referenceDate, memberId);
      if (reviewReminder && !dismissedIds.has(reviewReminder.id)) {
        reminders.push(reviewReminder);
      }
    }

    return reminders;
  } catch (err) {
    console.error('Failed to compute active reminders:', err);
    return [];
  }
}

/**
 * Requests browser notification permission.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.debug('Failed to request notification permission:', err);
    return 'denied';
  }
}

/**
 * Checks if first-launch permission request is needed and prompts user.
 */
export async function checkAndPromptInitialNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  try {
    const hasPrompted = window.localStorage.getItem('bb_notif_initial_prompted');
    if (!hasPrompted) {
      window.localStorage.setItem('bb_notif_initial_prompted', 'true');
      if (Notification.permission === 'default') {
        return await requestNotificationPermission();
      }
    }
  } catch {
    // ignore storage or permission error
  }
  return Notification.permission;
}

/**
 * Dispatches a native PWA Service Worker notification when permitted.
 */
export async function dispatchPWANotification(
  title: string,
  options?: NotificationOptions
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.showNotification) {
        await registration.showNotification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          ...options,
        });
        return true;
      }
    }

    // Fallback to Window Notification
    new Notification(title, options);
    return true;
  } catch (err) {
    console.debug('Error dispatching notification:', err);
    return false;
  }
}

/**
 * Checks reminders and dispatches Service Worker PWA notifications for unread reminders,
 * respecting user push notification preferences.
 */
export async function evaluateAndDispatchReminders(options?: ComputeRemindersOptions): Promise<AppReminder[]> {
  const memberId = options?.memberId || 'mem-00000000-0011';
  let prefs: NotificationPreferences;
  try {
    prefs = await financeService.getNotificationPreferences(memberId);
  } catch {
    prefs = {
      household_id: 'hh-00000000-0001',
      member_id: memberId,
      push_enabled: true,
      sound_enabled: true,
      haptics_enabled: true,
      cc_payment_due: true,
      cc_missing_statement: true,
      streak_and_logging: true,
      monthly_balance_updates: true,
      partner_shared_spend: true,
      budget_limit_alerts: true,
      recurring_bills_due: true,
      goal_pacing_alerts: true,
      monthly_budget_review: true,
      cc_due_days_before: 5,
      budget_warning_pct: 80,
      settlement_threshold_sgd: 200,
    };
  }

  const reminders = await computeActiveReminders(options);

  if (
    prefs.push_enabled &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    for (const reminder of reminders) {
      const sessionKey = `bb_notif_dispatched_${memberId}_${reminder.id}`;
      if (inFlightDispatches.has(sessionKey) || window.sessionStorage.getItem(sessionKey)) {
        continue;
      }
      // Immediately claim lock and record in sessionStorage before awaiting async dispatch
      inFlightDispatches.add(sessionKey);
      window.sessionStorage.setItem(sessionKey, '1');
      try {
        await dispatchPWANotification(reminder.title, {
          body: reminder.message,
          tag: `${memberId}-${reminder.id}`,
        });
      } catch (err) {
        console.debug('Failed to dispatch notification:', err);
      } finally {
        inFlightDispatches.delete(sessionKey);
      }
    }
  }

  return reminders;
}
