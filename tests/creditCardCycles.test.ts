import { describe, it, expect } from "vitest";
import {
    getStatementDate,
    getLatestClosedMonth,
    getUnpaidCardCycles,
} from "../src/lib/creditCardCycles";
import { checkPendingCreditCardDueReminders } from "../src/lib/reminders/rules";
import type { CreditCard, CreditCardStatement } from "../src/types/finance";

const card = (over: Partial<CreditCard> = {}): CreditCard => ({
    id: "c1",
    household_id: "h1",
    owner_id: "m1",
    name: "Daily Card",
    bank: "Bank",
    billing_day: 10,
    due_day: 28,
    color: "#dfc2ff",
    is_active: true,
    ...over,
});

const stmt = (
    over: Partial<CreditCardStatement> = {},
): CreditCardStatement => ({
    id: "s1",
    card_id: "c1",
    household_id: "h1",
    month: "2026-10",
    statement_amount: 120,
    due_date: "2026-10-28",
    is_paid: false,
    ...over,
});

describe("getStatementDate", () => {
    it("uses the billing day of the month", () => {
        expect(getStatementDate("2026-10", 10)).toBe("2026-10-10");
    });

    it("clamps to short months", () => {
        expect(getStatementDate("2026-02", 31)).toBe("2026-02-28");
    });
});

describe("getLatestClosedMonth", () => {
    it("is the current month once the billing day is reached", () => {
        expect(getLatestClosedMonth(card(), "2026-11-10")).toBe("2026-11");
    });

    it("is the previous month before the billing day", () => {
        expect(getLatestClosedMonth(card(), "2026-11-09")).toBe("2026-10");
    });

    it("rolls back across years", () => {
        expect(getLatestClosedMonth(card(), "2026-01-03")).toBe("2025-12");
    });
});

describe("getUnpaidCardCycles", () => {
    it("computes a pending cycle with no logged statement", () => {
        const cycles = getUnpaidCardCycles([card()], [], "2026-11-12");
        expect(cycles).toHaveLength(1);
        expect(cycles[0]).toMatchObject({
            month: "2026-11",
            statementDate: "2026-11-10",
            dueDate: "2026-11-28",
            status: "pending",
            amount: null,
            statement: null,
            daysUntilDue: 16,
        });
    });

    it("rolls the due date to next month when due day is not after billing day", () => {
        const cycles = getUnpaidCardCycles(
            [card({ billing_day: 25, due_day: 10 })],
            [],
            "2026-11-26",
        );
        expect(cycles[0].dueDate).toBe("2026-12-10");
    });

    it("prefers the logged statement's amount and due date", () => {
        const logged = stmt({
            month: "2026-11",
            statement_amount: 250.5,
            due_date: "2026-11-30",
        });
        const cycles = getUnpaidCardCycles([card()], [logged], "2026-11-12");
        expect(cycles[0]).toMatchObject({
            status: "unpaid",
            amount: 250.5,
            dueDate: "2026-11-30",
            statement: logged,
        });
    });

    it("hides a paid latest cycle", () => {
        const paid = stmt({ month: "2026-11", is_paid: true });
        expect(getUnpaidCardCycles([card()], [paid], "2026-11-12")).toEqual([]);
    });

    it("keeps older logged unpaid statements and flags them overdue", () => {
        const old = stmt({
            id: "old",
            month: "2026-09",
            due_date: "2026-09-28",
        });
        const cycles = getUnpaidCardCycles([card()], [old], "2026-11-12");
        expect(cycles.map((c) => c.month)).toEqual(["2026-09", "2026-11"]);
        expect(cycles[0].daysUntilDue).toBeLessThan(0);
    });

    it("ignores inactive cards", () => {
        expect(
            getUnpaidCardCycles([card({ is_active: false })], [], "2026-11-12"),
        ).toEqual([]);
    });

    it("sorts by due date across cards", () => {
        const a = card({ id: "a", due_day: 28 });
        const b = card({ id: "b", due_day: 20 });
        const cycles = getUnpaidCardCycles([a, b], [], "2026-11-12");
        expect(cycles.map((c) => c.card.id)).toEqual(["b", "a"]);
    });

    it("filters by owner when a member id is given", () => {
        const mine = card({ id: "a", owner_id: "m1" });
        const theirs = card({ id: "b", owner_id: "m2" });
        const cycles = getUnpaidCardCycles(
            [mine, theirs],
            [],
            "2026-11-12",
            "m1",
        );
        expect(cycles.map((c) => c.card.id)).toEqual(["a"]);
    });
});

describe("checkPendingCreditCardDueReminders", () => {
    // billing 10, due 28 -> November cycle due 2026-11-28
    it("stays quiet outside every offset", () => {
        expect(
            checkPendingCreditCardDueReminders([card()], [], "2026-11-12"),
        ).toEqual([]);
    });

    it.each([
        ["2026-11-23", "Daily Card Due in 5 Days", "d5"],
        ["2026-11-27", "Daily Card Due Tomorrow", "d1"],
        ["2026-11-28", "Daily Card Due Today", "d0"],
        ["2026-11-29", "Daily Card Overdue", "overdue"],
    ])("fires on %s without a logged statement", (day, title, stage) => {
        const [r] = checkPendingCreditCardDueReminders(
            [card()],
            [],
            day,
            [5, 1, 0],
        );
        expect(r).toMatchObject({
            id: `reminder-cc-due-c1-2026-11-${stage}`,
            type: "credit_card_due",
            title,
            message: "Statement pending",
        });
    });

    it("skips cycles that already have a logged statement", () => {
        const logged = stmt({ month: "2026-11", due_date: "2026-11-28" });
        expect(
            checkPendingCreditCardDueReminders(
                [card()],
                [logged],
                "2026-11-27",
                [5, 1, 0],
            ),
        ).toEqual([]);
    });
});
