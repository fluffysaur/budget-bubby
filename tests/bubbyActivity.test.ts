import { describe, it, expect, beforeEach, vi } from "vitest";
import { queryClient } from "../src/lib/queryClient";
import { queryKeys } from "../src/hooks/useFinanceQueries";
import { financeService } from "../src/services/financeService";
import {
    recordActivityCheckin,
    resetActivityCheckinState,
} from "../src/lib/bubby/activity";
import { matchPartnerMember, resolveLoggedInMember } from "../src/lib/members";
import { onAppEvent, type AppEventMap } from "../src/lib/appEvents";
import type { DailyCheckin, HouseholdMember } from "../src/types/finance";

const members: HouseholdMember[] = [
    { id: "mem-yj", household_id: "hh", display_name: "Yi Jia", role: "owner" },
    { id: "mem-r", household_id: "hh", display_name: "Rachel", role: "member" },
];

function checkin(member_id: string, checkin_date: string): DailyCheckin {
    return { id: `${member_id}-${checkin_date}`, household_id: "hh", member_id, checkin_date, type: "expense" };
}

describe("resolveLoggedInMember", () => {
    it("matches partner ids to display names, ignoring spaces and case", () => {
        expect(matchPartnerMember(members, "yijia")?.id).toBe("mem-yj");
        expect(matchPartnerMember(members, "rachel")?.id).toBe("mem-r");
        expect(matchPartnerMember(members, null)).toBeNull();
    });

    it("falls back to the given member, then the first member (demo mode)", () => {
        expect(resolveLoggedInMember(members, null, members[1])?.id).toBe("mem-r");
        expect(resolveLoggedInMember(members, null)?.id).toBe("mem-yj");
        expect(resolveLoggedInMember([], null)).toBeNull();
    });

    it("prefers the logged-in partner over the perspective member", () => {
        expect(resolveLoggedInMember(members, "rachel", members[0])?.id).toBe("mem-r");
    });
});

describe("recordActivityCheckin", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        queryClient.clear();
        resetActivityCheckinState();
    });

    it("checks in the logger for today, optimistically, and reports a first log", () => {
        const record = vi
            .spyOn(financeService, "recordDailyCheckin")
            .mockResolvedValue(checkin("mem-r", "2026-11-05"));
        // Yi Jia logged a dinner Rachel paid for on Monday: server checked in Rachel on Monday
        queryClient.setQueryData(queryKeys.dailyCheckins(), [checkin("mem-r", "2026-11-02")]);

        const events: AppEventMap["day:logged"][] = [];
        const off = onAppEvent("day:logged", (d) => events.push(d));
        const result = recordActivityCheckin("mem-yj", "expense", "2026-11-05");
        off();

        expect(result).toEqual({ firstForDate: true });
        expect(record).toHaveBeenCalledWith("mem-yj", "2026-11-05", "expense");
        const cached = queryClient.getQueryData<DailyCheckin[]>(queryKeys.dailyCheckins());
        expect(cached?.some((c) => c.member_id === "mem-yj" && c.checkin_date === "2026-11-05")).toBe(true);
        expect(events).toEqual([
            { memberId: "mem-yj", date: "2026-11-05", source: "expense", firstForDate: true },
        ]);
    });

    it("skips the network when today is already logged", () => {
        const record = vi.spyOn(financeService, "recordDailyCheckin");
        queryClient.setQueryData(queryKeys.dailyCheckins(), [checkin("mem-yj", "2026-11-05")]);

        expect(recordActivityCheckin("mem-yj", "expense", "2026-11-05")).toEqual({ firstForDate: false });
        expect(record).not.toHaveBeenCalled();
    });

    it("records once per member per day even before the cache refetches", () => {
        const record = vi
            .spyOn(financeService, "recordDailyCheckin")
            .mockResolvedValue(checkin("mem-yj", "2026-11-05"));
        recordActivityCheckin("mem-yj", "inbox", "2026-11-05");
        recordActivityCheckin("mem-yj", "inbox", "2026-11-05");
        expect(record).toHaveBeenCalledTimes(1);
    });

    it("does nothing without a member", () => {
        const record = vi.spyOn(financeService, "recordDailyCheckin");
        expect(recordActivityCheckin(null)).toBeNull();
        expect(record).not.toHaveBeenCalled();
    });
});
