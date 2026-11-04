/**
 * Recurring item helpers:
 * - Type classification (insurance/tax deduct; subscription/bill/other spend)
 */
import { describe, it, expect } from "vitest";
import {
    isDeductionType,
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
        ...overrides,
    };
}

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
