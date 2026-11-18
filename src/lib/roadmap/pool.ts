/**
 * The household pool: all non-CPF balances (Cash, Investment, Other) minus
 * unpaid card statements, valued as of the last balance update. This is the
 * non-CPF net worth from docs/plans/2026-11-04-card-debt-net-worth.md.
 */

import { calculateCardDebt } from "../financialFormulas";
import type {
    Account,
    AccountSnapshot,
    CreditCardStatement,
} from "../../types/finance";
import type { RoadmapPool } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

const inPool = (acc: Pick<Account, "type">) => acc.type !== "CPF";

/** Distinct balance-update dates ('YYYY-MM-DD') for pool accounts, oldest first. */
export function balanceUpdateDates(
    accounts: Account[],
    snapshots: AccountSnapshot[],
): string[] {
    const ids = new Set(accounts.filter(inPool).map((a) => a.id));
    const dates = new Set(
        snapshots
            .filter((s) => ids.has(s.account_id))
            .map((s) => s.snapshot_date.slice(0, 10)),
    );
    return [...dates].sort();
}

/** 'YYYY-MM-DD' of the last balance update, or `today` with no history. */
export function lastBalanceUpdate(
    accounts: Account[],
    snapshots: AccountSnapshot[],
    today: string,
): string {
    const dates = balanceUpdateDates(accounts, snapshots);
    if (dates.length > 0) return dates[dates.length - 1];
    const updated = accounts
        .filter(inPool)
        .map((a) => a.updated_at?.slice(0, 10))
        .filter((d): d is string => Boolean(d))
        .sort();
    return updated.length > 0 ? updated[updated.length - 1] : today;
}

function splitPool(
    balances: Array<{ type: Account["type"]; balance: number }>,
    cardDebt: number,
    asOf: string,
): RoadmapPool {
    let liquid = 0;
    let investments = 0;
    for (const { type, balance } of balances) {
        if (type === "CPF") continue;
        if (type === "Investment") investments += balance;
        else liquid += balance;
    }
    return {
        liquid: round2(liquid - cardDebt),
        investments: round2(investments),
        asOf,
    };
}

/** Today's pool from live account balances (which match the last update). */
export function computePool(
    accounts: Account[],
    snapshots: AccountSnapshot[],
    statements: CreditCardStatement[],
    today: string,
): RoadmapPool {
    const asOf = lastBalanceUpdate(accounts, snapshots, today);
    return splitPool(
        accounts.map((a) => ({
            type: a.type,
            balance: Number(a.balance) || 0,
        })),
        calculateCardDebt(statements, asOf.slice(0, 7)),
        asOf,
    );
}

/** The pool as it stood on `date`, from each account's latest snapshot on or before it. */
export function poolAtDate(
    accounts: Account[],
    snapshots: AccountSnapshot[],
    statements: CreditCardStatement[],
    date: string,
): RoadmapPool {
    const latest = new Map<string, AccountSnapshot>();
    for (const snap of snapshots) {
        if (snap.snapshot_date.slice(0, 10) > date) continue;
        const prev = latest.get(snap.account_id);
        if (!prev || snap.snapshot_date > prev.snapshot_date) {
            latest.set(snap.account_id, snap);
        }
    }
    const balances = accounts.flatMap((a) => {
        const snap = latest.get(a.id);
        return snap
            ? [{ type: a.type, balance: Number(snap.balance) || 0 }]
            : [];
    });
    return splitPool(
        balances,
        calculateCardDebt(statements, date.slice(0, 7)),
        date,
    );
}
