import { describe, it, expect } from "vitest";
import {
    deriveBubbyState,
    memberStreak,
    pointsForDay,
    stageForPoints,
    STAGES,
} from "../src/lib/bubby/growth";
import { addDays, mondayOf, toSgtDateString } from "../src/lib/bubby/dates";
import type { DailyCheckin } from "../src/types/finance";

const A = "mem-a";
const B = "mem-b";
const IDS = [A, B];

function row(member_id: string, checkin_date: string, type: DailyCheckin["type"] = "expense"): DailyCheckin {
    return { id: `${member_id}-${checkin_date}`, household_id: "hh", member_id, checkin_date, type };
}

/** `days` consecutive dates ending at `end`, logged by the given members. */
function run(end: string, days: number, members: string[]): DailyCheckin[] {
    const rows: DailyCheckin[] = [];
    for (let i = 0; i < days; i++) {
        const date = addDays(end, -i);
        for (const m of members) rows.push(row(m, date));
    }
    return rows;
}

describe("pointsForDay", () => {
    it("gives 1 for anyone, +1 for a couple day, +1 when on a roll", () => {
        expect(pointsForDay(false, 1)).toBe(1);
        expect(pointsForDay(true, 1)).toBe(2);
        expect(pointsForDay(false, 7)).toBe(2);
        expect(pointsForDay(true, 7)).toBe(3);
        expect(pointsForDay(true, 6)).toBe(2);
    });
});

describe("stage thresholds", () => {
    it("crosses each stage exactly at its threshold", () => {
        expect(stageForPoints(0)).toBe(0);
        expect(stageForPoints(5)).toBe(0);
        expect(stageForPoints(6)).toBe(1);
        expect(stageForPoints(19)).toBe(1);
        expect(stageForPoints(20)).toBe(2);
        expect(stageForPoints(59)).toBe(2);
        expect(stageForPoints(60)).toBe(3);
        expect(stageForPoints(149)).toBe(3);
        expect(stageForPoints(150)).toBe(4);
        expect(stageForPoints(299)).toBe(4);
        expect(stageForPoints(300)).toBe(5);
        expect(STAGES[5].name).toBe("Bubby");
    });
});

describe("deriveBubbyState", () => {
    const today = "2026-11-05";

    it("sums single, couple and on-a-roll days", () => {
        // 3 solo days, then a gap, then 7 couple days ending today
        const rows = [
            ...run("2026-10-20", 3, [A]),
            ...run(today, 7, [A, B]),
        ];
        const state = deriveBubbyState(rows, IDS, today);
        // solo: 3 x 1; couple run: days 1-6 = 2 each, day 7 = 3
        expect(state.points).toBe(3 + 6 * 2 + 3);
        expect(state.householdDays).toBe(10);
        expect(state.coupleDays).toBe(7);
        expect(state.coupleStreak).toBe(7);
        expect(state.longestCoupleStreak).toBe(7);
        expect(state.isCoupleDayToday).toBe(true);
        expect(state.gapDays).toBe(0);
        expect(state.stage).toBe(1);
        expect(state.nextStageAt).toBe(20);
    });

    it("never regresses: the high-water mark covers deleted rows", () => {
        const full = run(today, 12, [A, B]);
        const before = deriveBubbyState(full, IDS, today);
        const afterDelete = deriveBubbyState(full.slice(10), IDS, today, before.points);
        expect(afterDelete.derivedPoints).toBeLessThan(before.points);
        expect(afterDelete.points).toBe(before.points);
        expect(afterDelete.stage).toBe(before.stage);
    });

    it("treats today as pending for the couple streak", () => {
        const rows = [...run(addDays(today, -1), 4, [A, B]), row(A, today)];
        const state = deriveBubbyState(rows, IDS, today);
        expect(state.coupleStreak).toBe(4);
        expect(state.isCoupleDayToday).toBe(false);
        expect(state.todayLoggedBy.has(A)).toBe(true);
        expect(state.todayLoggedBy.has(B)).toBe(false);
    });

    it("breaks the couple streak after a missed couple day", () => {
        const rows = [...run(addDays(today, -3), 5, [A, B]), ...run(today, 2, [A, B])];
        const state = deriveBubbyState(rows, IDS, today);
        expect(state.coupleStreak).toBe(2);
        expect(state.longestCoupleStreak).toBe(5);
    });

    it("counts the logger, not the payer: both rows on one day make a couple day", () => {
        // Server checked in the payer (B) on the expense date; activity check-in added the logger (A) today
        const rows = [row(B, today), row(A, today)];
        expect(deriveBubbyState(rows, IDS, today).isCoupleDayToday).toBe(true);
    });

    it("ignores future-dated rows and reports the gap since the last day", () => {
        const rows = [row(A, "2026-11-01"), row(A, "2026-11-09")];
        const state = deriveBubbyState(rows, IDS, today);
        expect(state.householdDays).toBe(1);
        expect(state.gapDays).toBe(4);
    });

    it("returns a null gap and an egg without any history", () => {
        const state = deriveBubbyState([], IDS, today);
        expect(state.gapDays).toBeNull();
        expect(state.stage).toBe(0);
        expect(state.points).toBe(0);
    });

    it("tracks the best month for the Ang Bao rule", () => {
        const rows = run("2026-10-31", 31, [A]);
        expect(deriveBubbyState(rows, IDS, today).maxHouseholdDaysInMonth).toBe(31);
    });

    it("derives 2,000 rows quickly", () => {
        const rows = run(today, 1000, [A, B]);
        const start = performance.now();
        deriveBubbyState(rows, IDS, today);
        // Generous bound for CI; the plan's budget is ≤2ms on device
        expect(performance.now() - start).toBeLessThan(50);
    });
});

describe("member streak", () => {
    it("counts one member's consecutive days", () => {
        const rows = [...run("2026-11-05", 3, [A]), row(B, "2026-11-05")];
        expect(memberStreak(rows, A, "2026-11-05")).toBe(3);
        expect(memberStreak(rows, B, "2026-11-05")).toBe(1);
    });
});

describe("SGT date boundaries", () => {
    it("rolls over at SGT midnight, not UTC midnight", () => {
        expect(toSgtDateString(new Date("2026-11-04T15:59:00Z"))).toBe("2026-11-04");
        expect(toSgtDateString(new Date("2026-11-04T16:00:00Z"))).toBe("2026-11-05");
    });

    it("finds the Monday of a week, across a month boundary", () => {
        expect(mondayOf("2026-11-01")).toBe("2026-10-26"); // Sunday
        expect(mondayOf("2026-11-02")).toBe("2026-11-02"); // Monday
    });
});
