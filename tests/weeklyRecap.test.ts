import { describe, it, expect } from "vitest";
import { buildWeeklyRecap, recapMonths, recapWeekFor } from "../src/lib/bubby/recap";
import { collectFeedEvents } from "../src/lib/bubby/sources";
import { addDays } from "../src/lib/bubby/dates";
import type { DailyCheckin, Expense } from "../src/types/finance";
import type { BubbyStore } from "../src/lib/bubby/storage";

const A = "mem-a";
const B = "mem-b";
const WEEK = { start: "2026-10-26", end: "2026-11-01" }; // Mon-Sun across a month boundary

function exp(date: string, amount: number, category_id = "cat-food", extra: Partial<Expense> = {}): Expense {
    return {
        id: `${date}-${amount}-${category_id}-${extra.payer_id ?? A}`,
        household_id: "hh",
        payer_id: A,
        date,
        item: "x",
        amount,
        category_id,
        is_shared: false,
        split_ratio: 0,
        settled: false,
        created_at: `${date}T04:00:00.000Z`,
        ...extra,
    };
}

function chk(member_id: string, checkin_date: string, type: DailyCheckin["type"] = "expense"): DailyCheckin {
    return { id: `${member_id}-${checkin_date}-${type}`, household_id: "hh", member_id, checkin_date, type };
}

function recap(expenses: Expense[], checkins: DailyCheckin[] = [], store: BubbyStore = {}, weeklyBudget?: number) {
    const events = collectFeedEvents({ checkins, expenses, snapshots: [], bonusEvents: [], store });
    return buildWeeklyRecap({ week: WEEK, expenses, checkins, events, weeklyBudget });
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
    it("sums the week across the month boundary, skips goal spend, finds the top category", () => {
        const r = recap([
            exp("2026-10-26", 20),
            exp("2026-11-01", 30, "cat-fun"),
            exp("2026-11-01", 15, "cat-fun", { id: "dup" }),
            exp("2026-10-30", 500, "cat-fun", { goal_id: "goal-1" }),
            exp("2026-11-02", 99), // next week
            exp("2026-10-20", 130), // week before
        ]);
        expect(r.spent).toBe(65);
        expect(r.prevSpent).toBe(130);
        expect(r.changePct).toBe(-50);
        expect(r.topCategory).toEqual({ categoryId: "cat-fun", amount: 45 });
    });

    it("lists who fed Bubby each day, for the dots", () => {
        const r = recap([], [chk(A, "2026-10-27"), chk(B, "2026-10-27"), chk(A, "2026-10-29")]);
        expect(r.days).toHaveLength(7);
        expect(r.days[1].fed.sort()).toEqual([A, B]);
        expect(r.days[3].fed).toEqual([A]);
    });

    it("reports a body change as the top win", () => {
        const fed = [0, 1, 2, 3, 4].flatMap((i) => [chk(A, addDays(WEEK.start, i)), chk(B, addDays(WEEK.start, i))]);
        expect(recap([], fed).win).toEqual({ kind: "body", text: "Bubby ate well" });
    });

    it("falls through under pace, no-spend days and lowest week", () => {
        expect(recap([exp("2026-10-27", 40)], [], {}, 124).win).toEqual({
            kind: "under-pace",
            text: "S$84 under pace",
        });
        expect(recap([], [chk(A, "2026-10-27", "no_spend"), chk(A, "2026-10-28", "no_spend")]).win.kind).toBe(
            "no-spend",
        );
        expect(
            recap([exp("2026-10-27", 10), exp("2026-10-20", 50), exp("2026-10-13", 60), exp("2026-10-06", 70)]).win
                .kind,
        ).toBe("lowest-week");
    });

    it("always has a win", () => {
        expect(recap([], [chk(A, "2026-10-29")]).win).toEqual({ kind: "logged", text: "Logged 1 of 7 days" });
    });
});
