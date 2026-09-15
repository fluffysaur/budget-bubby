# Budget Buddy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modern couple and personal finance web application (React 19, Vite, Tailwind CSS, Supabase PostgreSQL/Auth, Vercel) for Yi Jia and Rachel, replacing their Notion workspace with automated budgeting, loan amortization, shared expense splitting, and PWA mobile speed.

**Architecture:** A fast Single-Page Application with a decoupled service layer. When Supabase credentials exist, it runs authenticated PostgreSQL queries with Row-Level Security. Without credentials, it falls back seamlessly to a local storage mock store with pre-seeded demo data for immediate testing. Public GitHub repository safe: no real financial figures are committed to Git.

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind CSS, Lucide React, Recharts, TanStack Query, Vitest, Supabase JS, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-15-budget-buddy-design.md`

## Global Constraints
- **Public Git Safety**: Never commit real balances, account numbers, or personal secrets to Git. Use `.gitignore` for `.env*` and `*.private.sql`.
- **Currency**: Singapore Dollars (SGD) formatted as `S$1,234.56`.
- **CPF Contribution**: 20% employee deduction from gross salary.
- **True Net Worth Formula**: `True Net Worth = Total Assets - Outstanding Loans`.
- **Shared Expense Split**: Default 50/50 split ratio with running "Who Owes Whom" settlement balance.
- **Vercel Routing**: SPA rewrites configured in `vercel.json` so direct URL visits don't 404.

---

### Task 1: Project Scaffolding, Tooling, Tailwind & Test Setup

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `vercel.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

**Interfaces:**
- Produces: Working React 19 + Vite + TypeScript + Tailwind CSS project with Vitest test runner.

- [ ] **Step 1: Create package.json and project configs**
Create `package.json` with dependencies (`react`, `react-dom`, `@supabase/supabase-js`, `@tanstack/react-query`, `lucide-react`, `recharts`, `clsx`, `tailwind-merge`) and devDependencies (`vite`, `typescript`, `tailwindcss`, `@tailwindcss/vite` or postcss, `vitest`, `@testing-library/react`, `jsdom`).

- [ ] **Step 2: Create Vite and TypeScript configurations**
Setup `vite.config.ts`, `vitest.config.ts`, and `tsconfig.json` with path aliases and DOM testing environment.

- [ ] **Step 3: Setup index.html, index.css, and vercel.json**
Setup standard HTML5 entry, Tailwind CSS imports, and `vercel.json` rewrite:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 4: Create simple App.tsx and verify build & tests**
Run `npm install`, `npm run build`, and `npm run test` to verify zero errors.

- [ ] **Step 5: Commit**
```bash
git add package.json vite.config.ts tsconfig*.json index.html src/ vercel.json vitest.config.ts tests/
git commit -m "chore: scaffold react vite tailwind project with vitest"
```

---

### Task 2: Core Financial Types & Calculation Engines (TDD)

**Files:**
- Create: `src/types/finance.ts`
- Create: `src/lib/currency.ts`
- Create: `src/lib/dateUtils.ts`
- Create: `src/lib/financialFormulas.ts`
- Test: `tests/financialFormulas.test.ts`
- Test: `tests/currency.test.ts`

**Interfaces:**
- Produces:
  - `formatSGD(amount: number): string`
  - `calculateCPFAndNetPay(grossSalary: number, cpfRate?: number, bonus?: number): { cpfDeduction: number; takeHomePay: number }`
  - `calculateDisposableBudget(takeHomePay: number, taxesMonthly: number, insuranceMonthly: number): number`
  - `calculateCategoryAllocations(afterDeductions: number, targets: { categoryId: string; percentage: number }[]): { categoryId: string; allocatedAmount: number }[]`
  - `calculateLoanAmortization(principal: number, annualRate: number, monthlyPayment: number, startDate: string, extraMonthlyPayment?: number): AmortizationResult`
  - `calculateSharedExpenseSettlement(expenses: Expense[], member1Id: string, member2Id: string): SettlementSummary`
  - `calculateGoalPacing(targetAmount: number, savedSoFar: number, targetDate: string, monthlyContribution: number): GoalPacingResult`

