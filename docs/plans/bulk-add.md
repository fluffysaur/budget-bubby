# Bulk Add: redesign plan

Branch suggestion: `refactor/bulk-add` cut from up-to-date `main` (current branch `refactor/unified-expense-form` must be merged first, since we reuse its category logic). No commit/push/PR without explicit approval (AGENTS.md 7A).

## 1. Overview

Replace the 910-line `src/components/expenses/BulkAddExpenseModal.tsx` (two tabs: table grid at ~L504-860, Smart Paste at ~L460-503) with a single simple rows UI optimised for "catch up on a few days of missed expenses":

- Day chips (Today / Yesterday / pick date) set the date for newly added rows; each row keeps its own date.
- Each row: amount, description, auto-guessed category chip (tap to change). Shared, tags, foreign currency live behind a per-row "More" toggle.
- Mobile: compact cards + sticky bottom bar (`+ Row`, `Save N · S$total`). Desktop (sm/md+): table.
- Rename "Bulk Log" to "Bulk Add" everywhere. Remove Smart Paste.

Non-goals: new backend endpoints, schema changes (Live Supabase DB, no remote migrations), changing the single-expense form's behaviour.

## 2. Rename "Bulk Log" to "Bulk Add"

Occurrences (grep `Bulk Log|bulk log`):
- `src/pages/ExpensesPage.tsx:4` (header comment), `:323` + `:347` (`aria-label="+ Bulk Log"`), `:328` + `:352` (button text). New: `aria-label="+ Bulk Add"`, text `Bulk Add`. Keep `FileSpreadsheet` icon? Swap to `ListPlus` (lucide) since there is no spreadsheet any more.
- `src/pages/ExpensesPage.tsx:560` comment "Bulk Add Expense Modal" is fine.
- `README.md:59, 174, 328` (feature bullet currently advertises "smart text-paste"; rewrite).
- `tests/ExpenseLedgerBulk.test.tsx:3,78` ("Fast Log and Bulk Log" describe names). Do NOT rename "Fast Log" (different feature).
- Modal title/subtitle: title `Bulk Add` (concise-copy rule), no subtitle (or `Catch up on missed days` max).
- Component keeps the name `BulkAddExpenseModal` (already "Add").

## 3. Component breakdown

New folder `src/components/expenses/bulk-add/`. `BulkAddExpenseModal.tsx` stays at its current path as a thin shell (re-export or move; keep path to avoid touching ExpensesPage import at L46).

| File | Responsibility | Approx lines |
|---|---|---|
| `BulkAddExpenseModal.tsx` (existing path) | `AnimatedModal` + `ModalHeader`/`ModalBody`/`ModalFooter` wiring, reset on open, composes the pieces below | ~120 |
| `bulk-add/useBulkAddRows.ts` | Row state, reducer, add/remove/update/set-date, derived summary, validation | ~180 |
| `bulk-add/useBulkAddSubmit.ts` | Build `CreateExpenseInput[]`, call `financeService.bulkAddExpenses`, event dispatch, error handling | ~90 |
| `bulk-add/DayChips.tsx` | Today / Yesterday / date-picker chips (`role="radiogroup"`) | ~70 |
| `bulk-add/BulkRowCard.tsx` | Mobile row card (`sm:hidden`) | ~130 |
| `bulk-add/BulkRowTableRow.tsx` | Desktop `<tr>` (`hidden sm:table-row`) | ~110 |
| `bulk-add/RowMoreFields.tsx` | Shared toggle, tags, currency + FX rate; reused by both row layouts | ~120 |
| `bulk-add/CategoryChip.tsx` | Chip showing guessed category; opens picker (popover on desktop, bottom list on mobile). Includes goal option | ~100 |
| `bulk-add/BulkAddFooterBar.tsx` | `+ Row` and `Save N · S$total` (sticky on mobile, `ModalFooter` on desktop) | ~60 |
| `src/lib/categoryGuess.ts` (new, shared) | `KEYWORD_CATEGORY_MAP` + `guessCategoryId(text, categories)` extracted from `ExpenseFormModal.tsx:101-190` and the matcher at `:455-472` | ~110 |
| `src/lib/bulkAddRows.ts` | Pure helpers: `createRow`, `rowToCreateInput`, `isRowBlank`, `validateRow`, `summarise` (unit-testable without React) | ~120 |

