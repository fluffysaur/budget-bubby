import { describe, it, expect, beforeEach } from "vitest";
import {
    checkInboxReminder,
    type AppReminder,
} from "../src/lib/reminders/rules";
import { computeRemindersFrom, getReminderUrl, type ReminderDataSource } from "../src/lib/reminders/engine";
import { classifyReminder } from "../src/lib/reminders/push";
import { mockFinanceService } from "../src/services/mockFinanceService";
import type { InboxSummary } from "../src/types/finance";

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