- [ ] **Step 1: Write failing tests for financial formulas & currency formatting**
Write comprehensive test suites covering:
- SGD formatting (`1234.5` -> `S$1,234.50`, negative amounts -> `-S$50.00`)
- Singapore CPF 20% calculation (`5000` gross -> `1000` CPF, `4000` take-home)
- After-deductions pool calculation
- HDB Loan amortization ($500k @ 2.6%, $2,665/mo -> exact interest, principal, months, payoff date)
- Prepayment simulation (extra $500/mo -> shortened term and saved interest)
- Splitwise-style settlement calculation (Yi Jia paid $100 shared, Rachel paid $40 shared -> Rachel owes Yi Jia $30)
- Goal pacing status (`Achieved`, `On Track`, `Behind`)

- [ ] **Step 2: Run tests to verify they fail**
Run `npx vitest run tests/financialFormulas.test.ts` -> Expected: FAIL (modules missing).

- [ ] **Step 3: Implement types, currency, dateUtils, and financialFormulas**
Implement the mathematical functions exactly as specified in the design spec.

- [ ] **Step 4: Run tests to verify they pass**
Run `npx vitest run` -> Expected: ALL PASS.

- [ ] **Step 5: Commit**
```bash
git add src/types/ src/lib/ tests/
git commit -m "feat: implement core financial calculation engines with full test coverage"
```

---

### Task 3: Supabase Migrations, Private Notion Seed & Mock Public Seed

**Files:**
- Create: `supabase/migrations/20260915_init.sql`
- Create: `supabase/seed.private.sql` (Gitignored)
- Create: `src/data/mockSeedData.ts`

**Interfaces:**
- Produces:
  - Complete PostgreSQL DDL for all 14 tables with foreign keys, indexes, and RLS policies.
  - Private SQL seed script containing the real Notion workspace data for private Supabase import.
  - Public mock seed dataset for local demo testing.

- [ ] **Step 1: Create Supabase migration DDL**
Write `supabase/migrations/20260915_init.sql` defining:
`households`, `household_members`, `accounts`, `account_snapshots`, `base_budget_profiles`, `categories`, `base_profile_allocations`, `monthly_budgets`, `monthly_budget_categories`, `expenses`, `loans`, `loan_payments`, `savings_goals`, `recurring_policies`, plus RLS policies and indexes.

