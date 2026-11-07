# UI Polish Plan

Four items on branch `fix/ui-polish` (cut from up-to-date `main`). No dependency installs, no DB migrations applied by agents, no commits/pushes without approval (AGENTS.md section 7).

Key discovery for item 4: the `categories` table has **no `group` column** (`supabase/migrations/20260915_init.sql:66`). `supabaseFinanceService.addCategory` (`src/services/supabaseFinanceService.ts:502-526`) and `updateCategory` (`:536-550`) never write `group`; they only echo it back on the returned row, and reads derive it from the name (`:464`, `:498`). So today the group toggle in the modals is **not persisted** on the live DB. Item 4 needs a compat layer plus a user-run SQL step.

---

## 1. Categories cap line (BudgetPage)

**Files:** `src/pages/BudgetPage.tsx:304-312`; tests `tests/BudgetComponents.test.tsx` (or a new `tests/BudgetPageCategoriesHeader.test.tsx` if the page is not already rendered there).

**Changes**
- Extract a small local presentational component `CategoriesHeader` in `src/components/budget/CategoriesHeader.tsx` (props: `remaining`, `allocated`, `spent`). Keeps BudgetPage lean and testable.
- Layout:
  ```
  <div className="space-y-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 ...>Categories</h2>
      <p className="min-w-0 text-sm">
        <span className="font-black font-display text-(--text-ink)"><CurrencyText amount={remaining} /> left</span>
        <span className="text-(--text-muted)"> of <CurrencyText amount={allocated} /></span>
      </p>
    </div>
    <div role="progressbar" aria-valuenow aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-(--bg-canvas)">
      <div className="h-full rounded-full bg-emerald-500|bg-amber-500|bg-rose-500" style={{width}} />
    </div>
  </div>
  ```
- Bar fills with **spent / allocated**, clamped 0-100. Colours reuse the thresholds in CategoryProgressList (<80 emerald, 80-99 amber, >=100 rose). Over-cap: text becomes `S$X over` in `text-rose-600 dark:text-rose-400`. `allocated === 0` -> 0% width, hide bar.
- Drop the word "cap" (concise copy rule). Heading stays `Categories`. Replace the existing `text-slate-*` heading classes with `text-(--text-ink)` tokens while touching this block.
- Keep `spendableRemaining/Allocated/Spent` (BudgetPage `:196-198`); these are already spendable-only, so allocation categories never skew the bar.

**Edge cases:** 360px: heading + amount wrap onto two lines via `flex-wrap`; amounts `shrink-0`-safe because they are short. Dark mode: tokens only (rose/amber/emerald have `dark:` text variants where used as text). Large values (S$123,456): `wrap-break-word` on the `<p>`. Negative remaining handled above.

**Verification:** unit test renders `CategoriesHeader` with (a) under cap, (b) 85%, (c) over cap, (d) allocated 0; asserts text `left`/`over`, bar `aria-valuenow`, colour class. Manual: 360px and 1280px, light/dark.

---

## 2. Budget waterfall (Income Flow)

**Files:** `src/components/budget/BudgetWaterfall.tsx` (rewrite body, `:36-227`), `src/pages/BudgetPage.tsx:380-391` (rendering), tests in `tests/BudgetComponents.test.tsx` (grep for `BudgetWaterfall` first and update assertions on "Budget Waterfall Breakdown", "Disposable Pool", "Edit Budget").

**Changes**
- Remove the outer `rounded-2xl border-2 ... shadow-cute` wrapper (`:62-64`) and the internal header (`:67-90`, duplicate of the CollapsibleSection title "Income Flow"). Root becomes `<div className={`space-y-4 ${className}`}>`. CollapsibleSection is the only card.
- Replace the 4-tile grid (`:93-196`) with a vertical list. Add a tiny internal `FlowRow` (same file, not exported) taking `label`, `amount`, `sign` (`"+" | "-" | ""`), `tone` (`default | negative | total`), optional `icon`, optional `children` (sub-rows):
  ```
  <div className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-(--text-ink)">
      {icon}<TruncatedText text={label} />
    </div>
    <span className="shrink-0 font-mono-num ..."><CurrencyText amount /></span>
  </div>
  ```
