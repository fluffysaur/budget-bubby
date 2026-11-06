/**
 * What feeds Bubby: a pluggable list of sources.
 *
 * Food 🍤 (per member, capped at 5 a day): each expense logged, each
 * no-spend check-in, a check-in without a matching expense (the logger who
 * recorded a partner's spend), and petting Bubby (once a day). Inbox
 * confirms and bulk-add rows become expenses, so they count through the
 * expense source. Food is derived from rows that still exist, so deleting
 * and re-logging an expense can't farm food.
 *
 * Exercise 💪 (household, once per natural period): clearing the inbox (a
 * day), updating balances (a day), adding to a goal (a day), logging a bonus
 * (a day), month-end sweep or bank (a month), reading the weekly recap (a
 * week).
 *
 * To add a source, append to FEED_SOURCES.
 */

import type { AccountSnapshot, DailyCheckin, Expense } from "../../types/finance";
import type { BubbyStore, LocalExerciseKind } from "./storage";
import { mondayOf, toSgtDateString } from "./dates";

export type FeedKind = "food" | "exercise";
export type FeedPeriod = "day" | "week" | "month";

export interface FeedEvent {
    sourceId: string;
    kind: FeedKind;
    date: string;
    /** Food is per member; exercise is household-wide. */
    memberId?: string;
}

/** Bonus entries (feat/bonus-log). Empty on branches without that table. */
export interface BonusEventLike {
    event_date: string;
}

export interface FeedContext {
    checkins: readonly DailyCheckin[];
    expenses: readonly Expense[];
    snapshots: readonly AccountSnapshot[];
    bonusEvents: readonly BonusEventLike[];
    store: BubbyStore;
}

export interface FeedSource {
    id: string;
    kind: FeedKind;
    /** Exercise counts once per period. Food is counted per event (then capped). */
    period?: FeedPeriod;
    collect(ctx: FeedContext): FeedEvent[];
}

/** SGT day an expense was logged (falls back to its expense date). */
export function loggedDateOf(e: Expense): string {
    if (e.created_at) {
        const d = new Date(e.created_at);
        if (!isNaN(d.getTime())) return toSgtDateString(d);
    }
    return e.date;
}

function localDays(store: BubbyStore, kind: LocalExerciseKind): string[] {
    return store.exercise?.[kind] ?? [];
}

const exercise = (id: string, period: FeedPeriod, dates: (ctx: FeedContext) => string[]): FeedSource => ({
    id,
    kind: "exercise",
    period,
    collect: (ctx) => dates(ctx).map((date) => ({ sourceId: id, kind: "exercise", date })),
});

export const FEED_SOURCES: readonly FeedSource[] = [
    {
        id: "expense",
        kind: "food",
        collect: ({ expenses }) =>
            expenses.map((e) => ({
                sourceId: "expense",
                kind: "food",
                date: loggedDateOf(e),
                memberId: e.payer_id,
            })),
    },
    {
        id: "no-spend",
        kind: "food",
        collect: ({ checkins }) =>
            checkins
                .filter((c) => c.type === "no_spend")
                .map((c) => ({ sourceId: "no-spend", kind: "food", date: c.checkin_date, memberId: c.member_id })),
    },
    {
        // The logger's check-in (e.g. logging a dinner the partner paid for)
        id: "logged",
        kind: "food",
        collect: ({ checkins, expenses }) => {
            const paid = new Set(expenses.map((e) => `${e.payer_id}|${loggedDateOf(e)}`));
            return checkins
                .filter((c) => c.type === "expense" && !paid.has(`${c.member_id}|${c.checkin_date}`))
                .map((c) => ({ sourceId: "logged", kind: "food", date: c.checkin_date, memberId: c.member_id }));
        },
    },
    {
        id: "pet",
        kind: "food",
        collect: ({ store }) =>
            Object.entries(store.petDays ?? {}).flatMap(([memberId, days]) =>
                days.map((date) => ({ sourceId: "pet", kind: "food" as const, date, memberId })),
            ),
    },
    exercise("inbox-clear", "day", ({ store }) => localDays(store, "inbox-clear")),
    exercise("balances", "day", ({ store, snapshots }) => [
        ...localDays(store, "balances"),
        ...snapshots.map((s) => s.snapshot_date),
    ]),
    exercise("goal-add", "day", ({ store }) => localDays(store, "goal-add")),
    exercise("bonus", "day", ({ bonusEvents }) => bonusEvents.map((b) => b.event_date)),
    exercise("month-end", "month", ({ store }) => localDays(store, "month-end")),
    exercise("recap-read", "week", ({ store }) => localDays(store, "recap-read")),
];

export function periodKey(period: FeedPeriod | undefined, date: string): string {
    if (period === "month") return date.slice(0, 7);
    if (period === "week") return mondayOf(date);
    return date;
}

/** All feed events, with exercise already collapsed to one per period. */
export function collectFeedEvents(
    ctx: FeedContext,
    sources: readonly FeedSource[] = FEED_SOURCES,
): FeedEvent[] {
    const out: FeedEvent[] = [];
    for (const source of sources) {
        const events = source.collect(ctx);
        if (source.kind === "food") {
            out.push(...events);
            continue;
        }
        const seen = new Set<string>();
        for (const e of events) {
            const key = periodKey(source.period, e.date);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(e);
        }
    }
    return out;
}