Rendering both a card list and a table doubles DOM and risks duplicate IDs/inputs in tests. Preferred: ONE row renderer per breakpoint chosen via a `useMediaQuery("(min-width: 640px)")` hook (add `src/hooks/useMediaQuery.ts`) so only one set mounts. Alternative (CSS-only `hidden sm:...`) is simpler but mounts two inputs per field; reject because refs/autofocus and tests get ambiguous.

### Reuse from ExpenseFormModal (do not duplicate)

- Category keyword guess: extract `KEYWORD_CATEGORY_MAP` (L101-190) and the loop in `handleItemTextChange` (L455-472) into `src/lib/categoryGuess.ts`; `ExpenseFormModal` imports it (small behaviour-neutral refactor, own commit). This also fixes the situation where the old parser had a *second* divergent keyword table (`findCategoryByKeyword` in `expenseParser.ts:~55-100`).
- Spendable category filter: `isSpendableCategory` (`financialFormulas.ts:240`) for the picker's default list, with "More" to show all (same as `ExpenseFormModal` `showMoreCategories`).
- Goal spend: current bulk uses `goal:`/`cat:` select values (L256-266). Keep the data model (`goalId` XOR `categoryId`) and offer goals as a trailing section in `CategoryChip` picker (limit like `GOAL_CHIP_LIMIT = 4`, ExpenseFormModal L76). A goal row has `category_id: null`.
- Shared/split: same semantics as single form: `split_ratio: isShared ? 0.5 : 0.0` (see bug note below). Default from `defaultShared`/perspective as in L99-103 now. Also read/write `LAST_SPLIT_STORAGE_KEY` helpers? They are module-private (L79-97); move `getStoredLastSplit/storeLastSplit` and recent-tags helpers (L191-230) to `src/lib/expensePrefs.ts` and import from both. Optional; if too invasive, bulk just uses perspective default (open question 1).
- FX: keep `useFxRates`, `FxRateInput`, `convertToSGD`, `buildExpenseFxFields` (currencyConverter.ts:179/200). One rate per foreign currency, as now (state `rateOverrides`).
- Amount input: do NOT reuse `CentsFirstAmountInput` (cents-first ATM entry is slow for batch typing and its `inputMode="numeric"` has no decimal point). Use `<Input inputMode="decimal">` per the agreed decision. Zero-decimal currencies (`isZeroDecimalCurrency`): use `inputMode="numeric"` when row currency is JPY/VND/KRW/IDR.
- Celebration: keep the existing `expenseAdded` window event (L360-378). Listeners: `ExpenseSuccessCelebration.tsx:73-82` (3s toast with chime), `StreakChip.tsx:50`, `CategoryLimitWarningBanner.tsx:150`. Already brief; the synthetic detail has aggregate amount and item `"N expenses logged"`. Keep, but also check `CategoryLimitWarningBanner` handles an aggregate event gracefully (it reads `category_id` from `created[0]` only; see open question 3).

## 4. State model

```ts
interface BulkRow {
  id: string;            // crypto-safe via src/lib/uuid.ts (not Date.now+random)
  date: string;          // YYYY-MM-DD, copied from active day chip at creation
  time: string;          // set once at row creation: getCurrentSingaporeTime()
  amount: string;        // raw text, parsed on validate/submit (avoids "1." cursor jumps)
  item: string;
  categoryId: string;    // "" = none yet
  goalId: string | null;
  categoryTouched: boolean; // user explicitly picked: stops auto-guess (mirrors categoryManuallySelected, ExpenseFormModal:365)
  isShared: boolean;
  tags: string[];
  currency: string;      // default "SGD"
  touched: { amount: boolean; item: boolean }; // inline errors only after blur/submit
}
interface BulkState {
  rows: BulkRow[];
  activeDate: string;    // day chip selection; applied to NEW rows only
  payerId: string;       // single payer for batch (existing behaviour, L146)
  rateOverrides: Record<string, number | undefined>;
  showErrors: boolean;   // set on failed Save attempt
}
```