- Order and sub-rows (sub-rows indented `pl-6 text-xs text-(--text-muted)`, same flex pattern):
  1. **Gross** (total gross); sub-rows Salary, Bonus (only if > 0, purple, Sparkles icon).
  2. **CPF** `-amount` (rose). Drop "(20%)" and "Employee CPF" captions; put the rate in a `<TooltipPopover>` ("Employee CPF, 20% of gross") per progressive disclosure.
  3. **Deductions** `-amount`; sub-rows Taxes, Insurance.
  4. **Take-home** as the emphasised row: `rounded-xl border-2 border-(--border-ink) bg-(--pastel-mint-light) p-3 shadow-cute-sm` (the one allowed bordered element; it is a highlight, not a container). Rename "Disposable Pool / Net Take-Home" -> `Take-home`.
  5. **Allocations** subheading (`text-xs font-bold uppercase tracking-wider text-(--text-muted)`) with a trailing `100%` token, then one row per category: colour dot (`style={{backgroundColor: color}}`, `h-2.5 w-2.5 shrink-0 rounded-full`), name via `TruncatedText` (`min-w-0 flex-1`), percent muted `shrink-0 text-xs`, amount `shrink-0`. Use `<CategoryBadge>`? No: it adds chrome; a dot + text row is lighter. Existing hardcoded fallback `"#dfc2ff"` (`:155`) -> keep as data fallback via `PRESET_COLORS[0]` from `src/lib/categoryPresets` (no new hex literals).
- Dividers between groups: `divide-y divide-(--border-subtle)` on the list wrapper with `py-2.5` rows, so no extra boxes.
- Separate allocation rows into spendable first then allocation group? Keep input order (no behaviour change).
- **Empty state** (`:38-44`, `!budget`): replace the bordered div with `EmptyStateCard` from `src/components/ui/EmptyStateCard` following the formula: title `No Budget`, prompt `Set up a budget to see your income flow.`, action Button `Set Up Budget` calling `onEditProfile` (omit the button if the handler is absent). No `bg-white dark:bg-slate-900` classes.
- **Edit button:** move out of the removed header. Render at the bottom of the list as `<Button variant="outline" size="sm" leftIcon={<Settings className="h-3.5 w-3.5" />} onClick={onEditProfile}>Edit Budget</Button>`, right-aligned (`flex justify-end pt-1`). Do not keep the raw `<button>` (`:73-81`). Alternative of placing it in CollapsibleSection's header is rejected: it would require changing that primitive and the header is a toggle target on mobile.
- Update the file header docblock (it describes the old tile layout) and drop unused imports (`DollarSign`, `Building2`, `Receipt`, `Wallet` if the row icons are not kept; keep only icons actually used so lint stays at 0 warnings).
- Indentation: file currently mixes 2/4/8 spaces; reformat the whole file to 4 spaces with double quotes per `.prettierrc` (justified since it is a rewrite).
- BudgetPage `:380-391`: no structural change; keep `subtitle` as is but shorten to `Take-home & CPF` only if the current subtitle wraps (verify at 360px). Still pass `onEditProfile`.

**Edge cases:** 360px: no grid, so nothing can overflow; long category names truncate via TruncatedText with popover; amounts like `-S$12,345.67` stay `shrink-0` (labels give way). Dark mode: `bg-(--pastel-mint-light)` and `text-(--text-ink)` are token-driven; negative amounts keep `dark:text-rose-400`. `budget.after_deductions` fallback logic (`:55`) is unchanged. Zero bonus hides the Bonus row.

**Verification:** update/add tests: renders list order Gross, CPF, Deductions, Take-home, Allocations (query by text, assert document order via `compareDocumentPosition`); no element with `shadow-cute` outer wrapper (`container.firstChild` lacks `border-2`); empty state shows `No Budget` and CTA calls `onEditProfile`; long name is truncated (TruncatedText rendered). Manual: 360px light/dark, Edit Budget opens editor.

---

## 3. iOS input zoom

iOS Safari zooms when a focused control's computed font-size < 16px. Fix with `text-base sm:text-sm` (16px on mobile, 14px from 640px). No `maximum-scale` (viewport stays at `index.html:8`).

