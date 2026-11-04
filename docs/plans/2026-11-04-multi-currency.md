# Multi-Currency Fix Plan

Date: 2026-11-04
Status: Implemented on branch, awaiting review (not committed)
Branch: `fix/multi-currency` (worktree `../budget-bubby-fx`)

## Problem

Reported bug: after logging an expense with a custom exchange rate, **Edit Expense** shows the default rate instead of the custom one, and saving converts the amount again.

What we found in `src/lib/currencyConverter.ts` and the expense modals:

| # | Issue | Where |
|---|---|---|
| 1 | `refreshExchangeRates()` (open.er-api.com) is never called, so every conversion uses stale hardcoded rates | `currencyConverter.ts` |
| 2 | Edit converts again at the default rate and ignores the stored `exchange_rate`. Editing any field of a foreign expense can change its SGD amount. Edit has no rate field | `EditExpenseModal.tsx` |
| 3 | Bulk add can't override the rate | `BulkAddExpenseModal.tsx` |
| 4 | SGD rows are saved inconsistently: quick add saves `exchange_rate: 1`, while edit and bulk add save `null` | the three modals |
| 5 | The quick add rate box can't be cleared; it snaps back to the old value | `QuickAddExpenseModal.tsx` |
| 6 | No-decimal currencies are listed twice. The parser only reads currency codes, not symbols (`RM12` is read as SGD) | `CentsFirstAmountInput.tsx`, `expenseParser.ts` |
| 7 | The split preview in Edit multiplies the foreign amount (e.g. ¥2,000) and shows it as S$ | `EditExpenseModal.tsx` |

## Decisions

1. **Rate source:** keep open.er-api.com (latest rates only). No new dependencies.
2. **Fetching:** fetch in the background on app start, and when a non-SGD currency is chosen. Keep the 24h localStorage cache on each device.
3. **Rate freshness:** show "Rate as of <date>" using the API's update time. Show an "offline rate" note when using cached or built-in rates. Saving is never blocked.
4. **Edit keeps the saved rate.** Changing the amount or date keeps it. Only a currency change picks up a new rate. The edit modal gets an editable rate.
5. **Linked SGD and rate fields** (quick add and edit). The rate is the anchor:
    - Changing the foreign amount or the rate recalculates SGD.
    - Typing SGD (e.g. from a card statement) works out the rate.
    - The rate is stored to 6 decimal places (`numeric(12,6)`).
6. **Bulk add:** one editable rate for each foreign currency in the batch, applied to all rows in that currency.
7. **Saving SGD rows:** new and edited SGD expenses save `exchange_rate: null` and `original_amount: null`. Old rows saved with `1` count as SGD.
8. **Parser** reads currency symbols: `RM ₫ ฿ € £ ₩ NT$ A$ Rp ₱`. `¥` means JPY (type `CNY` for yuan). A plain `$` means SGD. There's one shared list of no-decimal currencies.
9. **Existing data:** no backfill and no migration. Wrong old rows can be fixed in Edit.
10. **Tests first:**
    - a failing test for the edit bug
    - unit tests for the converter and parser
    - then lint, build, unit and e2e all pass.

## Coordination with parallel work

- **UI overhaul** ([`2026-11-04-ui-overhaul.md`](2026-11-04-ui-overhaul.md)):
    - PR 1 (`fix/add-expense-coerce`) touches the add-expense save path.
    - PR 5 (`refactor/add-expense-minimal`) rewrites `QuickAddExpenseModal`, with FX tucked under "More".
    - To keep merges easy, the FX logic lives in `src/lib/currencyConverter.ts` and one reusable `FxRateField` component. Changes to the modals stay thin.
    - Whichever merges second rebases.
- **Notifications** ([`2026-11-04-notifications.md`](2026-11-04-notifications.md)) edits `src/types/finance.ts` and the finance services. This plan doesn't touch either, because the FX columns already exist.

## Out of scope

- Historical rates for each date.
- Database migrations.
- Restyling the modals beyond the rate field.

## Implementation notes

- `src/lib/currencyConverter.ts` adds `buildExpenseFxFields`, `rateFromSGD`, `roundRate`, `getDefaultRate`, `getRateStatus`, `ZERO_DECIMAL_CURRENCIES`, and currency `aliases`. `refreshExchangeRates` shares one in-flight request and fires `FX_RATES_UPDATED_EVENT`.
- `src/hooks/useFxRates.ts` fetches rates while enabled and re-renders when they land.
- `src/components/expenses/FxRateField.tsx` contains:
    - `FxRateField`: linked SGD and rate fields, a status line, and "Use live rate".
    - `FxRateInput`: the rate box on its own, also used in bulk add.
- `src/main.tsx` warms the rate cache on app start. This avoids `App.tsx`, which the UI work edits.
- Tests:
    - `tests/MultiCurrency.test.tsx` covers the edit regression.
    - `tests/currencyConverter.test.ts` covers the converter and parser.
    - Two assertions in `tests/ExpenseEntryUX.test.tsx` now read the new "Converted SGD" input.
