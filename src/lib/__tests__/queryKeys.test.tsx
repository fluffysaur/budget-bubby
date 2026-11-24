import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
    INVALIDATION_MAP,
    invalidateDomain,
    keys,
    type InvalidationDomain,
} from "../queryKeys";
import { useInvalidateFinance } from "../../hooks/finance/shared";

/** Snapshot of what each domain refreshed before the registry existed. */
const EXPECTED: Record<InvalidationDomain, string[]> = {
    expenses: [
        "expenses",
        "settle-ups",
        "all-expenses",
        "household-overview",
        "monthly-budget",
        "budget-detail",
    ],
    budget: [
        "monthly-budget",
        "budget-detail",
        "base-profiles",
        "base-allocations",
        "household-overview",
    ],
    accounts: ["accounts", "account-snapshots", "household-overview"],
    goals: ["goals", "household-overview"],
    recurring: [
        "recurringItems",
        "household-overview",
        "monthly-budget",
        "budget-detail",
    ],
    categories: ["categories", "monthly-budget", "budget-detail"],
    cards: ["credit-cards", "credit-card-statements"],
    bonus: [
        "bonus-events",
        "bonus-split-default",
        "monthly-budget",
        "budget-detail",
        "household-overview",
    ],
};

const HOOK_FOR: Record<
    InvalidationDomain,
    keyof ReturnType<typeof useInvalidateFinance>
> = {
    expenses: "invalidateExpenses",
    budget: "invalidateBudget",
    accounts: "invalidateAccounts",
    goals: "invalidateGoals",
    recurring: "invalidateRecurring",
    categories: "invalidateCategories",
    cards: "invalidateCreditCards",
    bonus: "invalidateBonus",
};

describe("query key registry", () => {
    it("every key lives under the finance root", () => {
        expect(keys.expenses.list({ month: "2026-01" })[0]).toBe("finance");
        expect(
            keys.budget.detail("2026-01", "household", undefined, ["a"])[0],
        ).toBe("finance");
        expect(keys.inbox.summary()[0]).toBe("finance");
    });

    it("domain prefixes match their parameterised keys", () => {
        expect(keys.accounts.list("personal").slice(0, 2)).toEqual([
            ...keys.accounts.all,
        ]);
        expect(keys.budget.history(["2026-01"]).slice(0, 2)).toEqual([
            ...keys.budget.monthlyAll,
        ]);
        expect(keys.inbox.items.slice(0, 2)).toEqual([...keys.inbox.all]);
    });

    it.each(Object.keys(EXPECTED) as InvalidationDomain[])(
        "%s invalidates the same key set as before",
        (domain) => {
            const names = INVALIDATION_MAP[domain].map((k) => k[1]);
            expect(names).toEqual(EXPECTED[domain]);
        },
    );

    it("invalidateDomain calls invalidateQueries once per key", () => {
        const qc = new QueryClient();
        const spy = vi.spyOn(qc, "invalidateQueries");
        invalidateDomain(qc, "goals");
        expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([
            ...INVALIDATION_MAP.goals,
        ]);
    });

    it.each(Object.keys(HOOK_FOR) as InvalidationDomain[])(
        "useInvalidateFinance.%s uses the map",
        (domain) => {
            const qc = new QueryClient();
            const spy = vi.spyOn(qc, "invalidateQueries");
            const wrapper = ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={qc}>
                    {children}
                </QueryClientProvider>
            );
            const { result } = renderHook(() => useInvalidateFinance(), {
                wrapper,
            });
            (result.current[HOOK_FOR[domain]] as () => void)();
            expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([
                ...INVALIDATION_MAP[domain],
            ]);
        },
    );
});