- `useReducer` in `useBulkAddRows` with actions `add`, `remove`, `update`, `setCategory`, `setActiveDate`, `applyDateToAll` (optional long-press on chip: open question 2), `reset`. Reducer is pure and testable.
- Initial rows: **1** (not 3) so mobile isn't a wall of empty cards; auto-add a new row when the user presses Enter on the last row's description (see focus flow).
- Hooks rule (AGENTS 4): all hooks at the top of the modal component; no hooks after early returns. `useMediaQuery` and `useFxRates(foreignCurrencies.length > 0)` called unconditionally.
- Fallback memoization: the existing `categories = propCategories?.length ? ... : mockCategories` (L85-90) is stable (module const); `members` same. Goals: replace the `activeGoals` `useState` + effect (L119-142) with the `useGoals` query hook if present in `src/hooks/useFinanceQueries.ts` (check), otherwise keep the effect; never inline `|| []` in deps.
- Reset: keep the justOpened logic (L199-224) but simplified to `useEffect` keyed on `isOpen` -> `dispatch({type:"reset", ...})`. Day chip resets to Today.
- Auto-guess: on description change, if `!categoryTouched`, `categoryId = guessCategoryId(text, categories) ?? row.categoryId`. Default category when none guessed: `""` (chip reads "Category" in muted style). Decision: row with an empty category is blocked on save for non-goal rows (matches single form L604-617), or default to first spendable? Open question 4; plan assumes block + inline "Pick category".
- `activeDate` changes do not mutate existing rows. Row date shown as a small tappable date chip in "More"? No: date is primary for catch-up, so show a compact date label under the description on mobile (`text-xs text-(--text-muted)`, tap opens native date input) and a date cell on desktop.

## 5. Layouts and classes

Modal: `AnimatedModal maxWidth="max-w-4xl" isDrawerOnMobile` (check prop at AnimatedModal.tsx:29; `SM_MAX_WIDTH_MAP` already contains `max-w-4xl`). Body is the scroll container; footer is outside of scroll so it is naturally sticky inside the drawer. Use `ModalFooter` for the bar so no extra `sticky` hack is needed; add `pb-[env(safe-area-inset-bottom)]` only if the existing `ModalFooter` does not already (verify at AnimatedModal.tsx:669-682; arbitrary value `pb-[env(...)]` is the only non-canonical one acceptable, there is no Tailwind canonical equivalent).

### Header zone (above list, not scrolling away on mobile)
- `DayChips`: `flex flex-wrap items-center gap-2`. Chip: `inline-flex min-h-11 items-center rounded-full border-2 border-(--border-ink) px-3 text-sm font-bold active:translate-x-0.5 active:translate-y-0.5`; selected `bg-(--pastel-lilac-light) shadow-cute-sm`, idle `bg-(--bg-card)`. Third chip "Pick date" wraps a visually hidden `<input type="date" max={today}>` (font-size 16px). If the picked date is not today/yesterday, chip label becomes `Mon, 3 Nov`. Each chip `role="radio"` `aria-checked`.
- Payer: reuse `<Select aria-label="Payer for all expenses">` (src/components/ui/Select.tsx) in place of the raw `<select>` (L432); keep the aria-label so tests survive.
- Prefer rendering payer only when `members.length > 1`.

