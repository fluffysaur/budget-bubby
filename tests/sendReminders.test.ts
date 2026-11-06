/**
 * Server-side reminder sender: selection, bundling and the hourly run.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockFinanceService } from "../src/services/mockFinanceService";
import {
    runSendReminders,
    toSingaporeWallClock,
    type SendRemindersDeps,
    type PushTarget,
} from "../src/server/sendReminders";
import {
    classifyReminder,
    selectForPush,
    buildPushMessages,
    withReadKeys,
    DIGEST_HOUR,
} from "../src/lib/reminders/push";
import { getReminderUrl } from "../src/lib/reminders/engine";
import type { AppReminder } from "../src/lib/reminders/rules";

const MEMBER = "mem-00000000-0011";

function reminder(overrides: Partial<AppReminder>): AppReminder {
    return {
        id: "r-1",
        type: "recurring_bill_due",
        title: "Netflix Due Tomorrow",
        message: "S$15.98 subscription",
        severity: "info",
        actionLabel: "View Recurring",
        actionType: "view_recurring",
        ...overrides,
    };
}

/** SGT wall-clock time -> real instant (SGT is UTC+8, no DST). */
function sgt(isoLocal: string): Date {
    return new Date(`${isoLocal}+08:00`);
}

function makeDeps(overrides: Partial<SendRemindersDeps> = {}): SendRemindersDeps & {
    sendPush: ReturnType<typeof vi.fn>;
    deleteSubscription: ReturnType<typeof vi.fn>;
} {
    const target: PushTarget = { endpoint: "https://push.example/a", p256dh: "p", auth: "a" };
    const deps = {
        service: mockFinanceService,
        listHouseholdIds: async () => ["hh-00000000-0001"],
        listMembers: async () => [{ id: MEMBER }],
        listSubscriptions: async () => [target],
        deleteSubscription: vi.fn().mockResolvedValue(undefined),
        sendPush: vi.fn().mockResolvedValue({ ok: true }),
        now: sgt("2026-10-29T19:00:00"),
        ...overrides,
    };
    return deps as SendRemindersDeps & {
        sendPush: ReturnType<typeof vi.fn>;
        deleteSubscription: ReturnType<typeof vi.fn>;
    };
}

describe("push selection", () => {
    it("classifies urgent, routine and immediate reminders", () => {
        expect(
            classifyReminder(reminder({ type: "credit_card_due", data: { daysUntilDue: 1 } })),
        ).toBe("urgent");
        expect(
            classifyReminder(reminder({ type: "credit_card_due", data: { daysUntilDue: -1 } })),
        ).toBe("urgent");
        expect(
            classifyReminder(reminder({ type: "credit_card_due", data: { daysUntilDue: 3 } })),
        ).toBe("routine");
        expect(classifyReminder(reminder({ type: "budget_limit", severity: "alert" }))).toBe(
            "urgent",
        );
        expect(classifyReminder(reminder({ type: "budget_limit", severity: "warning" }))).toBe(
            "immediate",
        );
        expect(classifyReminder(reminder({ type: "daily_checkin" }))).toBe("immediate");
        expect(classifyReminder(reminder({ type: "settlement_due" }))).toBe("immediate");
        expect(classifyReminder(reminder({ type: "recurring_bill_due" }))).toBe("routine");
        expect(classifyReminder(reminder({ type: "partner_shared_spend" }))).toBe("routine");
    });

    it("holds routine reminders until the morning bundle", () => {
        const list = [
            reminder({ id: "routine-1" }),
            reminder({ id: "urgent-1", type: "budget_limit", severity: "alert" }),
        ];
        const early = selectForPush(list, DIGEST_HOUR - 1);
        expect(early.single.map((r) => r.id)).toEqual(["urgent-1"]);
        expect(early.digest).toHaveLength(0);

        const morning = selectForPush(list, DIGEST_HOUR);
        expect(morning.digest.map((r) => r.id)).toEqual(["routine-1"]);
    });

    it("bundles several routine reminders into one push", () => {
        const messages = buildPushMessages(
            {
                single: [reminder({ id: "u", type: "budget_limit", severity: "alert", title: "Dining Over Budget", actionType: "view_budget" })],
                digest: [
                    reminder({ id: "d1", title: "Citi Due in 3 Days" }),
                    reminder({ id: "d2", title: "Netflix Due Tomorrow" }),
                    reminder({ id: "d3", title: "Update Balances" }),
                ],
            },
            "2026-10-29",
        );
        expect(messages).toHaveLength(2);
        expect(messages[0]).toMatchObject({ title: "Dining Over Budget", url: "/budget", keys: ["u"] });
        expect(messages[1]).toMatchObject({
            title: "3 Reminders",
            body: "Citi Due in 3 Days, Netflix Due Tomorrow, Update Balances",
            tag: "digest-2026-10-29",
            keys: ["d1", "d2", "d3"],
        });
    });

    it("sends a lone routine reminder as itself, not a bundle", () => {
        const messages = buildPushMessages(
            { single: [], digest: [reminder({ id: "d1", title: "Citi Due in 3 Days" })] },
            "2026-10-29",
        );
        expect(messages).toEqual([
            expect.objectContaining({ title: "Citi Due in 3 Days", keys: ["d1"], url: "/recurring" }),
        ]);
    });

    it("maps reminders to app paths and appends read keys", () => {
        expect(getReminderUrl(reminder({ actionType: "view_goals", data: { goalId: "g 1" } }))).toBe(
            "/goals?goalId=g%201",
        );
        expect(getReminderUrl(reminder({ actionType: "update_balances" }))).toBe("/accounts");
        expect(withReadKeys("/budget", ["a", "b"])).toBe("/budget?read=a%2Cb");
        expect(withReadKeys("/goals?goalId=g", ["a"])).toBe("/goals?goalId=g&read=a");
        expect(withReadKeys("/", [])).toBe("/");
    });
});

