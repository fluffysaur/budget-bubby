# Budget Bubby 🇸ɢ 💍

> **Couple & Personal Finance Planner for Singapore Households**
> Designed for **Yi Jia & Rachel** to manage joint and personal cash flows, CPF, 50/50 expense settlements, HDB mortgage amortization, milestone savings goals, and daily spend habits.

---

## Table of Contents

- [Budget Bubby 🇸ɢ 💍](#budget-bubby-ɢ-)
    - [Table of Contents](#table-of-contents)
    - [Key Features](#key-features)
        - [1. Daily Expense Logging \& Ledger Power Tools](#1-daily-expense-logging--ledger-power-tools)
        - [2. Couple Splits \& 50/50 Settlement Center](#2-couple-splits--5050-settlement-center)
        - [3. Dynamic Perspective Switching](#3-dynamic-perspective-switching)
        - [4. Budget Waterfall, % Sliders \& Limit Alerts](#4-budget-waterfall--sliders--limit-alerts)
        - [5. Cumulative Surplus / Deficit Rollover](#5-cumulative-surplus--deficit-rollover)
        - [6. Big-Ticket Goals \& Sinking Fund Drawdowns](#6-big-ticket-goals--sinking-fund-drawdowns)
        - [7. Spend Tags \& Trip Expense Tracking](#7-spend-tags--trip-expense-tracking)
        - [8. Credit Card Statements Tracker](#8-credit-card-statements-tracker)
        - [9. Daily Check-in Streak \& Habit Tracker](#9-daily-check-in-streak--habit-tracker)
        - [10. Accounts, Investments \& True Net Worth](#10-accounts-investments--true-net-worth)
        - [11. HDB Mortgage \& Prepayment Simulator](#11-hdb-mortgage--prepayment-simulator)
        - [12. Recurring Policies \& Tax Renewal Calendar](#12-recurring-policies--tax-renewal-calendar)
        - [13. WebAuthn Biometrics \& PIN Security](#13-webauthn-biometrics--pin-security)
        - [14. In-App Notifications \& PWA Reminders](#14-in-app-notifications--pwa-reminders)
        - [15. Offline-First Sync \& Instant Loading](#15-offline-first-sync--instant-loading)
    - [Singapore-Specific Financial Engine](#singapore-specific-financial-engine)
    - [Architecture \& Tech Stack](#architecture--tech-stack)
    - [Local Development Quickstart](#local-development-quickstart)
        - [1. Prerequisites](#1-prerequisites)
        - [2. Installation](#2-installation)
        - [3. Run Development Server](#3-run-development-server)
    - [Dual-Mode Data Access](#dual-mode-data-access)
    - [Supabase Setup \& Migrations](#supabase-setup--migrations)
        - [1. Database Migrations Overview](#1-database-migrations-overview)
        - [2. Apply Private Seed (Optional)](#2-apply-private-seed-optional)
        - [3. Environment Variables \& Authentication](#3-environment-variables--authentication)
        - [4. Private PIN Access Setup](#4-private-pin-access-setup)
    - [Testing \& Quality Assurance](#testing--quality-assurance)
        - [Test Coverage Highlights](#test-coverage-highlights)
    - [PWA Mobile Installation](#pwa-mobile-installation)
    - [Vercel Deployment Guide](#vercel-deployment-guide)
        - [SPA Routing on Vercel](#spa-routing-on-vercel)
    - [Security \& Git Safety](#security--git-safety)

---

## Key Features

### 1. Daily Expense Logging & Ledger Power Tools

- **ATM Cents-First Amount Input**: Fast right-to-left decimal entry (`1` $\rightarrow$ `$0.01`, `1250` $\rightarrow$ `$12.50`) without needing to tap the decimal point. Supports zero-decimal currencies (`VND`, `JPY`, `KRW`, `IDR`).
- **Segmented Personal / Shared Pill**: Clear 1-tap toggling between `👤 Personal` and `👥 Shared 50/50` with visual split explanations.
- **Multi-Currency Conversion & Live Rates**: Regional currency conversion (`SGD`, `MYR`, `VND`, `JPY`, `THB`, `USD`, `EUR`, etc.) with cached exchange rates and custom rate overrides.
- **Smart Category Auto-Matching**: Automatically detects category based on keyword descriptions (e.g. typing "Groceries", "FairPrice", or "Dinner").
- **Quick Date Selector & Remarks**: 1-tap date chips (`Today`, `Yesterday`, `-2d`, Custom date picker) with inline notes for receipts or details.
- **Fast Log Widget**: Inline compact Fast Log card on the Dashboard plus a standalone `/fast-log` PWA shortcut route featuring an integrated virtual keypad.
- **Bulk Log Rapid Entry**: `BulkAddExpenseModal` with a spreadsheet-like multi-row grid and smart text-paste auto-parsing (e.g. paste `12.50 Lunch #trip` directly).
- **Ledger Sorting & Pagination**: Sort expenses by Date (newest/oldest), Amount (high/low), Category, or Payer, with customizable page sizes (20 / 50 / 100 rows).
- **Edit & Delete Modals**: Full modification support via `EditExpenseModal` and safe deletion with `DeleteExpenseModal` showing settlement impact before confirming.
- **Audio & Particle Celebration**: Realistic Web Audio "cha-ching" chime with gesture auto-unlock and confetti animation on logging spend.

### 2. Couple Splits & 50/50 Settlement Center

- **Automated Net Balance Computation**: Automatically tracks who paid for what and calculates running debt balances (e.g. _"Rachel owes Yi Jia S$1,234.56"_).
- **1-Click Settlement**: Clear shared balances in a single tap with recorded settlement timestamps and history audit logs.
- **Custom Split Ratios**: Adjust splits per transaction when expenses are not strictly 50/50.

### 3. Dynamic Perspective Switching

- **Combined Household**: Pooled net worth, joint assets, shared spending settlements, combined savings milestones, and household renewals.
- **Yi Jia's Personal Perspective**: Individual salary, 20% CPF deduction, personal bank accounts, and personal category caps.
- **Rachel's Personal Perspective**: Individual salary, 20% CPF deduction, personal bank accounts, and personal category caps.

### 4. Budget Waterfall, % Sliders & Limit Alerts

- **Visual Budget Waterfall**: Flow from `Gross Salary` $\rightarrow$ `20% CPF Employee Deduction` $\rightarrow$ `Net Take-Home Pay` $\rightarrow$ `Tithing (10%)` $\rightarrow$ `Spendable Allocations` $\rightarrow$ `Unallocated Buffer`.
- **Interactive % Allocation Sliders**: Dynamic percentage sliders in `ManageCategoriesModal` and `BaseProfileEditorModal` with live dollar conversions, lock toggles, and auto-balancing to 100%.
- **Persistent Warning Banner**: `CategoryLimitWarningBanner` permanently surfaced on Dashboard and Budget pages highlighting categories approaching or exceeding their caps.
- **Multi-Tier Audio/Visual Alerts**: Visual amber toast + warning chime at $\ge 80\%$, red alert toast + exceeded chime at $\ge 100\%$.

### 5. Cumulative Surplus / Deficit Rollover

- **Month-to-Month Rollover**: `CumulativeSurplusCard` displays cumulative savings surplus rolled over across months.
- **Spendable Isolation**: Calculated from monthly spendable cap minus spendable expenses, specifically excluding goal-funded drawdowns to avoid double penalties.

### 6. Big-Ticket Goals & Sinking Fund Drawdowns

- **Milestone Couple Goals**: Track HDB Down Payment, Wedding Banquet, Home Renovation, Emergency Fund, and Honeymoon.
- **Direct Expense Drawdown**: Connect expenses directly to goals (via Quick Add or `SpendFromGoalModal`). Spending draws down `saved_so_far` while isolating the spend from monthly budget caps to prevent double-counting.
- **Monthly Pacing Badges**: Real-time pacing indicators: _Ahead of Pace_, _On Track_, _Behind Pace_.

### 7. Spend Tags & Trip Expense Tracking

- **Tagging Engine**: Tag any expense with `#tags` (e.g. `#VietnamTrip`, `#WeddingBanquet`, `#BlackFriday`).
- **Spend Tags Overview**: Dedicated `SpendTagsOverviewCard` displaying total spend, transaction counts, and date ranges per tag.
- **Multi-Tag Filter**: Filter the main ledger across multiple tags simultaneously.

### 8. Credit Card Statements Tracker

- **Statement & Cycle Management**: `CreditCardTrackerSection` tracking cards (DBS Altitude, OCBC 365, UOB One, etc.) with statement dates, due dates, and statement balances.
- **1-Tap Payment Toggle**: Toggle statements between **Unpaid** and **Paid** with visual settlement confirmation.
- **Due Date Proximity Badges**: Highlights upcoming payments with countdown days and overdue warnings.

### 9. Daily Check-in Streak & Habit Tracker

- **Daily Check-in Bar**: Pinned prominently on Dashboard with current streak count, couple streak calculation, and fire milestone badge.
- **1-Tap "No Spend Today"**: Quick check-in action for zero-spend days that advances the couple streak without adding dummy expenses.
- **7-Day Mini Calendar**: Visual dot indicators displaying check-in consistency for the active week.

### 10. Accounts, Investments & True Net Worth

- **Comprehensive Asset Tracking**: Cash, High-Yield Savings Accounts, Brokerage/Investments, and CPF (OA, SA, MA).
- **True Net Worth Formula**:
  $$\text{True Net Worth} = \sum (\text{Cash} + \text{Investments} + \text{CPF OA/SA/MA}) - \sum (\text{HDB Loan} + \text{Other Liabilities})$$
- **Balance Snapshots**: Historical balance tracking and monthly net worth growth charts.

### 11. HDB Mortgage & Prepayment Simulator

- **Amortization Engine**: Complete schedule breaking down principal vs interest for every monthly installment.
- **Prepayment Simulator**: Compute total interest saved and tenure months cut by making additional monthly contributions or lump-sum prepayments.

### 12. Recurring Policies & Tax Renewal Calendar

- **Annual Amortization**: Smooths out annual lump sums (IRAS Income Tax, Property Tax, Life & Health Insurance) into monthly budget deductions.
- **12-Month Renewal Visualizer**: Timeline identifying heavy payment months ahead of time.

### 13. WebAuthn Biometrics & PIN Security

- **Platform Biometrics**: Authenticate instantly via Touch ID, Face ID, or Windows Hello / Fingerprint directly from `PinLoginScreen`.
- **Encrypted Local Token**: Device-bound biometric tokens encrypt user session verification without storing raw PINs in cleartext.
- **Private 6-Digit PIN**: Secure fallback authentication for Yi Jia and Rachel.

### 14. In-App Notifications & PWA Reminders

- **Notification Bell & Popover**: Header badge showing unread notifications with 1-click action triggers.
- **Scheduled Alerts**: Automatic notifications for:
    - Daily spend check-in (evening reminder).
    - Monthly balance reconciliation (1st and last day of month).
    - Credit card payment due dates (within 5 days of due date).

### 15. Offline-First Sync & Instant Loading

- **Offline Mutation Outbox**: Expenses logged offline are stored in a persistent queue (`offlineSyncQueue.ts`) and automatically synced when connectivity returns.
- **Offline Banner Counter**: Top connectivity banner showing pending sync counts and sync progress.
- **Route-Level Code-Splitting**: All major pages code-split via `React.lazy()` with branded skeleton loaders for `<50ms` first paint.
- **Mobile Safe Area**: Tailored layout conforming to notch, dynamic island, and iOS bottom navigation bars (`viewport-fit=cover`).

---

## Singapore-Specific Financial Engine

1. **Currency**: Singapore Dollar standard formatting: `S$1,234.56`.
2. **CPF Employee Contribution**: Automated 20% employee deduction from monthly gross salary (under 55 age bracket).
3. **True Net Worth Calculation**:
   $$\text{True Net Worth} = \sum (\text{Assets}) - \sum (\text{Liabilities})$$
4. **Shared Expense 50/50 Settlement**: The payer is credited with 50% of the cost until settled up.

---

## Architecture & Tech Stack

```
budget-bubby/
├── src/
│   ├── components/
│   │   ├── accounts/       # Account cards, groups, balance update modal, net worth chart
│   │   ├── auth/           # PinLoginScreen, WebAuthn biometric unlock prompt
│   │   ├── budget/         # Waterfall flow, month picker, category % sliders, surplus card
│   │   ├── cards/          # Credit card statement tracker, card management modal
│   │   ├── categories/     # ManageCategoriesModal with auto-balancing sliders
│   │   ├── dashboard/      # Net worth hero, daily streak bar, warning banner, quick actions
│   │   ├── expenses/       # Ledger table, CentsFirstAmountInput, fast log widget, bulk log modal, edit/delete modals
│   │   ├── goals/          # Milestone goal cards, spend-from-goal modal, deposit modal
│   │   ├── layout/         # DesktopSidebar, MobileBottomNav, AppHeader, NotificationCenterPopover
│   │   ├── loans/          # Amortization schedule, prepayment simulator
│   │   ├── pwa/            # OfflineBanner, PWAInstallButton, IOSInstallModal, PWAUpdateToast
│   │   └── recurring/      # Policy table, renewal calendar, add policy modal
│   ├── context/            # HouseholdContext, AuthContext
│   ├── data/               # mockSeedData (Singapore couple seed data)
│   ├── lib/                # Financial formulas, currency converter, sound effects, biometrics, notification scheduler
│   ├── pages/              # DashboardPage, BudgetPage, ExpensesPage, AccountsPage, PlanPage, FastLogPage
│   ├── services/           # Dual-mode financeService, offlineSyncQueue, Supabase PostgreSQL client
│   ├── types/              # Comprehensive TypeScript interfaces for all finance models
│   ├── App.tsx             # Root router, lazy route suspense, global modal triggers
│   └── main.tsx            # React 19 bootstrap & service worker registration
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── icon.svg            # Vector app brand icon
│   └── pwa-*.png           # App icons & maskable icons
├── supabase/
│   ├── migrations/         # PostgreSQL schema migrations
│   │   ├── 20260915_init.sql
│   │   ├── 20261022_strict_auth_rls.sql
│   │   └── 20261028_epics_foundation.sql
│   └── seed.private.sql    # Private production seed (gitignored)
├── tests/                  # 26 Vitest test suites (316 passing unit and component tests)
├── e2e/                    # Playwright end-to-end smoke tests
└── vercel.json             # SPA routing rewrite rule
```

- **Framework**: [React 19](https://react.dev/) + [Vite v6](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **PWA**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) + Workbox
- **Database Backend**: [Supabase](https://supabase.com/) (PostgreSQL with RLS)
- **Testing**: [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) + [Playwright](https://playwright.dev/)

---

## Local Development Quickstart

### 1. Prerequisites

- **Node.js**: `v20.0.0` or higher
- **npm**: `v10.0.0` or higher

### 2. Installation

```bash
# Clone repository
git clone https://github.com/your-username/budget-bubby.git
cd budget-bubby

# Install dependencies
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Dual-Mode Data Access

Budget Bubby features a transparent **Dual-Mode Data Architecture** implemented in `src/services/financeService.ts`:

| Mode                   | Trigger Condition                                      | Data Source                  | Persistence                                      |
| :--------------------- | :----------------------------------------------------- | :--------------------------- | :----------------------------------------------- |
| **Demo Mock Mode**     | No `.env` file or placeholder credentials              | `src/data/mockSeedData.ts`   | Local browser session (instant zero-config demo) |
| **Live Supabase Mode** | Valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` | Supabase PostgreSQL database | Cloud PostgreSQL with Row-Level Security         |

The active mode is indicated by the status badge in the top right header (**Demo Mock** with amber indicator vs. **Live Supabase** with emerald indicator).

---

## Supabase Setup & Migrations

If you wish to connect Budget Bubby to your own Supabase project:

### 1. Database Migrations Overview

In the Supabase SQL Editor, run the migration files in chronological order:

1. `supabase/migrations/20260915_init.sql`: Creates initial 14 relational tables (`households`, `household_members`, `accounts`, `expenses`, `savings_goals`, etc.) with base RLS.
2. `supabase/migrations/20261022_strict_auth_rls.sql`: Applies strict PIN authentication and user-level RLS policies.
3. `supabase/migrations/20261028_epics_foundation.sql`: Adds `credit_cards`, `credit_card_statements`, `daily_checkins` tables, and adds `tags`, `goal_id`, `original_amount`, `original_currency`, and `exchange_rate` columns to `expenses`.

### 2. Apply Private Seed (Optional)

If you maintain private household seed data:

```sql
supabase/seed.private.sql
```

### 3. Environment Variables & Authentication

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
VITE_YIJIA_EMAIL=yijia@example.com
VITE_RACHEL_EMAIL=rachel@example.com
```

### 4. Private PIN Access Setup

1. In **Supabase Dashboard → Authentication → Users**, create the two partner user accounts:
    - User 1: Yi Jia's email with Yi Jia's chosen unique 6-digit PIN as the password.
    - User 2: Rachel's email with Rachel's chosen unique 6-digit PIN as the password.
2. In **Authentication → Providers → Email**, turn off **"Allow new users to sign up"** so unauthorized visitors cannot create accounts.
3. When accessing Budget Bubby, enter your 6-digit PIN (or authenticate with Fingerprint / Face ID).

---

## Testing & Quality Assurance

Budget Bubby includes a comprehensive test suite across calculations, services, contexts, component trees, and routing:

```bash
# Run all Vitest unit and integration tests (316 tests across 26 test files)
npm run test

# Run Vitest in watch mode
npm run test:watch

# Run Playwright end-to-end smoke tests
npm run test:e2e
```

### Test Coverage Highlights

- **Epic Test Suites**:
    - `epic0Foundation.test.ts`: Currency conversion, FX caching, and Web Audio engine.
    - `epic1ExpenseEntryUX.test.tsx`: Cents-first input, segmented personal/shared pill, currency selector, and safe areas.
    - `epic2LedgerFastBulk.test.tsx`: Sorting, pagination, edit/delete modals, fast log widget, and bulk paste parser.
    - `epic3BudgetSurplusAlerts.test.tsx`: Category % sliders, cumulative surplus card, and 80%/100% warning alerts.
    - `epic4TagsGoalsCCTracker.test.tsx`: Spend tags, goal-spend isolation, and credit card statement tracking.
    - `epic5StreakAuthNotifications.test.tsx`: Daily check-in streak, WebAuthn biometrics, and notification reminders.
    - `epic6OfflineSyncPerf.test.tsx`: Offline outbox queue, reconnect sync, and lazy route Suspense loading.
- **Component & Domain Tests**:
    - `ExpenseComponents.test.tsx`, `BudgetComponents.test.tsx`, `GoalsComponents.test.tsx`, `AccountsComponents.test.tsx`, `LoansComponents.test.tsx`, `RecurringComponents.test.tsx`, `HouseholdContext.test.tsx`, `Auth.test.tsx`, `pwa.test.tsx`.

---

## PWA Mobile Installation

Budget Bubby is configured as a standalone Progressive Web App:

- **Manifest**: `public/manifest.json` configured for `standalone` display with `#059669` theme color.
- **iOS Safari**: Tap **Share** $\rightarrow$ **Add to Home Screen** (assisted by `IOSInstallModal`).
- **Android Chrome**: Tap the install button in the header or browser menu $\rightarrow$ **Add to Home screen**.
- **Mobile Experience**: Supports notch / dynamic island viewports (`viewport-fit=cover`), fixed bottom navigation, and quick access floating action button (FAB).

---

## Vercel Deployment Guide

Budget Bubby is pre-configured for one-click deployment on [Vercel](https://vercel.com):

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Import the project in Vercel:
    - **Framework Preset**: `Vite`
    - **Build Command**: `npm run build`
    - **Output Directory**: `dist`
3. Add Environment Variables in Vercel Project Settings (if using live Supabase):
    - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
    - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
4. Deploy!

### SPA Routing on Vercel

The included `vercel.json` ensures that direct visits or page reloads on routes like `/budget`, `/expenses`, `/fast-log`, and `/accounts` do not result in a 404:

```json
{
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## Security & Git Safety

> [!IMPORTANT]
> Never commit real financial figures, bank account numbers, or Supabase service keys to Git.

- `.env*` files are strictly excluded via `.gitignore`.
- Private database seeds (`*.private.sql` and `supabase/seed.private.sql`) are excluded via `.gitignore`.
- Supabase Row-Level Security (RLS) ensures that unauthenticated clients cannot read or write household assets.