### Mobile card (`< sm`)
```
<li class="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-cute-sm space-y-2">
  row 1: <div class="flex items-center gap-2">
           amount <Input inputMode="decimal" enterKeyHint="next" class="w-28 shrink-0 text-base font-black" placeholder="0.00"/>   // text-base = 16px, no iOS zoom
           desc   <Input enterKeyHint="next" class="min-w-0 flex-1 text-base" placeholder="e.g. Lunch"/>
           delete <Button variant="ghost" size="icon-md" aria-label="Remove row {n}" class="shrink-0"/>  // Trash2, min 44px
         </div>
  row 2: <div class="flex items-center gap-2">
           <CategoryChip class="min-h-11 min-w-0 flex-1"/>   // TruncatedText for name
           <button class="min-h-11 shrink-0 ... text-xs font-bold text-(--text-muted)" aria-expanded>More</button>
         </div>
  row 3 (when More open): <RowMoreFields/> inside a grid-rows collapse (see jank section)
  inline error: <p class="text-xs font-bold text-rose-600" role="alert"> (exact error colour: follow Alert danger token; if a token exists use text-(--danger) )
</li>
```
- All `<input>`/`<select>` on mobile must compute to `font-size: 16px`: use `text-base sm:text-sm`. Verify `Input.tsx` doesn't force `text-sm` on mobile (read before building; extend with a `size` prop if needed rather than overriding).
- Swipe-to-delete: do NOT implement swipe in v1 (conflicts with the drawer drag handlers in AnimatedModal `ModalDragContext`, `data-drag-ignore`, and horizontal inputs). Use the trash icon button; optional v2 swipe with `data-drag-ignore="true"`. Flag in open questions. Removing the last remaining row clears it instead of removing (keeps >=1 row; current `handleDeleteRow` L242-246 does the same). Deleting a non-blank row shows a 4s "Row removed · Undo" inline strip (avoid ConfirmModal for a 1-row delete; AGENTS 5B requires ConfirmModal only for destructive confirmations: undo is the lighter equivalent; confirm this is acceptable, open question 5).
- List container: `ol class="space-y-3"`; new rows get `animate-in`-style fade (CSS `@starting-style` or an existing keyframe in `index.css`; check available keyframes before adding). Respect `prefers-reduced-motion`.

### Desktop table (`sm` and up; `md` for full columns)
- `<table class="w-full table-fixed text-sm">`, `<colgroup>` fixed widths to prevent jank when content changes: date `w-28`, amount `w-28`, description `w-auto`, category `w-44`, more `w-24`, actions `w-12`. Header `text-xs font-bold uppercase tracking-wider text-(--text-muted)`.
- Cells: description cell `min-w-0`, category via `CategoryChip` + `TruncatedText`. "More" expands a second `<tr><td colSpan={6}>` under the row containing `RowMoreFields` in a `grid grid-cols-1 sm:grid-cols-3 gap-3`.
- `sm` (640-767): same table but hide the date column behind the row's chip (`hidden md:table-cell`) and show date inside the description cell as small text.
- Totals: do not duplicate; footer shows `Save N · S$total`.

### Footer bar
`ModalFooter className="gap-2"`:
- Left: `<Button variant="secondary" size="md" leftIcon={<Plus/>} className="min-h-11">Row</Button>` aria-label `+ Row`.
- Right: `<Button variant="primary" size="md" className="min-h-11 flex-1 sm:flex-none" isLoading={isSubmitting} disabled={summary.count === 0 || isSubmitting}>Save {n} · <CurrencyText amount={total}/></Button>`. Use `formatSGD` for the string label because the button text should stay a plain string for accessible name; `CurrencyText` only if it renders plain text (verify).
- Disabled when 0 valid rows; clicking when invalid rows exist scrolls to and focuses first invalid field (not disabled in that case so the user gets feedback).

