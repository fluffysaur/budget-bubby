import { describe, expect, it } from "vitest";
import { buildYearOutlay } from "../recurringItems";
import type { RecurringItem } from "../../types/finance";

function item(overrides: Partial<RecurringItem>): RecurringItem {
    return {
        id: "r1",
        household_id: "hh-1",
        name: "Infant care",
        type: "bill",
        amount: 100,
        frequency: "monthly",
        ...overrides,
    } as RecurringItem;
}

const monthsWithItems = (...args: Parameters<typeof buildYearOutlay>) =>
    buildYearOutlay(...args)
        .filter((m) => m.monthlyItems.length + m.annualItems.length > 0)
        .map((m) => m.month);

describe("buildYearOutlay with goal-linked items", () => {
    // Goal target March 2027 + 3 months = starts June 2027
    const goalsById = new Map([["g1", { target_date: "2027-03-15" }]]);
    const linked = item({
        goal_id: "g1",
        goal_offset_months: 3,
        start_date: "2027-01-01",
    });

    it("leaves out months before the goal-derived start", () => {
        const may = buildYearOutlay([linked], 2027, goalsById)[4];
        expect(may.monthlyItems).toEqual([]);
        expect(may.total).toBe(0);
    });

    it("counts from the goal-derived start month onwards", () => {
        const june = buildYearOutlay([linked], 2027, goalsById)[5];
        expect(june.monthlyItems).toEqual([linked]);
        expect(june.total).toBe(100);
        expect(monthsWithItems([linked], 2027, goalsById)).toEqual([
            6, 7, 8, 9, 10, 11, 12,
        ]);
    });

    it("skips an annual payment that falls before the goal-derived start", () => {
        const annual = item({
            ...linked,
            frequency: "annually",
            payment_month: 4,
        });
        expect(monthsWithItems([annual], 2027, goalsById)).toEqual([]);
        expect(monthsWithItems([annual], 2028, goalsById)).toEqual([4]);
    });

    it("falls back to the stored start date when the goal has no target date", () => {
        const noTarget = new Map([["g1", { target_date: "" }]]);
        expect(monthsWithItems([linked], 2027, noTarget)).toHaveLength(12);
        expect(monthsWithItems([linked], 2026, noTarget)).toEqual([]);
    });

    it("leaves items without a goal link unchanged", () => {
        const unlinked = item({ start_date: "2027-10-01" });
        expect(monthsWithItems([unlinked], 2027, goalsById)).toEqual([
            10, 11, 12,
        ]);
    });
});
