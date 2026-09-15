-- ==============================================================================
-- Budget Buddy: Initial Schema Migration
-- Creates all 14 tables, constraints, foreign keys, indexes, and RLS policies
-- ==============================================================================

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. Households
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'SGD',
  created_at timestamptz not null default now()
);

-- 2. Household Members
create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  role text not null default 'member' check (role in ('owner', 'member')),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 3. Accounts (Assets)
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references household_members(id) on delete cascade,
  name text not null,
  type text not null check (type in ('Cash', 'Investment', 'CPF', 'Other')),
  balance numeric(12, 2) not null default 0.00,
  currency text not null default 'SGD',
  institution text,
  is_joint boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

-- 4. Account Snapshots (Net Worth History)
create table if not exists account_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  balance numeric(12, 2) not null,
  snapshot_date date not null default current_date
);

-- 5. Base Budget Profiles (Salary & Default Rates)
create table if not exists base_budget_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references household_members(id) on delete cascade,
  gross_salary numeric(12, 2) not null default 0.00,
  cpf_employee_rate numeric(5, 4) not null default 0.2000,
  tithing_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint unique_household_owner_profile unique (household_id, owner_id)
);

-- 6. Categories
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  color text not null default '#64748B',
  icon text not null default 'tag',
  is_system boolean not null default false,
  constraint unique_household_category_name unique (household_id, name)
);

-- 7. Base Profile Allocations
create table if not exists base_profile_allocations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references base_budget_profiles(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  target_percentage numeric(5, 4) not null,
  constraint unique_profile_category_allocation unique (profile_id, category_id)
);

-- 8. Monthly Budgets
create table if not exists monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references household_members(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  gross_salary numeric(12, 2) not null,
  bonus numeric(12, 2) not null default 0.00,
  cpf_deduction numeric(12, 2) not null default 0.00,
  taxes_deduction numeric(12, 2) not null default 0.00,
  insurance_deduction numeric(12, 2) not null default 0.00,
  after_deductions numeric(12, 2) not null default 0.00,
  notes text,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint unique_owner_month unique (owner_id, month)
);

-- 9. Monthly Budget Categories
create table if not exists monthly_budget_categories (
  id uuid primary key default gen_random_uuid(),
  monthly_budget_id uuid not null references monthly_budgets(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  percentage numeric(5, 4) not null,
  allocated_amount numeric(12, 2) not null,
  constraint unique_budget_category unique (monthly_budget_id, category_id)
);

-- 10. Expenses (Ledger & Shared Expenses)
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  payer_id uuid not null references household_members(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  date date not null default current_date,
  item text not null,
  amount numeric(12, 2) not null,
  remarks text,
  is_shared boolean not null default false,
  split_ratio numeric(5, 4) not null default 0.5000,
  settled boolean not null default false,
  created_at timestamptz not null default now()
);

-- 11. Loans (Liabilities & Amortization)
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  borrower_id uuid references household_members(id) on delete set null,
  name text not null,
  principal numeric(12, 2) not null,
  interest_rate numeric(6, 4) not null, -- e.g. 0.0260 for 2.6%
  monthly_payment numeric(12, 2) not null,
  amount_paid numeric(12, 2) not null default 0.00,
  start_date date not null,
  term_months integer not null,
  loan_type text not null default 'amortized',
  status text not null default 'active' check (status in ('active', 'paid_off')),
  created_at timestamptz not null default now()
);

-- 12. Loan Payments
create table if not exists loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  payment_date date not null,
  payment_amount numeric(12, 2) not null,
  principal_portion numeric(12, 2) not null,
  interest_portion numeric(12, 2) not null,
  is_extra_payment boolean not null default false
);

-- 13. Savings Goals
create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid references household_members(id) on delete set null,
  title text not null,
  target_amount numeric(12, 2) not null,
  saved_so_far numeric(12, 2) not null default 0.00,
  target_date date not null,
  monthly_contribution numeric(12, 2) not null default 0.00,
  emoji text not null default '🎯',
  status text not null default 'on_track' check (status in ('on_track', 'behind', 'achieved')),
  created_at timestamptz not null default now()
);

-- 14. Recurring Policies (Insurance, Taxes, Subscriptions)
create table if not exists recurring_policies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references household_members(id) on delete cascade,
  type text not null check (type in ('insurance', 'tax', 'subscription')),
  name text not null,
  amount numeric(12, 2) not null,
  frequency text not null check (frequency in ('annually', 'monthly')),
  payment_month integer check (payment_month between 1 and 12),
  start_date date,
  end_date date,
  notes text,
  monthly_amortized_amount numeric(12, 2) not null
);

-- ==============================================================================
-- Indexes for Performance
-- ==============================================================================

create index if not exists idx_household_members_household_id on household_members(household_id);
create index if not exists idx_household_members_user_id on household_members(user_id);
create index if not exists idx_accounts_household_id on accounts(household_id);
create index if not exists idx_accounts_owner_id on accounts(owner_id);
create index if not exists idx_account_snapshots_account_id on account_snapshots(account_id);
create index if not exists idx_account_snapshots_household_id on account_snapshots(household_id);
create index if not exists idx_base_budget_profiles_household_id on base_budget_profiles(household_id);
create index if not exists idx_categories_household_id on categories(household_id);
create index if not exists idx_base_profile_allocations_profile_id on base_profile_allocations(profile_id);
create index if not exists idx_monthly_budgets_household_id on monthly_budgets(household_id);
create index if not exists idx_monthly_budgets_owner_month on monthly_budgets(owner_id, month);
create index if not exists idx_monthly_budget_categories_budget_id on monthly_budget_categories(monthly_budget_id);
create index if not exists idx_expenses_household_id on expenses(household_id);
create index if not exists idx_expenses_payer_id on expenses(payer_id);
create index if not exists idx_expenses_category_id on expenses(category_id);
create index if not exists idx_expenses_date on expenses(date);
create index if not exists idx_loans_household_id on loans(household_id);
create index if not exists idx_loan_payments_loan_id on loan_payments(loan_id);
create index if not exists idx_savings_goals_household_id on savings_goals(household_id);
create index if not exists idx_recurring_policies_household_id on recurring_policies(household_id);
create index if not exists idx_recurring_policies_owner_id on recurring_policies(owner_id);

