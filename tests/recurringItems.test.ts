/**
 * Recurring item helpers:
 * - Due-day clamping to short months (incl. leap years)
 * - Next due date / days-until-due for monthly and annual schedules
 * - Per-category recurring spend (monthly full, annual amortized,
 *   start/end range, uncategorized, deduction types excluded)
 * - Type classification (insurance/tax deduct; subscription/bill/other spend)
 */
import { describe, it, expect } from "vitest";
import {
    addMonths,
    clampDueDay,
    getDaysInMonth,
    getNextDueDate,
    getDaysUntilDue,
    formatDueInDays,
    ordinal,
} from "../src/lib/dateUtils";
import {
    calculateRecurringCategorySpend,
    findDefaultRecurringCategoryId,
    getRecurringMonthlyAmount,
    getRecurringMonthlyShare,
    isRecurringItemActiveInMonth,
    isDeductionType,
    resolveDueDay,
    isSpendType,
    RECURRING_ITEM_TYPES,
    RECURRING_TYPE_LABELS,
} from "../src/lib/recurringItems";
import { calculateMemberRecurringDeductions } from "../src/lib/financialFormulas";
import type { RecurringItem } from "../src/types/finance";

const YJ = "mem-yj";
const RC = "mem-rc";

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
        category_id: null,
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
        expect(
            getDaysUntilDue({ frequency: "monthly", due_day: 15 }, ref),
        ).toBe(11);
    });

    it("monthly: due today counts as 0 days", () => {
        const ref = new Date(2026, 10, 4, 18, 30);
        expect(getDaysUntilDue({ frequency: "monthly", due_day: 4 }, ref)).toBe(
            0,
        );
    });

    it("monthly: rolls to next month and clamps day 31", () => {
        const ref = new Date(2026, 10, 30); // 30 Nov -> 31 clamps to 30 Nov (today)
        expect(
            getNextDueDate({ frequency: "monthly", due_day: 31 }, ref),
        ).toEqual(new Date(2026, 10, 30));
        const ref2 = new Date(2027, 0, 31); // 31 Jan: due today
        expect(
            getDaysUntilDue({ frequency: "monthly", due_day: 31 }, ref2),
        ).toBe(0);
        const ref3 = new Date(2028, 1, 1); // 1 Feb 2028, due 31 -> 29 Feb 2028
        expect(
            getNextDueDate({ frequency: "monthly", due_day: 31 }, ref3),
        ).toEqual(new Date(2028, 1, 29));
    });

    it("monthly: December wraps to January next year", () => {
        const ref = new Date(2026, 11, 20);
        expect(
            getNextDueDate({ frequency: "monthly", due_day: 5 }, ref),
        ).toEqual(new Date(2027, 0, 5));
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
            makeItem({
                type: "insurance",
                frequency: "annually",
                amount: 1200,
                monthly_amortized_amount: 100,
            }),
            makeItem({
                type: "tax",
                frequency: "annually",
                amount: 2400,
                monthly_amortized_amount: 200,
            }),
            makeItem({
                type: "bill",
                amount: 80,
                monthly_amortized_amount: 80,
            }),
            makeItem({
                type: "other",
                amount: 30,
                monthly_amortized_amount: 30,
            }),
            makeItem({
                type: "subscription",
                amount: 15,
                monthly_amortized_amount: 15,
            }),
        ];
        expect(calculateMemberRecurringDeductions(items, YJ)).toEqual({
            taxesMonthly: 200,
            insuranceMonthly: 100,
        });
    });
});

describe("Recurring monthly amount & active range", () => {
    it("monthly items count in full, annual items amortized", () => {
        expect(
            getRecurringMonthlyAmount(
                makeItem({ amount: 25, monthly_amortized_amount: 25 }),
            ),
        ).toBe(25);
        expect(
            getRecurringMonthlyAmount(
                makeItem({
                    frequency: "annually",
                    amount: 1200,
                    monthly_amortized_amount: 100,
                }),
            ),
        ).toBe(100);
        expect(
            getRecurringMonthlyAmount(
                makeItem({
                    frequency: "annually",
                    amount: 120,
                    monthly_amortized_amount: undefined as unknown as number,
                }),
            ),
        ).toBe(10);
    });

    it("respects start_date and end_date at month granularity", () => {
        const item = makeItem({
            start_date: "2026-03-15",
            end_date: "2026-08-02",
        });
        expect(isRecurringItemActiveInMonth(item, "2026-02")).toBe(false);
        expect(isRecurringItemActiveInMonth(item, "2026-03")).toBe(true);
        expect(isRecurringItemActiveInMonth(item, "2026-08")).toBe(true);
        expect(isRecurringItemActiveInMonth(item, "2026-09")).toBe(false);
        expect(isRecurringItemActiveInMonth(makeItem({}), "1999-01")).toBe(
            true,
        );
    });
});

