-- ==============================================================================
-- Budget Bubby: Epics Foundation Schema Migration
-- 1. Extends `expenses` with tags, goal linking, and currency conversion fields
-- 2. Adds `credit_cards` and `credit_card_statements`
-- 3. Adds `daily_checkins` for streaks
-- 4. Full RLS & performance indexes
-- ==============================================================================

-- 1. Extend expenses table
alter table expenses
  add column if not exists tags text[] not null default '{}',
  add column if not exists goal_id uuid references savings_goals(id) on delete set null,
  add column if not exists original_amount numeric(12, 2),
  add column if not exists original_currency text default 'SGD',
  add column if not exists exchange_rate numeric(12, 6);

create index if not exists idx_expenses_goal_id on expenses(goal_id);
create index if not exists idx_expenses_tags on expenses using gin (tags);

-- 2. Credit Cards
create table if not exists credit_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references household_members(id) on delete cascade,
  name text not null,
  bank text not null,
  last4 text,
  billing_day integer not null check (billing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  credit_limit numeric(12, 2),
  color text not null default '#059669',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_cards_household_id on credit_cards(household_id);
create index if not exists idx_credit_cards_owner_id on credit_cards(owner_id);

-- Credit Card Statements
create table if not exists credit_card_statements (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references credit_cards(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  statement_amount numeric(12, 2) not null default 0.00,
  due_date date not null,
  is_paid boolean not null default false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint unique_card_month unique (card_id, month)
);

create index if not exists idx_credit_card_statements_household_id on credit_card_statements(household_id);
create index if not exists idx_credit_card_statements_card_id on credit_card_statements(card_id);
create index if not exists idx_credit_card_statements_month on credit_card_statements(month);

-- 3. Daily Check-ins (Streak Tracking)
create table if not exists daily_checkins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references household_members(id) on delete cascade,
  checkin_date date not null default current_date,
  type text not null check (type in ('expense', 'no_spend')),
  created_at timestamptz not null default now(),
  constraint unique_member_checkin_date unique (member_id, checkin_date)
);

create index if not exists idx_daily_checkins_household_id on daily_checkins(household_id);
create index if not exists idx_daily_checkins_member_date on daily_checkins(member_id, checkin_date);

-- ==============================================================================
-- RLS Policies
-- ==============================================================================

alter table credit_cards enable row level security;
drop policy if exists "Allow household access" on credit_cards;
create policy "Allow household access" on credit_cards for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = credit_cards.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = credit_cards.household_id
      and household_members.user_id = auth.uid()
  )
);

alter table credit_card_statements enable row level security;
drop policy if exists "Allow household access" on credit_card_statements;
create policy "Allow household access" on credit_card_statements for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = credit_card_statements.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = credit_card_statements.household_id
      and household_members.user_id = auth.uid()
  )
);

alter table daily_checkins enable row level security;
drop policy if exists "Allow household access" on daily_checkins;
create policy "Allow household access" on daily_checkins for all
using (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = daily_checkins.household_id
      and household_members.user_id = auth.uid()
  )
)
with check (
  auth.uid() is null
  or exists (
    select 1 from household_members
    where household_members.household_id = daily_checkins.household_id
      and household_members.user_id = auth.uid()
  )
);
