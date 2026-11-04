/**
 * Recurring item helpers:
 * - Due-day clamping to short months (incl. leap years)
 * - Next due date / days-until-due for monthly and annual schedules
 * - Type classification (insurance/tax deduct; subscription/bill/other spend)
 */
import { describe, it, expect } from "vitest";
import {
    clampDueDay,
    getDaysInMonth,
    getNextDueDate,
    getDaysUntilDue,
    formatDueInDays,
} from "../src/lib/dateUtils";
import {
    isDeductionType,
    resolveDueDay,
    isSpendType,
    RECURRING_ITEM_TYPES,
    RECURRING_TYPE_LABELS,
} from "../src/lib/recurringItems";
import { calculateMemberRecurringDeductions } from "../src/lib/financialFormulas";
import type { RecurringItem } from "../src/types/finance";

const YJ = "mem-yj";

function makeItem(overrides: Partial<RecurringItem>): RecurringItem {
    return {
        id: overrides.id ?? `ri-${Math.random().toString(36).slice(2, 8)}`,
        household_id: "hh-1",
        owner_id: YJ,
        type: "subscription",
        name: "Item",
        amount: 10,
        frequency: "monthly",
        payment_month: null,
        start_date: null,
        end_date: null,
        notes: null,
        monthly_amortized_amount: 10,
        due_day: 1,
        ...overrides,
    };
}

describe("Due day clamping", () => {
    it("returns days in month including leap years", () => {
        expect(getDaysInMonth(2026, 11)).toBe(30);
        expect(getDaysInMonth(2026, 2)).toBe(28);
        expect(getDaysInMonth(2028, 2)).toBe(29);
        expect(getDaysInMonth(2026, 12)).toBe(31);
    });

    it("clamps day 31 to the last day of short months", () => {
        expect(clampDueDay(31, 2026, 11)).toBe(30);
        expect(clampDueDay(31, 2026, 2)).toBe(28);
        expect(clampDueDay(31, 2028, 2)).toBe(29);
        expect(clampDueDay(30, 2027, 2)).toBe(28);
        expect(clampDueDay(31, 2026, 1)).toBe(31);
        expect(clampDueDay(15, 2026, 2)).toBe(15);
    });

    it("guards against out-of-range input", () => {
        expect(clampDueDay(0, 2026, 4)).toBe(1);
        expect(clampDueDay(-3, 2026, 4)).toBe(1);
        expect(clampDueDay(45, 2026, 4)).toBe(30);
    });
});

describe("Next due date", () => {
    it("monthly: due later this month", () => {
        const ref = new Date(2026, 10, 4); // 4 Nov 2026
        const next = getNextDueDate({ frequency: "monthly", due_day: 15 }, ref);
        expect(next).toEqual(new Date(2026, 10, 15));
        expect(getDaysUntilDue({ frequency: "monthly", due_day: 15 }, ref)).toBe(11);
    });

    it("monthly: due today counts as 0 days", () => {
        const ref = new Date(2026, 10, 4, 18, 30);
        expect(getDaysUntilDue({ frequency: "monthly", due_day: 4 }, ref)).toBe(0);
    });

    it("monthly: rolls to next month and clamps day 31", () => {
        const ref = new Date(2026, 10, 30); // 30 Nov -> 31 clamps to 30 Nov (today)
        expect(getNextDueDate({ frequency: "monthly", due_day: 31 }, ref)).toEqual(
            new Date(2026, 10, 30),
        );
        const ref2 = new Date(2027, 0, 31); // 31 Jan: due today
        expect(getDaysUntilDue({ frequency: "monthly", due_day: 31 }, ref2)).toBe(0);
        const ref3 = new Date(2028, 1, 1); // 1 Feb 2028, due 31 -> 29 Feb 2028
        expect(getNextDueDate({ frequency: "monthly", due_day: 31 }, ref3)).toEqual(
            new Date(2028, 1, 29),
        );
    });

    it("monthly: December wraps to January next year", () => {
        const ref = new Date(2026, 11, 20);
        expect(getNextDueDate({ frequency: "monthly", due_day: 5 }, ref)).toEqual(
            new Date(2027, 0, 5),
        );
    });

    it("annual: uses payment month and due day, wrapping to next year", () => {
        const ref = new Date(2026, 10, 4);
        expect(
            getNextDueDate(
                { frequency: "annually", payment_month: 12, due_day: 10 },
                ref,
            ),
        ).toEqual(new Date(2026, 11, 10));
        expect(
            getNextDueDate(
                { frequency: "annually", payment_month: 2, due_day: 31 },
                ref,
            ),
        ).toEqual(new Date(2027, 1, 28));
    });

    it("annual: defaults due day to 1 and returns null without payment month", () => {
        const ref = new Date(2026, 10, 4);
        expect(
            getNextDueDate({ frequency: "annually", payment_month: 12 }, ref),
        ).toEqual(new Date(2026, 11, 1));
        expect(getNextDueDate({ frequency: "annually" }, ref)).toBeNull();
        expect(getDaysUntilDue({ frequency: "annually" }, ref)).toBeNull();
    });

    it("formats due-in labels", () => {
        expect(formatDueInDays(0)).toBe("Due today");
        expect(formatDueInDays(1)).toBe("Due tomorrow");
        expect(formatDueInDays(9)).toBe("Due in 9 days");
    });
});

describe("resolveDueDay", () => {
    it("defaults monthly items to day 1 and annual items to null", () => {
        expect(resolveDueDay("monthly", null)).toBe(1);
        expect(resolveDueDay("monthly", undefined)).toBe(1);
        expect(resolveDueDay("annually", null)).toBeNull();
    });

    it("keeps valid days and bounds out-of-range values", () => {
        expect(resolveDueDay("monthly", 31)).toBe(31);
        expect(resolveDueDay("annually", 15)).toBe(15);
        expect(resolveDueDay("monthly", 0)).toBe(1);
        expect(resolveDueDay("monthly", 40)).toBe(31);
    });
});

describe("Recurring item types", () => {
    it("lists all five types with labels", () => {
        expect(RECURRING_ITEM_TYPES).toEqual([
            "insurance",
            "tax",
            "subscription",
            "bill",
            "other",
        ]);
        expect(RECURRING_TYPE_LABELS.bill).toBe("Bill");
        expect(RECURRING_TYPE_LABELS.other).toBe("Other");
    });

    it("only insurance and tax are deductions", () => {
        expect(isDeductionType("insurance")).toBe(true);
        expect(isDeductionType("tax")).toBe(true);
        expect(isDeductionType("subscription")).toBe(false);
        expect(isDeductionType("bill")).toBe(false);
        expect(isDeductionType("other")).toBe(false);
        expect(isSpendType("bill")).toBe(true);
        expect(isSpendType("insurance")).toBe(false);
    });

    it("bill and other items do not reduce take-home pay", () => {
        const items = [
            makeItem({ type: "insurance", frequency: "annually", amount: 1200, monthly_amortized_amount: 100 }),
            makeItem({ type: "tax", frequency: "annually", amount: 2400, monthly_amortized_amount: 200 }),
            makeItem({ type: "bill", amount: 80, monthly_amortized_amount: 80 }),
            makeItem({ type: "other", amount: 30, monthly_amortized_amount: 30 }),
            makeItem({ type: "subscription", amount: 15, monthly_amortized_amount: 15 }),
        ];
        expect(calculateMemberRecurringDeductions(items, YJ)).toEqual({
            taxesMonthly: 200,
            insuranceMonthly: 100,
        });
    });
});
