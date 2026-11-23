/**
 * Household CPF OA for the Roadmap. See docs/plans/2026-11-18-roadmap.md,
 * decisions 15-19.
 *
 * - OA accounts are found by `cpf_kind`, never by name. SA and MA never fund
 *   goals.
 * - OA growth is the average monthly change across the last OA snapshots,
 *   needing at least 3 snapshot dates; before that it is 0.
 * - Items "Paid from CPF OA" (a mortgage) change OA growth from their start
 *   month, unless the OA snapshots already reflect them.
 */

import { formatMonth, monthsBetween } from "../dateUtils";
import { oaEventsFromRecurring } from "./lifeEvents";
import type {
    Account,
    AccountSnapshot,
    RecurringItem,
    SavingsGoal,
} from "../../types/finance";
import type { RoadmapCpfOa } from "./types";

/** Snapshot dates needed before OA growth is measured. */
export const CPF_GROWTH_MIN_SNAPSHOTS = 3;
/** How many of the latest OA snapshot dates the growth averages over. */
export const CPF_GROWTH_WINDOW = 6;

const round2 = (n: number) => Math.round(n * 100) / 100;

export const isCpfOa = (acc: Pick<Account, "type" | "cpf_kind">) =>
    acc.type === "CPF" && acc.cpf_kind === "OA";

/** Average monthly OA growth, summed over the OA accounts. */
function oaGrowth(oaIds: Set<string>, snapshots: AccountSnapshot[]): number {
    // $0 snapshots are skipped: auto-created OA accounts open at $0, which
    // would otherwise read as a jump in growth on the first real update.
    const oaSnaps = snapshots.filter(
        (s) => oaIds.has(s.account_id) && (Number(s.balance) || 0) > 0,
    );
    const dates = [
        ...new Set(oaSnaps.map((s) => s.snapshot_date.slice(0, 10))),
    ].sort();
    if (dates.length < CPF_GROWTH_MIN_SNAPSHOTS) return 0;
    const from = dates[Math.max(0, dates.length - CPF_GROWTH_WINDOW)];

    let growth = 0;
    for (const id of oaIds) {
        const own = oaSnaps
            .filter(
                (s) =>
                    s.account_id === id && s.snapshot_date.slice(0, 10) >= from,
            )
            .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
        if (own.length < 2) continue;
        const first = own[0];
        const last = own[own.length - 1];
        const months = monthsBetween(first.snapshot_date, last.snapshot_date);
        if (months <= 0) continue;
        growth +=
            ((Number(last.balance) || 0) - (Number(first.balance) || 0)) /
            months;
    }
    return round2(growth);
}

/** Household OA (all members combined), or null with no OA accounts. */
export function computeCpfOa(
    accounts: Account[],
    snapshots: AccountSnapshot[],
    recurringItems: RecurringItem[],
    today: string,
    goals?: Pick<SavingsGoal, "id" | "target_date">[],
): RoadmapCpfOa | null {
    const oaAccounts = accounts.filter(isCpfOa);
    if (oaAccounts.length === 0) return null;
    const oaIds = new Set(oaAccounts.map((a) => a.id));

    const lastSnapshot = snapshots
        .filter((s) => oaIds.has(s.account_id))
        .map((s) => s.snapshot_date.slice(0, 10))
        .sort()
        .at(-1);
    const lastUpdated = oaAccounts
        .map((a) => a.updated_at?.slice(0, 10))
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1);
    const asOf = lastSnapshot ?? lastUpdated ?? today;

    return {
        balance: round2(
            oaAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0),
        ),
        monthlyGrowth: oaGrowth(oaIds, snapshots),
        asOf,
        changes: oaEventsFromRecurring(recurringItems, formatMonth(asOf), goals),
    };
}
