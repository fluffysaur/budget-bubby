/** Supabase queries for the notifications domain. */

import type {
    DailyCheckin,
    CheckinType,
    NotificationPreferences,
    NotificationLogEntry,
    NotificationLogRef,
    PushSubscriptionInput,
    UpdateNotificationPreferencesInput,
} from "../../types/finance";
import { getDefaultNotificationPreferences } from "../../lib/notificationDefaults";
import {
    getLocalNotificationLog,
    claimLocalNotificationSend,
    markLocalNotificationsRead,
    dismissLocalNotification,
} from "../localNotificationLog";
import {
    normalizeNotificationPreferences,
    fetchAllPages,
    type PaginatableQuery,
} from "./shared";
import type { SupabaseContext } from "./context";

export class NotificationsStore {
    constructor(private readonly ctx: SupabaseContext) {}

    // Daily Check-ins
    async getDailyCheckins(memberId?: string): Promise<DailyCheckin[]> {
        const client = this.ctx.getClient();
        const buildQuery = () => {
            let query = client
                .from("daily_checkins")
                .select("*")
                .order("checkin_date", { ascending: false });
            if (memberId) {
                query = query.eq("member_id", memberId);
            }
            return query;
        };
        return fetchAllPages<DailyCheckin>(
            () => buildQuery() as unknown as PaginatableQuery<DailyCheckin>,
        );
    }

    async recordDailyCheckin(
        memberId: string,
        date: string,
        type: CheckinType,
    ): Promise<DailyCheckin> {
        const client = this.ctx.getClient();
        const householdId = await this.ctx.getHouseholdId();
        const { data, error } = await client
            .from("daily_checkins")
            .upsert(
                {
                    household_id: householdId,
                    member_id: memberId,
                    checkin_date: date,
                    type,
                },
                { onConflict: "member_id,checkin_date" },
            )
            .select()
            .single();
        if (error) throw error;
        return data as DailyCheckin;
    }