**Primitives**
- `src/components/ui/Input.tsx:51`: `px-3.5 py-2.5 text-sm` -> `px-3.5 py-2.5 text-base sm:text-sm`. Keep `min-h-11` unaffected (padding + 16px line-height already ~44px; add `min-h-11` for AGENTS.md D if absent).
- `src/components/ui/Select.tsx:42-46` `sizeClasses`: md `text-sm` -> `text-base sm:text-sm`; **sm** variant `text-xs` -> `text-base sm:text-xs` (compact stays 12px on desktop, 16px on mobile). Mobile sm variant gets slightly taller; keep `py-2` and check dense rows (BulkAdd, filter bar) at 360px.
- Add a textarea primitive? None exists. Create `src/components/ui/Textarea.tsx` mirroring Input (label, error, same classes) and migrate the two raw textareas. This honours "Inputs & Selects: always use primitives" and avoids repeating the 16px rule. Sonnet-level job.

**Raw controls bypassing the primitives (must get the mobile 16px rule, either by migrating to `Input/Select/Textarea` or, where the control is a bespoke inline-edit/compact one, by changing its `text-xs|text-sm` class to `text-base sm:text-xs|sm:text-sm`):**

| File | Lines (`<input`/`<select`/`<textarea`) |
|---|---|
| `src/components/goals/QuickDepositModal.tsx` | 163 |
| `src/components/goals/AddEditGoalModal.tsx` | 247, 270, 294, 320, 345, 365 |
| `src/components/layout/NotificationSettingsModal.tsx` | 518, 545, 650 (check: 650 may be a toggle checkbox; skip checkbox/radio/range/file types) |
| `src/components/expenses/ExpenseFilterBar.tsx` | 209, 414 |
| `src/components/expenses/BulkAddExpenseModal.tsx` | select 432, 619, 660; textarea 484; input 549, 569, 589, 727, 772 |
| `src/components/expenses/FxRateField.tsx` | 41, 98 |
| `src/components/expenses/CentsFirstAmountInput.tsx` | 232 (shared amount input; high traffic, fix first) |
| `src/components/expenses/ExpenseFormModal.tsx` | input 902, 1002, 1013, 1075, 1133, 1208, 1253; select 1169 |
| `src/components/accounts/BulkBalanceUpdateModal.tsx` | 176, 277 |
| `src/components/accounts/EditAccountModal.tsx` | 112, 129, 180, 208 |
| `src/components/accounts/UpdateBalanceModal.tsx` | 291, 321, 338, 394, 428, 548 |
| `src/components/accounts/CreditCardTrackerSection.tsx` | 767, 791, 810 |
| `src/components/accounts/AccountGroupList.tsx` | 336 |
| `src/components/accounts/AddEditCreditCardModal.tsx` | 239, 273, 292, 320, 351, 383 |
| `src/components/accounts/AddAccountModal.tsx` | select 183; input 234, 248, 286, 322, 357, 370 |
| `src/components/categories/ManageCategoriesModal.tsx` | 635, 667, 704, 770 (770 is the name field, uses ad-hoc slate classes) |
| `src/components/recurring/AddRecurringModal.tsx` | input 267, 351; textarea 460 |
| `src/components/recurring/RecurringTable.tsx` | 155 |
| `src/components/budget/BaseProfileEditorModal.tsx` | 757, 781, 939, 1247, 1288, 1363 (+ inline category name input near 945, `text-xs`) |
| `src/components/budget/SurplusSweepModal.tsx` | 379 |
| `src/components/budget/BonusAllocationCollapsible.tsx` | 54 |

(Source: `grep -rnE "<(input|textarea|select)\b" src`; re-run before starting, as ExpenseFormModal and BulkAdd are being churned by the unified-expense-form refactor.)

**Approach:** two passes. (a) Fix primitives + `CentsFirstAmountInput` + `Textarea` (covers most real use). (b) Sweep the table: for each raw control, prefer swapping to `<Input>/<Select>/<Textarea>`; if a bespoke look is needed (inline table cell, number steppers, sweep sliders with text boxes), apply `text-base sm:text-sm` in place. Skip `type=checkbox|radio|range|file|hidden` (not subject to zoom).