### No-jank checklist
- Rows keyed by stable `id`; never key by index.
- Fixed `colgroup` widths on desktop; mobile cards have fixed-height first row (`min-h-11`).
- "More" uses `grid grid-rows-[0fr] -> grid-rows-[1fr]` with `transition-[grid-template-rows]` and `overflow-hidden` inner `min-h-0`, so no height measuring.
- Error text reserved: inline error container uses `min-h-4` only when `showErrors`; otherwise errors appear below the row (acceptable shift) but never while typing (only on blur/submit).
- Memoise rows: `React.memo(BulkRowCard)` with stable callbacks (`dispatch` is stable; pass `rowId` and let child call `dispatch({type, id})`), so typing in one row does not re-render all rows.
- Summary derived via `useMemo` over `rows` + `rateOverrides`.
- Auto-scroll newly added row into view with `scrollIntoView({ block: "nearest" })` AFTER focus with `preventScroll: true`, to avoid the iOS keyboard jump (focus first, then manual nearest scroll in `requestAnimationFrame`).
- Keyboard overlay: on mobile the drawer must shrink with `visualViewport`; verify the existing AnimatedModal handles it (check; tests in `e2e/modal-behaviour.spec.ts`, `mobile-viewport.spec.ts`).

## 6. Keyboard and focus flow

- Amount: `inputMode="decimal"`, `enterKeyHint="next"`, Enter -> focus same row description (`preventDefault`; the modal must not be a `<form>` whose Enter submits; wrap in `<form onSubmit={e=>e.preventDefault()}>` only if Save is a real submit button; recommended: no form, buttons are `type="button"`).
- Description: `enterKeyHint="next"`. Enter: if this is the last row and the row is valid (amount > 0 and item non-blank) -> `addRow()` and focus its amount; if this is the last row but invalid -> show inline errors, stay; otherwise focus next row's amount.
- `+ Row` button: add row, focus new row's amount (`useEffect` keyed by `pendingFocusId` ref, focusing `inputRefs.current[id].amount` after commit). Use a ref map `Map<rowId, {amount, item}>`; do not use `autoFocus` attribute (reliable on mount only, and iOS ignores programmatic focus not tied to a user gesture; since `+ Row` and Enter are user gestures this works in iOS Safari if focus is called synchronously in the same tick: call `flushSync` around dispatch then `.focus()`, or pre-focus a hidden proxy input. Verify on a real iPhone; open question 6).
- On open: focus first row's amount (modal open is user gesture).
- Tab order natural: amount -> description -> category chip -> More -> remove. Remove button `tabIndex={-1}` on desktop to keep Tab flow fast? Keep focusable but last.
- Cmd/Ctrl+Enter anywhere in the modal triggers Save. Escape closes (existing AnimatedModal behaviour; `isDirty` prop (AnimatedModal.tsx:25) set true when any non-blank row exists so accidental close prompts discard).
- Amount sanitising: `onChange` strips everything except digits and one `.`/`,` (convert `,` to `.`); max 2 decimals (0 for zero-decimal currencies).
- Pasting a multi-line block into description is not a feature (Smart Paste removed): no special handling.

## 7. Validation

Pure function `validateRow(row, ctx)` in `src/lib/bulkAddRows.ts` returning `{ amount?: string; item?: string; category?: string }`.
- Blank row (no amount, no item) is ignored entirely (not an error), so spare rows do not block Save.
- Partially filled: missing amount -> "Enter amount"; amount <= 0 or NaN -> "Enter amount"; missing item -> "Add description"; non-goal row without category -> "Pick category"; foreign currency without usable rate (`rateOverrides[c] ?? getDefaultRate(c)` falsy) -> "Set rate".
- Errors shown only for `touched` fields (on blur) or after a failed Save (`showErrors`). Error text copy is 2-3 words (AGENTS section 6). Input gets `aria-invalid` + `aria-describedby`; the first invalid field is focused on failed Save.
- Top-level `<Alert variant="danger">` only for service/save errors, not field errors. Existing generic message ("Please fill in at least one expense...", L335-339) becomes `Add at least one expense.` shown inline only if every row is blank.
- Date: reject future dates (`max={today}`); `type="date"` with `min` unset.
- Summary count = number of valid, non-blank rows; total uses `convertToSGD` exactly as the current summary (L298-322), rounded to 2dp.

