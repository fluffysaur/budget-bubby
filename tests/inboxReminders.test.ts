import { describe, it, expect, beforeEach } from "vitest";
import {
    checkInboxReminder,
    checkMissingCreditCardStatements,
    checkCreditCardDueReminders,
    type AppReminder,
} from "../src/lib/reminders/rules";
import { computeRemindersFrom, getReminderUrl, type ReminderDataSource } from "../src/lib/reminders/engine";
import { classifyReminder } from "../src/lib/reminders/push";
import { mockFinanceService } from "../src/services/mockFinanceService";
import type { CreditCard, CreditCardStatement, InboxSummary } from "../src/types/finance";

const REF = new Date(2026, 10, 5, 19, 0, 0); // SGT wall clock, 7 PM
const summary = (over: Partial<InboxSummary> = {}): InboxSummary => ({
    available: true,
    pendingCount: 3,
    pendingTotalSgd: 84.2,
    oldestCapturedAt: new Date(REF.getTime() - 3600_000).toISOString(),
    ...over,
});

describe("checkInboxReminder", () => {
    it("fires after check-in time with a stable daily key and totals only", () => {
        const r = checkInboxReminder(summary(), 19, "m1", "2026-11-05", "18:00", REF);
        expect(r).toMatchObject({
            id: "reminder-inbox-m1-2026-11-05",
            type: "inbox_pending",
            title: "3 Purchases to Sort",
            message: "S$84.20 waiting.",
            severity: "info",
            actionLabel: "Sort Now",
            actionType: "view_inbox",
        });
        expect(checkInboxReminder(summary(), 20, "m1", "2026-11-05", "18:00", REF)?.id).toBe(r?.id);
    });

    it("is gated by check-in time, count and availability", () => {
        expect(checkInboxReminder(summary(), 17, "m1", "2026-11-05", "18:00", REF)).toBeNull();
        expect(checkInboxReminder(summary({ pendingCount: 0 }), 19, "m1", "2026-11-05")).toBeNull();
        expect(checkInboxReminder(summary({ available: false }), 19, "m1", "2026-11-05")).toBeNull();
        expect(checkInboxReminder(null, 19, "m1", "2026-11-05")).toBeNull();
    });

    it("warns when the oldest item is over 3 days old", () => {
        const old = summary({
            pendingCount: 1,
            oldestCapturedAt: new Date(REF.getTime() - 4 * 86_400_000).toISOString(),
        });
        expect(checkInboxReminder(old, 19, "m1", "2026-11-05", "18:00", REF)).toMatchObject({
            severity: "warning",
            title: "1 Purchase to Sort",
        });
    });
});

describe("inbox reminder", () => {
    it("routes and classifies the inbox nudge", () => {
        const r = checkInboxReminder(summary(), 19, "m1", "2026-11-05", "18:00", REF) as AppReminder;
        expect(getReminderUrl(r)).toBe("/inbox");
        expect(classifyReminder(r)).toBe("immediate");
    });
});

describe("engine with the inbox", () => {
    beforeEach(() => {
        localStorage.clear();
        mockFinanceService.resetData();
    });

    const opts = { memberId: "mem-00000000-0011", currentHour: 19, referenceDate: REF };

    it("sends at most one logging nudge: inbox replaces daily check-in", async () => {
        const reminders = await computeRemindersFrom(mockFinanceService, opts);
        const types = reminders.map((r) => r.type);
        expect(types).toContain("inbox_pending");
        expect(types).not.toContain("daily_checkin");
    });

    it("survives a getInboxSummary throw (before the migration)", async () => {
        const source: ReminderDataSource = {
            getNotificationPreferences: (id: string) => mockFinanceService.getNotificationPreferences(id),
            getNotificationLog: (id: string) => mockFinanceService.getNotificationLog(id),
            getAllAccountSnapshots: (p) => mockFinanceService.getAllAccountSnapshots(p),
            getCreditCardStatements: (m) => mockFinanceService.getCreditCardStatements(m),
            getCreditCards: () => mockFinanceService.getCreditCards(),
            getHouseholdOverview: () => mockFinanceService.getHouseholdOverview(),
            getExpenses: (f) => mockFinanceService.getExpenses(f),
            getRecurringItems: () => mockFinanceService.getRecurringItems(),
            getGoals: () => mockFinanceService.getGoals(),
            getDailyCheckins: (id) => mockFinanceService.getDailyCheckins(id),
            getMonthlyBudget: (m, id) => mockFinanceService.getMonthlyBudget(m, id),
            getInboxSummary: async () => {
                throw { code: "42P01" };
            },
        } as ReminderDataSource;
        const reminders = await computeRemindersFrom(source, opts);
        expect(reminders.map((r) => r.type)).not.toContain("inbox_pending");
    });
});

