/**
 * Weekly recap ("Last Week"), shown on Home from Monday until it is
 * acknowledged or Thursday comes, about the previous Mon-Sun (SGT).
 * Household perspective, because Bubby is shared. There is always a win.
 */

import type { DailyCheckin, Expense } from "../../types/finance";
import { formatSGD } from "../currency";
import { addDays, daysBetween, mondayOf } from "./dates";
import { deriveBubbyState, STAGES } from "./growth";
import { ACCESSORIES, getUnlocked } from "./accessories";

export interface RecapWeek {
    start: string;
    end: string;
}

/** The week to recap (previous Mon-Sun), or null when no recap is due today. */
export function recapWeekFor(today: string, seenWeek?: string): RecapWeek | null {
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
    | "growth"
    | "couple-days"
    | "under-pace"
    | "inbox-zero"
    | "no-spend"
    | "lowest-week"
    | "logged";

export interface WeeklyRecap {
    week: RecapWeek;
    spent: number;
    prevSpent: number;
    /** Change vs the week before, in whole percent, or null without a base. */
    changePct: number | null;
    topCategory: { categoryId: string; amount: number } | null;
    win: { kind: RecapWinKind; text: string };
}

export interface RecapInputs {
    week: RecapWeek;
    expenses: Expense[];
    checkins: DailyCheckin[];
    memberIds: readonly string[];
    inboxZeroDays?: readonly string[];
    /** Pro-rata weekly spendable budget, if known. */
    weeklyBudget?: number | null;
}

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

function growthWin(inputs: RecapInputs): string | null {
    const { week, checkins, memberIds, inboxZeroDays = [] } = inputs;
    const before = deriveBubbyState(checkins, memberIds, addDays(week.start, -1));
    const after = deriveBubbyState(checkins, memberIds, week.end);
    if (after.stage > before.stage) return `Bubby grew to ${STAGES[after.stage].name}`;

    const unlockState = (s: typeof before, until: string) =>
        getUnlocked({
            stage: s.stage,
            points: s.points,
            longestCoupleStreak: s.longestCoupleStreak,
            maxHouseholdDaysInMonth: s.maxHouseholdDaysInMonth,
            inboxZeroDays: inboxZeroDays.filter((d) => d <= until).length,
        });
    const had = new Set(unlockState(before, addDays(week.start, -1)));
    const fresh = unlockState(after, week.end).find((id) => !had.has(id));
    if (fresh) return `Unlocked ${ACCESSORIES.find((a) => a.id === fresh)?.label ?? fresh}`;
    return null;
}

export function buildWeeklyRecap(inputs: RecapInputs): WeeklyRecap {
    const { week, expenses, checkins, memberIds, inboxZeroDays = [], weeklyBudget } = inputs;

    const spent = spendBetween(expenses, week.start, week.end);
    const prevSpent = spendBetween(expenses, addDays(week.start, -7), addDays(week.start, -1));
    const changePct = prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null;

    const byCategory = new Map<string, number>();
    for (const e of expenses) {
        if (e.goal_id || !e.category_id || !inRange(e.date, week.start, week.end)) continue;
        byCategory.set(e.category_id, (byCategory.get(e.category_id) ?? 0) + (e.amount || 0));
    }
    let topCategory: WeeklyRecap["topCategory"] = null;
    for (const [categoryId, amount] of byCategory) {
        if (!topCategory || amount > topCategory.amount) {
            topCategory = { categoryId, amount: Math.round(amount * 100) / 100 };
        }
    }

    // Per-day check-in facts for the week
    const pair = memberIds.slice(0, 2);
    const weekRows = checkins.filter((c) => inRange(c.checkin_date, week.start, week.end));
    const byDate = new Map<string, Set<string>>();
    const noSpendDates = new Set<string>();
    for (const c of weekRows) {
        if (!byDate.has(c.checkin_date)) byDate.set(c.checkin_date, new Set());
        byDate.get(c.checkin_date)!.add(c.member_id);
        if (c.type === "no_spend") noSpendDates.add(c.checkin_date);
    }
    const coupleDays =
        pair.length === 2
            ? Array.from(byDate.values()).filter((s) => s.has(pair[0]) && s.has(pair[1])).length
            : 0;
    const inboxZeros = inboxZeroDays.filter((d) => inRange(d, week.start, week.end)).length;

    const priorWeeks = [1, 2, 3].map((n) =>
        spendBetween(expenses, addDays(week.start, -7 * n), addDays(week.start, -7 * n + 6)),
    );

    const win = ((): WeeklyRecap["win"] => {
        const grew = growthWin(inputs);
        if (grew) return { kind: "growth", text: grew };
        if (coupleDays >= 5) return { kind: "couple-days", text: `${coupleDays} couple days` };
        if (weeklyBudget && weeklyBudget > 0 && spent < weeklyBudget) {
            return {
                kind: "under-pace",
                text: `${formatSGD(Math.round(weeklyBudget - spent), { showCents: false })} under pace`,
            };
        }
        if (inboxZeros >= 3) return { kind: "inbox-zero", text: `${inboxZeros} inbox zero days` };
        if (noSpendDates.size >= 2) return { kind: "no-spend", text: `${noSpendDates.size} no-spend days` };
        if (priorWeeks.some((w) => w > 0) && priorWeeks.every((w) => spent < w)) {
            return { kind: "lowest-week", text: "Lowest spend in 4 weeks" };
        }
        return { kind: "logged", text: `Logged ${byDate.size} of 7 days` };
    })();

    return { week, spent, prevSpent, changePct, topCategory, win };
}
