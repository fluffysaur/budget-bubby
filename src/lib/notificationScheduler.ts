/**
 * Notification & Reminders Engine for Budget Bubby
 * 
 * Capabilities:
 * - Computes active reminders for:
 *   1. Daily Spend Check-in (evening reminder if user hasn't logged spend or checked in today)
 *   2. Monthly Balance Update (1st and last days of month if account snapshots haven't been updated this month)
 *   3. Credit Card Payment Due (alerts user when unpaid CC statement is due within 5 days)
 * - Dispatches Service Worker PWA notifications (registration.showNotification) when permitted
 * - Provides query and dismissal helpers for UI components
 */

import { financeService } from '../services/financeService';
import { getTodayDateString, getCurrentMonth, getSingaporeDate } from './dateUtils';
import type { StreakSummary, AccountSnapshot, CreditCardStatement } from '../types/finance';

export type ReminderType = 'daily_checkin' | 'balance_update' | 'credit_card_due';
export type ReminderActionType = 'check_in' | 'update_balances' | 'view_cc';

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

/**
 * Checks if a daily spend check-in reminder should be issued.
 * Triggers if the user hasn't checked in or logged expenses today.
 * If currentHour >= 18, it's flagged as an evening reminder.
 */
export function checkDailyCheckinReminder(
  streak: StreakSummary,
  currentHour?: number
): AppReminder | null {
  if (streak.checkedInToday) return null;

  const hour = currentHour !== undefined ? currentHour : getSingaporeDate().getHours();
  const isEvening = hour >= 18;

  return {
    id: `reminder-daily-checkin-${getTodayDateString()}`,
    type: 'daily_checkin',
    title: isEvening ? 'Daily Spend Check-in (Evening)' : 'Daily Spend Check-in',
    message: isEvening
      ? "You haven't logged today's spend or checked in yet. Keep your streak alive tonight! 🔥"
      : "You haven't checked in or logged today's spend yet. Keep your streak going! 🔥",
    severity: 'warning',
    actionLabel: 'Check In Now',
    actionType: 'check_in',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Checks if account balance snapshots are due.
 * Triggers on the 1st or last 4 days of the month (>= 28th) if no snapshot exists for current month.
 */
export function checkBalanceUpdateReminder(
  snapshots: AccountSnapshot[],
  referenceDate?: Date
): AppReminder | null {
  const d = referenceDate || getSingaporeDate();
  const day = d.getDate();
  const currentMonth = getCurrentMonth();
  
  // Calculate last day of this month
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const isFirstOrLastDays = day === 1 || day >= lastDay - 3;

  if (!isFirstOrLastDays) return null;

  // Check if any account snapshot exists for the current month
  const hasSnapshotThisMonth = snapshots.some((s) =>
    s.snapshot_date.startsWith(currentMonth)
  );

  if (hasSnapshotThisMonth) return null;

  return {
    id: `reminder-balance-update-${currentMonth}`,
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
 * Checks for unpaid credit card statements due within 5 days.
 */
export function checkCreditCardDueReminders(
  statements: CreditCardStatement[],
  todayStr?: string
): AppReminder[] {
  const today = todayStr || getTodayDateString();
  const todayMs = new Date(today + 'T12:00:00').getTime();
  const reminders: AppReminder[] = [];

  for (const stmt of statements) {
    if (stmt.is_paid || !stmt.due_date) continue;

    const dueMs = new Date(stmt.due_date + 'T12:00:00').getTime();
    const diffDays = Math.ceil((dueMs - todayMs) / (1000 * 60 * 60 * 24));

    // Due within 5 days (including today or past due up to -1)
    if (diffDays >= -1 && diffDays <= 5) {
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
 * Computes all active in-app reminders based on current financial data.
 */
export async function computeActiveReminders(options?: {
  memberId?: string;
  currentHour?: number;
  referenceDate?: Date;
}): Promise<AppReminder[]> {
  try {
    const [streak, snapshots, statements] = await Promise.all([
      financeService.getStreakSummary(options?.memberId),
      financeService.getAllAccountSnapshots('household'),
      financeService.getCreditCardStatements(),
    ]);

    const reminders: AppReminder[] = [];

    // 1. Daily Spend Check-in
    const dailyReminder = checkDailyCheckinReminder(streak, options?.currentHour);
    if (dailyReminder) reminders.push(dailyReminder);

    // 2. Monthly Balance Update
    const balanceReminder = checkBalanceUpdateReminder(snapshots, options?.referenceDate);
    if (balanceReminder) reminders.push(balanceReminder);

    // 3. Credit Card Payment Due
    const todayStr = options?.referenceDate
      ? options.referenceDate.toISOString().slice(0, 10)
      : undefined;
    const ccReminders = checkCreditCardDueReminders(statements, todayStr);
    reminders.push(...ccReminders);

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
 * Checks reminders and dispatches Service Worker PWA notifications for unread reminders.
 */
export async function evaluateAndDispatchReminders(options?: {
  memberId?: string;
  currentHour?: number;
}): Promise<AppReminder[]> {
  const reminders = await computeActiveReminders(options);

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    for (const reminder of reminders) {
      const sessionKey = `bb_notif_dispatched_${reminder.id}`;
      if (!window.sessionStorage.getItem(sessionKey)) {
        await dispatchPWANotification(reminder.title, {
          body: reminder.message,
          tag: reminder.id,
        });
        window.sessionStorage.setItem(sessionKey, '1');
      }
    }
  }

  return reminders;
}
