import { describe, it, expect } from "vitest";
import {
    bodyFor,
    deriveCondition,
    FITNESS_FULL,
    METER_HIGH,
    moodFor,
    NOURISH_FULL,
} from "../src/lib/bubby/body";
import {
    collectFeedEvents,
    FEED_SOURCES,
    type FeedContext,
    type FeedSource,
} from "../src/lib/bubby/sources";
import { addDays } from "../src/lib/bubby/dates";
import type {
    AccountSnapshot,
    DailyCheckin,
    Expense,
} from "../src/types/finance";

const A = "mem-a";
const B = "mem-b";
const TODAY = "2026-11-06";

function exp(
    payer_id: string,
    day: string,
    id = `${payer_id}-${day}-${Math.random()}`,
): Expense {
    return {
        id,
        household_id: "hh",
        payer_id,
        date: day,
        item: "x",
        amount: 5,
        is_shared: false,
        split_ratio: 0,
        settled: false,
        // Logged at noon SGT on that day
        created_at: `${day}T04:00:00.000Z`,
    };
}

function chk(
    member_id: string,
    checkin_date: string,
    type: DailyCheckin["type"] = "expense",
): DailyCheckin {
    return {
        id: `${member_id}-${checkin_date}-${type}`,
        household_id: "hh",
        member_id,
        checkin_date,
        type,
    };
}

function ctx(patch: Partial<FeedContext> = {}): FeedContext {
    return {
        checkins: [],
        expenses: [],
        snapshots: [],
        bonusEvents: [],
        store: {},
        ...patch,
    };
}

function condition(patch: Partial<FeedContext> = {}, today = TODAY) {
    return deriveCondition(collectFeedEvents(ctx(patch)), today);
}

describe("food", () => {
    it("caps each member at 5 food a day", () => {
        const expenses = Array.from({ length: 9 }, (_, i) =>
            exp(A, TODAY, `e${i}`),
        );
        expect(condition({ expenses }).nourishment).toBeCloseTo(
            5 / NOURISH_FULL,
        );
    });

    it("counts expenses, no-spend days and petting; deleting and re-logging can't farm", () => {
        const before = condition({
            expenses: [exp(A, TODAY, "e1")],
        }).nourishment;
        // Delete e1 and log e2: still one expense row
        const after = condition({
            expenses: [exp(A, TODAY, "e2")],
        }).nourishment;
        expect(after).toBe(before);

        const more = condition({
            expenses: [exp(A, TODAY, "e2")],
            checkins: [chk(B, TODAY, "no_spend")],
            store: { petDays: { [A]: [TODAY] } },
        }).nourishment;
        expect(more).toBeCloseTo(3 / NOURISH_FULL);
    });

    it("feeds the logger who recorded a partner's spend (check-in with no own expense)", () => {
        const c = condition({
            expenses: [exp(B, TODAY)],
            checkins: [chk(A, TODAY)],
        });
        expect(c.fedToday).toEqual(new Set([A, B]));
    });

    it("only counts the last 7 days", () => {
        const expenses = [
            exp(A, addDays(TODAY, -6)),
            exp(A, addDays(TODAY, -7)),
        ];
        expect(condition({ expenses }).nourishment).toBeCloseTo(
            1 / NOURISH_FULL,
        );
    });
});

describe("exercise", () => {
    it("counts each source once per period over 30 days", () => {
        const snapshots: AccountSnapshot[] = [
            {
                id: "s1",
                account_id: "a1",
                household_id: "hh",
                balance: 1,
                snapshot_date: TODAY,
            },
            {
                id: "s2",
                account_id: "a2",
                household_id: "hh",
                balance: 1,
                snapshot_date: TODAY,
            },
            {
                id: "s3",
                account_id: "a1",
                household_id: "hh",
                balance: 1,
                snapshot_date: addDays(TODAY, -40),
            },
        ];
        const c = condition({
            snapshots,
            store: {
                exercise: {
                    balances: [TODAY], // same day as the snapshots
                    "recap-read": ["2026-11-02", "2026-11-04"], // same week
                    "month-end": ["2026-11-01", "2026-11-03"], // same month
                    "goal-add": ["2026-11-02", "2026-11-03"],
                },
            },
        });
        // balances 1 + recap 1 + month-end 1 + goal-add 2
        expect(c.fitness).toBeCloseTo(5 / FITNESS_FULL);
    });

    it("has a bonus source that is empty without bonus data", () => {
        const bonus = FEED_SOURCES.find((s) => s.id === "bonus")!;
        expect(bonus.collect(ctx())).toEqual([]);
        expect(
            bonus.collect(ctx({ bonusEvents: [{ event_date: TODAY }] })),
        ).toHaveLength(1);
    });

    it("accepts new sources", () => {
        const extra: FeedSource = {
            id: "custom",
            kind: "exercise",
            period: "day",
            collect: () => [
                { sourceId: "custom", kind: "exercise", date: TODAY },
            ],
        };
        const events = collectFeedEvents(ctx(), [...FEED_SOURCES, extra]);
        expect(events.some((e) => e.sourceId === "custom")).toBe(true);
    });
});

describe("body", () => {
    it("maps meters to the four bodies", () => {
        expect(bodyFor(0, 0)).toBe("regular");
        expect(bodyFor(METER_HIGH, 0)).toBe("chubby");
        expect(bodyFor(0, METER_HIGH)).toBe("lean");
        expect(bodyFor(1, 1)).toBe("buff");
    });

    it("a couple logging most days plus monthly chores reaches Buff", () => {
        const expenses: Expense[] = [];
        for (let d = 0; d < 7; d++) {
            if (d === 3) continue; // missed a day
            expenses.push(
                exp(A, addDays(TODAY, -d)),
                exp(B, addDays(TODAY, -d)),
            );
        }
        const c = condition({
            expenses,
            store: {
                exercise: {
                    balances: [addDays(TODAY, -5)],
                    "month-end": [addDays(TODAY, -5)],
                    "recap-read": [addDays(TODAY, -3), addDays(TODAY, -10)],
                },
            },
        });
        expect(c.body).toBe("buff");
    });

    it("drifts back to Regular when neglected, never worse", () => {
        const expenses = Array.from({ length: 10 }, (_, i) =>
            exp(A, addDays(TODAY, -i % 3), `e${i}`),
        );
        expect(condition({ expenses }).body).toBe("chubby");
        expect(condition({ expenses }, addDays(TODAY, 30)).body).toBe(
            "regular",
        );
    });
});

describe("mood", () => {
    it("follows days since anyone fed Bubby", () => {
        expect(moodFor(null)).toBe("normal");
        expect(moodFor(2)).toBe("normal");
        expect(moodFor(3)).toBe("rumbly");
        expect(moodFor(5)).toBe("teary");
        expect(moodFor(7)).toBe("missyou");
    });

    it("one feed brings Bubby straight back", () => {
        const old = [exp(A, addDays(TODAY, -8))];
        expect(condition({ expenses: old }).mood).toBe("missyou");
        expect(
            condition({ expenses: old, store: { petDays: { [B]: [TODAY] } } })
                .mood,
        ).toBe("normal");
    });

    it("rolls over at SGT midnight", () => {
        // 23:30 SGT on the 5th is 15:30Z
        const late: Expense = {
            ...exp(A, "2026-11-05"),
            created_at: "2026-11-05T15:30:00.000Z",
        };
        expect(
            condition({ expenses: [late] }, "2026-11-05").fedToday.has(A),
        ).toBe(true);
    });
});