## 8. Save flow, error handling, offline

Flow (`useBulkAddSubmit`):
1. Validate; if invalid -> focus first invalid, return.
2. Build inputs with `rowToCreateInput(row, { payerId, rateOverrides })` -> `CreateExpenseInput`:
   - `category_id: row.goalId ? null : row.categoryId || null`, `goal_id`, `payer_id`, `item.trim()`, `...buildExpenseFxFields(num, currency, rate)`, `date`, `time`, `is_shared`, `split_ratio: isShared ? 0.5 : 0.0`, `tags`.
   - **Fix existing bug**: current code writes `split_ratio: r.isShared ? 0.5 : 0.5` (BulkAddExpenseModal.tsx ~L346). Solo rows must be `0.0` to match `ExpenseFormModal.tsx:630`. Add unit test; call this out in the PR as a behaviour fix.
3. `await financeService.bulkAddExpenses(inputs)` (`financeService.ts:237-246` routes to `offlineSyncQueue.bulkAddExpenses` unless replaying; cache invalidated after).
4. On success: dispatch `expenseAdded` (aggregate detail as now), `onExpensesAdded?.(created)`, persist recent tags / last split (if shared helpers extracted), close. Keep the celebration brief: single existing 3s toast + chime; no extra confetti in the modal itself.
5. On failure: keep all rows and inputs intact, show `<Alert variant="danger">` above the list (sticky at top of body), re-enable Save; message from `Error.message` else `Couldn't save. Try again.`.

Offline interaction (`src/services/offlineSyncQueue.ts:301-321`, replay at `:414-420`):
- Offline: `mockFinanceService.bulkAddExpenses` creates optimistic rows, `enqueueMutation("bulkAddExpenses", { expenses, optimisticIds })` and returns optimistics, so the modal sees *success* and closes. Good: no special UI needed. Add a subtle line in the success toast? Out of scope; the existing pending-queue indicator handles it.
- **Risk to verify and flag (non-atomic partial failure)**: `supabaseFinanceService.bulkAddExpenses` (L1049-1056) inserts sequentially. If row 3 of 5 fails with a network error, `offlineSyncQueue.bulkAddExpenses` (L306-313) catches ANY error, then queues and optimistically adds the WHOLE batch, so rows 1-2 are duplicated on replay. Not caused by this redesign but made more likely by the "catch up N days" use case. Options: (a) leave as is and document, (b) fix in a separate small commit: make Supabase `bulkAddExpenses` a single `insert([...])` (one request is atomic) — requires reading `addExpense` mapping at supabaseFinanceService (not read in this plan), or have offline queue only fall back on network-type errors before any row succeeded. Recommend (b) as its own commit with tests in `tests/OfflineSyncAndPerf.test.tsx` (existing test at L113). Need approval since it touches data path (open question 7).
- Double-submit guard: `isSubmitting` ref + disabled Save; also disable `+ Row`/remove during submit.
- Optimistic ids: the `created` array passed to `onExpensesAdded` may be optimistic (offline); `ExpensesPage.handleExpenseAdded` already handles single-add the same way.
- FX offline: `useFxRates`/`getDefaultRate` falls back to cached rates (`currencyConverter.ts` offline status tested in `tests/currencyConverter.test.ts:~110-125`), so foreign rows still save offline. Show the existing stale-rate hint from `FxRateInput`.

## 9. What is removed

