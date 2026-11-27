import { describe, expect, it } from "vitest";
import { upcomingRecurringChanges } from "../recurringUpcoming";
import type { RecurringItem } from "../../types/finance";

function item(overrides: Partial<RecurringItem>): RecurringItem {
    return {
        id: "r1",
        household_id: "hh-1",
        name: "HBO Max",
        type: "subscription",
        amount: 9.65,
        frequency: "monthly",
        ...overrides,
    } as RecurringItem;
}

const TODAY = "2026-11-27";

describe("upcomingRecurringChanges", () => {
    it("lists a future start as a cost", () => {
        const [c] = upcomingRecurringChanges(
            [item({ start_date: "2027-01-01" })],
            TODAY,
        );
        expect(c).toMatchObject({
            kind: "starts",
            month: "2027-01",
            monthlyDelta: -9.65,
        });
    });

    it("lists a future end as savings", () => {
        const [c] = upcomingRecurringChanges(
            [item({ end_date: "2027-03-31" })],
            TODAY,
        );
        expect(c).toMatchObject({ kind: "ends", monthlyDelta: 9.65 });
    });

    it("skips items already started and not ending", () => {
        expect(
            upcomingRecurringChanges(
                [item({ start_date: "2026-01-01" }), item({ id: "r2" })],
                TODAY,
            ),
        ).toEqual([]);
    });

    it("includes deductions like tax and insurance, with their type", () => {
        const out = upcomingRecurringChanges(
            [
                item({ id: "t", type: "tax", end_date: "2027-04-30" }),
                item({
                    id: "i",
                    type: "insurance",
                    start_date: "2027-03-01",
                }),
            ],
            TODAY,
        );
        expect(out).toMatchObject([
            { id: "i-starts", type: "insurance", monthlyDelta: -9.65 },
            { id: "t-ends", type: "tax", monthlyDelta: 9.65 },
        ]);
    });

    it("skips past ends and sorts soonest first", () => {
        const out = upcomingRecurringChanges(
            [
                item({ id: "late", start_date: "2027-06-01" }),
                item({ id: "soon", end_date: "2027-01-31" }),
                item({ id: "past", end_date: "2026-01-31" }),
            ],
            TODAY,
        );
        expect(out.map((c) => c.id)).toEqual(["soon-ends", "late-starts"]);
    });

    it("uses the linked goal's date for goal-linked starts", () => {
        const [c] = upcomingRecurringChanges(
            [item({ goal_id: "g1", goal_offset_months: 1, start_date: null })],
            TODAY,
            [{ id: "g1", target_date: "2027-04-01" }],
        );
        expect(c.month).toBe("2027-05");
    });
});
