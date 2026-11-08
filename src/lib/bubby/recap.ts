/**
 * Weekly recap ("Last Week"), shown on Home from Monday until it is
 * acknowledged or Thursday comes, about the previous Mon-Sun (SGT).
 * Household perspective, because Bubby is shared. There is always a win,
 * and the days both partners fed Bubby are shown as a row of dots.
 */

import type { DailyCheckin, Expense } from "../../types/finance";
import { formatSGD } from "../currency";
import { addDays, daysBetween, mondayOf } from "./dates";
import { deriveCondition, foodByMemberDay, type BubbyBody } from "./body";
import type { FeedEvent } from "./sources";

export interface RecapWeek {
    start: string;
    end: string;
}

/** The week to recap (previous Mon-Sun), or null when no recap is due today. */
export function recapWeekFor(
    today: string,
    seenWeek?: string,
): RecapWeek | null {
    const thisMonday = mondayOf(today);
    // Mon, Tue, Wed only: gone by Thursday
    if (daysBetween(thisMonday, today) > 2) return null;
    const start = addDays(thisMonday, -7);
    if (seenWeek === start) return null;
    return { start, end: addDays(start, 6) };
}

/** Months (YYYY-MM) the recap needs: the week plus the 3 weeks before it. */
export function recapMonths(week: RecapWeek): [string, string] {
    return [addDays(week.start, -21).slice(0, 7), week.end.slice(0, 7)];
}

export type RecapWinKind =
    | "body"
    | "under-pace"
    | "inbox-zero"
    | "no-spend"
    | "lowest-week"
    | "logged";

export interface RecapDay {
    date: string;
    /** Members who fed Bubby that day. */
    fed: string[];
}

export interface WeeklyRecap {
    week: RecapWeek;
    spent: number;
    prevSpent: number;
    /** Change vs the week before, in whole percent, or null without a base. */
    changePct: number | null;
    topCategory: { categoryId: string; amount: number } | null;
    win: { kind: RecapWinKind; text: string };
    /** Mon-Sun, for the "fed together" dots. */
    days: RecapDay[];
}

export interface RecapInputs {
    week: RecapWeek;
    expenses: Expense[];
    checkins: DailyCheckin[];
    /** Feed events (see sources.ts), for body changes and fed days. */
    events: FeedEvent[];
    /** Pro-rata weekly spendable budget, if known. */
    weeklyBudget?: number | null;
}

const BODY_WIN: Record<Exclude<BubbyBody, "regular">, string> = {
    buff: "Bubby got buff",
    lean: "Bubby got lean",
    chubby: "Bubby ate well",
};

function inRange(date: string, start: string, end: string): boolean {
    return date >= start && date <= end;
}

function spendBetween(expenses: Expense[], start: string, end: string): number {
    let total = 0;
    for (const e of expenses) {
        // Goal-funded spend comes out of savings, not the budget
        if (e.goal_id || !inRange(e.date, start, end)) continue;
        total += e.amount || 0;
    }
    return Math.round(total * 100) / 100;
}

export function buildWeeklyRecap(inputs: RecapInputs): WeeklyRecap {
    const { week, expenses, checkins, events, weeklyBudget } = inputs;

    const spent = spendBetween(expenses, week.start, week.end);
    const prevSpent = spendBetween(
        expenses,
        addDays(week.start, -7),
        addDays(week.start, -1),
    );
    const changePct =
        prevSpent > 0
            ? Math.round(((spent - prevSpent) / prevSpent) * 100)
            : null;

    const byCategory = new Map<string, number>();
    for (const e of expenses) {
        if (
            e.goal_id ||
            !e.category_id ||
            !inRange(e.date, week.start, week.end)
        )
            continue;
        byCategory.set(
            e.category_id,
            (byCategory.get(e.category_id) ?? 0) + (e.amount || 0),
        );
    }
    let topCategory: WeeklyRecap["topCategory"] = null;
    for (const [categoryId, amount] of byCategory) {
        if (!topCategory || amount > topCategory.amount) {
            topCategory = {
                categoryId,
                amount: Math.round(amount * 100) / 100,
            };
        }
    }

    // Who fed Bubby each day of the week
    const food = foodByMemberDay(events);
    const days: RecapDay[] = Array.from({ length: 7 }, (_, i) => ({
        date: addDays(week.start, i),
        fed: [],
    }));
    for (const key of food.keys()) {
        const [memberId, date] = key.split("|");
        const day = days.find((d) => d.date === date);
        if (day && memberId !== "household") day.fed.push(memberId);
    }

    const noSpendDates = new Set(
        checkins
            .filter(
                (c) =>
                    c.type === "no_spend" &&
                    inRange(c.checkin_date, week.start, week.end),
            )
            .map((c) => c.checkin_date),
    );
    const inboxZeros = new Set(
        events
            .filter(
                (e) =>
                    e.sourceId === "inbox-clear" &&
                    inRange(e.date, week.start, week.end),
            )
            .map((e) => e.date),
    ).size;
    const priorWeeks = [1, 2, 3].map((n) =>
        spendBetween(
            expenses,
            addDays(week.start, -7 * n),
            addDays(week.start, -7 * n + 6),
        ),
    );

    const win = ((): WeeklyRecap["win"] => {
        const before = deriveCondition(events, addDays(week.start, -1)).body;
        const after = deriveCondition(events, week.end).body;
        if (after !== "regular" && after !== before)
            return { kind: "body", text: BODY_WIN[after] };
        if (weeklyBudget && weeklyBudget > 0 && spent < weeklyBudget) {
            return {
                kind: "under-pace",
                text: `${formatSGD(Math.round(weeklyBudget - spent), { showCents: false })} under pace`,
            };
        }
        if (inboxZeros >= 3)
            return {
                kind: "inbox-zero",
                text: `${inboxZeros} inbox zero days`,
            };
        if (noSpendDates.size >= 2)
            return {
                kind: "no-spend",
                text: `${noSpendDates.size} no-spend days`,
            };
        if (
            priorWeeks.some((w) => w > 0) &&
            priorWeeks.every((w) => spent < w)
        ) {
            return { kind: "lowest-week", text: "Lowest spend in 4 weeks" };
        }
        const logged = days.filter((d) => d.fed.length > 0).length;
        return { kind: "logged", text: `Logged ${logged} of 7 days` };
    })();

    return { week, spent, prevSpent, changePct, topCategory, win, days };
}
