/**
 * Pure bonus log logic: split buckets, CPF defaults, monthly / YTD summaries
 * and year grouping. No React, no service calls.
 */

import type {
    BonusEvent,
    BonusMonthSummary,
    BonusSplitKey,
    BonusSplitShare,
    BonusType,
    HouseholdMember,
} from "../types/finance";

export { distributeGoalShare, goalGap, isGoalFundable } from "./goalDistribution";
export type { GoalDistributionMode } from "./goalDistribution";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface BonusSplitBucket {
    key: BonusSplitKey;
    label: string;
    color: string;
}

/** Fixed split buckets, in display order. */
export const BONUS_SPLIT_BUCKETS: readonly BonusSplitBucket[] = [
    { key: "tithing", label: "Tithing", color: "#8B5CF6" },
    { key: "goals", label: "Goals", color: "#3B82F6" },
    { key: "savings", label: "Savings", color: "#6366F1" },
    { key: "investments", label: "Investments", color: "#10B981" },
    { key: "lifestyle", label: "Lifestyle", color: "#EC4899" },
];

export const BONUS_SPLIT_KEYS: readonly BonusSplitKey[] = BONUS_SPLIT_BUCKETS.map((b) => b.key);

/** Seeded default split: Tithing 10 / Goals 40 / Savings 10 / Investments 20 / Lifestyle 20. */
export const DEFAULT_BONUS_SPLIT: readonly BonusSplitShare[] = [
    { key: "tithing", pct: 0.1 },
    { key: "goals", pct: 0.4 },
    { key: "savings", pct: 0.1 },
    { key: "investments", pct: 0.2 },
    { key: "lifestyle", pct: 0.2 },
];

export const BONUS_TYPES: readonly BonusType[] = ["aws", "performance", "sign_on", "other"];

export const BONUS_TYPE_LABELS: Record<BonusType, string> = {
    aws: "AWS",
    performance: "Performance",
    sign_on: "Sign-on",
    other: "Other",
};

export const DEFAULT_BONUS_CPF_RATE = 0.2;

/** Employee CPF on a bonus, rounded to cents. */
export function defaultBonusCpf(gross: number, rate: number = DEFAULT_BONUS_CPF_RATE): number {
    const safeGross = Math.max(0, Number(gross) || 0);
    const safeRate = Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_BONUS_CPF_RATE;
    return round2(safeGross * safeRate);
}

/** AWS is usually paid in December; otherwise default to Performance. */
export function defaultBonusType(receivedOn: string): BonusType {
    return receivedOn.slice(5, 7) === "12" ? "aws" : "performance";
}

export function cloneDefaultSplit(): BonusSplitShare[] {
    return DEFAULT_BONUS_SPLIT.map((s) => ({ ...s }));
}

/**
 * Cleans a stored split: unknown keys are dropped, missing buckets become 0,
 * order follows BONUS_SPLIT_BUCKETS, and a sum other than 1 is rescaled.
 * Falls back to the default split when nothing usable is left.
 */
export function normalizeBonusSplit(raw: unknown): BonusSplitShare[] {
    const byKey = new Map<BonusSplitKey, number>();
    if (Array.isArray(raw)) {
        for (const entry of raw) {
            if (!entry || typeof entry !== "object") continue;
            const key = (entry as { key?: unknown }).key;
            const pct = Number((entry as { pct?: unknown }).pct);
            if (
                typeof key === "string" &&
                (BONUS_SPLIT_KEYS as readonly string[]).includes(key) &&
                Number.isFinite(pct) &&
                pct >= 0
            ) {
                byKey.set(key as BonusSplitKey, pct);
            }
        }
    }
    const sum = Array.from(byKey.values()).reduce((s, v) => s + v, 0);
    if (sum <= 0) return cloneDefaultSplit();
    const scale = Math.abs(sum - 1) < 0.0001 ? 1 : 1 / sum;
    return BONUS_SPLIT_KEYS.map((key) => ({
        key,
        pct: Math.round((byKey.get(key) ?? 0) * scale * 10000) / 10000,
    }));
}

/**
 * Applies a split to the net bonus. Amounts are rounded to cents and the last
 * non-zero bucket absorbs the remainder, so the shares always sum to `net`.
 */
