# Spendable Pacing & Multi-Goal Surplus Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide full visibility into remaining monthly spendable budget and daily pacing on the Expenses page, paired with a celebratory, multi-goal month-end surplus sweep workflow and a clean slate each month.

**Architecture:** 
- Pure financial calculation utilities in `financialFormulas.ts` calculate perspective-aware spendable caps, actual spendable expenditures, remaining allowance, and dynamic daily pace (`remaining ÷ daysLeftInMonth`).
- Reusable UI component `<SurplusSweepModal />` powered by `<AnimatedModal />` supports splitting month-end unspent surplus across multiple Savings Goals by fixed dollars or percentages.
- Celebratory `<MonthEndSweepBanner />` integrates into both `ExpensesPage` and `BudgetPage` (`CumulativeSurplusCard`), allowing 1-click surplus sweeps.
- Updated `ExpensesPage` summary strip adopts a 4-card responsive grid featuring Spendable Remaining as the primary card with an inline progress meter and daily pace pill.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, TanStack Query, Lucide icons, Vitest, Testing Library.

**Spec:** Decisions aligned during `/grill-me` session on 2026-10-29:
- Clean slate every month for spendable limits (no rollover into next month's day-to-day spending).
- Prompted month-end sweep celebrating unspent surplus with multi-goal allocation (% or $ split).
- 4-card summary strip on Expenses page: Spendable Remaining (primary with daily pace), Total Spent, Shared Spending, Unsettled Balance.
- Deficits recorded in surplus history without penalizing Day 1 of the new month.

## Global Constraints

- Use canonical Tailwind v4 utilities (`bg-(--bg-card)`, `border-(--border-ink)`, `shadow-(--shadow-cute)`, `stroke-3` or `strokeWidth={2.5}`).
- 4 spaces indentation (`tabWidth: 4`), double quotes (`" "`), semicolons (`semi: true`), multi-line trailing commas.
- Reuse existing primitives in `src/components/ui/` (`Card`, `StatCard`, `Button`, `AnimatedModal`, `Badge`, `CurrencyText`, `TooltipPopover`, `TruncatedText`).
- Fast refresh hygiene: no non-component exports in `.tsx` files without `react-refresh/only-export-components` annotation.
- TanStack Query memoization: no raw inline array/object literals in query hook dependency arrays.

---

### Task 1: Update AGENTS.md Guidelines with UI System & Reusable Component Rules

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: Developer & agent design system rules for UI consistency, reusable components, and usability guardrails.

- [ ] **Step 1: Edit `AGENTS.md` to add Section 5 (UI System, Reusable Primitives & Usability Standards)**
  - Add guidelines for Theme tokens (`--bg-canvas`, `--bg-card`, `--text-ink`, `--border-ink`, `--shadow-cute`).
  - Document mandatory reusable primitives (`Card`, `StatCard`, `Button`, `AnimatedModal`, `Badge`, `CurrencyText`, `TooltipPopover`).
  - Document usability standards (touch targets, visual feedback, clear hierarchy, empty/loading states).
- [ ] **Step 2: Verify formatting and markdown structure**
  - Ensure 4-space formatting and clear headings.

---

### Task 2: Pure Domain Helpers for Spendable Pacing & Surplus Detection

**Files:**
- Modify: `src/lib/financialFormulas.ts`
- Create / Modify: `tests/financialFormulas.test.ts`

**Interfaces:**
- Produces:
  - `calculateSpendablePacing(options)`:
    - Input: `{ month: string; memberId?: string; perspective: Perspective; expenses: Expense[]; categories: Category[]; baseProfiles?: BaseBudgetProfile[]; baseAllocations?: BaseProfileAllocation[]; monthlyBudget?: MonthlyBudgetDetail | null }`
    - Returns: `{ spendableAllocated: number; spendableSpent: number; spendableRemaining: number; daysInMonth: number; dayOfMonth: number; daysRemaining: number; dynamicDailyPace: number; isCurrentMonth: boolean; pacingStatus: 'safe' | 'warning' | 'exceeded'; progressPercent: number }`
  - `detectUnspentMonthEndSurplus(options)`:
    - Input: `{ currentMonth: string; lastMonth: string; memberId?: string; perspective: Perspective; expenses: Expense[]; categories: Category[]; baseProfiles?: BaseBudgetProfile[]; baseAllocations?: BaseProfileAllocation[] }`
    - Returns: `{ hasUnspentSurplus: boolean; surplusAmount: number; lastMonth: string }`

- [ ] **Step 1: Write failing unit tests for `calculateSpendablePacing` and `detectUnspentMonthEndSurplus` in `tests/financialFormulas.test.ts`**
  - Test calculation with normal current month, dynamic daily pace (`remaining / daysLeft`).
  - Test past month behavior (`daysRemaining = 0`, daily pace 0, remaining equals final surplus/deficit).
  - Test personal perspective with 50/50 shared split and goal-funded expense exclusion.
  - Test detecting unspent surplus from the prior month.
- [ ] **Step 2: Run test to confirm it fails**
  - Run `npx vitest run tests/financialFormulas.test.ts`.
- [ ] **Step 3: Implement `calculateSpendablePacing` and `detectUnspentMonthEndSurplus` in `src/lib/financialFormulas.ts`**
  - Use `isSpendableCategory` to include only Food, Lifestyle, Transport, Buffer.
  - Exclude expenses with `goal_id`.
  - Factor `getMemberExpenseShare` for accurate perspective calculation.
  - Calculate days in month and days remaining dynamically based on Singapore local time / given date.
- [ ] **Step 4: Run test to confirm it passes**
  - Run `npx vitest run tests/financialFormulas.test.ts`.

---

### Task 3: Multi-Goal Surplus Sweep Modal Component

**Files:**
- Create: `src/components/budget/SurplusSweepModal.tsx`
- Create: `tests/SurplusSweepModal.test.tsx`

**Interfaces:**
- Produces: `<SurplusSweepModal isOpen={boolean} onClose={() => void} surplusAmount={number} month={string} goals={SavingsGoal[]} onSweepComplete={(allocations: Array<{ goalId: string; amount: number }>) => Promise<void>} />`
- Consumes: `AnimatedModal`, `Button`, `Badge`, `CurrencyText`, `formatSGD`, `soundEffects`.

- [ ] **Step 1: Write test for `SurplusSweepModal` in `tests/SurplusSweepModal.test.tsx`**
  - Test renders surplus amount and active savings goals.
  - Test selecting goals and toggling between Percentage (%) and Dollar ($) mode.
  - Test "Split Evenly" preset button.
  - Test validation prevents submitting if total allocated exceeds surplus amount.
  - Test submitting calls `onSweepComplete` with correct `{ goalId, amount }` array.
- [ ] **Step 2: Run test to confirm it fails**
  - Run `npx vitest run tests/SurplusSweepModal.test.tsx`.
- [ ] **Step 3: Implement `SurplusSweepModal.tsx`**
  - Use `AnimatedModal`, `ModalHeader`, `ModalBody`, `ModalFooter`.
  - Display celebration header with PiggyBank and sparkle icons.
  - Include presets: "Split Evenly", "All to Top Goal".
  - Goal rows with checkboxes, goal emoji, title, target progress preview, and amount/percentage input.
  - Running remaining surplus badge showing how much is left to allocate.
  - Confetti and celebration chime sound on successful submit.
- [ ] **Step 4: Run test to confirm it passes**
  - Run `npx vitest run tests/SurplusSweepModal.test.tsx`.

---

### Task 4: Celebratory Month-End Sweep Banner Component

**Files:**
- Create: `src/components/budget/MonthEndSweepBanner.tsx`
- Create: `tests/MonthEndSweepBanner.test.tsx`

**Interfaces:**
- Produces: `<MonthEndSweepBanner month={string} surplusAmount={number} onSweepClick={() => void} onDismiss={() => void} className?: string />`
- Consumes: `Card`, `Button`, `CurrencyText`, `Sparkles`, `ArrowRight`, `X`.

- [ ] **Step 1: Write test for `MonthEndSweepBanner` in `tests/MonthEndSweepBanner.test.tsx`**
  - Test renders month name, formatted surplus amount, and "Sweep to Goals" button.
  - Test clicking dismiss triggers `onDismiss`.
  - Test clicking "Sweep to Goals" triggers `onSweepClick`.
- [ ] **Step 2: Run test to confirm it fails**
  - Run `npx vitest run tests/MonthEndSweepBanner.test.tsx`.
- [ ] **Step 3: Implement `MonthEndSweepBanner.tsx`**
  - Style with pastel lilac/cream card background, cute border-2, and subtle hover animations.
  - Include celebratory copy: "🎉 Great job in [Month]! You have [S$XXX] unspent spendable budget."
  - Action button "Sweep to Savings Goals →".
- [ ] **Step 4: Run test to confirm it passes**
  - Run `npx vitest run tests/MonthEndSweepBanner.test.tsx`.

---

### Task 5: 4-Card Summary Grid & Sweep Integration in ExpensesPage

**Files:**
- Modify: `src/pages/ExpensesPage.tsx`
- Create / Modify: `tests/ExpensesPage.test.tsx`

**Interfaces:**
- Consumes: `calculateSpendablePacing`, `detectUnspentMonthEndSurplus`, `SurplusSweepModal`, `MonthEndSweepBanner`, `StatCard`, `financeService.updateGoal`.

- [ ] **Step 1: Write test for updated ExpensesPage summary strip in `tests/ExpensesPage.test.tsx`**
  - Verify 4 cards render: Spendable Remaining, Total Spent, Shared Spending, Unsettled Balance.
  - Verify Spendable Remaining card displays remaining amount, daily pace (`S$XX/day left`), and monthly limit info.
  - Verify celebration sweep banner renders if unspent surplus detected from previous month and opens modal when clicked.
- [ ] **Step 2: Run test to confirm it fails**
  - Run `npx vitest run tests/ExpensesPage.test.tsx`.
- [ ] **Step 3: Update `ExpensesPage.tsx`**
  - Compute `spendablePacing` via `calculateSpendablePacing` using TanStack queries (`expensesData`, `categoriesData`, `baseProfilesData`, `baseAllocationsData`).
  - Check for unspent surplus in previous month (with localStorage dismissal tracking to avoid nagging).
  - Update grid from `sm:grid-cols-3` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
  - Add Primary Spendable Remaining card:
    - Title: "Spendable Remaining"
    - Value: `formatSGD(pacing.spendableRemaining)`
    - Subtitle: Dynamic pace e.g. `S$45.00/day left (16 days)` or `Month ended: +S$250 surplus`.
    - Footer / Badge: Progress meter showing `Spent S$XXX of S$X,XXX cap`.
    - Color indicator (emerald if healthy, amber if warning, rose if overspent).
  - Integrate `<SurplusSweepModal />` and handle multi-goal deposit via `financeService.updateGoal`.
- [ ] **Step 4: Run test to confirm it passes**
  - Run `npx vitest run tests/ExpensesPage.test.tsx`.

---

### Task 6: Integrate Sweep Action into CumulativeSurplusCard on BudgetPage

**Files:**
- Modify: `src/components/budget/CumulativeSurplusCard.tsx`
- Modify: `src/pages/BudgetPage.tsx`
- Modify: `tests/BudgetSurplusAlerts.test.tsx`

**Interfaces:**
- Consumes: `SurplusSweepModal`, `SavingsGoal`.

- [ ] **Step 1: Write/update test verifying "Sweep to Goals" button appears in `CumulativeSurplusCard` when surplus > 0**
  - Run `npx vitest run tests/BudgetSurplusAlerts.test.tsx`.
- [ ] **Step 2: Update `CumulativeSurplusCard.tsx`**
  - Add a "Sweep Surplus" action button in the card header or footer when the selected month or cumulative surplus is positive.
  - Open `<SurplusSweepModal />` passing active savings goals.
- [ ] **Step 3: Run test to confirm it passes**
  - Run `npx vitest run tests/BudgetSurplusAlerts.test.tsx`.

---

### Task 7: Full System Verification & Regression Testing

**Files:**
- All modified and newly created files.

- [ ] **Step 1: Run TypeScript typecheck**
  - Run `npm run build` to verify zero type errors.
- [ ] **Step 2: Run full unit test suite**
  - Run `npx vitest run` and verify all tests pass.
- [ ] **Step 3: Verify Tailwind v4 and code styling consistency**
  - Verify no arbitrary CSS brackets, canonical tokens used, 4-space indentation, semicolons.
