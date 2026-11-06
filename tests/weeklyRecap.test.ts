import { describe, it, expect } from "vitest";
import { buildWeeklyRecap, recapMonths, recapWeekFor } from "../src/lib/bubby/recap";
import { addDays } from "../src/lib/bubby/dates";
import type { DailyCheckin, Expense } from "../src/types/finance";

const A = "mem-a";
const B = "mem-b";
const WEEK = { start: "2026-10-26", end: "2026-11-01" }; // Mon-Sun across a month boundary

function exp(date: string, amount: number, category_id = "cat-food", extra: Partial<Expense> = {}): Expense {
    return {
        id: `${date}-${amount}-${category_id}`,
        household_id: "hh",
        payer_id: A,
        date,
        item: "x",
        amount,
        category_id,
        is_shared: false,
        split_ratio: 0,
        settled: false,
        ...extra,
    };
}

function chk(member_id: string, checkin_date: string, type: DailyCheckin["type"] = "expense"): DailyCheckin {
    return { id: `${member_id}-${checkin_date}`, household_id: "hh", member_id, checkin_date, type };
}

describe("recap week bounds", () => {
    it("recaps the previous Mon-Sun from Monday to Wednesday only", () => {
        expect(recapWeekFor("2026-11-02")).toEqual(WEEK); // Monday
        expect(recapWeekFor("2026-11-04")).toEqual(WEEK); // Wednesday
        expect(recapWeekFor("2026-11-05")).toBeNull(); // Thursday
        expect(recapWeekFor("2026-11-01")).toBeNull(); // Sunday
    });

    it("hides once acknowledged", () => {
        expect(recapWeekFor("2026-11-03", WEEK.start)).toBeNull();
    });

    it("loads the months the week and the 3 before it span", () => {
        expect(recapMonths(WEEK)).toEqual(["2026-10", "2026-11"]);
    });
});

describe("buildWeeklyRecap", () => {
    const base = { week: WEEK, checkins: [] as DailyCheckin[], memberIds: [A, B] };

    it("sums the week across the month boundary, skips goal spend, finds the top category", () => {
        const recap = buildWeeklyRecap({
            ...base,
            expenses: [
                exp("2026-10-26", 20),
                exp("2026-11-01", 30, "cat-fun"),
                exp("2026-11-01", 15, "cat-fun"),
                exp("2026-10-30", 500, "cat-fun", { goal_id: "goal-1" }),
                exp("2026-11-02", 99), // next week
                exp("2026-10-20", 130), // week before
            ],
        });
        expect(recap.spent).toBe(65);
        expect(recap.prevSpent).toBe(130);
        expect(recap.changePct).toBe(-50);
        expect(recap.topCategory).toEqual({ categoryId: "cat-fun", amount: 45 });
    });

    it("prefers 5+ couple days over being under pace", () => {
        const checkins = [0, 1, 2, 3, 4].flatMap((i) => [chk(A, addDays(WEEK.start, i)), chk(B, addDays(WEEK.start, i))]);
        // Seed enough history that this week's paws don't cross a stage (no growth win)
        const prior = Array.from({ length: 60 }, (_, i) => chk(A, addDays(WEEK.start, -40 - i)));
        const recap = buildWeeklyRecap({ ...base, checkins: [...prior, ...checkins], expenses: [], weeklyBudget: 300 });
        expect(recap.win).toEqual({ kind: "couple-days", text: "5 couple days" });
    });

    it("reports a stage-up as the top win", () => {
        const checkins = [0, 1, 2].flatMap((i) => [chk(A, addDays(WEEK.start, i)), chk(B, addDays(WEEK.start, i))]);
        const recap = buildWeeklyRecap({ ...base, checkins, expenses: [] });
        expect(recap.win).toEqual({ kind: "growth", text: "Bubby grew to Wobbly Egg" });
    });

    it("falls through under pace, no-spend days and lowest week", () => {
        const prior = Array.from({ length: 30 }, (_, i) => chk(A, addDays(WEEK.start, -40 - i)));
        expect(
            buildWeeklyRecap({ ...base, checkins: prior, expenses: [exp("2026-10-27", 40)], weeklyBudget: 124 }).win,
        ).toEqual({ kind: "under-pace", text: "S$84 under pace" });

        const noSpend = [chk(A, "2026-10-27", "no_spend"), chk(A, "2026-10-28", "no_spend")];
        expect(buildWeeklyRecap({ ...base, checkins: [...prior, ...noSpend], expenses: [] }).win.kind).toBe("no-spend");

        const lowest = buildWeeklyRecap({
            ...base,
            checkins: prior,
            expenses: [exp("2026-10-27", 10), exp("2026-10-20", 50), exp("2026-10-13", 60), exp("2026-10-06", 70)],
        });
        expect(lowest.win.kind).toBe("lowest-week");
    });

    it("always has a win", () => {
        const prior = Array.from({ length: 30 }, (_, i) => chk(A, addDays(WEEK.start, -40 - i)));
        const recap = buildWeeklyRecap({ ...base, checkins: [...prior, chk(A, "2026-10-29")], expenses: [] });
        expect(recap.win).toEqual({ kind: "logged", text: "Logged 1 of 7 days" });
    });
});
