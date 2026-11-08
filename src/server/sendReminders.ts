/**
 * Server-side reminder sender, run hourly by the send-reminders Edge
 * Function (bundled by `npm run build:functions`).
 *
 * For each member with push on and at least one device:
 *   1. Skip during the member's quiet hours (held reminders go next run).
 *   2. Compute active reminders with the same engine as the app.
 *   3. Pick what is eligible this hour, claim each key in notification_log
 *      (a key is pushed at most once), and push to every device.
 *
 * Data is loaded with the app's Supabase service using a service-role
 * client. The service relies on RLS for household scoping, which a service
 * role bypasses, so this refuses to run unless exactly one household exists.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseFinanceServiceImpl } from "../services/supabaseFinanceService";
import {
    computeRemindersFrom,
    type ReminderDataSource,
} from "../lib/reminders/engine";
import { isWithinQuietHours, type AppReminder } from "../lib/reminders/rules";
import {
    buildPushMessages,
    selectForPush,
    type PushMessage,
    type PushSelection,
} from "../lib/reminders/push";
import { formatISODate } from "../lib/dateUtils";
import type { FinanceService } from "../services/financeService";

export interface PushTarget {
    endpoint: string;
    p256dh: string;
    auth: string;
}

export interface SendPushResult {
    ok: boolean;
    /** The push service says this subscription no longer exists (404/410). */
    gone?: boolean;
}

export interface SendRemindersDeps {
    service: ReminderDataSource & Pick<FinanceService, "claimNotificationSend">;
    listHouseholdIds(): Promise<string[]>;
    listMembers(): Promise<{ id: string; display_name?: string }[]>;
    listSubscriptions(memberId: string): Promise<PushTarget[]>;
    deleteSubscription(endpoint: string): Promise<void>;
    sendPush(target: PushTarget, message: PushMessage): Promise<SendPushResult>;
    now: Date;
    /** Compute and report only: no claims, no pushes. */
    dryRun?: boolean;
}

export interface MemberRunResult {
    memberId: string;
    skipped?: "push_off" | "no_devices" | "quiet_hours";
    /** Reminder keys claimed (or, in a dry run, that would be). */
    keys: string[];
    pushes: number;
    removedDevices: number;
}

export interface SendRemindersResult {
    ranAt: string;
    sgTime: string;
    dryRun: boolean;
    members: MemberRunResult[];
}

/** Date whose local fields hold Singapore wall-clock time. */
export function toSingaporeWallClock(date: Date): Date {
    return new Date(
        date.toLocaleString("en-US", { timeZone: "Asia/Singapore" }),
    );
}

async function claimAll(
    deps: SendRemindersDeps,
    memberId: string,
    reminders: AppReminder[],
): Promise<AppReminder[]> {
    const claimed: AppReminder[] = [];
    for (const reminder of reminders) {
        const won = await deps.service.claimNotificationSend(memberId, {
            key: reminder.id,
            type: reminder.type,
        });
        if (won) claimed.push(reminder);
    }
    return claimed;
}

async function runForMember(
    deps: SendRemindersDeps,
    memberId: string,
    sgNow: Date,
): Promise<MemberRunResult> {
    const result: MemberRunResult = {
        memberId,
        keys: [],
        pushes: 0,
        removedDevices: 0,
    };

    const prefs = await deps.service.getNotificationPreferences(memberId);
    if (!prefs.push_enabled) return { ...result, skipped: "push_off" };

    let targets = await deps.listSubscriptions(memberId);
    if (targets.length === 0) return { ...result, skipped: "no_devices" };

    const minutes = sgNow.getHours() * 60 + sgNow.getMinutes();
    if (
        isWithinQuietHours(
            minutes,
            prefs.quiet_hours_start,
            prefs.quiet_hours_end,
        )
    ) {
        return { ...result, skipped: "quiet_hours" };
    }

    const reminders = await computeRemindersFrom(deps.service, {
        memberId,
        referenceDate: sgNow,
        currentHour: sgNow.getHours(),
    });
    const selection = selectForPush(reminders, sgNow.getHours());

    let toSend: PushSelection;
    if (deps.dryRun) {
        const log = await deps.service.getNotificationLog(memberId);
        const seen = new Set(log.map((e) => e.reminder_key));
        toSend = {
            single: selection.single.filter((r) => !seen.has(r.id)),
            digest: selection.digest.filter((r) => !seen.has(r.id)),
        };
    } else {
        toSend = {
            single: await claimAll(deps, memberId, selection.single),
            digest: await claimAll(deps, memberId, selection.digest),
        };
    }
    result.keys = [...toSend.single, ...toSend.digest].map((r) => r.id);

    const messages = buildPushMessages(toSend, formatISODate(sgNow));
    if (deps.dryRun) return { ...result, pushes: messages.length };

    for (const message of messages) {
        const live: PushTarget[] = [];
        for (const target of targets) {
            const res = await deps.sendPush(target, message);
            if (res.gone) {
                await deps.deleteSubscription(target.endpoint);
                result.removedDevices += 1;
            } else {
                live.push(target);
            }
        }
        targets = live;
        result.pushes += 1;
        if (targets.length === 0) break;
    }

    return result;
}

export async function runSendReminders(
    deps: SendRemindersDeps,
): Promise<SendRemindersResult> {
    const householdIds = await deps.listHouseholdIds();
    if (householdIds.length !== 1) {
        throw new Error(
            `send-reminders supports exactly one household, found ${householdIds.length}`,
        );
    }

    const sgNow = toSingaporeWallClock(deps.now);
    const members = await deps.listMembers();
    const results: MemberRunResult[] = [];
    for (const member of members) {
        results.push(await runForMember(deps, member.id, sgNow));
    }

    return {
        ranAt: deps.now.toISOString(),
        sgTime: `${formatISODate(sgNow)} ${String(sgNow.getHours()).padStart(2, "0")}:${String(sgNow.getMinutes()).padStart(2, "0")}`,
        dryRun: !!deps.dryRun,
        members: results,
    };
}

/** Builds the deps from a service-role Supabase client. */
export function createSupabaseSendDeps(
    client: SupabaseClient,
    options: Pick<SendRemindersDeps, "sendPush" | "now" | "dryRun">,
): SendRemindersDeps {
    const service = new SupabaseFinanceServiceImpl(client, {
        localFallback: false,
    });
    return {
        service,
        ...options,
        async listHouseholdIds() {
            const { data, error } = await client
                .from("households")
                .select("id");
            if (error) throw error;
            return (data || []).map((row) => row.id as string);
        },
        async listMembers() {
            const { data, error } = await client
                .from("household_members")
                .select("id, display_name");
            if (error) throw error;
            return (data || []) as { id: string; display_name?: string }[];
        },
        async listSubscriptions(memberId) {
            const { data, error } = await client
                .from("push_subscriptions")
                .select("endpoint, p256dh, auth")
                .eq("member_id", memberId);
            if (error) throw error;
            return (data || []) as PushTarget[];
        },
        async deleteSubscription(endpoint) {
            const { error } = await client
                .from("push_subscriptions")
                .delete()
                .eq("endpoint", endpoint);
            if (error) throw error;
        },
    };
}
