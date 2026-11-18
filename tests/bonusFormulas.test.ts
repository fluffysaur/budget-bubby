import { describe, it, expect } from "vitest";
import {
    computeBonusSplit,
    defaultBonusCpf,
    defaultBonusType,
    DEFAULT_BONUS_SPLIT,
    groupBonusesByYear,
    normalizeBonusSplit,
    summarizeBonusesForMonth,
    summarizeBonusesYtd,
} from "../src/lib/bonusFormulas";
import { isMissingRelationError } from "../src/lib/supabaseErrors";
import type { BonusEvent } from "../src/types/finance";

const event = (overrides: Partial<BonusEvent>): BonusEvent => ({
    id: overrides.id ?? "b1",
    household_id: "hh",
    recipient_id: "yj",
    type: "performance",
    received_on: "2026-03-15",
    gross: 1000,
    cpf: 200,
    net: 800,
    split: [],
    goal_contributions: [],
    ...overrides,
});

const sumAmounts = (list: { amount?: number }[]) =>
    Math.round(list.reduce((s, x) => s + (x.amount ?? 0), 0) * 100) / 100;

describe("defaultBonusCpf", () => {
    it("uses 20% by default", () => {
        expect(defaultBonusCpf(10000)).toBe(2000);
    });

    it("uses a custom rate", () => {
        expect(defaultBonusCpf(3333.33, 0.17)).toBe(566.67);
    });

    it("never goes negative", () => {
        expect(defaultBonusCpf(-50)).toBe(0);
    });
});

describe("defaultBonusType", () => {
    it("is AWS in December and Performance otherwise", () => {
        expect(defaultBonusType("2026-12-20")).toBe("aws");
        expect(defaultBonusType("2026-03-01")).toBe("performance");
    });
});

describe("computeBonusSplit", () => {
    it("sums exactly to net for awkward amounts", () => {
        const shares = computeBonusSplit(3333.33, DEFAULT_BONUS_SPLIT);
        expect(sumAmounts(shares)).toBe(3333.33);
        expect(shares.find((s) => s.key === "goals")?.amount).toBe(1333.33);
    });

    it("puts the remainder on the last non-zero bucket", () => {
        const shares = computeBonusSplit(100.01, [
            { key: "tithing", pct: 0.5 },
            { key: "goals", pct: 0.5 },
            { key: "savings", pct: 0 },
        ]);
        expect(shares.map((s) => s.amount)).toEqual([50.01, 50, 0]);
        expect(sumAmounts(shares)).toBe(100.01);
    });
});

describe("normalizeBonusSplit", () => {
    it("drops unknown keys, fills missing buckets and rescales", () => {
        const split = normalizeBonusSplit([
            { key: "goals", pct: 2 },
            { key: "lifestyle", pct: 2 },
            { key: "holiday", pct: 5 },
        ]);
        expect(split.map((s) => s.key)).toEqual([
            "tithing",
            "goals",
            "savings",
            "investments",
            "lifestyle",
        ]);
        expect(split.find((s) => s.key === "goals")?.pct).toBe(0.5);
        expect(split.find((s) => s.key === "tithing")?.pct).toBe(0);
    });

    it("falls back to the default split for junk", () => {
        expect(normalizeBonusSplit(null)).toEqual(DEFAULT_BONUS_SPLIT);
    });
});

describe("summarizeBonusesForMonth", () => {
    const events = [
        event({
            id: "1",
            recipient_id: "yj",
            received_on: "2026-03-01",
            gross: 1000,
            cpf: 200,
            net: 800,
        }),
        event({
            id: "2",
            recipient_id: "yj",
            received_on: "2026-03-20",
            gross: 500,
            cpf: 100,
            net: 400,
        }),
        event({
            id: "3",
            recipient_id: "rc",
            received_on: "2026-03-05",
            gross: 2000,
            cpf: 400,
            net: 1600,
        }),
    ];

    it("uses events and ignores the legacy value", () => {
        expect(summarizeBonusesForMonth(events, "2026-03", "yj", 9999)).toEqual(
            {
                gross: 1500,
                cpf: 300,
                net: 1200,
                count: 2,
                source: "events",
            },
        );
    });

    it("sums the household", () => {
        expect(
            summarizeBonusesForMonth(events, "2026-03", "household").gross,
        ).toBe(3500);
    });

    it("falls back to the legacy column", () => {
        expect(summarizeBonusesForMonth(events, "2026-04", "yj", 1500)).toEqual(
            {
                gross: 1500,
                cpf: 0,
                net: 1500,
                count: 0,
                source: "legacy",
            },
        );
    });

    it("reports none", () => {
        expect(summarizeBonusesForMonth([], "2026-04", "yj", 0).source).toBe(
            "none",
        );
    });
});

describe("summarizeBonusesYtd", () => {
    it("totals per member and household for the year", () => {
        const ytd = summarizeBonusesYtd(
            [
                event({
                    id: "1",
                    recipient_id: "yj",
                    received_on: "2026-01-10",
                }),
                event({
                    id: "2",
                    recipient_id: "rc",
                    received_on: "2026-06-10",
                    gross: 2000,
                    cpf: 400,
                    net: 1600,
                }),
                event({
                    id: "3",
                    recipient_id: "yj",
                    received_on: "2025-12-10",
                }),
            ],
            2026,
            [
                { id: "yj", display_name: "Yi Jia" },
                { id: "rc", display_name: "Rachel" },
            ],
        );
        expect(ytd.members[0]).toMatchObject({
            memberId: "yj",
            gross: 1000,
            net: 800,
            count: 1,
        });
        expect(ytd.members[1]).toMatchObject({
            memberId: "rc",
            gross: 2000,
            net: 1600,
            count: 1,
        });
        expect(ytd.household).toEqual({
            gross: 3000,
            cpf: 600,
            net: 2400,
            count: 2,
        });
    });
});

describe("groupBonusesByYear", () => {
    it("orders years and events newest first", () => {
        const groups = groupBonusesByYear([
            event({ id: "old", received_on: "2025-12-01" }),
            event({ id: "mar", received_on: "2026-03-01" }),
            event({ id: "nov", received_on: "2026-11-01" }),
        ]);
        expect(groups.map((g) => g.year)).toEqual([2026, 2025]);
        expect(groups[0].events.map((e) => e.id)).toEqual(["nov", "mar"]);
        expect(groups[0].totals.count).toBe(2);
    });
});

describe("isMissingRelationError", () => {
    it("recognises missing tables and functions", () => {
        for (const code of ["42P01", "PGRST205", "42883", "PGRST202"]) {
            expect(isMissingRelationError({ code })).toBe(true);
        }
        expect(isMissingRelationError({ code: "23505" })).toBe(false);
        expect(isMissingRelationError(null)).toBe(false);
    });
});