    // Notification Preferences
    async getNotificationPreferences(
        memberId: string,
    ): Promise<NotificationPreferences> {
        const cacheKey = `bb_notif_prefs_${memberId}`;
        try {
            const client = this.ctx.getClient();
            const householdId = await this.ctx.getHouseholdId();
            const { data, error } = await client
                .from("notification_preferences")
                .select("*")
                .eq("member_id", memberId)
                .maybeSingle();

            if (!error && data) {
                const prefs = normalizeNotificationPreferences(
                    data,
                    memberId,
                    householdId,
                );
                if (typeof window !== "undefined" && window.localStorage) {
                    window.localStorage.setItem(
                        cacheKey,
                        JSON.stringify(prefs),
                    );
                }
                return prefs;
            }

            // If no row exists yet, insert defaults
            const defaults = getDefaultNotificationPreferences(
                memberId,
                householdId,
            );
            const { data: inserted, error: insertError } = await client
                .from("notification_preferences")
                .upsert(defaults, { onConflict: "member_id" })
                .select()
                .single();

            if (!insertError && inserted) {
                const prefs = normalizeNotificationPreferences(
                    inserted,
                    memberId,
                    householdId,
                );
                if (typeof window !== "undefined" && window.localStorage) {
                    window.localStorage.setItem(
                        cacheKey,
                        JSON.stringify(prefs),
                    );
                }
                return prefs;
            }
            if (insertError) {
                console.warn(
                    "Failed to create notification preferences:",
                    insertError.message,
                );
            }
        } catch (err) {
            console.debug(
                "Failed to fetch notification preferences from Supabase, checking cache:",
                err,
            );
        }

        // Cache fallback
        if (typeof window !== "undefined" && window.localStorage) {
            const cached = window.localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch {
                    // ignore parsing error
                }
            }
        }
        return getDefaultNotificationPreferences(memberId);
    }

    async updateNotificationPreferences(
        memberId: string,
        updates: UpdateNotificationPreferencesInput,
    ): Promise<NotificationPreferences> {
        const cacheKey = `bb_notif_prefs_${memberId}`;
        const householdId = await this.ctx
            .getHouseholdId()
            .catch(() => "hh-00000000-0001");
        const existing = await this.getNotificationPreferences(memberId);
        const updated: NotificationPreferences = {
            ...existing,
            ...updates,
            updated_at: new Date().toISOString(),
        };

        try {
            const client = this.ctx.getClient();
            const { error } = await client
                .from("notification_preferences")
                .upsert(
                    {
                        ...updated,
                        household_id: householdId,
                        member_id: memberId,
                    },
                    { onConflict: "member_id" },
                );
            if (error) throw error;
        } catch (err) {
            console.debug(
                "Failed to update notification preferences in Supabase:",
                err,
            );
        }

        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(cacheKey, JSON.stringify(updated));
            window.dispatchEvent(
                new CustomEvent("notificationPreferencesUpdated", {
                    detail: { memberId, preferences: updated },
                }),
            );
        }
        return updated;
    }

    // Notification Log
    // Falls back to the device-local log if the table can't be reached
    // (for example, before the notification_log migration is applied).
    async getNotificationLog(
        memberId: string,
    ): Promise<NotificationLogEntry[]> {
        try {
            const since = new Date(
                Date.now() - 90 * 24 * 60 * 60 * 1000,
            ).toISOString();
            const { data, error } = await this.ctx
                .getClient()
                .from("notification_log")
                .select(
                    "reminder_key, type, sent_at, read_at, dismissed_at, created_at",
                )
                .eq("member_id", memberId)
                .gte("created_at", since);
            if (error) throw error;
            return (data || []) as NotificationLogEntry[];
        } catch (err) {
            if (!this.ctx.localFallback) throw err;
            console.debug(
                "Failed to fetch notification log, using local log:",
                err,
            );
            return getLocalNotificationLog(memberId);
        }
    }

    async claimNotificationSend(
        memberId: string,
        ref: NotificationLogRef,
    ): Promise<boolean> {
        try {
            const householdId = await this.ctx.getHouseholdId();
            // Insert-or-ignore: a returned row means this caller owns the send
            const { data, error } = await this.ctx
                .getClient()
                .from("notification_log")
                .upsert(
                    {
                        household_id: householdId,
                        member_id: memberId,
                        reminder_key: ref.key,
                        type: ref.type,
                        sent_at: new Date().toISOString(),
                    },
                    {
                        onConflict: "member_id,reminder_key",
                        ignoreDuplicates: true,
                    },
                )
                .select("id");
            if (error) throw error;
            return (data || []).length > 0;
        } catch (err) {
            if (!this.ctx.localFallback) throw err;
            console.debug(
                "Failed to claim notification send, using local log:",
                err,
            );
            return claimLocalNotificationSend(memberId, ref);
        }
    }

    async markNotificationsRead(
        memberId: string,
        refs: NotificationLogRef[],
    ): Promise<void> {
        if (refs.length === 0) return;
        const readAt = new Date().toISOString();
        try {
            // Update existing rows first so their type (set when pushed) is kept
            const { data, error } = await this.ctx
                .getClient()
                .from("notification_log")
                .update({ read_at: readAt })
                .eq("member_id", memberId)
                .in(
                    "reminder_key",
                    refs.map((ref) => ref.key),
                )
                .select("reminder_key");
            if (error) throw error;
            const updated = new Set(
                (data || []).map((row) => row.reminder_key as string),
            );
            const missing = refs.filter((ref) => !updated.has(ref.key));
            if (missing.length === 0) return;
            await this.upsertNotificationLog(
                memberId,
                missing,
                { read_at: readAt },
                () => markLocalNotificationsRead(memberId, missing),
            );
        } catch (err) {
            if (!this.ctx.localFallback) throw err;
            console.debug(
                "Failed to mark notifications read, using local log:",
                err,
            );
            markLocalNotificationsRead(memberId, refs);
        }
    }

    async dismissNotification(
        memberId: string,
        ref: NotificationLogRef,
    ): Promise<void> {
        await this.upsertNotificationLog(
            memberId,
            [ref],
            { dismissed_at: new Date().toISOString() },
            () => dismissLocalNotification(memberId, ref),
        );
    }

    // Push Subscriptions
    async savePushSubscription(
        memberId: string,
        subscription: PushSubscriptionInput,
    ): Promise<void> {
        const householdId = await this.ctx.getHouseholdId();
        // Upsert by endpoint: a device follows whichever member last subscribed on it
        const { error } = await this.ctx
            .getClient()
            .from("push_subscriptions")
            .upsert(
                {
                    household_id: householdId,
                    member_id: memberId,
                    endpoint: subscription.endpoint,
                    p256dh: subscription.p256dh,
                    auth: subscription.auth,
                    user_agent: subscription.user_agent ?? null,
                    last_seen_at: new Date().toISOString(),
                },
                { onConflict: "endpoint" },
            );
        if (error) throw error;
    }

    async deletePushSubscription(endpoint: string): Promise<void> {
        const { error } = await this.ctx
            .getClient()
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", endpoint);
        if (error) throw error;
    }

    private async upsertNotificationLog(
        memberId: string,
        refs: NotificationLogRef[],
        patch: { read_at?: string; dismissed_at?: string },
        fallback: () => void,
    ): Promise<void> {
        try {
            const householdId = await this.ctx.getHouseholdId();
            const { error } = await this.ctx
                .getClient()
                .from("notification_log")
                .upsert(
                    refs.map((ref) => ({
                        household_id: householdId,
                        member_id: memberId,
                        reminder_key: ref.key,
                        type: ref.type,
                        ...patch,
                    })),
                    { onConflict: "member_id,reminder_key" },
                );
            if (error) throw error;
        } catch (err) {
            if (!this.ctx.localFallback) throw err;
            console.debug(
                "Failed to update notification log, using local log:",
                err,
            );
            fallback();
        }
    }
}
