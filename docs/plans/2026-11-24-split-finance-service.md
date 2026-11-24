# Split the finance service and query hooks by domain

Status: proposed (app-audit 2026-11-24). Priority P3. Not started.

## Goal

Replace the two monolith files with per-domain modules, so that a change to goals or expenses touches only that domain's file. Each domain also owns its invalidation, so adding a query key can't leave a screen stale.

## Evidence

- `src/services/supabaseFinanceService.ts` is about 2,925 lines and holds every domain (accounts, expenses, goals, budget, categories, cards, inbox, settle-ups).
- `src/hooks/useFinanceQueries.ts` is about 1,495 lines, with 39 exported hooks and 18 `mutationFn`. The optimistic `onMutate`/`onError`/`onSettled` blocks are copied by hand between hooks.
- The invalidation fan-out is listed by hand in `src/hooks/useFinanceQueries.ts:284-400`. `invalidateExpenses` alone makes about 7 `invalidateQueries` calls, and there are 78 `invalidateQueries` calls across `src`.
- `src/components/expenses/ExpenseListTable.tsx:127-148` and `src/components/expenses/ExpenseFormModal.tsx:225-235` fetch through `financeService` in `useEffect`, bypassing the query cache, so goals and inbox chips go stale after mutations.

## Approach

1. **Query key registry.** Add `src/lib/queryKeys.ts` with one factory per domain (`keys.expenses.all`, `keys.expenses.month(m)` and so on). Domain invalidation becomes `invalidateQueries({ queryKey: keys.expenses.all })`, plus a declared list of dependent domains (for example, expenses → budget, household-overview, settle-ups).
2. **Mutation helper.** Add `createOptimisticMutation({ keys, apply, rollback })` so every hook shares the same snapshot, rollback and settle behaviour. It pairs with the global error toast from #250.
3. **Split the hooks.** Create `src/hooks/finance/{accounts,expenses,goals,budget,categories,cards,inbox,settleUps}.ts`. Keep `useFinanceQueries.ts` as a re-export barrel so call sites don't change in the same PR.
4. **Split the service.** Create `src/services/supabase/{domain}.ts` behind the same `financeService` interface. The mock service gets the same split. This coordinates with #254 (lazy-loading mock mode).
5. **Fix cache bypasses.** Replace the `useEffect` fetches in `ExpenseListTable` and `ExpenseFormModal` with the existing query hooks.
6. **Remove the barrel.** Update imports and delete `useFinanceQueries.ts` once nothing imports it.

## Staged PRs (each green on `npm run check` on its own)

| PR | Scope | Risk |
|---|---|---|
| A | Key registry + invalidation map + test (steps 1, 5) | Low; behaviour should not change |
| B | Mutation helper; migrate 3 hooks as a pilot (step 2) | Medium; rollback semantics |
| C | Hooks split behind the barrel (step 3) | Low; mechanical (Sonnet-suitable) |
| D | Service split, Supabase + mock (step 4) | Medium; large diff, coordinate with #254 |
| E | Drop the barrel (step 6) | Low |

## Files touched

`src/hooks/useFinanceQueries.ts`, `src/hooks/finance/*` (new), `src/lib/queryKeys.ts` (new), `src/services/supabaseFinanceService.ts`, `src/services/mockFinanceService.ts`, `src/services/financeService.ts`, `src/services/supabase/*` (new), `src/components/expenses/ExpenseListTable.tsx`, `src/components/expenses/ExpenseFormModal.tsx`, plus every importer of the hooks (PR E).

## Risks

- **Missed invalidation edges.** A dependency that is implicit today gets dropped. Mitigate with the PR A test, which asserts that each mutation invalidates the expected key set (snapshot of the current behaviour first).
- **Offline queue.** `src/services/offlineSyncQueue.ts` calls service methods by name, so check it against the split service.
- **Persisted cache.** Changing query key shapes invalidates the persisted cache (`src/lib/queryPersistence.ts`). Bump the storage key version once, in PR A.
- **Merge conflicts** with in-flight feature work. Land PR C quickly, because it's mechanical.

## Test plan

- PR A: a unit test maps each mutation to its invalidated keys and matches the snapshot taken before refactoring.
- PR B: unit tests for optimistic apply, rollback on error and settle refetch.
- Every PR: `npm run check`. PRs C and D also need `npm run test:e2e`, because e2e runs in mock mode and exercises every domain.
- Manually check that the partner realtime sync (`usePartnerRealtimeSync`) still refreshes the other device after an expense add.
- No DB change.
