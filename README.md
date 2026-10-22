# Budget Buddy 🇸ɢ 💍

> **Couple & Personal Finance Planner for Singapore Households**
> Designed for **Yi Jia & Rachel** to manage joint and personal cash flows, CPF, 50/50 expense settlements, HDB mortgage amortization, and milestone savings goals.

---

## Table of Contents

- [Budget Buddy 🇸ɢ 💍](#budget-buddy-ɢ-)
    - [Table of Contents](#table-of-contents)
    - [Key Features](#key-features)
    - [Singapore-Specific Financial Engine](#singapore-specific-financial-engine)
    - [Architecture \& Tech Stack](#architecture--tech-stack)
    - [Local Development Quickstart](#local-development-quickstart)
        - [1. Prerequisites](#1-prerequisites)
        - [2. Installation](#2-installation)
        - [3. Run Development Server](#3-run-development-server)
    - [Dual-Mode Data Access](#dual-mode-data-access)
    - [Supabase Setup \& Migrations](#supabase-setup--migrations)
        - [1. Create Supabase Project](#1-create-supabase-project)
        - [2. Apply Database Migrations](#2-apply-database-migrations)
        - [3. Apply Private Seed (Optional)](#3-apply-private-seed-optional)
        - [4. Configure Environment Variables](#4-configure-environment-variables)
    - [Testing \& Quality Assurance](#testing--quality-assurance)
        - [Test Coverage Highlights](#test-coverage-highlights)
    - [PWA Mobile Installation](#pwa-mobile-installation)
    - [Vercel Deployment Guide](#vercel-deployment-guide)
        - [SPA Routing on Vercel](#spa-routing-on-vercel)
    - [Security \& Git Safety](#security--git-safety)

---

## Key Features

- **Dynamic Perspective Switching**:
    - **Combined Household**: Pooled net worth, joint assets, 50/50 shared spending settlements, combined savings goals, and renewal calendar.
    - **Yi Jia's Personal Perspective**: Individual salary, CPF withholding, personal accounts, and personal budget allocations.
    - **Rachel's Personal Perspective**: Individual salary, CPF withholding, personal accounts, and personal budget allocations.
- **Monthly Budget Waterfall**:
    - Visual financial flow: `Gross Salary` → `20% CPF Employee Deduction` → `Net Take-Home Pay` → `Tithing (10%)` → `Budgeted Categories` → `Unallocated Buffer`.
    - Category progress meters with color-coded warning indicators when spending exceeds budget.
- **50/50 Shared Expense Ledger & Settlement Center**:
    - Log daily expenses with a single click.
    - Running settlement balance tracking: calculates who paid and computes net amount owed (e.g., _"Rachel owes Yi Jia S$1,234.56"_).
    - One-click **Settle Up** action to clear debts and record settlement timestamps.
- **Accounts & True Net Worth**:
    - Tracks Cash, Investments, and CPF accounts (OA, SA, MA).
    - Formula:
        $$
        \text{True Net Worth} = \text{Total Assets} - \text{Outstanding Liabilities}
        $$
    - Historical progression chart and modal balance updating.
- **Milestone Savings Goals**:
    - Track major couple milestones: Wedding Banquet, HDB Down Payment, Home Renovation, Emergency Fund, and Honeymoon.
    - Real-time monthly pacing badges: _Ahead of Pace_, _On Track_, _Behind Pace_.
    - Quick deposit modal to log incremental savings.
- **HDB Mortgage & Prepayment Simulator**:
    - Complete amortization schedule (monthly breakdown of principal vs interest).
    - Prepayment simulator: calculate interest saved and months cut by making extra monthly payments or lump-sum prepayments.
- **Recurring Policies & Annual Tax Calendar**:
    - Amortizes annual expenses (e.g. Life & Health Insurance, IRAS Income Tax, Property Tax) into monthly budget deductions.
    - 12-month visual renewal timeline with heaviest payment month indicators.
- **Progressive Web App (PWA)**:
    - Installable standalone app on iOS and Android with mobile bottom navigation and floating Quick Add FAB.

---

## Singapore-Specific Financial Engine

1. **Currency**: All figures are formatted in Singapore Dollars (SGD) using standard Singapore bank formatting: `S$1,234.56`.
2. **CPF Employee Contribution**: Standard 20% employee deduction from monthly gross salary (under 55 age bracket) directly calculated and visualized.
3. **True Net Worth Formula**:
    $$
    \text{True Net Worth} = \sum (\text{Cash} + \text{Investments} + \text{CPF OA/SA/MA}) - \sum (\text{HDB Loan} + \text{Other Debts})
    $$
4. **Shared Expense Settlement**:
    - Shared expenses default to a 50/50 split ratio ($0.5$).
    - The payer is credited with the other partner's 50% share until settled.

---

## Architecture & Tech Stack

```
budget-buddy/
├── src/
│   ├── components/
│   │   ├── accounts/       # Account cards, groups, balance update modal, net worth chart
│   │   ├── budget/         # Waterfall flow, month picker, category progress, base profile editor
│   │   ├── dashboard/      # Net worth hero, settlement widget, goals overview, upcoming bills
│   │   ├── expenses/       # Ledger table, filter bar, quick add expense modal
│   │   ├── goals/          # Milestone goal cards, deposit modal, add/edit goal modal
│   │   ├── layout/         # Desktop sidebar, mobile bottom nav, app header, perspective banner
│   │   ├── loans/          # Summary card, amortization table & chart, prepayment simulator
│   │   └── recurring/      # Policy table, renewal calendar, add policy modal
│   ├── context/            # HouseholdContext (perspective, theme, member state)
│   ├── data/               # mockSeedData (realistic Singapore couple demo seed data)
│   ├── lib/                # Financial formulas, currency formatting (S$), date utilities
│   ├── pages/              # Top-level page containers (Dashboard, Budget, Expenses, Accounts, Goals, Loans, Recurring)
│   ├── services/           # Dual-mode financeService (mock fallback vs Supabase PostgreSQL)
│   ├── types/              # Full TypeScript schemas for accounts, loans, budgets, expenses, etc.
│   ├── App.tsx             # Root router, responsive shell layout, global modals
│   └── main.tsx            # React 19 entrypoint
├── public/
│   ├── manifest.json       # PWA manifest
│   └── icon.svg            # Vector app brand icon
├── supabase/
│   ├── migrations/         # PostgreSQL schema (14 tables, constraints, RLS policies)
│   └── seed.private.sql    # Private production seed (strictly gitignored)
├── tests/                  # Vitest unit, component, and router integration tests
└── vercel.json             # SPA routing rewrite rule
```

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Routing**: [React Router v7](https://reactrouter.com/)
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
git clone https://github.com/your-username/budget-buddy.git
cd budget-buddy

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

Budget Buddy features a transparent **Dual-Mode Data Architecture** implemented in `src/services/financeService.ts`:

| Mode                   | Trigger Condition                                      | Data Source                  | Persistence                                      |
| :--------------------- | :----------------------------------------------------- | :--------------------------- | :----------------------------------------------- |
| **Demo Mock Mode**     | No `.env` file or placeholder credentials              | `src/data/mockSeedData.ts`   | Local browser session (instant zero-config demo) |
| **Live Supabase Mode** | Valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` | Supabase PostgreSQL database | Cloud PostgreSQL with Row-Level Security         |

The active mode is indicated by the status badge in the top right header (**Demo Mock** with amber indicator vs. **Live Supabase** with emerald indicator).

---

## Supabase Setup & Migrations

If you wish to connect Budget Buddy to your own Supabase project:

### 1. Create Supabase Project

Create a new project in the [Supabase Dashboard](https://app.supabase.com).

### 2. Apply Database Migrations

In the Supabase SQL Editor, paste and execute the schema migration file:

```sql
supabase/migrations/20260915_init.sql
```

This migration creates:

- 14 relational tables (`households`, `household_members`, `accounts`, `account_snapshots`, `base_budget_profiles`, `categories`, `base_profile_allocations`, `monthly_budgets`, `monthly_budget_categories`, `expenses`, `savings_goals`, `savings_goal_contributions`, `loans`, `recurring_policies`).
- Proper foreign keys with cascade deletions.
- Indexes on foreign keys and frequently queried date fields.
- Row-Level Security (RLS) policies allowing authenticated household members to access their shared data.

### 3. Apply Private Seed (Optional)

If you maintain private household seed data, run:

```sql
supabase/seed.private.sql
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

Restart the development server (`npm run dev`) to switch into **Live Supabase** mode.

---

## Testing & Quality Assurance

Budget Buddy includes a comprehensive test suite across calculations, services, contexts, component trees, and routing:

```bash
# Run all Vitest unit and integration tests
npm run test

# Run Vitest in watch mode
npm run test:watch

# Run Playwright end-to-end tests
npm run test:e2e
```

### Test Coverage Highlights

- **Financial Formulas**: CPF 20% calculation, net take-home pay, waterfall distribution, True Net Worth, 50/50 settlements, loan amortization schedules, savings pace indicators.
- **Currency & Date**: Singapore Dollar `S$1,234.56` zero-padding and negative currency handling; Singapore timezone (`Asia/Singapore`) calculations.
- **Service Layer**: Dual-mode data fallback, expense additions, balance updates, loan retrievals, and settlement resets.
- **Context & App Shell**: Multi-perspective switching, theme toggle (light/dark class DOM synchronization), React Router tab navigation, and Quick Add expense modal lifecycle.

---

## PWA Mobile Installation

Budget Buddy is configured as an installable Progressive Web App:

- **Manifest**: `public/manifest.json` configured for `standalone` display with `#059669` theme color.
- **iOS Safari**: Tap **Share** → **Add to Home Screen**.
- **Android Chrome**: Tap the install prompt or menu → **Add to Home screen**.
- **Mobile Experience**: Supports notch / dynamic island viewports (`viewport-fit=cover`), bottom navigation, and quick access floating action button (FAB).

---

## Vercel Deployment Guide

Budget Buddy is pre-configured for one-click deployment on [Vercel](https://vercel.com):

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

The included `vercel.json` ensures that direct visits or page reloads on routes like `/budget`, `/expenses`, and `/loans` do not result in a 404:

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
