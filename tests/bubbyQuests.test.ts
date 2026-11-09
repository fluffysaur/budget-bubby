import { describe, it, expect } from "vitest";
import {
    allDone,
    dailyQuests,
    monthlyQuests,
    weeklyQuests,
} from "../src/lib/bubby/quests";
import { snackForWeek, SNACKS } from "../src/lib/bubby/snacks";
import type { CreditCardStatement, DailyCheckin } from "../src/types/finance";

const ME = "mem-a";
const TODAY = "2026-11-06"; // Friday; week starts 2026-11-02

function chk(member_id: string, checkin_date: string): DailyCheckin {
    return {
        id: `${member_id}-${checkin_date}`,
        household_id: "hh",
        member_id,
        checkin_date,
        type: "expense",
    };
}

describe("daily quests", () => {
    const base = {
        memberId: ME,
        today: TODAY,
        checkins: [],
        expenses: [],
        store: {},
        inboxPending: 0,
    };

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
            dailyQuests({
                ...base,
                inboxPending: 3,
                store: { exercise: { "inbox-clear": [TODAY] } },
            })[2].done,
        ).toBe(true);
    });

    it("vanish with the day: yesterday's progress doesn't count", () => {
        const quests = dailyQuests({
            ...base,
            checkins: [chk(ME, "2026-11-05")],
            store: { petDays: { [ME]: ["2026-11-05"] } },
        });
        expect(quests.filter((q) => q.done).map((q) => q.id)).toEqual([
            "inbox",
        ]);
    });
});

describe("weekly quests", () => {
    it("count balances and the recap read this week only", () => {
        const done = weeklyQuests({
            today: TODAY,
            snapshots: [
                {
                    id: "s",
                    account_id: "a",
                    household_id: "hh",
                    balance: 1,
                    snapshot_date: "2026-11-03",
                },
            ],
            store: { exercise: { "recap-read": ["2026-11-02"] } },
        });
        expect(allDone(done)).toBe(true);

        const lastWeek = weeklyQuests({
            today: TODAY,
            snapshots: [],
            store: {
                exercise: {
                    balances: ["2026-11-01"],
                    "recap-read": ["2026-10-27"],
                },
            },
        });
        expect(lastWeek.every((q) => !q.done)).toBe(true);
    });
});

describe("weekly goal quest", () => {
    const base = { today: TODAY, snapshots: [], store: {} };

    it("is hidden without an active goal", () => {
        const ids = weeklyQuests(base).map((q) => q.id);
        expect(ids).not.toContain("goal");
    });

    it("shows with an active goal and completes on a goal-add this week", () => {
        const pending = weeklyQuests({ ...base, hasActiveGoal: true });
        expect(pending.find((q) => q.id === "goal")).toMatchObject({
            reward: "exercise",
            done: false,
        });
        const done = weeklyQuests({
            ...base,
            hasActiveGoal: true,
            store: { exercise: { "goal-add": ["2026-11-04"] } },
        });
        expect(done.find((q) => q.id === "goal")?.done).toBe(true);
        const lastWeek = weeklyQuests({
            ...base,
            hasActiveGoal: true,
            store: { exercise: { "goal-add": ["2026-11-01"] } },
        });
        expect(lastWeek.find((q) => q.id === "goal")?.done).toBe(false);
    });

    it("keeps the weekly set completable when there is no goal", () => {
        const quests = weeklyQuests({
            ...base,
            snapshots: [
                {
                    id: "s",
                    account_id: "a",
                    household_id: "hh",
                    balance: 1,
                    snapshot_date: "2026-11-03",
                },
            ],
            store: { exercise: { "recap-read": ["2026-11-03"] } },
        });
        expect(allDone(quests)).toBe(true);
    });
});

function stmt(
    id: string,
    due_date: string,
    is_paid: boolean,
): CreditCardStatement {
    return {
        id,
        card_id: id,
        household_id: "hh",
        month: due_date.slice(0, 7),
        statement_amount: 100,
        due_date,
        is_paid,
    };
}

describe("monthly quests", () => {
    const base = {
        today: TODAY,
        statements: [] as CreditCardStatement[],
        surplusPending: false,
        store: {},
    };

    it("are empty when nothing is due and there is no surplus", () => {
        expect(monthlyQuests(base)).toEqual([]);
        expect(allDone(monthlyQuests(base))).toBe(false);
    });

    it("pay-cards needs every statement due this month paid", () => {
        const some = monthlyQuests({
            ...base,
            statements: [
                stmt("a", "2026-11-20", true),
                stmt("b", "2026-11-25", false),
            ],
        });
        expect(some).toEqual([
            expect.objectContaining({
                id: "cards",
                reward: "exercise",
                done: false,
            }),
        ]);
        const all = monthlyQuests({
            ...base,
            statements: [
                stmt("a", "2026-11-20", true),
                stmt("b", "2026-11-25", true),
            ],
        });
        expect(all[0].done).toBe(true);
    });

    it("counts statements by due date, ignoring other months", () => {
        const quests = monthlyQuests({
            ...base,
            statements: [
                stmt("old", "2026-10-28", false),
                stmt("next", "2026-12-03", false),
                stmt("now", "2026-11-12", true),
            ],
        });
        expect(quests.find((q) => q.id === "cards")?.done).toBe(true);
    });

    it("sweep shows with surplus or a sweep this month, done on month-end", () => {
        const pending = monthlyQuests({ ...base, surplusPending: true });
        expect(pending.map((q) => [q.id, q.done])).toEqual([["sweep", false]]);
        const done = monthlyQuests({
            ...base,
            store: { exercise: { "month-end": ["2026-11-02"] } },
        });
        expect(done.map((q) => [q.id, q.done])).toEqual([["sweep", true]]);
        const lastMonth = monthlyQuests({
            ...base,
            store: { exercise: { "month-end": ["2026-10-30"] } },
        });
        expect(lastMonth).toEqual([]);
    });

    it("are all done only when every shown quest is done", () => {
        const quests = monthlyQuests({
            ...base,
            statements: [stmt("a", "2026-11-20", true)],
            store: { exercise: { "month-end": ["2026-11-03"] } },
        });
        expect(allDone(quests)).toBe(true);
    });
});

describe("snacks", () => {
    it("rotates by week so both devices agree", () => {
        const weeks = [
            "2026-11-02",
            "2026-11-09",
            "2026-11-16",
            "2026-11-23",
            "2026-11-30",
            "2026-12-07",
        ];
        const picks = weeks.map(snackForWeek);
        expect(new Set(picks).size).toBe(SNACKS.length);
        expect(snackForWeek("2026-11-02")).toBe(snackForWeek("2026-11-02"));
    });
});
