import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    emitInboxEvent,
    onInboxEvent,
    InboxSessionTracker,
    noteInboxCount,
    INBOX_LAST_SEEN_KEY,
} from "../src/lib/inbox/inboxEvents";
import { isDayLogged, countDaysLogged, isCoupleDayLogged } from "../src/lib/logging/dayLogged";
import { financeService } from "../src/services/financeService";
import { mockFinanceService } from "../src/services/mockFinanceService";
import { queryClient } from "../src/lib/queryClient";
import type { DailyCheckin } from "../src/types/finance";

const checkin = (member_id: string, checkin_date: string): DailyCheckin => ({
    id: `${member_id}-${checkin_date}`,
    household_id: "h",
    member_id,
    checkin_date,
    type: "expense",
});

describe("inbox events", () => {
    beforeEach(() => localStorage.clear());

    it("emits and unsubscribes", () => {
        const handler = vi.fn();
        const off = onInboxEvent("inbox:item-discarded", handler);
        emitInboxEvent("inbox:item-discarded", { itemId: "i1", reason: "discarded", remaining: 2 });
        off();
        emitInboxEvent("inbox:item-discarded", { itemId: "i2", reason: "duplicate", remaining: 1 });
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ itemId: "i1", reason: "discarded", remaining: 2 });
    });

    it("fires inbox:cleared once per session", () => {
        const handler = vi.fn();
        const off = onInboxEvent("inbox:cleared", handler);
        let t = 1000;
        const tracker = new InboxSessionTracker(() => t);
        tracker.update(3, "2026-11-05");
        tracker.update(2, "2026-11-05");
        t = 6000;
        expect(tracker.update(0, "2026-11-05")).toBe(true);
        expect(tracker.update(0, "2026-11-05")).toBe(false);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ clearedCount: 3, durationMs: 5000, date: "2026-11-05" });
        // A new item starts a new session
        tracker.update(1, "2026-11-05");
        tracker.update(0, "2026-11-05");
        expect(handler).toHaveBeenCalledTimes(2);
        off();
    });

    it("never fires cleared when the session started empty", () => {
        const handler = vi.fn();
        const off = onInboxEvent("inbox:cleared", handler);
        const tracker = new InboxSessionTracker();
        tracker.update(0, "2026-11-05");
        tracker.update(0, "2026-11-05");
        expect(handler).not.toHaveBeenCalled();
        off();
    });

    it("emits items-arrived only when the count rises", () => {
        const handler = vi.fn();
        const off = onInboxEvent("inbox:items-arrived", handler);
        noteInboxCount(2); // first visit: just remember
        noteInboxCount(2);
        noteInboxCount(5);
        noteInboxCount(1);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ newCount: 3, pendingCount: 5 });
        expect(localStorage.getItem(INBOX_LAST_SEEN_KEY)).toBe("1");
        off();
    });
});

describe("dayLogged", () => {
    const rows = [checkin("a", "2026-11-04"), checkin("a", "2026-11-05"), checkin("b", "2026-11-05")];

    it("answers per member and per couple", () => {
        expect(isDayLogged(rows, "a", "2026-11-04")).toBe(true);
        expect(isDayLogged(rows, "b", "2026-11-04")).toBe(false);
        expect(countDaysLogged(rows, "a")).toBe(2);
        expect(countDaysLogged(rows, "a", "2026-11-05")).toBe(1);
        expect(isCoupleDayLogged(rows, ["a", "b"], "2026-11-05")).toBe(true);
        expect(isCoupleDayLogged(rows, ["a", "b"], "2026-11-04")).toBe(false);
        expect(isCoupleDayLogged(rows, [], "2026-11-05")).toBe(false);
    });
});

describe("day:logged from the finance service", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.setItem("budget_bubby_demo_pin", "true");
        mockFinanceService.resetData();
    });

    it("emits for an inbox confirm with firstForDate from the cache", async () => {
        const handler = vi.fn();
        const off = onInboxEvent("day:logged", handler);
        const [item] = (await financeService.getInboxItems()).items;
        queryClient.setQueryData(["finance", "daily-checkins", "all"], [checkin(item.member_id, "2026-11-01")]);
        await financeService.confirmInboxItem(item.id, {
            payer_id: item.member_id,
            date: "2026-11-01",
            item: item.merchant,
            amount: item.amount,
            is_shared: false,
        });
        expect(handler).toHaveBeenCalledWith({
            memberId: item.member_id,
            date: "2026-11-01",
            source: "inbox",
            firstForDate: false,
        });
        off();
        sessionStorage.clear();
    });
});
