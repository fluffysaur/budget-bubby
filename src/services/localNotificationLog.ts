/**
 * Device-local notification log.
 *
 * Used as the store for the mock service, and as the fallback for the
 * Supabase service when the notification_log table can't be reached.
 */

import type {
    NotificationLogEntry,
    NotificationLogRef,
} from "../types/finance";

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

type LogMap = Record<string, NotificationLogEntry>;

// In-memory store for environments without localStorage
const memoryStore = new Map<string, LogMap>();

function storageKey(memberId: string): string {
    return `bb_notif_log_${memberId}`;
}

function hasStorage(): boolean {
    try {
        return typeof window !== "undefined" && !!window.localStorage;
    } catch {
        return false;
    }
}

function load(memberId: string): LogMap {
    if (hasStorage()) {
        try {
            const raw = window.localStorage.getItem(storageKey(memberId));
            if (raw) return JSON.parse(raw) as LogMap;
        } catch {
            // ignore storage error
        }
        return {};
    }
    return memoryStore.get(memberId) ?? {};
}

function save(memberId: string, log: LogMap): void {
    const cutoff = Date.now() - RETENTION_MS;
    for (const [key, entry] of Object.entries(log)) {
        if (entry.created_at && new Date(entry.created_at).getTime() < cutoff) {
            delete log[key];
        }
    }
    if (hasStorage()) {
        try {
            window.localStorage.setItem(
                storageKey(memberId),
                JSON.stringify(log),
            );
        } catch {
            // ignore storage error
        }
        return;
    }
    memoryStore.set(memberId, log);
}

function upsert(
    memberId: string,
    ref: NotificationLogRef,
    patch: Partial<NotificationLogEntry>,
): void {
    const log = load(memberId);
    const existing = log[ref.key] ?? {
        reminder_key: ref.key,
        type: ref.type,
        created_at: new Date().toISOString(),
    };
    log[ref.key] = { ...existing, ...patch };
    save(memberId, log);
}

export function getLocalNotificationLog(
    memberId: string,
): NotificationLogEntry[] {
    return Object.values(load(memberId));
}

/**
 * Records a send for this reminder key. Returns true only for the first
 * caller; false when the key was already sent, read or dismissed.
 */
export function claimLocalNotificationSend(
    memberId: string,
    ref: NotificationLogRef,
): boolean {
    const log = load(memberId);
    if (log[ref.key]) return false;
    upsert(memberId, ref, { sent_at: new Date().toISOString() });
    return true;
}

export function markLocalNotificationsRead(
    memberId: string,
    refs: NotificationLogRef[],
): void {
    const now = new Date().toISOString();
    for (const ref of refs) {
        upsert(memberId, ref, { read_at: now });
    }
}

export function dismissLocalNotification(
    memberId: string,
    ref: NotificationLogRef,
): void {
    upsert(memberId, ref, { dismissed_at: new Date().toISOString() });
}

export function clearLocalNotificationLog(memberId?: string): void {
    if (memberId) {
        memoryStore.delete(memberId);
        if (hasStorage()) {
            try {
                window.localStorage.removeItem(storageKey(memberId));
            } catch {
                // ignore storage error
            }
        }
        return;
    }
    memoryStore.clear();
}
