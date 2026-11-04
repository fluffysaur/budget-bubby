/**
 * Notification & Reminders Engine for Budget Bubby
 *
 * - Reminder rules live in `./reminders/rules` (pure, reusable).
 * - This module fetches data, filters by member preferences and the
 *   notification log, and dispatches PWA notifications.
 * - Each reminder id is pushed at most once: the send is claimed in the
 *   notification log (Supabase, shared across devices) before dispatching.
 */

import { financeService } from "../services/financeService";
import { getCurrentMonth, formatISODate, formatMonth } from "./dateUtils";
import { getDefaultNotificationPreferences } from "../data/mockSeedData";
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
    currentMinutes,
    isWithinQuietHours,
    DEFAULT_CC_DUE_REMINDER_DAYS,
    type AppReminder,
} from "./reminders/rules";
import type { NotificationPreferences } from "../types/finance";

export * from "./reminders/rules";

// =============================================================================
// Legacy device-local dismissals (pre notification_log). Read once to migrate.
// =============================================================================

export function getDismissedReminderIds(memberId: string): Set<string> {
    if (typeof window === "undefined" || !window.localStorage) return new Set();
    try {
        const stored = window.localStorage.getItem(`bb_notif_dismissed_${memberId}`);
        if (stored) return new Set(JSON.parse(stored));
    } catch {
        // ignore storage error
    }
    return new Set();
}

export function clearDismissedReminders(memberId: string): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
        window.localStorage.removeItem(`bb_notif_dismissed_${memberId}`);
    } catch {
        // ignore storage error
    }
}

/**
 * Moves legacy localStorage dismissals into the notification log, then
 * removes the legacy key. Best effort.
 */
export async function migrateLegacyDismissals(memberId: string): Promise<void> {
    const legacy = getDismissedReminderIds(memberId);
    if (legacy.size === 0) return;
    try {
        for (const key of legacy) {
            await financeService.dismissNotification(memberId, { key, type: "legacy" });
        }
        clearDismissedReminders(memberId);
    } catch (err) {
        console.debug("Failed to migrate legacy dismissals:", err);
    }
}

// =============================================================================
// Core Notification Computing & Dispatching Engine
// =============================================================================

/**
 * CC due reminder offsets. Rows saved before cc_due_reminder_days existed
 * fall back to the legacy single lead time.
 */
export function getCcDueReminderDays(prefs: NotificationPreferences): number[] {
    if (Array.isArray(prefs.cc_due_reminder_days)) return prefs.cc_due_reminder_days;
    if (prefs.cc_due_days_before) return [prefs.cc_due_days_before];
    return DEFAULT_CC_DUE_REMINDER_DAYS;
}

export interface ComputeRemindersOptions {
    memberId?: string;
    currentHour?: number;
    referenceDate?: Date;
}

/**
 * Computes all active, non-dismissed reminders for a member.
 */
