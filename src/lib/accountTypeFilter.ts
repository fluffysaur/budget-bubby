/**
 * Pure helpers for the multi-select account type filter on AccountsPage.
 * An empty selection means "All".
 */

import type { Account, AccountType } from "../types/finance";

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
    "Cash",
    "Investment",
    "CPF",
    "Other",
];

export const ACCOUNT_TYPE_FILTER_LABELS: Record<AccountType, string> = {
    Cash: "Cash",
    Investment: "Investments",
    CPF: "CPF",
    Other: "Other",
};

/** Toggles a type; deselecting the last one reverts to All (empty). */
export function toggleAccountType(
    selected: AccountType[],
    type: AccountType,
): AccountType[] {
    const next = selected.includes(type)
        ? selected.filter((t) => t !== type)
        : [...selected, type];
    return ACCOUNT_TYPE_ORDER.filter((t) => next.includes(t));
}

export function filterAccountsByTypes(
    accounts: Account[],
    selected: AccountType[],
): Account[] {
    if (selected.length === 0) return accounts;
    return accounts.filter((a) => selected.includes(a.type));
}

/** Card debt applies only for All or when Cash is selected. */
export function includesCardDebt(selected: AccountType[]): boolean {
    return selected.length === 0 || selected.includes("Cash");
}

/** "Net Worth" for All, else names joined as "A, B & C". */
export function getAccountFilterLabel(selected: AccountType[]): string {
    const names = ACCOUNT_TYPE_ORDER.filter((t) => selected.includes(t)).map(
        (t) => ACCOUNT_TYPE_FILTER_LABELS[t],
    );
    if (names.length === 0) return "Net Worth";
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export function calculateFilteredNetWorth(
    accounts: Account[],
    selected: AccountType[],
    cardDebt: number,
): number {
    const total = filterAccountsByTypes(accounts, selected).reduce(
        (sum, a) => sum + a.balance,
        0,
    );
    const debt = includesCardDebt(selected) ? cardDebt : 0;
    return Math.round((total - debt) * 100) / 100;
}