**Guard against regressions:** add a vitest that reads `src/**/*.tsx`, finds raw `<input|select|textarea` (excluding `ui/` and non-text types) and asserts the element's className contains `text-base`. Use `fs`/`glob` in `tests/inputZoomGuard.test.ts`. If the allowlist for bespoke cases is needed, keep it explicit in the test. This is the cheapest durable fix.

**Edge cases:** compact `Select` rows at 360px (filter bar, BulkAdd) get taller text; check truncation (`truncate` already on select) and button heights. Placeholders inherit size. Dark mode unaffected. `font-mono-num` inputs: size class still applies.

**Verification:** unit tests on `Input`/`Select` (both variants) asserting class `text-base` and `sm:text-sm`/`sm:text-xs`; the guard test above; manual on a real iPhone (or Safari responsive mode with iOS UA): tap each modal's fields, confirm no zoom. `npm run build` + lint.

---

## 4. No warnings for allocation ("set aside") categories

### 4a. Behaviour fixes (no DB needed)

**Files and changes**
- `src/components/budget/CategoryProgressList.tsx`
  - Banner (`:74-97`, wait: filter at `:73-76`): compute `overBudgetCategories` only from `categories.filter((c) => isSpendableCategory(c.category ?? c.category_id))` (import from `../../lib/financialFormulas`). That alone silences the "X categories have exceeded budget" banner on the Allocations section.
  - Per-row: compute `const tracksCap = isSpendableCategory(catDetail.category ?? catDetail.category_id)`. When `!tracksCap`:
    - `isOverBudget = isNearLimit = false`; no `StatusIcon` badge, no "Over by", no "Rose Cap Exceeded" badge, card never gets the coral tint (`:130-132`).
    - Replace status badge with a neutral `Set aside` pill: `bg-(--pastel-lilac-light) text-(--text-ink)` + `PiggyBank` icon, no percentage.
    - Replace Spent / Budgeted / Remaining grid (`:182-212`) with a two-cell display: **Set aside** `<CurrencyText amount={allocated} />` and, only if `actual > 0`, **Funded** `<CurrencyText amount={actual} />` (neutral `text-(--text-ink)`, no rose/emerald). Rename the Remaining label away entirely (a surplus over the cap is not an error).
    - Progress bar: neutral `bg-(--pastel-lilac)` fill clamped to 100%, no status colours; if `allocated === 0` hide the bar. Keep `role="progressbar"` for tests.
  - Update the file docblock (`:1-12`), and keep `getCategoryIcon` as is (mapping Allowance to an icon is out of scope).
  - Keep the component usable for the spendable list too (BudgetPage `:372`/`:367` both use it); behaviour is purely per-row.
- `src/components/budget/CategoryLimitWarningBanner.tsx`: already filters at `:99` (sound/toast path) and `:186` (banner list). Add a regression test only. Verify both paths use the same helper after 4b changes (`isSpendableCategory(targetCat.category || targetCat.category_id)` works with the full object, so honours `group`).
- `src/lib/reminders/rules.ts:461` `checkBudgetLimitReminders`: already skips non-spendable via `isSpendableCategory(c.category || c.category_id)`. Same helper, so fixed by 4b. **Caveat:** if `c.category` is undefined, it falls to the `category_id` string, which is a UUID, which `isSpendableCategory` treats as spendable (no name match). Audit callers (`src/lib/reminders/engine.ts:200-206`, `src/server/sendReminders.ts` via `computeRemindersFrom`) to ensure `categories[i].category` is populated with the joined row; add a test with `category` missing to document the behaviour, and prefer making the helper ignore UUID-looking strings (`isValidUuid` in `src/lib/uuid.ts`) rather than silently treating them as spendable-by-name.
- Edge function bundle `supabase/functions/_shared/dist/send-reminders.js` is **generated** (`npm run build:functions`); it contains its own copy of `isSpendableCategory` (`:569`). After changing the helper, regenerate with `npm run build:functions` (is it tracked? check `git ls-files supabase/functions/_shared/dist`; if tracked, include in the commit). Deploying (`npm run deploy:functions`) is a user action.
- `DashboardPage.tsx:62` and `BudgetPage.tsx:181-182` already split on the helper; no change except what 4b brings.
- Sounds: `playBudgetWarningSound/ExceededSound` only fire from CategoryLimitWarningBanner (`:117` region), already gated at `:99`. No other callers (grep `playBudget` to confirm before closing).

