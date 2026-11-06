import { describe, it, expect } from "vitest";
import { allDone, dailyQuests, weeklyQuests } from "../src/lib/bubby/quests";
import { snackForWeek, SNACKS } from "../src/lib/bubby/snacks";
import type { DailyCheckin } from "../src/types/finance";

const ME = "mem-a";
const TODAY = "2026-11-06"; // Friday; week starts 2026-11-02

function chk(member_id: string, checkin_date: string): DailyCheckin {
    return { id: `${member_id}-${checkin_date}`, household_id: "hh", member_id, checkin_date, type: "expense" };
}

describe("daily quests", () => {
    const base = { memberId: ME, today: TODAY, checkins: [], expenses: [], store: {}, inboxPending: 0 };

    it("treats an empty inbox as done", () => {
        const quests = dailyQuests(base);
        expect(quests.map((q) => [q.id, q.done])).toEqual([
            ["log", false],
            ["pet", false],
            ["inbox", true],
        ]);
    });

    it("are all done after logging and petting", () => {
        const quests = dailyQuests({
            ...base,
            checkins: [chk(ME, TODAY)],
            store: { petDays: { [ME]: [TODAY] } },
        });
        expect(allDone(quests)).toBe(true);
    });

    it("need the inbox cleared while items wait", () => {
        expect(dailyQuests({ ...base, inboxPending: 3 })[2].done).toBe(false);
        expect(
            dailyQuests({ ...base, inboxPending: 3, store: { exercise: { "inbox-clear": [TODAY] } } })[2].done,
        ).toBe(true);
    });

    it("vanish with the day: yesterday's progress doesn't count", () => {
        const quests = dailyQuests({ ...base, checkins: [chk(ME, "2026-11-05")], store: { petDays: { [ME]: ["2026-11-05"] } } });
        expect(quests.filter((q) => q.done).map((q) => q.id)).toEqual(["inbox"]);
    });
});

describe("weekly quests", () => {
    it("count balances and the recap read this week only", () => {
        const done = weeklyQuests({
            today: TODAY,
            snapshots: [{ id: "s", account_id: "a", household_id: "hh", balance: 1, snapshot_date: "2026-11-03" }],
            store: { exercise: { "recap-read": ["2026-11-02"] } },
        });
        expect(allDone(done)).toBe(true);

        const lastWeek = weeklyQuests({
            today: TODAY,
            snapshots: [],
            store: { exercise: { balances: ["2026-11-01"], "recap-read": ["2026-10-27"] } },
        });
        expect(lastWeek.every((q) => !q.done)).toBe(true);
    });
});

describe("snacks", () => {
    it("rotates by week so both devices agree", () => {
        const weeks = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"];
        const picks = weeks.map(snackForWeek);
        expect(new Set(picks).size).toBe(SNACKS.length);
        expect(snackForWeek("2026-11-02")).toBe(snackForWeek("2026-11-02"));
    });
});