describe("runSendReminders", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("converts instants to Singapore wall-clock time", () => {
        const d = toSingaporeWallClock(new Date("2026-10-29T11:30:00Z"));
        expect(d.getHours()).toBe(19);
        expect(d.getMinutes()).toBe(30);
    });

    it("refuses to run unless exactly one household exists", async () => {
        await expect(
            runSendReminders(makeDeps({ listHouseholdIds: async () => ["a", "b"] })),
        ).rejects.toThrow(/exactly one household/);
        await expect(
            runSendReminders(makeDeps({ listHouseholdIds: async () => [] })),
        ).rejects.toThrow(/exactly one household/);
    });

    it("pushes each reminder once across hourly runs", async () => {
        const deps = makeDeps();
        const first = await runSendReminders(deps);
        expect(first.members[0].keys.length).toBeGreaterThan(0);
        // The seed household logged two days ago, so Bubby is fine: no nudge
        expect(first.members[0].keys.some((k) => k.startsWith("reminder-daily-checkin-"))).toBe(false);
        const pushesAfterFirst = deps.sendPush.mock.calls.length;
        expect(pushesAfterFirst).toBe(first.members[0].pushes);

        const second = await runSendReminders({ ...deps, now: sgt("2026-10-29T20:00:00") });
        expect(second.members[0].keys).toEqual([]);
        expect(deps.sendPush.mock.calls.length).toBe(pushesAfterFirst);
    });

    it("dry run reports without claiming or pushing", async () => {
        const deps = makeDeps({ dryRun: true });
        const dry = await runSendReminders(deps);
        expect(dry.dryRun).toBe(true);
        expect(dry.members[0].keys.length).toBeGreaterThan(0);
        expect(deps.sendPush).not.toHaveBeenCalled();

        // Nothing was claimed, so a real run still sends
        const real = makeDeps();
        const result = await runSendReminders(real);
        expect(result.members[0].keys).toEqual(dry.members[0].keys);
    });

    it("skips members with push off, no devices, or in quiet hours", async () => {
        await mockFinanceService.updateNotificationPreferences(MEMBER, { push_enabled: false });
        let result = await runSendReminders(makeDeps());
        expect(result.members[0].skipped).toBe("push_off");

        await mockFinanceService.updateNotificationPreferences(MEMBER, { push_enabled: true });
        result = await runSendReminders(makeDeps({ listSubscriptions: async () => [] }));
        expect(result.members[0].skipped).toBe("no_devices");

        // Default quiet hours 22:00-08:00
        result = await runSendReminders(makeDeps({ now: sgt("2026-10-29T23:00:00") }));
        expect(result.members[0].skipped).toBe("quiet_hours");
        expect(result.members[0].keys).toEqual([]);
    });

    it("removes devices the push service reports gone", async () => {
        const gone: PushTarget = { endpoint: "https://push.example/gone", p256dh: "p", auth: "a" };
        const live: PushTarget = { endpoint: "https://push.example/live", p256dh: "p", auth: "a" };
        const deps = makeDeps({ listSubscriptions: async () => [gone, live] });
        deps.sendPush.mockImplementation(async (target: PushTarget) =>
            target.endpoint === gone.endpoint ? { ok: false, gone: true } : { ok: true },
        );

        const result = await runSendReminders(deps);
        expect(result.members[0].removedDevices).toBe(1);
        expect(deps.deleteSubscription).toHaveBeenCalledTimes(1);
        expect(deps.deleteSubscription).toHaveBeenCalledWith(gone.endpoint);
        // After removal, later pushes in the same run only go to the live device
        const goneCalls = deps.sendPush.mock.calls.filter(([t]) => t.endpoint === gone.endpoint);
        expect(goneCalls).toHaveLength(1);
    });
});
