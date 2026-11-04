# Card Debt in Net Worth

Date: 2026-11-04
Status: Done
Branch: `feat/card-debt-net-worth` (cut from `main` at `eba074e`)
Parent plan: [`2026-11-04-ui-overhaul.md`](2026-11-04-ui-overhaul.md) (follow-up "Card debt in net worth")

## Goal

Net worth becomes **total account balances minus unpaid credit-card statements**. The Accounts page Net Worth card and the net-worth history chart both use this definition and must agree.

## Decisions (settled with the user; do not reopen)

1. **What counts as card debt:** only billed statements with `is_paid = false`. The current cycle's unbilled spending is not counted, because the app doesn't know it.
2. **Perspective:**
    - Combined counts every card.
    - Yi Jia's or Rachel's view counts only cards whose `credit_cards.owner_id` is that member.
    - This mirrors how accounts are filtered.
3. **History chart:** at each month-end M, subtract the statements that were still unpaid then. See the rule below. The chart's latest point must equal the Net Worth card.
4. **Net Worth card:** shows the figure net of card debt, plus a short line like `S$1,240 card debt`. When there is no debt, keep the current `N accounts` subtitle.
5. **No database changes:** no migrations and no new columns. The production DB is live and shared by two users, so all data needed already exists.

## Current state (read these first)

