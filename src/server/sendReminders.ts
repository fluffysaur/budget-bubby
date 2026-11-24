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
 * Runs once per household. Data is loaded with the app's Supabase service
 * using a service-role client, which bypasses RLS, so each household gets its
 * own service over a client filtered to that household, and its own timezone
 * (falling back to Singapore until households have a timezone column).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseFinanceServiceImpl } from "../services/supabaseFinanceService";
import { scopeClientToHousehold } from "./householdScopedClient";
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

export interface HouseholdInfo {
    id: string;
    /** IANA timezone; defaults to Singapore when missing or invalid. */
    timezone?: string | null;
}

export const DEFAULT_TIMEZONE = "Asia/Singapore";

export interface SendRemindersDeps {
    /** A service whose every query is scoped to the given household. */
    createService(
        householdId: string,
    ): ReminderDataSource & Pick<FinanceService, "claimNotificationSend">;
    listHouseholds(): Promise<HouseholdInfo[]>;
    listMembers(
        householdId: string,
    ): Promise<{ id: string; display_name?: string }[]>;
    listSubscriptions(memberId: string): Promise<PushTarget[]>;
    deleteSubscription(endpoint: string): Promise<void>;
    sendPush(target: PushTarget, message: PushMessage): Promise<SendPushResult>;
    now: Date;
    /** Compute and report only: no claims, no pushes. */
    dryRun?: boolean;
}

export interface MemberRunResult {
    householdId: string;
    memberId: string;
    skipped?: "push_off" | "no_devices" | "quiet_hours";
    /** Reminder keys claimed (or, in a dry run, that would be). */
    keys: string[];
    pushes: number;
    removedDevices: number;
    /** Set when this household or member failed; the run carried on. */
    error?: string;
}

export interface SendRemindersResult {
    ranAt: string;
    dryRun: boolean;
    members: MemberRunResult[];
}

/** Constant-time string equality via SHA-256 + fixed-length XOR. */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const [hashA, hashB] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(a)),
        crypto.subtle.digest("SHA-256", encoder.encode(b)),
    ]);
    const bytesA = new Uint8Array(hashA);
    const bytesB = new Uint8Array(hashB);
    let diff = 0;
    for (let i = 0; i < bytesA.length; i += 1) {
        diff |= bytesA[i] ^ bytesB[i];
    }
    return diff === 0;
}

/** Verifies `Authorization: Bearer <secret>` in constant time. */
export async function isAuthorizedBearer(
    authorization: string | null | undefined,
    secret: string,
): Promise<boolean> {
    if (!authorization || !secret) return false;
    return timingSafeEqual(authorization, `Bearer ${secret}`);
}

/** Date whose local fields hold wall-clock time in `timeZone`. */
export function toWallClock(
    date: Date,
    timeZone: string = DEFAULT_TIMEZONE,
): Date {
    try {
        return new Date(date.toLocaleString("en-US", { timeZone }));
    } catch {
        // Invalid timezone name: use the default rather than failing the run.
        return new Date(
            date.toLocaleString("en-US", { timeZone: DEFAULT_TIMEZONE }),
        );
    }
}

async function claimAll(
    service: ReturnType<SendRemindersDeps["createService"]>,
    memberId: string,
    reminders: AppReminder[],
): Promise<AppReminder[]> {
    const claimed: AppReminder[] = [];
    for (const reminder of reminders) {
        const won = await service.claimNotificationSend(memberId, {
            key: reminder.id,
            type: reminder.type,
        });
        if (won) claimed.push(reminder);
    }
    return claimed;
}

async function runForMember(
    deps: SendRemindersDeps,
    service: ReturnType<SendRemindersDeps["createService"]>,
    householdId: string,
    memberId: string,
    sgNow: Date,
): Promise<MemberRunResult> {
    const result: MemberRunResult = {
        householdId,
        memberId,
        keys: [],
        pushes: 0,
        removedDevices: 0,
    };

    const prefs = await service.getNotificationPreferences(memberId);
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

    const reminders = await computeRemindersFrom(service, {
        memberId,
        referenceDate: sgNow,
        currentHour: sgNow.getHours(),
    });
    const selection = selectForPush(reminders, sgNow.getHours());

    let toSend: PushSelection;
    if (deps.dryRun) {
        const log = await service.getNotificationLog(memberId);
        const seen = new Set(log.map((e) => e.reminder_key));
        toSend = {
            single: selection.single.filter((r) => !seen.has(r.id)),
            digest: selection.digest.filter((r) => !seen.has(r.id)),
        };
    } else {
        toSend = {
            single: await claimAll(service, memberId, selection.single),
            digest: await claimAll(service, memberId, selection.digest),
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

function failedResult(
    householdId: string,
    memberId: string,
    err: unknown,
): MemberRunResult {
    const error = err instanceof Error ? err.message : String(err);
    console.error("send-reminders failed", householdId, memberId, error);
    return {
        householdId,
        memberId,
        keys: [],
        pushes: 0,
        removedDevices: 0,
        error,
    };
}

export async function runSendReminders(
    deps: SendRemindersDeps,
): Promise<SendRemindersResult> {
    const households = await deps.listHouseholds();
    const results: MemberRunResult[] = [];
    for (const household of households) {
        // One bad household or member must not block the rest.
        try {
            const service = deps.createService(household.id);
            const localNow = toWallClock(
                deps.now,
                household.timezone ?? undefined,
            );
            const members = await deps.listMembers(household.id);
            for (const member of members) {
                try {
                    results.push(
                        await runForMember(
                            deps,
                            service,
                            household.id,
                            member.id,
                            localNow,
                        ),
                    );
                } catch (err) {
                    results.push(failedResult(household.id, member.id, err));
                }
            }
        } catch (err) {
            results.push(failedResult(household.id, "", err));
        }
    }

    return {
        ranAt: deps.now.toISOString(),
        dryRun: !!deps.dryRun,
        members: results,
    };
}

/** Builds the deps from a service-role Supabase client. */
export function createSupabaseSendDeps(
    client: SupabaseClient,
    options: Pick<SendRemindersDeps, "sendPush" | "now" | "dryRun">,
): SendRemindersDeps {
    return {
        ...options,
        createService(householdId) {
            return new SupabaseFinanceServiceImpl(
                scopeClientToHousehold(client, householdId),
                { localFallback: false },
            );
        },
        async listHouseholds() {
            // select("*") so a future `timezone` column is picked up as-is.
            const { data, error } = await client
                .from("households")
                .select("*")
                .order("id");
            if (error) throw error;
            return (data || []).map((row) => ({
                id: row.id as string,
                timezone:
                    typeof row.timezone === "string" ? row.timezone : null,
            }));
        },
        async listMembers(householdId) {
            const { data, error } = await client
                .from("household_members")
                .select("id, display_name")
                .eq("household_id", householdId);
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