### 4b. Persisting the toggle ("Track cap" vs "Set aside")

Current state: `CategoryGroup = 'spendable' | 'allocation'` exists in types (`src/types/finance.ts:90,99,106`); there is no DB column, so the value is lost on reload and re-derived from the name. Since the live DB must not be touched by agents:

1. **Add migration file** `supabase/migrations/20261107090000_categories_group.sql` (full timestamp, unapplied; user applies it):
   ```sql
   alter table categories
     add column if not exists "group" text
     check ("group" in ('spendable', 'allocation'));
   ```
   Nullable on purpose: null means "derive from name", so existing rows behave exactly as today. No backfill in the migration.
2. **Compat layer in `supabaseFinanceService`** (so the app works before AND after the user applies the migration, per the "no remote migrations, add compat layers" rule):
   - Reads (`:464`, `:498`): `group: row.group ?? (isSpendableCategory(row.name) ? 'spendable' : 'allocation')` (replace `||` with `??` to keep explicit values). `select('*')` will return the column when it exists and omit it when it does not; confirm the select strings include `*`.
   - `addCategory`/`updateCategory`: include `group` in the payload; on Postgres error `42703` (undefined column) or PostgREST `PGRST204` ("column not found in schema cache"), retry once without `group` and return the row with the requested group echoed (current behaviour). Cache a module-level `groupColumnSupported` flag to avoid repeated failing requests.
   - `mockFinanceService.ts` already tracks `group`; just ensure update persists it.
3. **Name fallback** in `isSpendableCategory` (`src/lib/financialFormulas.ts:251-258`): extend the regex-like checks to `invest|saving|tith|allowance`. Refactor to a single `ALLOCATION_NAME_HINTS = ["invest", "saving", "tith", "allowance"]` constant. This makes Allowance an allocation category **immediately, with no DB change**, for rows whose group is null/unset. An explicit `group` always wins (so a user can flip it back to "Track cap").
   - Side effect to flag: anything named like `Savings goals`, `Allowance`/`Pocket allowance` becomes allocation; excluded from spend trends (`financialFormulas.ts:472,489`), the expense form's spendable picker (`ExpenseFormModal.tsx:266-270`), and Dashboard stats. That is the intended outcome for Allowance.
4. **User-run SQL (optional, after applying the migration):** to persist rather than rely on the name hint:
   ```sql
   update categories set "group" = 'allocation'
   where lower(name) like '%allowance%'
      or lower(name) similar to '%(invest|saving|tith)%';
   ```
   (or just flip the toggle per category in the app once the column exists.) Agents must not run either statement.

### 4c. Toggle UI ("Track cap" / "Set aside")

- `src/components/categories/ManageCategoriesModal.tsx:782-832`: replace the two verbose buttons ("Spendable Category" / "Wealth & Fixed Allocation", long descriptions) with `SegmentedTabs` (already used in this modal at `:487`) or two `Button`s: options `Track cap` and `Set aside`; label `Mode`; one short helper under it using TooltipPopover instead of a paragraph (`Track cap: warns near the limit. Set aside: funded, never warns.`). Replace the raw name `<input>` at `:770` with `<Input>` (also helps item 3).
- `src/components/budget/BaseProfileEditorModal.tsx:947-985`: same labels (`Spendable` / `Wealth / Fixed` -> `Track cap` / `Set aside`); reuse a shared small component `CategoryModeToggle` in `src/components/categories/CategoryModeToggle.tsx` used by both modals so copy/behaviour cannot drift (AGENTS.md section 5C zero redundancy). Both modals already carry `group` state and send it on save (`ManageCategoriesModal :396,403`, `BaseProfileEditorModal :502,514`).
- Default for new categories stays `Track cap`.
- Existing copy strings elsewhere that say "Spendable"/"Wealth & Fixed" (`ManageCategoriesModal :466` subtitle `Spendable caps & wealth allocations`, `:496` tabs) -> shorten to `Caps & set-asides` only if there is room; low priority.