describe("calculateRecurringCategorySpend", () => {
    const LIFESTYLE = "cat-lifestyle";
    const UTILITIES = "cat-utilities";

    const items: RecurringItem[] = [
        makeItem({
            id: "netflix",
            type: "subscription",
            amount: 20,
            monthly_amortized_amount: 20,
            category_id: LIFESTYLE,
        }),
        makeItem({
            id: "gym",
            type: "bill",
            amount: 120,
            monthly_amortized_amount: 120,
            category_id: LIFESTYLE,
        }),
        makeItem({
            id: "power",
            type: "bill",
            amount: 90,
            monthly_amortized_amount: 90,
            category_id: UTILITIES,
        }),
        makeItem({
            id: "cloud",
            type: "other",
            frequency: "annually",
            payment_month: 3,
            amount: 120,
            monthly_amortized_amount: 10,
            category_id: UTILITIES,
        }),
        makeItem({
            id: "misc",
            type: "other",
            amount: 5,
            monthly_amortized_amount: 5,
            category_id: null,
        }),
        makeItem({
            id: "ins",
            type: "insurance",
            amount: 1200,
            frequency: "annually",
            monthly_amortized_amount: 100,
            category_id: LIFESTYLE,
        }),
        makeItem({
            id: "rachel-sub",
            owner_id: RC,
            amount: 15,
            monthly_amortized_amount: 15,
            category_id: LIFESTYLE,
        }),
        makeItem({
            id: "joint-bill",
            owner_id: "joint",
            type: "bill",
            amount: 40,
            monthly_amortized_amount: 40,
            category_id: UTILITIES,
        }),
        makeItem({
            id: "future",
            amount: 50,
            monthly_amortized_amount: 50,
            start_date: "2026-12-01",
            category_id: LIFESTYLE,
        }),
        makeItem({
            id: "ended",
            amount: 60,
            monthly_amortized_amount: 60,
            end_date: "2026-10-31",
            category_id: LIFESTYLE,
        }),
    ];

    it("sums monthly items in full (and 50% for joint items per member) and annual items amortized per category", () => {
        const res = calculateRecurringCategorySpend(items, "2026-11", {
            ownerId: YJ,
        });
        expect(res.byCategory[LIFESTYLE].total).toBe(140); // netflix + gym
        expect(res.byCategory[UTILITIES].total).toBe(120); // power 90 + cloud 10 + joint 20 (50% of 40)
        expect(res.byCategory[LIFESTYLE].items.map((i) => i.id)).toEqual([
            "netflix",
            "gym",
        ]);
    });

    it("puts items with no category under uncategorized and counts them in total", () => {
        const res = calculateRecurringCategorySpend(items, "2026-11", {
            ownerId: YJ,
        });
        expect(res.uncategorized.total).toBe(5);
        expect(res.uncategorized.items.map((i) => i.id)).toEqual(["misc"]);
        expect(res.total).toBe(265);
    });

    it("excludes insurance/tax and items outside their active range", () => {
        const res = calculateRecurringCategorySpend(items, "2026-11", {
            ownerId: YJ,
        });
        const ids = [
            ...Object.values(res.byCategory).flatMap((b) => b.items),
            ...res.uncategorized.items,
        ].map((i) => i.id);
        expect(ids).not.toContain("ins");
        expect(ids).not.toContain("future");
        expect(ids).not.toContain("ended");
        expect(ids).not.toContain("rachel-sub");

        const dec = calculateRecurringCategorySpend(items, "2026-12", {
            ownerId: YJ,
        });
        expect(dec.byCategory[LIFESTYLE].items.map((i) => i.id)).toContain(
            "future",
        );
        const oct = calculateRecurringCategorySpend(items, "2026-10", {
            ownerId: YJ,
        });
        expect(oct.byCategory[LIFESTYLE].items.map((i) => i.id)).toContain(
            "ended",
        );
    });

    it("treats categories outside the budget as uncategorized", () => {
        const res = calculateRecurringCategorySpend(items, "2026-11", {
            ownerId: YJ,
            knownCategoryIds: [LIFESTYLE],
        });
        expect(res.byCategory[UTILITIES]).toBeUndefined();
        expect(res.uncategorized.total).toBe(125); // misc 5 + utilities 120
        expect(res.total).toBe(265);
    });

    it("includes every owner when no owner is given and counts joint items once across both members (M1)", () => {
        const householdRes = calculateRecurringCategorySpend(items, "2026-11");
        expect(householdRes.byCategory[LIFESTYLE].total).toBe(155);
        expect(householdRes.byCategory[UTILITIES].total).toBe(140); // power 90 + cloud 10 + joint 40 (1x)

        const yjRes = calculateRecurringCategorySpend(items, "2026-11", {
            ownerId: YJ,
        });
        const rcRes = calculateRecurringCategorySpend(items, "2026-11", {
            ownerId: RC,
        });
        expect(
            getRecurringMonthlyShare(
                items.find((i) => i.id === "joint-bill")!,
                YJ,
            ),
        ).toBe(20);
        expect(
            getRecurringMonthlyShare(
                items.find((i) => i.id === "joint-bill")!,
                RC,
            ),
        ).toBe(20);
        expect(
            getRecurringMonthlyShare(
                items.find((i) => i.id === "joint-bill")!,
                "household",
            ),
        ).toBe(40);
        expect(
            yjRes.byCategory[UTILITIES].total +
                rcRes.byCategory[UTILITIES].total,
        ).toBe(householdRes.byCategory[UTILITIES].total);
    });
});