describe("credit card missing-statement & statement-date reminders (Issue #81)", () => {
    const makeCard = (over: Partial<CreditCard> = {}): CreditCard => ({
        id: "cc-test-1",
        household_id: "hh-1",
        owner_id: "mem-1",
        name: "DBS Altitude",
        bank: "DBS",
        billing_day: 15,
        due_day: 5,
        color: "#0284c7",
        is_active: true,
        ...over,
    });

    const makeStatement = (over: Partial<CreditCardStatement> = {}): CreditCardStatement => ({
        id: "stmt-test-1",
        card_id: "cc-test-1",
        household_id: "hh-1",
        month: "2026-10",
        statement_amount: 850.5,
        due_date: "2026-11-05",
        is_paid: false,
        ...over,
    });

    it("fires on the statement date itself (billing_day) when no statement is logged", () => {
        const card = makeCard({ billing_day: 15 });
        const onBillingDay = new Date("2026-10-15T12:00:00");
        const reminders = checkMissingCreditCardStatements([card], [], onBillingDay);
        expect(reminders).toHaveLength(1);
        expect(reminders[0]).toMatchObject({
            id: "reminder-cc-missing-cc-test-1-2026-10",
            type: "credit_card_missing_stmt",
            title: "DBS Altitude Statement Needed",
            message: "Cycle closed on day 15.",
            severity: "info",
            actionLabel: "Add Statement",
            actionType: "view_cc",
        });
    });

    it("does not fire before the statement date", () => {
        const card = makeCard({ billing_day: 15 });
        const beforeBillingDay = new Date("2026-10-14T12:00:00");
        const reminders = checkMissingCreditCardStatements([card], [], beforeBillingDay);
        expect(reminders).toHaveLength(0);
    });

    it("continues to fire after the statement date while statement is unlogged", () => {
        const card = makeCard({ billing_day: 15 });
        const afterBillingDay = new Date("2026-10-20T12:00:00");
        const reminders = checkMissingCreditCardStatements([card], [], afterBillingDay);
        expect(reminders).toHaveLength(1);
        expect(reminders[0].id).toBe("reminder-cc-missing-cc-test-1-2026-10");
    });

    it("stops firing once a statement has been logged for the month", () => {
        const card = makeCard({ billing_day: 15 });
        const stmt = makeStatement({ card_id: card.id, month: "2026-10" });
        const afterBillingDay = new Date("2026-10-20T12:00:00");
        const reminders = checkMissingCreditCardStatements([card], [stmt], afterBillingDay);
        expect(reminders).toHaveLength(0);
    });

    it("clamps billing_day to month length so 31st billing days fire in 30-day months", () => {
        const card = makeCard({ id: "cc-nov-31", billing_day: 31 });
        // Nov 29: 30-day month, before effective clamped billing day (30)
        expect(
            checkMissingCreditCardStatements([card], [], new Date("2026-11-29T12:00:00")),
        ).toHaveLength(0);
        // Nov 30: clamped billing day reached, statement missing
        const reminders = checkMissingCreditCardStatements(
            [card],
            [],
            new Date("2026-11-30T12:00:00"),
        );
        expect(reminders).toHaveLength(1);
        expect(reminders[0].id).toBe("reminder-cc-missing-cc-nov-31-2026-11");
        expect(reminders[0].message).toBe("Cycle closed on day 30.");
    });

    it("ignores inactive cards", () => {
        const card = makeCard({ billing_day: 10, is_active: false });
        const reminders = checkMissingCreditCardStatements([card], [], new Date("2026-10-15T12:00:00"));
        expect(reminders).toHaveLength(0);
    });

    it("scopes reminders to the active member when specified", () => {
        const card1 = makeCard({ id: "c1", owner_id: "mem-1", billing_day: 10 });
        const card2 = makeCard({ id: "c2", owner_id: "mem-2", billing_day: 10 });
        const testDate = new Date("2026-10-15T12:00:00");

        const mem1Reminders = checkMissingCreditCardStatements([card1, card2], [], testDate, "mem-1");
        expect(mem1Reminders).toHaveLength(1);
        expect(mem1Reminders[0].data?.cardId).toBe("c1");

        const mem2Reminders = checkMissingCreditCardStatements([card1, card2], [], testDate, "mem-2");
        expect(mem2Reminders).toHaveLength(1);
        expect(mem2Reminders[0].data?.cardId).toBe("c2");
    });

    it("differentiates statement date reminders from payment due date reminders", () => {
        const card = makeCard({ billing_day: 15, due_day: 5 });
        // Phase 1: On statement date (Oct 15) -> statement needed reminder fires
        const missingOnStmtDate = checkMissingCreditCardStatements(
            [card],
            [],
            new Date("2026-10-15T12:00:00"),
        );
        expect(missingOnStmtDate).toHaveLength(1);
        expect(missingOnStmtDate[0].type).toBe("credit_card_missing_stmt");
        expect(missingOnStmtDate[0].title).toBe("DBS Altitude Statement Needed");

        // Phase 2: User logs statement for Oct (due 2026-11-05)
        const stmt = makeStatement({
            card_id: card.id,
            month: "2026-10",
            due_date: "2026-11-05",
            statement_amount: 500,
            is_paid: false,
            card,
        });

        // Missing statement reminder is now cleared
        const missingAfterLog = checkMissingCreditCardStatements(
            [card],
            [stmt],
            new Date("2026-10-20T12:00:00"),
        );
        expect(missingAfterLog).toHaveLength(0);

        // Phase 3: Payment due date reminder fires near due date (e.g. 3 days before on Nov 2)
        const dueReminders = checkCreditCardDueReminders(
            [stmt],
            "2026-11-02",
            [7, 3, 1, 0],
        );
        expect(dueReminders).toHaveLength(1);
        expect(dueReminders[0].type).toBe("credit_card_due");
        expect(dueReminders[0].title).toBe("DBS Altitude Due in 3 Days");
        expect(dueReminders[0].message).toBe("S$500.00 statement");
    });

    it("handles string reference dates and ISO strings normalized to Singapore time", () => {
        const card = makeCard({ billing_day: 15 });
        // UTC 16:30 on Oct 14 is 00:30 on Oct 15 in Singapore -> statement date reached
        const reminders = checkMissingCreditCardStatements(
            [card],
            [],
            "2026-10-14T16:30:00Z",
        );
        expect(reminders).toHaveLength(1);
        expect(reminders[0].id).toBe("reminder-cc-missing-cc-test-1-2026-10");

        // Date-only string "2026-10-14" is before billing day 15
        expect(
            checkMissingCreditCardStatements([card], [], "2026-10-14"),
        ).toHaveLength(0);

        // Date-only string "2026-10-15" triggers on billing day 15
        expect(
            checkMissingCreditCardStatements([card], [], "2026-10-15"),
        ).toHaveLength(1);
    });
});
