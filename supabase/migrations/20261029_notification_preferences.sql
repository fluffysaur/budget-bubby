-- ==============================================================================
-- Budget Bubby: Notification Preferences Schema Migration
-- Creates per-member notification preferences table with full RLS
-- ==============================================================================

create table if not exists notification_preferences (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    member_id uuid not null references household_members(id) on delete cascade,
    push_enabled boolean not null default true,
    sound_enabled boolean not null default true,
    cc_payment_due boolean not null default true,
    cc_missing_statement boolean not null default true,
    streak_and_logging boolean not null default true,
    monthly_balance_updates boolean not null default true,
    partner_shared_spend boolean not null default true,
    budget_limit_alerts boolean not null default true,
    recurring_bills_due boolean not null default true,
    goal_pacing_alerts boolean not null default true,
    monthly_budget_review boolean not null default true,
    cc_due_days_before integer not null default 5 check (cc_due_days_before between 1 and 14),
    budget_warning_pct integer not null default 80 check (budget_warning_pct between 50 and 99),
    settlement_threshold_sgd numeric(12, 2) not null default 200.00,
    updated_at timestamptz not null default now(),
    constraint unique_member_notification_prefs unique (member_id)
);

create index if not exists idx_notification_preferences_household_id on notification_preferences(household_id);
create index if not exists idx_notification_preferences_member_id on notification_preferences(member_id);

alter table notification_preferences enable row level security;
drop policy if exists "Allow household access" on notification_preferences;
create policy "Allow household access" on notification_preferences for all
using (
    auth.uid() is null
    or exists (
        select 1 from household_members
        where household_members.household_id = notification_preferences.household_id
          and household_members.user_id = auth.uid()
    )
)
with check (
    auth.uid() is null
    or exists (
        select 1 from household_members
        where household_members.household_id = notification_preferences.household_id
          and household_members.user_id = auth.uid()
    )
);
