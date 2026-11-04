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
import { getDefaultNotificationPreferences } from "../data/mockSeedData";
import { isServerPushEnabled } from "./pushSubscription";
import { currentMinutes, isWithinQuietHours, type AppReminder } from "./reminders/rules";
import { computeRemindersFrom, type ComputeRemindersOptions } from "./reminders/engine";
import type { NotificationPreferences } from "../types/finance";

export * from "./reminders/rules";
export * from "./reminders/engine";

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
 * Computes all active, non-dismissed reminders for a member.
 */
export async function computeActiveReminders(
    options?: ComputeRemindersOptions,
): Promise<AppReminder[]> {
    try {
        return await computeRemindersFrom(financeService, options);
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
                    icon: "/pwa-192x192.png",
                    badge: "/pwa-192x192.png",
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
 *
 * With server push configured, the send-reminders function sends every push
 * and this only returns the reminders for the bell.
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
        !isServerPushEnabled() &&
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
