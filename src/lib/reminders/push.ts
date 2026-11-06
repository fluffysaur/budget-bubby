/**
 * Push selection and message building for the send-reminders function.
 * Pure: decides which reminders go out on an hourly run and how they are
 * bundled into push messages.
 */

import { getReminderUrl } from "./engine";
import type { AppReminder, ReminderType } from "./rules";
import type { PushMessage } from "./pushMessage";

export { withReadKeys, type PushMessage } from "./pushMessage";

/** Routine reminders wait for the morning bundle, sent from this hour (SGT). */
export const DIGEST_HOUR = 9;

const ROUTINE_TYPES = new Set<ReminderType>([
    "balance_update",
    "credit_card_due",
    "credit_card_missing_stmt",
    "recurring_bill_due",
    "monthly_budget_review",
    "goal_pacing",
    "partner_shared_spend",
]);

const DIGEST_BODY_MAX = 180;

export type PushClass = "urgent" | "routine" | "immediate";

/**
 * - urgent: CC due in a day or less (or overdue), budget exceeded. Always
 *   pushed on their own, any hour outside quiet hours.
 * - routine: date-driven reminders. Bundled from DIGEST_HOUR.
 * - immediate: Bubby nudge, budget nearing, settlement. Pushed
 *   on the next run (check-in types are already gated by check-in time).
 */
export function classifyReminder(reminder: AppReminder): PushClass {
    if (reminder.type === "credit_card_due") {
        const days = reminder.data?.daysUntilDue;
        if (typeof days === "number" && days <= 1) return "urgent";
    }
    if (reminder.type === "budget_limit" && reminder.severity === "alert") {
        return "urgent";
    }
    return ROUTINE_TYPES.has(reminder.type) ? "routine" : "immediate";
}

export interface PushSelection {
    /** Each pushed on its own. */
    single: AppReminder[];
    /** Bundled into one push when there is more than one. */
    digest: AppReminder[];
}

/** Picks the reminders eligible to push at this SGT hour. */
export function selectForPush(
    reminders: AppReminder[],
    hour: number,
): PushSelection {
    const single: AppReminder[] = [];
    const digest: AppReminder[] = [];
    for (const reminder of reminders) {
        const cls = classifyReminder(reminder);
        if (cls === "routine") {
            if (hour >= DIGEST_HOUR) digest.push(reminder);
        } else {
            single.push(reminder);
        }
    }
    return { single, digest };
}

function toMessage(reminder: AppReminder): PushMessage {
    return {
        title: reminder.title,
        body: reminder.message,
        tag: reminder.id,
        url: getReminderUrl(reminder),
        keys: [reminder.id],
    };
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Builds push messages: one per single reminder, plus one bundle. */
export function buildPushMessages(
    selection: PushSelection,
    dateKey: string,
): PushMessage[] {
    const messages = selection.single.map(toMessage);
    if (selection.digest.length === 1) {
        messages.push(toMessage(selection.digest[0]));
    } else if (selection.digest.length > 1) {
        messages.push({
            title: `${selection.digest.length} Reminders`,
            body: truncate(
                selection.digest.map((r) => r.title).join(", "),
                DIGEST_BODY_MAX,
            ),
            tag: `digest-${dateKey}`,
            url: "/",
            keys: selection.digest.map((r) => r.id),
        });
    }
    return messages;
}