-- ==============================================================================
-- Row-Level Security (RLS) Policies
-- Partitioned by household_id, allowing authenticated household members
-- or unauthenticated/mock access when auth.uid() is null.
-- ==============================================================================

-- Households
alter table households enable row level security;
drop policy if exists "Allow household access" on households;
create policy "Allow household access" on households for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = households.id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = households.id
      and household_members.user_id = auth.uid()
  )
);

-- Household Members
alter table household_members enable row level security;
drop policy if exists "Allow household member access" on household_members;
create policy "Allow household member access" on household_members for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members hm
    where hm.household_id = household_members.household_id
      and hm.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members hm
    where hm.household_id = household_members.household_id
      and hm.user_id = auth.uid()
  )
);

-- Accounts
alter table accounts enable row level security;
drop policy if exists "Allow household access" on accounts;
create policy "Allow household access" on accounts for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = accounts.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = accounts.household_id
      and household_members.user_id = auth.uid()
  )
);

-- Account Snapshots
alter table account_snapshots enable row level security;
drop policy if exists "Allow household access" on account_snapshots;
create policy "Allow household access" on account_snapshots for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = account_snapshots.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = account_snapshots.household_id
      and household_members.user_id = auth.uid()
  )
);

-- Base Budget Profiles
alter table base_budget_profiles enable row level security;
drop policy if exists "Allow household access" on base_budget_profiles;
create policy "Allow household access" on base_budget_profiles for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = base_budget_profiles.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = base_budget_profiles.household_id
      and household_members.user_id = auth.uid()
  )
);

-- Categories
alter table categories enable row level security;
drop policy if exists "Allow household access" on categories;
create policy "Allow household access" on categories for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = categories.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = categories.household_id
      and household_members.user_id = auth.uid()
  )
);

-- Base Profile Allocations
alter table base_profile_allocations enable row level security;
drop policy if exists "Allow household access" on base_profile_allocations;
create policy "Allow household access" on base_profile_allocations for all
using (
  auth.uid() is null
  or exists (
    select 1 from base_budget_profiles
    join household_members on household_members.household_id = base_budget_profiles.household_id
    where base_budget_profiles.id = base_profile_allocations.profile_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from base_budget_profiles
    join household_members on household_members.household_id = base_budget_profiles.household_id
    where base_budget_profiles.id = base_profile_allocations.profile_id
      and household_members.user_id = auth.uid()
  )
);

-- Monthly Budgets
alter table monthly_budgets enable row level security;
drop policy if exists "Allow household access" on monthly_budgets;
create policy "Allow household access" on monthly_budgets for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = monthly_budgets.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = monthly_budgets.household_id
      and household_members.user_id = auth.uid()
  )
);

-- Monthly Budget Categories
alter table monthly_budget_categories enable row level security;
drop policy if exists "Allow household access" on monthly_budget_categories;
create policy "Allow household access" on monthly_budget_categories for all
using (
  auth.uid() is null
  or exists (
    select 1 from monthly_budgets
    join household_members on household_members.household_id = monthly_budgets.household_id
    where monthly_budgets.id = monthly_budget_categories.monthly_budget_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from monthly_budgets
    join household_members on household_members.household_id = monthly_budgets.household_id
    where monthly_budgets.id = monthly_budget_categories.monthly_budget_id
      and household_members.user_id = auth.uid()
  )
);

-- Expenses
alter table expenses enable row level security;
drop policy if exists "Allow household access" on expenses;
create policy "Allow household access" on expenses for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = expenses.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = expenses.household_id
      and household_members.user_id = auth.uid()
  )
);

-- Loans
alter table loans enable row level security;
drop policy if exists "Allow household access" on loans;
create policy "Allow household access" on loans for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = loans.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = loans.household_id
      and household_members.user_id = auth.uid()
  )
);

-- Loan Payments
alter table loan_payments enable row level security;
drop policy if exists "Allow household access" on loan_payments;
create policy "Allow household access" on loan_payments for all
using (
  auth.uid() is null
  or exists (
    select 1 from loans
    join household_members on household_members.household_id = loans.household_id
    where loans.id = loan_payments.loan_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from loans
    join household_members on household_members.household_id = loans.household_id
    where loans.id = loan_payments.loan_id
      and household_members.user_id = auth.uid()
  )
);

-- Savings Goals
alter table savings_goals enable row level security;
drop policy if exists "Allow household access" on savings_goals;
create policy "Allow household access" on savings_goals for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = savings_goals.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = savings_goals.household_id
      and household_members.user_id = auth.uid()
  )
);

-- Recurring Policies
alter table recurring_policies enable row level security;
drop policy if exists "Allow household access" on recurring_policies;
create policy "Allow household access" on recurring_policies for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = recurring_policies.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = recurring_policies.household_id
      and household_members.user_id = auth.uid()
  )
);