export async function computeActiveReminders(
    options?: ComputeRemindersOptions,
): Promise<AppReminder[]> {
    try {
        const memberId = options?.memberId || "mem-00000000-0011";
        const referenceDate = options?.referenceDate;
        const currentMonth = referenceDate ? formatMonth(referenceDate) : getCurrentMonth();
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
            financeService.getNotificationPreferences(memberId),
            financeService.getNotificationLog(memberId),
            financeService.getStreakSummary(memberId),
            financeService.getAllAccountSnapshots(memberId),
            financeService.getCreditCardStatements(),
            financeService.getCreditCards(),
            financeService.getHouseholdOverview(),
            financeService.getExpenses(),
            financeService.getRecurringItems(),
            financeService.getGoals(),
            financeService.getDailyCheckins(),
            financeService.getMonthlyBudget(currentMonth, memberId),
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
            candidates.push(checkBalanceUpdateReminder(snapshots, referenceDate, memberId));
        }

        if (prefs.cc_payment_due) {
            candidates.push(
                ...checkCreditCardDueReminders(statements, todayStr, ccDueDays, memberId),
            );
        }

        if (prefs.cc_missing_statement) {
            candidates.push(
                ...checkMissingCreditCardStatements(cards, statements, referenceDate, memberId),
            );
        }

        if (prefs.partner_shared_spend) {
            candidates.push(
                ...checkPartnerSharedSpendReminders(expenses, members, memberId, todayStr),
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
                ...checkBudgetLimitReminders(monthlyBudget, prefs.budget_warning_pct || 80, memberId),
            );
        }

        if (prefs.recurring_bills_due) {
            candidates.push(...checkRecurringBillsReminders(recurringItems, referenceDate, memberId));
        }

        if (prefs.goal_pacing_alerts) {
            candidates.push(...checkGoalPacingReminders(goals, referenceDate));
        }

        if (prefs.monthly_budget_review) {
            candidates.push(checkMonthlyBudgetReviewReminder(monthlyBudget, referenceDate, memberId));
        }

        const dismissed = new Set(
            log.filter((entry) => entry.dismissed_at).map((entry) => entry.reminder_key),
        );
        return candidates.filter(
            (r): r is AppReminder => r !== null && !dismissed.has(r.id),
        );
    } catch (err) {
        console.error("Failed to compute active reminders:", err);
        return [];
    }
}

/**
 * Requests browser notification permission.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === "undefined" || !("Notification" in window)) {
        return "denied";
    }
    try {
        return await Notification.requestPermission();
    } catch (err) {
        console.debug("Failed to request notification permission:", err);
        return "denied";
    }
}

/**
 * Checks if first-launch permission request is needed and prompts user.
 */
export async function checkAndPromptInitialNotificationPermission(): Promise<NotificationPermission | null> {
    if (typeof window === "undefined" || !("Notification" in window)) return null;
    try {
        const hasPrompted = window.localStorage.getItem("bb_notif_initial_prompted");
        if (!hasPrompted) {
            window.localStorage.setItem("bb_notif_initial_prompted", "true");
            if (Notification.permission === "default") {
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
    options?: NotificationOptions,
): Promise<boolean> {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    if (Notification.permission !== "granted") return false;

    try {
        if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && registration.showNotification) {
                await registration.showNotification(title, {
                    icon: "/icons/icon-192x192.png",
                    badge: "/icons/icon-192x192.png",
                    ...options,
                });
                return true;
            }
        }

        // Fallback to Window Notification
        new Notification(title, options);
        return true;
    } catch (err) {
        console.debug("Error dispatching notification:", err);
        return false;
    }
}

/**
 * Computes reminders and pushes each one at most once. A reminder is pushed
 * only if this call wins the claim in the notification log.
 */
export async function evaluateAndDispatchReminders(
    options?: ComputeRemindersOptions,
): Promise<AppReminder[]> {
    const memberId = options?.memberId || "mem-00000000-0011";
    let prefs: NotificationPreferences;
    try {
        prefs = await financeService.getNotificationPreferences(memberId);
    } catch {
        prefs = getDefaultNotificationPreferences(memberId);
    }

    const reminders = await computeActiveReminders(options);

    // During quiet hours nothing is claimed, so held reminders push on the
    // first evaluation after quiet hours end.
    const quiet = isWithinQuietHours(
        currentMinutes(options?.currentHour, options?.referenceDate),
        prefs.quiet_hours_start,
        prefs.quiet_hours_end,
    );

    if (
        !quiet &&
        prefs.push_enabled &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
    ) {
        for (const reminder of reminders) {
            try {
                const claimed = await financeService.claimNotificationSend(memberId, {
                    key: reminder.id,
                    type: reminder.type,
                });
                if (!claimed) continue;
                await dispatchPWANotification(reminder.title, {
                    body: reminder.message,
                    tag: `${memberId}-${reminder.id}`,
                });
            } catch (err) {
                console.debug("Failed to dispatch notification:", err);
            }
        }
    }

    return reminders;
}