**Edge cases:** category with `group = 'allocation'` but spending logged against it (via goal funding or the expense form's allocation picker, `ExpenseFormModal:270,378`): shown as `Funded S$X`, never alarming. `allocated_amount = 0` rows: bar hidden. Flipping a category from Track cap to Set aside mid-month: past reminders for it simply stop being generated; dedupe keys (`reminder-budget-exceeded-...`) are unchanged. Dark mode: lilac tokens only, no `#fff1ee` hardcodes on the allocation path (the existing banner at `:77` uses hex values; convert to `bg-(--pastel-coral-light)` while editing since it violates AGENTS.md hex rule). 360px: pill + name must keep `min-w-0`/`shrink-0` as already done in the header row.

**Verification**
- `tests/financialFormulas.test.ts`: `isSpendableCategory` — `Allowance` (name and object without group) -> false; object with `group: 'spendable'` and name `Allowance` -> true; explicit `allocation` on `Food` -> false; case/whitespace.
- `tests/BudgetComponents.test.tsx` (CategoryProgressList): allocation row over cap -> no `badge-rose-*`, no "exceeded budget" banner, shows `Set aside`/`Funded`; spendable row over cap still shows banner and badge (existing test must stay green).
- `tests/BudgetSurplusAlerts.test.tsx` / a new `CategoryLimitWarningBanner` test: allocation category crossing 80/100% fires no sound (mock `soundEffects`), no toast, no banner.
- Reminders: add cases to the existing reminder tests (find via `grep -l checkBudgetLimitReminders tests`; `tests/sendReminders.test.ts`, `tests/StreakAndNotifications.test.tsx`): allocation over cap -> `[]`; missing `category` join -> documented behaviour.
- `tests/supabaseFinanceService.test.ts`: `addCategory`/`updateCategory` with a mock client whose insert errors with `42703` first -> retries without `group`, returns echoed group; success path sends `group`.
- `tests/categoryManagement.test.tsx`: toggle labels `Track cap` / `Set aside`; save payload carries the selected group.
- Manual with the mock service (no live DB): add `Allowance`, confirm it appears under Allocations, no banner. Do not run against prod.

---

## Suggested commit breakdown (conventional commits; each needs user approval)

1. `fix(inputs): use 16px text on mobile to stop iOS focus zoom` (primitives, Textarea, CentsFirstAmountInput, guard test, sweep of raw controls; may split sweep by area: `expenses`, `accounts`, `budget/categories/goals/recurring`).
2. `refactor(budget): flatten income flow into a single-card list` (BudgetWaterfall + tests).
3. `feat(budget): bold remaining with progress bar in categories header` (CategoriesHeader + BudgetPage + tests).
4. `fix(budget): suppress cap warnings for set-aside categories` (CategoryProgressList, helper change incl. Allowance hint, reminders tests, rebuilt functions bundle if tracked).
5. `feat(categories): persist track-cap vs set-aside toggle` (migration file, service compat layer, shared `CategoryModeToggle`, both modals, copy).

Quality gate before proposing the PR: `npm run lint` (0/0), `npm run build`, `npm test`, `npm run test:e2e` (UI flows touched).

## Open questions

1. OK to ship `supabase/migrations/20261107090000_categories_group.sql` as an unapplied file for the user to run (nullable `group` column), with the retry-without-`group` compat layer meanwhile? Without it, the toggle can only be enforced for the session and via name hints.
2. Is `supabase/functions/_shared/dist/send-reminders.js` tracked in git? If yes, regenerate in commit 4 and the user redeploys; if no, nothing to commit.
3. Item 3 sweep size is about 70 raw controls: migrate to primitives (cleaner, bigger diff, risks the in-flight unified expense form refactor `b06684f`) or add `text-base sm:text-sm` in place (small diff)? Plan default: in place for `ExpenseFormModal`/`BulkAddExpenseModal`, primitives elsewhere.
4. Should `Funded` for allocation rows count goal deposits and allocation-category expenses (current `actualSpent`) or stay at "Set aside" only? Plan default: show both, hide Funded when 0.
