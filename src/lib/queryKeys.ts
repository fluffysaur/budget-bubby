/**
 * Query key registry for every finance query.
 *
 * One factory per domain. Every key starts with `["finance", ...]`, so a domain
 * prefix (for example `keys.expenses.all`) invalidates all of that domain's
 * queries. Do not write `["finance", ...]` literals elsewhere.
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ExpenseFilter, Perspective } from "../types/finance";

export const keys = {
    overview: {
        all: ["finance", "household-overview"] as const,
    },
    accounts: {
        all: ["finance", "accounts"] as const,
        list: (perspective?: Perspective) =>
            ["finance", "accounts", perspective ?? "household"] as const,
        snapshotsAll: ["finance", "account-snapshots"] as const,
        snapshots: (perspective?: Perspective) =>
            [
                "finance",
                "account-snapshots",
                perspective ?? "household",
            ] as const,
    },
    expenses: {
        /** Every filtered expense list. */
        all: ["finance", "expenses"] as const,
        list: (filter?: ExpenseFilter) =>
            ["finance", "expenses", filter ?? {}] as const,
        /** The unfiltered list. */
        every: ["finance", "all-expenses"] as const,
    },
    goals: {
        all: ["finance", "goals"] as const,
    },
    recurring: {
        all: ["finance", "recurringItems"] as const,
    },
    budget: {
        /** Monthly budgets, including the history rows. */
        monthlyAll: ["finance", "monthly-budget"] as const,
        month: (month: string, memberId?: string) =>
            ["finance", "monthly-budget", month, memberId ?? "all"] as const,
        history: (months: string[]) =>
            ["finance", "monthly-budget", "history", months.join(",")] as const,
        detailAll: ["finance", "budget-detail"] as const,
        detail: (
            month: string,
            perspective: Perspective,
            activeMemberId: string | undefined,
            memberIds: string[],
        ) =>
            [
                "finance",
                "budget-detail",
                month,
                perspective,
                activeMemberId,
                memberIds.join(","),
            ] as const,
        baseProfiles: ["finance", "base-profiles"] as const,
        baseAllocationsAll: ["finance", "base-allocations"] as const,
        baseAllocations: (profileId?: string) =>
            ["finance", "base-allocations", profileId ?? "all"] as const,
    },
    categories: {
        all: ["finance", "categories"] as const,
    },
    cards: {
        all: ["finance", "credit-cards"] as const,
        statementsAll: ["finance", "credit-card-statements"] as const,
        statements: (month?: string) =>
            ["finance", "credit-card-statements", month ?? "all"] as const,
    },
    dailyCheckins: {
        all: ["finance", "daily-checkins"] as const,
        list: (memberId?: string) =>
            ["finance", "daily-checkins", memberId ?? "all"] as const,
    },
    bonus: {
        events: ["finance", "bonus-events"] as const,
        splitDefaultAll: ["finance", "bonus-split-default"] as const,
        splitDefault: (memberId?: string) =>
            ["finance", "bonus-split-default", memberId ?? "none"] as const,
    },
    settleUps: {
        all: ["finance", "settle-ups"] as const,
    },
    inbox: {
        all: ["finance", "inbox"] as const,
        items: ["finance", "inbox", "items", "pending"] as const,
        summaryAll: ["finance", "inbox", "summary"] as const,
        summary: (memberId?: string) =>
            ["finance", "inbox", "summary", memberId ?? "household"] as const,
        rules: ["finance", "inbox", "rules"] as const,
        tokens: (memberId?: string) =>
            ["finance", "inbox", "tokens", memberId ?? "me"] as const,
    },
} as const;

/** Every finance query. */
export const ALL_FINANCE_KEY = ["finance"] as const;

export type InvalidationDomain =
    | "expenses"
    | "budget"
    | "accounts"
    | "goals"
    | "recurring"
    | "categories"
    | "cards"
    | "bonus";

/**
 * Query keys to refresh when a domain changes: the domain's own keys plus the
 * keys of dependent domains. Add a dependency here and every mutation of the
 * domain picks it up.
 */
export const INVALIDATION_MAP: Record<InvalidationDomain, readonly QueryKey[]> =
    {
        expenses: [
            keys.expenses.all,
            keys.settleUps.all,
            keys.expenses.every,
            keys.overview.all,
            keys.budget.monthlyAll,
            keys.budget.detailAll,
        ],
        budget: [
            keys.budget.monthlyAll,
            keys.budget.detailAll,
            keys.budget.baseProfiles,
            keys.budget.baseAllocationsAll,
            keys.overview.all,
        ],
        accounts: [
            keys.accounts.all,
            keys.accounts.snapshotsAll,
            keys.overview.all,
        ],
        goals: [keys.goals.all, keys.overview.all],
        recurring: [
            keys.recurring.all,
            keys.overview.all,
            keys.budget.monthlyAll,
            keys.budget.detailAll,
        ],
        categories: [
            keys.categories.all,
            keys.budget.monthlyAll,
            keys.budget.detailAll,
        ],
        cards: [keys.cards.all, keys.cards.statementsAll],
        bonus: [
            keys.bonus.events,
            keys.bonus.splitDefaultAll,
            keys.budget.monthlyAll,
            keys.budget.detailAll,
            keys.overview.all,
        ],
    };

/** Invalidate a domain and everything that depends on it. */
export function invalidateDomain(
    queryClient: QueryClient,
    domain: InvalidationDomain,
): void {
    for (const queryKey of INVALIDATION_MAP[domain]) {
        void queryClient.invalidateQueries({ queryKey });
    }
}