- [ ] **Step 2: Create private seed SQL script**
Write `supabase/seed.private.sql` populated with the exact Notion data extracted during discovery:
- Yi Jia & Rachel household members
- 13 Yi Jia Accounts (UOB Lady's, SGX CDP, OCBC Invest, CPF OA/SA/MA, Webull, Moomoo, IBKR, POSB, UOB One, ESPP, OCBC 360)
- 5 Rachel Accounts (OCBC 360, POSB, CPF OA/SA/MA)
- HDB Loan ($500,000 @ 2.6%, $2,665/mo)
- 5 Shared Goals (Wedding $55k, Honeymoon $10k, HDB Down Payment $190k, Renovation $90k, Baby Fund $30k)
- Policies: Manulife Lifeready, Income Enhanced Incomeshield, IRAS Income Tax 2026
- Category allocations (Food 15%, Lifestyle 15%, Investments 35%, Savings 15%, Tithing 10%, Transport 5%, Buffer 5%)

- [ ] **Step 3: Create public mock dataset**
Create `src/data/mockSeedData.ts` exporting fully typed mock data (anonymized/template amounts for public safety) matching the exact schema.

- [ ] **Step 4: Verify .gitignore protection**
Verify `git status` shows `seed.private.sql` is untracked and ignored by `.gitignore`.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/ src/data/mockSeedData.ts
git commit -m "feat: add supabase migration schema and public mock seed data"
```

---

### Task 4: Dual-Mode Data Access Service Layer (TDD)

**Files:**
- Create: `src/services/supabaseClient.ts`
- Create: `src/services/financeService.ts`
- Create: `src/services/mockFinanceService.ts`
- Create: `src/services/supabaseFinanceService.ts`
- Test: `tests/financeService.test.ts`

**Interfaces:**
- Produces:
  `FinanceService` interface implemented by `mockFinanceService` and `supabaseFinanceService`:
  - `getHouseholdOverview(): Promise<HouseholdOverview>`
  - `getAccounts(perspective: Perspective): Promise<Account[]>`
  - `updateAccountBalance(accountId: string, newBalance: number): Promise<Account>`
  - `getMonthlyBudget(month: string, memberId?: string): Promise<MonthlyBudgetDetail>`
  - `updateMonthlyBudget(budget: Partial<MonthlyBudget>): Promise<void>`
  - `updateBaseProfile(profile: BaseBudgetProfile, allocations: BaseAllocation[]): Promise<void>`
  - `getExpenses(filter: ExpenseFilter): Promise<Expense[]>`
  - `addExpense(expense: CreateExpenseInput): Promise<Expense>`
  - `deleteExpense(id: string): Promise<void>`
  - `settleSharedExpenses(member1Id: string, member2Id: string): Promise<void>`
  - `getLoans(): Promise<Loan[]>`
  - `getGoals(): Promise<SavingsGoal[]>`
  - `addGoal(goal: CreateGoalInput): Promise<SavingsGoal>`
  - `updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal>`
  - `getPolicies(): Promise<RecurringPolicy[]>`

- [ ] **Step 1: Write test for mock finance service CRUD operations**
Write unit tests for `mockFinanceService`:
- Read initial accounts & compute net worth
- Update account balance and verify snapshot created
- Add a shared expense and verify settlement balance updates
- Settle expenses and verify balance resets
- Add/update savings goals

- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run tests/financeService.test.ts` -> Expected: FAIL.

- [ ] **Step 3: Implement mockFinanceService & supabaseClient & financeService dispatcher**
Implement in-memory / localStorage mock service that loads `mockSeedData.ts` and persists changes. Create `financeService.ts` that detects if `VITE_SUPABASE_URL` is set to delegate to `supabaseFinanceService`, otherwise uses `mockFinanceService`.

- [ ] **Step 4: Run test to verify it passes**
Run `npx vitest run tests/financeService.test.ts` -> Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/services/ tests/financeService.test.ts
git commit -m "feat: implement dual-mode finance service layer with mock fallback"
```

---

### Task 5: App Shell, Context & Perspective Switcher

**Files:**
- Create: `src/context/HouseholdContext.tsx`
- Create: `src/components/layout/AppHeader.tsx`
- Create: `src/components/layout/DesktopSidebar.tsx`
- Create: `src/components/layout/MobileBottomNav.tsx`
- Create: `src/components/layout/PerspectiveBanner.tsx`
- Test: `tests/HouseholdContext.test.tsx`

**Interfaces:**
- Produces:
  - `useHousehold()` hook providing `{ perspective, setPerspective, members, activeMember, theme, toggleTheme, isMockMode }`.
  - Responsive layout shell with top header, desktop sidebar, and mobile bottom navigation with Quick Add action.

- [ ] **Step 1: Write test for HouseholdContext**
Test switching between `household`, `yijia`, and `rachel`, verifying `activeMember` updates accordingly.

- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run tests/HouseholdContext.test.tsx` -> Expected: FAIL.

- [ ] **Step 3: Implement HouseholdContext, AppHeader, DesktopSidebar, and MobileBottomNav**
Build the components with clean Tailwind styles, Lucide icons, perspective pills, currency badges, and theme toggle.

- [ ] **Step 4: Run test to verify it passes**
Run `npx vitest run tests/HouseholdContext.test.tsx` -> Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/context/ src/components/layout/ tests/HouseholdContext.test.tsx
git commit -m "feat: add app shell, responsive navigation, and perspective switcher"
```

---

### Task 6: Quick Add Expense Modal & Daily Expense Ledger

**Files:**
- Create: `src/components/expenses/QuickAddExpenseModal.tsx`
- Create: `src/components/expenses/ExpenseListTable.tsx`
- Create: `src/components/expenses/ExpenseFilterBar.tsx`
- Create: `src/pages/ExpensesPage.tsx`
- Test: `tests/ExpenseComponents.test.tsx`

**Interfaces:**
- Produces:
  - Fast mobile-optimized Quick Add modal with numeric input, category selection, payer toggle, and 50/50 split option.
  - Searchable, filterable expense ledger with delete/edit capabilities.

- [ ] **Step 1: Write test for Quick Add Expense modal and splitting**
Verify modal opens, handles amount input, selects category, toggles shared split, and calls service `addExpense`.

- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run tests/ExpenseComponents.test.tsx` -> Expected: FAIL.

- [ ] **Step 3: Implement QuickAddExpenseModal, ExpenseFilterBar, and ExpenseListTable**
Create modern UI with fast keyboard support, auto-focus on amount, category chips, and delete confirmation.

- [ ] **Step 4: Run test to verify it passes**
Run `npx vitest run tests/ExpenseComponents.test.tsx` -> Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/expenses/ src/pages/ExpensesPage.tsx tests/ExpenseComponents.test.tsx
git commit -m "feat: add quick add expense modal and searchable transaction ledger"
```

---

### Task 7: Monthly Budget Tracker & Base Profile Editor

**Files:**
- Create: `src/components/budget/MonthPicker.tsx`
- Create: `src/components/budget/BudgetWaterfall.tsx`
- Create: `src/components/budget/CategoryProgressList.tsx`
- Create: `src/components/budget/BaseProfileEditorModal.tsx`
- Create: `src/pages/BudgetPage.tsx`
- Test: `tests/BudgetComponents.test.tsx`

**Interfaces:**
- Produces:
  - Month navigation (`YYYY-MM`).
  - Visual waterfall bar: Gross Salary -> 20% CPF -> Fixed Deductions -> After Deductions -> Category Allocations.
  - Category meters (Actual Spent vs Budgeted, green/amber/red indicators).
  - Modal to customize gross salary, CPF rate, and category percentage splits.

- [ ] **Step 1: Write test for budget waterfall and category calculation**
Test category spend aggregation against month expenses and over-budget warning detection.

- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run tests/BudgetComponents.test.tsx` -> Expected: FAIL.

- [ ] **Step 3: Implement budget components & page**
Build `MonthPicker`, `BudgetWaterfall`, `CategoryProgressList`, and `BaseProfileEditorModal`.

- [ ] **Step 4: Run test to verify it passes**
Run `npx vitest run tests/BudgetComponents.test.tsx` -> Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/budget/ src/pages/BudgetPage.tsx tests/BudgetComponents.test.tsx
git commit -m "feat: add monthly budget waterfall, category meters, and profile editor"
```

---

### Task 8: Accounts, Balances & Net Worth Growth Center

**Files:**
- Create: `src/components/accounts/AccountGroupList.tsx`
- Create: `src/components/accounts/AccountCard.tsx`
- Create: `src/components/accounts/UpdateBalanceModal.tsx`
- Create: `src/components/accounts/NetWorthChart.tsx`
- Create: `src/pages/AccountsPage.tsx`
- Test: `tests/AccountsComponents.test.tsx`

**Interfaces:**
- Produces:
  - Account groupings: Cash, Investments, CPF (OA/SA/MA).
  - Fast "Update Balance" modal that records date-stamped balance snapshots.
  - Interactive Recharts area chart showing Net Worth over time ($Assets - Liabilities$).

- [ ] **Step 1: Write test for accounts grouping and net worth aggregation**
Test asset summation across accounts and Net Worth calculation with outstanding loan liability.

- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run tests/AccountsComponents.test.tsx` -> Expected: FAIL.

- [ ] **Step 3: Implement account cards, update modal, Recharts area chart, and page**
Build components with SGD formatting, institution tags, asset class color badges, and historical snapshots chart.

- [ ] **Step 4: Run test to verify it passes**
Run `npx vitest run tests/AccountsComponents.test.tsx` -> Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/accounts/ src/pages/AccountsPage.tsx tests/AccountsComponents.test.tsx
git commit -m "feat: add accounts management, quick balance update, and net worth chart"
```

---

### Task 9: Loans & Debt Freedom Engine (Amortization & Prepayment Simulator)

**Files:**
- Create: `src/components/loans/LoanSummaryCard.tsx`
- Create: `src/components/loans/PrepaymentSimulator.tsx`
- Create: `src/components/loans/AmortizationChart.tsx`
- Create: `src/components/loans/AmortizationTable.tsx`
- Create: `src/pages/LoansPage.tsx`
- Test: `tests/LoansComponents.test.tsx`

**Interfaces:**
- Produces:
  - Loan overview dashboard (HDB loan: principal, current balance, interest remaining, payoff countdown).
  - Prepayment simulator: Slider for extra monthly payment or lump sum, showing immediate interest saved and years shaved off.
  - Principal vs Interest breakdown curve chart.
  - Month-by-month amortization schedule with annual rollup accordions.

- [ ] **Step 1: Write test for loan simulation and schedule generation**
Verify simulator calculates correct interest savings and updated debt-free date when extra prepayment is applied.

- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run tests/LoansComponents.test.tsx` -> Expected: FAIL.

- [ ] **Step 3: Implement LoanSummaryCard, PrepaymentSimulator, AmortizationChart, and AmortizationTable**
Build interactive UI with sliders, Recharts line/area charts, and collapsible yearly payment schedules.

- [ ] **Step 4: Run test to verify it passes**
Run `npx vitest run tests/LoansComponents.test.tsx` -> Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/loans/ src/pages/LoansPage.tsx tests/LoansComponents.test.tsx
git commit -m "feat: add loan amortization engine, prepayment simulator, and schedule table"
```

---

### Task 10: Savings Goals & Milestone Tracker

**Files:**
- Create: `src/components/goals/GoalCard.tsx`
- Create: `src/components/goals/AddEditGoalModal.tsx`
- Create: `src/pages/GoalsPage.tsx`
- Test: `tests/GoalsComponents.test.tsx`

**Interfaces:**
- Produces:
  - Visual goal cards (Wedding, Honeymoon, HDB Down Payment, Renovation, Baby Fund).
  - Pacing indicator (`Achieved`, `On Track`, `Behind`).
  - Add and edit goal modals.

- [ ] **Step 1: Write test for GoalCard status rendering**
Verify progress bar %, monthly required pace calculation, and status badge rendering.

- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run tests/GoalsComponents.test.tsx` -> Expected: FAIL.

- [ ] **Step 3: Implement GoalCard, AddEditGoalModal, and GoalsPage**
Build goal cards with emoji icons, progress bars, target date countdown, and pacing stats.

- [ ] **Step 4: Run test to verify it passes**
Run `npx vitest run tests/GoalsComponents.test.tsx` -> Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/goals/ src/pages/GoalsPage.tsx tests/GoalsComponents.test.tsx
git commit -m "feat: add savings goals tracker with monthly pacing and milestone cards"
```

---

### Task 11: Recurring Policies, Taxes & Annual Renewal Calendar

**Files:**
- Create: `src/components/recurring/PolicyTable.tsx`
- Create: `src/components/recurring/RenewalCalendar.tsx`
- Create: `src/components/recurring/AddPolicyModal.tsx`
- Create: `src/pages/RecurringPage.tsx`
- Test: `tests/RecurringComponents.test.tsx`

**Interfaces:**
- Produces:
  - Insurance and tax policies management table.
  - 12-month calendar heatmap highlighting heavy premium renewal months (e.g. September Manulife $3,155, October Incomeshield $1,612).

- [ ] **Step 1: Write test for renewal calendar month grouping**
Test grouping policies by `payment_month` and computing total cash required per month.

- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run tests/RecurringComponents.test.tsx` -> Expected: FAIL.

- [ ] **Step 3: Implement PolicyTable, RenewalCalendar, and RecurringPage**
Build table with amortized monthly cost calculation and visual 12-month timeline grid.

- [ ] **Step 4: Run test to verify it passes**
Run `npx vitest run tests/RecurringComponents.test.tsx` -> Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/recurring/ src/pages/RecurringPage.tsx tests/RecurringComponents.test.tsx
git commit -m "feat: add recurring policies table and 12-month renewal calendar"
```

---

### Task 12: Combined Household Hub & Settlement Center

**Files:**
- Create: `src/components/dashboard/NetWorthHeroCard.tsx`
- Create: `src/components/dashboard/SettlementWidget.tsx`
- Create: `src/components/dashboard/SharedGoalsOverview.tsx`
- Create: `src/components/dashboard/UpcomingBillsWidget.tsx`
- Create: `src/pages/DashboardPage.tsx`
- Test: `tests/DashboardComponents.test.tsx`

**Interfaces:**
- Produces:
  - Top-level Dashboard adapting to active perspective:
    - **Combined Household**: Net Worth ($Assets - Loans$), Settlement Widget ("Rachel owes Yi Jia $X" + "Settle Up"), Shared Goals carousel, upcoming renewal alerts.
    - **Personal (Yi Jia / Rachel)**: Personal net worth, personal budget progress, personal accounts, personal expenses.

- [ ] **Step 1: Write test for SettlementWidget and Settle Up action**
Verify settlement calculation renders who owes whom and clicking Settle Up invokes the service to clear unsettled balances.

- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run tests/DashboardComponents.test.tsx` -> Expected: FAIL.

- [ ] **Step 3: Implement dashboard widgets and DashboardPage**
Build responsive dashboard layout with metrics cards, Recharts overview, and settlement controls.

- [ ] **Step 4: Run test to verify it passes**
Run `npx vitest run tests/DashboardComponents.test.tsx` -> Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/dashboard/ src/pages/DashboardPage.tsx tests/DashboardComponents.test.tsx
git commit -m "feat: add combined household hub and personal dashboard views"
```

---

### Task 13: PWA Configuration, Router Integration, Build Verification & Vercel Readiness

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/`
- Modify: `index.html`
- Modify: `src/App.tsx`
- Create: `README.md` (instructions for Supabase setup, Vercel deployment, and private seed execution)

**Interfaces:**
- Produces:
  - Full router linking Dashboard, Budget, Expenses, Accounts, Loans, Goals, and Recurring views.
  - PWA manifest enabling install to iOS/Android home screen.
  - Clean `npm run build` and `npm test` with 100% passing tests.

- [ ] **Step 1: Wire up all routes in App.tsx**
Connect React Router paths (`/`, `/budget`, `/expenses`, `/accounts`, `/loans`, `/goals`, `/recurring`) with perspective-aware layout.

- [ ] **Step 2: Add PWA manifest and viewport headers**
Add `manifest.json`, theme colors, and apple-mobile-web-app meta tags to `index.html`.

- [ ] **Step 3: Create README.md**
Write clear documentation explaining:
- How to run locally (`npm run dev`)
- How to connect real Supabase (execute `supabase/migrations/20260915_init.sql` and `supabase/seed.private.sql`)
- How Vercel auto-deploys from GitHub `master` branch with environment variables.

- [ ] **Step 4: Run full build and test suite**
Execute:
`npm run test` -> ALL PASS
`npm run build` -> Clean Vite build in `dist/` with zero TypeScript or bundling errors.

- [ ] **Step 5: Final Commit**
```bash
git add .
git commit -m "feat: complete budget buddy couple finance app with PWA and Vercel setup"
```
