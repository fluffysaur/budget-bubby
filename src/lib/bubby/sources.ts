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
 * Exercise 💪 (once per natural period): clearing the inbox (a day),
 * updating balances (a day), adding to a goal (a day), logging a bonus (a
 * day), month-end sweep or bank (a month), reading the weekly recap (a week).
 *
 * Whose penguin it feeds (`penguinIds`, undefined = every penguin): personal
 * expenses, check-ins and pets feed that member's penguin; shared expenses,
 * joint account updates, month-end and bonuses feed everyone. Local exercise
 * feeds the member who did it on this device (older records with no member
 * feed everyone).
 *
 * To add a source, append to FEED_SOURCES.
 */

import type {
    Account,
    AccountSnapshot,
    DailyCheckin,
    Expense,
} from "../../types/finance";
import type { BubbyStore, LocalExerciseKind } from "./storage";
import { mondayOf, toSgtDateString } from "./dates";

export type FeedKind = "food" | "exercise";
export type FeedPeriod = "day" | "week" | "month";

export interface FeedEvent {
    sourceId: string;
    kind: FeedKind;
    date: string;
    /** Who did it (food only). Undefined: the household. */
    memberId?: string;
    /** Penguins this feeds. Undefined: every penguin. */
    penguinIds?: readonly string[];
    /** Exercise only: the natural period it counts once in. */
    periodKey?: string;
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
    /** Owners of snapshot accounts. Unknown accounts feed every penguin. */
    accounts?: readonly Account[];
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

interface ExerciseDay {
    date: string;
    penguinIds?: readonly string[];
}

/** Local exercise days, each with the members who did it (if recorded). */
function localDays(store: BubbyStore, kind: LocalExerciseKind): ExerciseDay[] {
    const by = store.exerciseBy?.[kind];
    return (store.exercise?.[kind] ?? []).map((date) => {
        const ids = by?.[date];
        return ids && ids.length > 0 ? { date, penguinIds: ids } : { date };
    });
}

const shared = (dates: readonly string[]): ExerciseDay[] =>
    dates.map((date) => ({ date }));

const exercise = (
    id: string,
    period: FeedPeriod,
    days: (ctx: FeedContext) => ExerciseDay[],
): FeedSource => ({
    id,
    kind: "exercise",
    period,
    collect: (ctx) =>
        days(ctx).map(({ date, penguinIds }) => ({
            sourceId: id,
            kind: "exercise",
            date,
            ...(penguinIds ? { penguinIds } : {}),
            periodKey: periodKey(period, date),
        })),
});

/** Joint or unknown accounts feed everyone; personal ones feed the owner. */
function snapshotDays(ctx: FeedContext): ExerciseDay[] {
    const owners = new Map(
        (ctx.accounts ?? []).map((a) => [
            a.id,
            a.is_joint ? undefined : a.owner_id,
        ]),
    );
    return ctx.snapshots.map((s) => {
        const owner = owners.get(s.account_id);
        return owner
            ? { date: s.snapshot_date, penguinIds: [owner] }
            : { date: s.snapshot_date };
    });
}

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
                ...(e.is_shared ? {} : { penguinIds: [e.payer_id] }),
            })),
    },
    {
        id: "no-spend",
        kind: "food",
        collect: ({ checkins }) =>
            checkins
                .filter((c) => c.type === "no_spend")
                .map((c) => ({
                    sourceId: "no-spend",
                    kind: "food",
                    date: c.checkin_date,
                    memberId: c.member_id,
                    penguinIds: [c.member_id],
                })),
    },
    {
        // The logger's check-in (e.g. logging a dinner the partner paid for)
        id: "logged",
        kind: "food",
        collect: ({ checkins, expenses }) => {
            const paid = new Set(
                expenses.map((e) => `${e.payer_id}|${loggedDateOf(e)}`),
            );
            return checkins
                .filter(
                    (c) =>
                        c.type === "expense" &&
                        !paid.has(`${c.member_id}|${c.checkin_date}`),
                )
                .map((c) => ({
                    sourceId: "logged",
                    kind: "food",
                    date: c.checkin_date,
                    memberId: c.member_id,
                    penguinIds: [c.member_id],
                }));
        },
    },
    {
        id: "pet",
        kind: "food",
        // memberId petted; the pet feeds the penguin(s) they tapped
        collect: ({ store }) =>
            Object.entries(store.petDays ?? {}).flatMap(([memberId, days]) =>
                days.flatMap((date) =>
                    (
                        store.petTargets?.[`${memberId}|${date}`] ?? [memberId]
                    ).map((penguinId) => ({
                        sourceId: "pet",
                        kind: "food" as const,
                        date,
                        memberId,
                        penguinIds: [penguinId],
                    })),
                ),
            ),
    },
    exercise("inbox-clear", "day", ({ store }) =>
        localDays(store, "inbox-clear"),
    ),
    exercise("balances", "day", (ctx) => [
        ...localDays(ctx.store, "balances"),
        ...snapshotDays(ctx),
    ]),
    exercise("goal-add", "day", ({ store }) => localDays(store, "goal-add")),
    exercise("bonus", "day", ({ bonusEvents }) =>
        shared(bonusEvents.map((b) => b.event_date)),
    ),
    // A household chore: feeds every penguin, whoever swept
    exercise("month-end", "month", ({ store }) =>
        shared(store.exercise?.["month-end"] ?? []),
    ),
    exercise("recap-read", "week", ({ store }) =>
        localDays(store, "recap-read"),
    ),
];

export function periodKey(
    period: FeedPeriod | undefined,
    date: string,
): string {
    if (period === "month") return date.slice(0, 7);
    if (period === "week") return mondayOf(date);
    return date;
}

const penguinKey = (e: FeedEvent) =>
    e.penguinIds ? [...e.penguinIds].sort().join(",") : "*";

/**
 * All feed events, with exercise collapsed to one per period for each set
 * of penguins it feeds.
 */
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
            const key = `${penguinKey(e)}|${e.periodKey ?? e.date}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(e);
        }
    }
    return out;
}
