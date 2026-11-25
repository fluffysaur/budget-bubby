import { describe, expect, it } from "vitest";
import { buildAccountTrends, daysSince, isStale } from "../accountTrend";
import type { AccountSnapshot } from "../../types/finance";

const snap = (
    account_id: string,
    snapshot_date: string,
    balance: number,
): AccountSnapshot => ({
    id: `${account_id}-${snapshot_date}`,
    account_id,
    household_id: "h",
    balance,
    snapshot_date,
});

describe("buildAccountTrends", () => {
    it("returns points oldest-first with delta", () => {
        const trends = buildAccountTrends(
            [
                snap("a", "2026-11-01", 1300),
                snap("a", "2026-09-01", 1000),
                snap("a", "2026-10-01", 1100),
            ],
            "2026-11-25",
        );
        expect(trends.get("a")).toEqual({
            points: [1000, 1100, 1300],
            delta: 300,
        });
    });

    it("omits accounts with fewer than 2 snapshots in window", () => {
        const trends = buildAccountTrends(
            [
                snap("a", "2026-11-01", 5),
                snap("b", "2025-01-01", 1),
                snap("b", "2026-11-02", 2),
            ],
            "2026-11-25",
        );
        expect(trends.has("a")).toBe(false);
        expect(trends.has("b")).toBe(false);
    });

    it("ignores future-dated snapshots", () => {
        const trends = buildAccountTrends(
            [snap("a", "2026-11-01", 5), snap("a", "2027-01-01", 9)],
            "2026-11-25",
        );
        expect(trends.size).toBe(0);
    });
});

describe("staleness", () => {
    it("computes days and stale threshold", () => {
        const now = new Date("2026-11-25T00:00:00Z");
        expect(daysSince("2026-10-11T00:00:00Z", now)).toBe(45);
        expect(daysSince(null, now)).toBeNull();
        expect(isStale(45)).toBe(true);
        expect(isStale(10)).toBe(false);
        expect(isStale(null)).toBe(false);
    });
});