export function computeBonusSplit(net: number, split: readonly BonusSplitShare[]): BonusSplitShare[] {
    const netCents = Math.round(Math.max(0, Number(net) || 0) * 100);
    const lastIdx = split.reduce((last, s, idx) => (s.pct > 0 ? idx : last), -1);
    let assigned = 0;
    return split.map((s, idx) => {
        let cents = 0;
        if (s.pct > 0) {
            if (idx === lastIdx) {
                cents = netCents - assigned;
            } else {
                cents = Math.round(netCents * s.pct);
                assigned += cents;
            }
        }
        return { key: s.key, pct: s.pct, amount: cents / 100 };
    });
}

/** The amount assigned to one bucket of a computed split. */
export function getSplitAmount(split: readonly BonusSplitShare[], key: BonusSplitKey): number {
    return split.find((s) => s.key === key)?.amount ?? 0;
}

export interface BonusTotals {
    gross: number;
    cpf: number;
    net: number;
    count: number;
}

function sumEvents(events: readonly BonusEvent[]): BonusTotals {
    return events.reduce<BonusTotals>(
        (acc, e) => ({
            gross: round2(acc.gross + e.gross),
            cpf: round2(acc.cpf + e.cpf),
            net: round2(acc.net + e.net),
            count: acc.count + 1,
        }),
        { gross: 0, cpf: 0, net: 0, count: 0 },
    );
}

/** Total amount a bonus sent to goals. */
export function bonusGoalTotal(event: Pick<BonusEvent, "goal_contributions">): number {
    return round2((event.goal_contributions || []).reduce((s, c) => s + c.amount, 0));
}

/**
 * Bonus income for one member (or the household) in a month.
 * - Events exist → their sums (legacy column ignored to avoid double counting)
 * - No events, legacy column > 0 → legacy value as gross and net, no CPF
 * - Otherwise zeros
 */
export function summarizeBonusesForMonth(
    events: readonly BonusEvent[],
    month: string,
    ownerId: string | "household",
    legacyBonus: number = 0,
): BonusMonthSummary {
    const matching = events.filter(
        (e) =>
            e.received_on.startsWith(month) &&
            (ownerId === "household" || e.recipient_id === ownerId),
    );
    if (matching.length > 0) {
        return { ...sumEvents(matching), source: "events" };
    }
    const legacy = round2(Number(legacyBonus) || 0);
    if (legacy > 0) {
        return { gross: legacy, cpf: 0, net: legacy, count: 0, source: "legacy" };
    }
    return { gross: 0, cpf: 0, net: 0, count: 0, source: "none" };
}

export interface BonusYtdSummary {
    year: number;
    members: Array<BonusTotals & { memberId: string; name: string }>;
    household: BonusTotals;
}

/** Year-to-date totals per member and for the household. */
export function summarizeBonusesYtd(
    events: readonly BonusEvent[],
    year: number,
    members: readonly Pick<HouseholdMember, "id" | "display_name">[],
): BonusYtdSummary {
    const inYear = events.filter((e) => e.received_on.startsWith(`${year}-`));
    return {
        year,
        members: members.map((m) => ({
            memberId: m.id,
            name: m.display_name,
            ...sumEvents(inYear.filter((e) => e.recipient_id === m.id)),
        })),
        household: sumEvents(inYear),
    };
}

export interface BonusYearGroup {
    year: number;
    events: BonusEvent[];
    totals: BonusTotals;
}

/** Groups events by year, newest year first, events newest first. */
export function groupBonusesByYear(events: readonly BonusEvent[]): BonusYearGroup[] {
    const byYear = new Map<number, BonusEvent[]>();
    for (const e of events) {
        const year = Number(e.received_on.slice(0, 4));
        if (!Number.isFinite(year)) continue;
        const list = byYear.get(year) ?? [];
        list.push(e);
        byYear.set(year, list);
    }
    return Array.from(byYear.entries())
        .sort(([a], [b]) => b - a)
        .map(([year, list]) => {
            const sorted = [...list].sort((a, b) =>
                a.received_on === b.received_on
                    ? (b.created_at ?? "").localeCompare(a.created_at ?? "")
                    : b.received_on.localeCompare(a.received_on),
            );
            return { year, events: sorted, totals: sumEvents(sorted) };
        });
}
