/**
 * Web Push subscription for this device.
 *
 * Server push is on when VITE_VAPID_PUBLIC_KEY is set: the send-reminders
 * function sends every push and the app stops sending its own. Without the
 * key, the app keeps sending pushes itself when open (Phase 1 behavior).
 */

import { financeService } from "../services/financeService";

const VAPID_PUBLIC_KEY = (
    import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
)?.trim();

/** True when pushes come from the server instead of the open app. */
export function isServerPushEnabled(): boolean {
    return !!VAPID_PUBLIC_KEY;
}

function isPushSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

/**
 * Subscribes this device and saves it for the member when push is wanted
 * (key configured, permission granted, push_enabled on). Removes the
 * device's subscription only when push_enabled is off or permission is
 * "denied". A "default" read (stale on some installed Android PWAs) keeps
 * an existing subscription. Safe to call on every launch.
 */
export async function syncPushSubscription(
    memberId: string,
    pushEnabled: boolean,
    permission: NotificationPermission = isPushSupported()
        ? Notification.permission
        : "denied",
): Promise<void> {
    if (!VAPID_PUBLIC_KEY || !isPushSupported()) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();

        if (!pushEnabled || permission === "denied") {
            if (existing) {
                await financeService.deletePushSubscription(existing.endpoint);
                await existing.unsubscribe();
            }
            return;
        }

        // Can't create a subscription without a grant, but keep what's there
        if (permission !== "granted" && !existing) return;

        const subscription =
            existing ??
            (await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
            }));
        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

        await financeService.savePushSubscription(memberId, {
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            user_agent: navigator.userAgent.slice(0, 255),
        });
    } catch (err) {
        console.debug("Failed to sync push subscription:", err);
    }
}

export type DevicePushStatus =
    | "subscribed"
    | "not_subscribed"
    | "unsupported"
    | "app_only";

/** This device's push subscription status, for diagnosing permission mismatches. */
export async function getDevicePushStatus(): Promise<DevicePushStatus> {
    if (!isPushSupported()) return "unsupported";
    if (!VAPID_PUBLIC_KEY) return "app_only";
    try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        return existing ? "subscribed" : "not_subscribed";
    } catch (err) {
        console.debug("Failed to read push subscription:", err);
        return "not_subscribed";
    }
}