- Smart Paste tab, `SegmentedTabs` usage in the modal, `pasteText`, `handleApplyPasteText` (L147-152, L268-284), and re-exports `export { parseBulkExpenseText }` / `export type { BulkExpenseDraftRow }` (L61-62).
- Per-row Time input (`aria-label="Time for row N"`, test at ExpenseLedgerBulk L324): time is auto-set at row creation. Catch-up entries do not need a time. (Confirm; open question 8.) Time remains in the payload.
- Hard-coded 3 starter rows and the `Sparkles` header; "Table Grid (n)" labels.
- `src/lib/expenseParser.ts` (239 lines): **becomes dead code in `src/`** after this change. Its only importers are `BulkAddExpenseModal.tsx` and tests (`tests/ExpenseLedgerBulk.test.tsx:12`, `tests/currencyConverter.test.ts:15,128-156`). What it contains: `parseBulkExpenseText`, `BulkExpenseDraftRow` type, and `CURRENCY_ALIASES` regex, plus an internal `findCategoryByKeyword` (a second, divergent keyword table). Proposed handling:
  - Delete `parseBulkExpenseText`, `BulkExpenseDraftRow`, `findCategoryByKeyword`, and `src/lib/expenseParser.ts` itself in the final cleanup commit. AGENTS 5C ("Always use `parseBulkExpenseText`") must be edited to delete that bullet (docs commit).
  - Category auto-guess: the single-form table (ExpenseFormModal L101) becomes the shared `categoryGuess.ts`, so nothing of value is lost.
  - The currency-alias detection (`RM12.50`, `¥980`, `NT$75`) is only used by the parser. It is genuinely nice for a typed description but not part of the agreed UI. Flag: either drop it, or keep `CURRENCY_ALIASES` as a tiny `detectCurrencyFromText()` in `currencyConverter.ts` for possible future use. Recommendation: drop, since unused code is rot; `git log` retains it. Needs user OK because it deletes a tested feature (AGENTS 7E: ask before deleting files).
  - Tests to delete/port: `tests/ExpenseLedgerBulk.test.tsx` parser cases (L270-300ish, L355-400, L508-525); the entire `describe('Bulk parser currency detection')` in `tests/currencyConverter.test.ts:127-156` (keep the rest of that file); update README L328 description.
- Dead dependencies after removal: check `Table as TableIcon`, `Sparkles`, `FileSpreadsheet`, `SegmentedTabs` imports for unused (ESLint must stay 0 warnings); `SegmentedTabs` is still used elsewhere (ExpenseFormModal L52).

## 10. Tests

