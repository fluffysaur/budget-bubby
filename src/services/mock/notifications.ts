/** In-memory mock of the notifications domain. */

import type {
    DailyCheckin,
    CheckinType,
    NotificationPreferences,
    UpdateNotificationPreferencesInput,
    NotificationLogEntry,
    NotificationLogRef,
    PushSubscriptionInput,
} from "../../types/finance";
import { getDefaultNotificationPreferences } from "../../data/mockSeedData";
import {
    getLocalNotificationLog,
    claimLocalNotificationSend,
    markLocalNotificationsRead,
    dismissLocalNotification,
} from "../localNotificationLog";
import { cloneDeep } from "./context";
import type { MockContext } from "./context";

export class NotificationsStore {
    constructor(private readonly ctx: MockContext) {}

    // Daily Check-ins
    async getDailyCheckins(memberId?: string): Promise<DailyCheckin[]> {
        let checkins = cloneDeep(this.ctx.state.dailyCheckins || []);
        if (memberId) {
            checkins = checkins.filter((c) => c.member_id === memberId);
        }
        checkins.sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));
        return checkins;
    }

    async recordDailyCheckin(
        memberId: string,
        date: string,
        type: CheckinType,
    ): Promise<DailyCheckin> {
        if (!this.ctx.state.dailyCheckins) this.ctx.state.dailyCheckins = [];

        const existing = this.ctx.state.dailyCheckins.find(
            (c) => c.member_id === memberId && c.checkin_date === date,
        );

        if (existing) {
            if (type === "expense") {
                existing.type = "expense";
            }
            this.ctx.persist();
            return cloneDeep(existing);
        }

        const checkin: DailyCheckin = {
            id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            household_id: this.ctx.state.household.id,
            member_id: memberId,
            checkin_date: date,
            type,
            created_at: new Date().toISOString(),
        };

        this.ctx.state.dailyCheckins.push(checkin);
        this.ctx.persist();
        return cloneDeep(checkin);
    }

    // Notification Preferences
    async getNotificationPreferences(
        memberId: string,
    ): Promise<NotificationPreferences> {
        if (!this.ctx.state.notificationPreferences) {
            this.ctx.state.notificationPreferences = {};
        }
        const cacheKey = `bb_notif_prefs_${memberId}`;
        if (typeof window !== "undefined" && window.localStorage) {
            const cached = window.localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    this.ctx.state.notificationPreferences[memberId] = parsed;
                    return cloneDeep(parsed);
                } catch {
                    // ignore parsing error
                }
            }
        }
        if (!this.ctx.state.notificationPreferences[memberId]) {
            this.ctx.state.notificationPreferences[memberId] =
                getDefaultNotificationPreferences(
                    memberId,
                    this.ctx.state.household.id,
                );
            this.ctx.persist();
        }
        const prefs = this.ctx.state.notificationPreferences[memberId];
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(cacheKey, JSON.stringify(prefs));
        }
        return cloneDeep(prefs);
    }

    async updateNotificationPreferences(
        memberId: string,
        updates: UpdateNotificationPreferencesInput,
    ): Promise<NotificationPreferences> {
        const existing = await this.getNotificationPreferences(memberId);
        const updated: NotificationPreferences = {
            ...existing,
            ...updates,
            updated_at: new Date().toISOString(),
        };
        if (!this.ctx.state.notificationPreferences) {
            this.ctx.state.notificationPreferences = {};
        }
        this.ctx.state.notificationPreferences[memberId] = updated;
        this.ctx.persist();

        const cacheKey = `bb_notif_prefs_${memberId}`;
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(cacheKey, JSON.stringify(updated));
            window.dispatchEvent(
                new CustomEvent("notificationPreferencesUpdated", {
                    detail: { memberId, preferences: updated },
                }),
            );
        }
        return cloneDeep(updated);
    }

    // Notification Log
    async getNotificationLog(
        memberId: string,
    ): Promise<NotificationLogEntry[]> {
        return getLocalNotificationLog(memberId);
    }

    async claimNotificationSend(
        memberId: string,
        ref: NotificationLogRef,
    ): Promise<boolean> {
        return claimLocalNotificationSend(memberId, ref);
    }

    async markNotificationsRead(
        memberId: string,
        refs: NotificationLogRef[],
    ): Promise<void> {
        markLocalNotificationsRead(memberId, refs);
    }

    async dismissNotification(
        memberId: string,
        ref: NotificationLogRef,
    ): Promise<void> {
        dismissLocalNotification(memberId, ref);
    }

    async savePushSubscription(
        _memberId: string,
        _subscription: PushSubscriptionInput,
    ): Promise<void> {}

    async deletePushSubscription(_endpoint: string): Promise<void> {}
}