| What | Where |
| --- | --- |
| Net Worth card: `totalAssets` sum of balances, `StatCard` titled "Net Worth" | `src/pages/AccountsPage.tsx` (around lines 110 and 178–187) |
| History chart: `accounts` + `snapshots` → `calculateMonthlyBalanceTrends` | `src/components/accounts/NetWorthChart.tsx` |
| History rule (snapshots only, accounts step in from first snapshot, current month uses live balances) | `calculateMonthlyBalanceTrends` in `src/lib/financialFormulas.ts` |
| Point type (`totalAssets`, `netWorth`, `nonCpfNetWorth`, …) | `MonthlyBalancePoint` in `src/types/finance.ts` |
| Statement type: `card_id`, `month` ('YYYY-MM'), `statement_amount`, `due_date`, `is_paid`, `paid_at` (ISO timestamp \| null), `card?` | `CreditCardStatement` in `src/types/finance.ts` |
| Fetch all statements with their card joined: `getCreditCardStatements()` with no month | `supabaseFinanceService` / `mockFinanceService` (both join `card`) |
| Query hooks: `useCreditCardStatementsQuery(month?)` and `useCreditCardsQuery()` | `src/hooks/useFinanceQueries.ts` |
| Marking paid sets `paid_at: new Date().toISOString()`, and unmarking sets it back to `null` | `src/components/accounts/CreditCardTrackerSection.tsx` (~line 225) |
| Demo data: Oct 2026 statements, one unpaid (S$842.50, Yi Jia's DBS card) and one paid on 2026-10-25 | `mockCreditCardStatements` in `src/data/mockSeedData.ts` |
| Money rendering rule: amounts in JSX use `<CurrencyText>` (lint-enforced) | `src/components/ui/CurrencyText.tsx`, `src/lib/moneyStyles.ts` |

`HouseholdOverview.trueNetWorth` in both services is currently just `totalAssets`, and no UI reads it. **Leave it alone.** Changing it is out of scope.

## The rule: is a statement owed at the end of month M?

```text
owedAt(stmt, M):
  stmt.statement_amount > 0
  and stmt.month <= M
  and not paidBy(stmt, endOf(M))

paidBy(stmt, end):
  if not stmt.is_paid: false
  if stmt.paid_at:      sgtMonth(stmt.paid_at) <= M     # paid during or before month M
  else:                 stmt.due_date[0:7] <= M         # legacy rows: paid, no timestamp → assume paid by due date
```

- **Current month:** current debt is the sum of `statement_amount` over statements with `is_paid = false`. This matches `owedAt(stmt, currentMonth)` for any row whose `paid_at` isn't in the future.
- **Singapore time:** all month boundaries are in Singapore time. `paid_at` is a UTC timestamp, so convert it before comparing.
- **No existing helper** turns a timestamp into an SGT month, so add a small one to `src/lib/dateUtils.ts`:

    ```ts
    /** 'YYYY-MM' in Asia/Singapore for an ISO timestamp. */
    export function toSingaporeMonth(iso: string): string
    ```

    Implement it with `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit" })`.
- **Check against the demo data** (Oct statements, current month Nov):
    - The S$620.00 statement paid on 2026-10-25 is *not* owed at the end of October.
    - The unpaid S$842.50 statement *is* owed at the end of October and today.

## Implementation steps

### 1. Pure logic (`src/lib/financialFormulas.ts`, `src/lib/dateUtils.ts`)

- Add `toSingaporeMonth` (above).
- Add `isStatementOwedAt(stmt, month): boolean` and `calculateCardDebt(statements, month): number`. The second sums `statement_amount` over the statements owed at that month and rounds to 2dp.
- Add `filterStatementsForPerspective(statements, perspective, activeMemberId)`:
    - Combined returns everything.
    - Otherwise keep statements where `stmt.card?.owner_id === activeMemberId`.
    - Keep statements on inactive cards (`is_active === false`), since they can still be unpaid.
    - In personal views only, drop statements whose card owner can't be resolved.
- Extend `calculateMonthlyBalanceTrends` with an optional 5th parameter, `statements: CreditCardStatement[] = []`. It defaults to empty, so existing callers and tests keep working. For each month:
    - `cardDebt = calculateCardDebt(statements, month)`
    - `netWorth = totalAssets - cardDebt`
    - `nonCpfNetWorth = nonCpfAssets - cardDebt`
- Add `cardDebt: number` to `MonthlyBalancePoint` in `src/types/finance.ts`.
- Leave `momChange` / `momChangePct` based on `totalAssets`, as now.
- Keep these functions in `src/lib/`, not in component files (React Fast Refresh rule in AGENTS.md §4).

### 2. Data (`src/pages/AccountsPage.tsx`)

- Fetch all statements with `useCreditCardStatementsQuery()` (no month).
- Memoise the filtered list with `filterStatementsForPerspective(..., perspective, activeMember?.id)`.
- **Memoisation rule (AGENTS.md §4):** never write `data || []` inline. Use `useMemo` or a module-level `EMPTY` constant.
- **Hooks rule:** all hooks go above any early return.
- `cardDebt = calculateCardDebt(statements, currentMonth)`. Use `useCurrentMonth()` for the month.
- `netWorth = totalAssets - cardDebt`.
- Pass the statements to `<NetWorthChart statements={...} />`.
- **Loading:** don't block the page skeleton on statements. Treat them as empty until loaded, as accounts' snapshots already are.

### 3. UI

- **Net Worth `StatCard`:**
    - `value={formatSGD(netWorth)}`.
    - **Subtitle:**
        - With card debt, a short data token, e.g. `` `${formatSGD(cardDebt)} card debt` `` (a string prop, so `formatSGD` is fine here). Copy rules: AGENTS.md §6.
        - Without card debt: keep `N accounts`.
    - **Tooltip:** `Account balances minus unpaid card statements.`
- **`NetWorthChart`:**
    - Accept `statements?: CreditCardStatement[]` and pass it to `calculateMonthlyBalanceTrends`.
    - Update the formula tooltip to: `Net Worth = account balances minus unpaid card statements. Accounts are included from their first balance update.`
    - The legend pill shows the latest `netWorth`. It already reads the last point, so it'll match the card.
- **Out of scope:** a separate liabilities series in the chart. Keep the single Net Worth line.
- **Cache refresh:** after a statement is marked paid or unpaid, the Net Worth card and chart must refresh without a reload.
    - `CreditCardTrackerSection` loads statements with its own `loadData()` (calling `financeService` directly, around line 156), not through TanStack Query, so nothing on the Accounts page hears about the change.
    - After each successful statement upsert there, call `queryClient.invalidateQueries({ queryKey: ["finance", "credit-card-statements"] })` (from `useQueryClient()`). This refreshes the no-month query that `AccountsPage` uses.
    - Keep its local `loadData()` as is.

### 4. Tests (Vitest, in `tests/`)

- **New `tests/cardDebtNetWorth.test.ts(x)`**, covering:
    - **`toSingaporeMonth`:** `2026-10-31T17:30:00Z` → `2026-11` (SGT is UTC+8).
    - **`isStatementOwedAt`:**
        - unpaid → owed in its month and every later month
        - not owed before its own month
        - paid in the same month → not owed
        - paid the next month → owed at the end of its own month, not after
        - `is_paid` with `paid_at` null → falls back to `due_date`
    - **`calculateCardDebt`:** sums the owed statements and ignores amounts ≤ 0.
    - **`filterStatementsForPerspective`:** Combined keeps all. A member view keeps only that member's cards.
    - **`calculateMonthlyBalanceTrends` with statements:**
        - `netWorth = totalAssets - cardDebt` per month
        - `cardDebt` is exposed on each point
        - without statements, the output is unchanged (the existing tests in `tests/netWorthHistory.test.tsx` must still pass untouched)
    - **`NetWorthChart`:** the legend shows assets minus debt.
- **AccountsPage integration** (mock service via `HouseholdProvider`, like the existing `tests/AccountsComponents.test.tsx`):
    - Combined: the Net Worth card shows the total balance minus the S$842.50 unpaid demo statement, and the subtitle includes `card debt`.
    - Rachel's view: excludes Yi Jia's card debt.
    - After marking the statement paid through the service, the card updates.
- **Existing tests:** update any that assert the old Net Worth value on the Accounts page, using the `withText` helper in `tests/helpers/textContent.ts` where an amount sits inside a sentence. Do not delete or weaken any assertions.

### 5. Verify

- **Quality gate (AGENTS.md §7C):** `npm run lint` (0 errors, 0 warnings), `npm run build`, `npm test` and `npm run test:e2e` must all pass.
- **Demo app check:**
    - Run it with `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite --port 5301`.
    - Open `/accounts` in Combined, Yi Jia and Rachel views.
    - Confirm the card and the chart's last point match in each view, and that marking the DBS statement paid (Accounts › Credit Cards) raises net worth by S$842.50.
    - Take before/after screenshots at 390px and 1280px for the PR.

## Git and PR

- Work on `feat/card-debt-net-worth`.
- **Don't commit, push or open a PR until the user says so.** Each of those needs its own approval.
- Conventional commits, e.g. `feat(accounts): subtract unpaid card statements from net worth`, ending with the attribution line in use for this repo.
- PR body: use the repo's PR format (Summary / Evidence / Merge Danger). The door is two-way and the change is display-only. Call out that net worth drops by any unpaid statements, so both users see a lower figure than before.
- **When done:** mark the follow-up in `2026-11-04-ui-overhaul.md` as done, the same way the net-worth history item was.

## Out of scope

- Counting unbilled current-cycle spending, or credit limits.
- Changing `HouseholdOverview.trueNetWorth` or any service response shape.
- A liabilities series or extra chart lines.
- Any database migration.