describe("calculateMemberRecurringDeductions with month filter and joint items (M1 & M2)", () => {
    it("excludes ended and future insurance/tax policies when month is provided and splits joint deductions 50/50", () => {
        const deductionItems: RecurringItem[] = [
            makeItem({
                id: "active-ins",
                owner_id: YJ,
                type: "insurance",
                frequency: "annually",
                amount: 1200,
                monthly_amortized_amount: 100,
                start_date: "2025-01-01",
                end_date: "2027-12-31",
            }),
            makeItem({
                id: "ended-ins",
                owner_id: YJ,
                type: "insurance",
                frequency: "annually",
                amount: 600,
                monthly_amortized_amount: 50,
                start_date: "2024-01-01",
                end_date: "2026-06-30",
            }),
            makeItem({
                id: "future-tax",
                owner_id: YJ,
                type: "tax",
                frequency: "monthly",
                amount: 80,
                monthly_amortized_amount: 80,
                start_date: "2026-12-01",
                end_date: null,
            }),
            makeItem({
                id: "joint-tax",
                owner_id: "joint",
                type: "tax",
                frequency: "monthly",
                amount: 60,
                monthly_amortized_amount: 60,
                start_date: "2026-01-01",
                end_date: null,
            }),
        ];

        // In 2026-10: ended-ins (ended 2026-06) and future-tax (starts 2026-12) are excluded
        const yjOct = calculateMemberRecurringDeductions(
            deductionItems,
            YJ,
            "2026-10",
        );
        expect(yjOct).toEqual({
            insuranceMonthly: 100,
            taxesMonthly: 30, // 50% of joint-tax (60)
        });

        const rcOct = calculateMemberRecurringDeductions(
            deductionItems,
            RC,
            "2026-10",
        );
        expect(rcOct).toEqual({
            insuranceMonthly: 0,
            taxesMonthly: 30, // 50% of joint-tax (60)
        });

        // Combined household counts joint-tax once (60)
        const hhOct = calculateMemberRecurringDeductions(
            deductionItems,
            "household",
            "2026-10",
        );
        expect(hhOct).toEqual({
            insuranceMonthly: 100,
            taxesMonthly: 60,
        });
        expect(yjOct.taxesMonthly + rcOct.taxesMonthly).toBe(
            hhOct.taxesMonthly,
        );

        // In 2026-05: ended-ins is still active
        const yjMay = calculateMemberRecurringDeductions(
            deductionItems,
            YJ,
            "2026-05",
        );
        expect(yjMay.insuranceMonthly).toBe(150);
    });
});

describe("addMonths day clamping (L1) and ordinal formatting", () => {
    it("clamps YYYY-MM-DD dates to the end of short target months instead of overflowing", () => {
        expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
        expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
        expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
        expect(addMonths("2026-05-31", -1)).toBe("2026-04-30");
        expect(addMonths("2026-01", 1)).toBe("2026-02");
    });

    it("formats English ordinal suffixes accurately including 11th, 12th, 13th and 21st, 22nd, 23rd", () => {
        expect(ordinal(1)).toBe("1st");
        expect(ordinal(2)).toBe("2nd");
        expect(ordinal(3)).toBe("3rd");
        expect(ordinal(4)).toBe("4th");
        expect(ordinal(11)).toBe("11th");
        expect(ordinal(12)).toBe("12th");
        expect(ordinal(13)).toBe("13th");
        expect(ordinal(21)).toBe("21st");
        expect(ordinal(22)).toBe("22nd");
        expect(ordinal(23)).toBe("23rd");
        expect(ordinal(31)).toBe("31st");
    });
});

describe("findDefaultRecurringCategoryId", () => {
    it("matches the lifestyle category case-insensitively", () => {
        expect(
            findDefaultRecurringCategoryId([
                { id: "a", name: "Food" },
                { id: "b", name: "My LifeStyle" },
            ]),
        ).toBe("b");
        expect(
            findDefaultRecurringCategoryId([{ id: "a", name: "Food" }]),
        ).toBeNull();
        expect(findDefaultRecurringCategoryId([])).toBeNull();
    });
});