Unit/component (vitest, `tests/`):
- New `tests/bulkAddRows.test.ts`: `createRow` defaults (date from activeDate, shared default), `validateRow` matrix (blank ignored, partial errors, goal row needs no category, foreign without rate), `rowToCreateInput` (`split_ratio` 0.0 for solo, 0.5 for shared; `category_id` null when goal; FX fields via `buildExpenseFxFields`), `summarise` totals with rate overrides.
- New `tests/categoryGuess.test.ts`: lunch/grab/netflix/clinic map to food/transport/lifestyle/buffer; unknown returns undefined; category list lacking the key returns undefined; respects `categoryTouched` in the reducer.
- New `tests/bulkAddReducer.test.ts` (or fold into first): add/remove (never below 1), `setActiveDate` doesn't mutate existing rows, auto-guess not applied after manual category.
- Rewrite the `BulkAddExpenseModal` describe in `tests/ExpenseLedgerBulk.test.tsx` (L268-end): remove parser tests (moved/deleted). New cases: renders title `Bulk Add`; day chips (Today selected by default; click Yesterday then `+ Row` -> new row has yesterday's date in submit payload); type amount/description -> category chip shows guessed name; changing chip stops auto-guess; Enter in description of last valid row adds a row and focuses its amount (`document.activeElement`); invalid row shows inline "Enter amount"/"Add description" only after Save click; Save button label `Save 2 · S$37.50`; submit calls `bulkAddExpenses` with `arrayContaining(objectContaining({amount, item, date, split_ratio}))`; service rejection keeps rows and shows Alert; blank rows are ignored; defaultShared true -> rows show shared state in More; member-view default solo; payer select retains `aria-label` "Payer for all expenses"; remove last row clears instead of removing; foreign currency via More shows FX rate input and total converts. jsdom `matchMedia` must be stubbed for `useMediaQuery` (check `tests/setup`/vitest config for an existing stub; otherwise add one in setup).
- `tests/OfflineSyncAndPerf.test.tsx:113` unchanged; add a case for partial-failure duplicate guard if open question 7 is approved.
- ExpensesPage tests: grep for `Bulk Log` in `tests/*` (only ExpenseLedgerBulk matched in grep; re-grep before the rename commit including `aria-label="+ Bulk Log"` queries).

E2E (Playwright, `e2e/`): there is currently NO bulk e2e spec (grep of `e2e/` for bulk returned nothing). Add `e2e/bulk-add-expenses.spec.ts` modelled on `e2e/quick-add-expense.spec.ts`:
- open via `getByRole('button', { name: /Bulk Add/i })` (visible in both mobile and desktop projects), fill two rows with keyboard only (type amount, Enter, type description, Enter, assert second amount focused), choose Yesterday chip, Save, assert dialog closed and the entries appear in the ledger.
- mobile project (`isMobile`): assert sticky `Save` button is within viewport after adding 6 rows; amount input has `inputmode="decimal"` and computed `font-size` 16px; no horizontal scroll (`scrollWidth <= clientWidth`).
- Also extend `mobile-viewport.spec.ts` only if it enumerates modals.
Quality gate before proposing commit/PR: `npm run lint` (0/0), `npm run build`, `npm test`, `npm run test:e2e` (UI flow changed).

## 11. Suggested commit breakdown

1. `refactor(expenses): extract category keyword guess to lib` (new `src/lib/categoryGuess.ts` + tests; `ExpenseFormModal` consumes it; behaviour-neutral).
2. `refactor(expenses): rename Bulk Log to Bulk Add` (ExpensesPage labels/aria, README, test names; icon swap optional). Small, easy review.
3. `feat(expenses): bulk add row model, validation and hooks` (`bulkAddRows.ts`, `useBulkAddRows`, `useBulkAddSubmit`, `useMediaQuery` + unit tests; includes the solo `split_ratio` fix).
4. `feat(expenses): bulk add rows UI` (all `bulk-add/*` components, new modal shell, remove Smart Paste, rewritten component tests).
5. `test(e2e): cover bulk add keyboard and mobile layout`.
6. `chore: remove expense text parser` (delete `expenseParser.ts`, its tests, AGENTS.md 5C bullet; needs explicit approval).
7. (optional, separate PR or commit, needs approval) `fix(sync): make bulk expense insert atomic / avoid duplicate replay`.

Co-Authored-By trailer on each commit per session attribution; PR body: what/why/how verified.

## 12. Open questions

1. Persist "last split" (`LAST_SPLIT_STORAGE_KEY`) and recent tags for bulk like the single form, requiring extraction of the module-private helpers (ExpenseFormModal L79-97, L191-230), or keep bulk on the perspective default only?
2. Should long-press / secondary action on a day chip "apply to all rows"? Default plan: no (new rows only), as agreed.
3. `CategoryLimitWarningBanner` (listens to `expenseAdded`, L86-150) uses the aggregate detail; does it handle multi-category batches? Probably only the first. Dispatch one event per distinct category instead? Needs reading that component.
4. Row with no category: block save with inline "Pick category", or default to the first spendable category? (Plan assumes block; the guess usually fills it.)
5. Row delete: inline undo strip vs ConfirmModal vs no confirmation. Plan: undo strip, no modal.
6. iOS focus-after-add reliability: needs a real-device check; fallback is keeping a persistent hidden input to retain the keyboard.
7. Approve the offline/Supabase non-atomic batch fix (section 8)?
8. Drop per-row time input (auto time at creation)? Plan: yes.
9. Swipe-to-delete: skipped in v1 because of drawer drag conflict (`AnimatedModal` touch handlers); icon button only. OK?
10. Delete `expenseParser.ts` including currency-symbol detection, or keep `detectCurrencyFromText`? Plan: delete.
11. Maximum rows cap (e.g. 30) to bound perf and the sequential Supabase inserts?
