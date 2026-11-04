-- ==============================================================================
-- Budget Bubby: Push Subscriptions
-- One row per device (Web Push endpoint). The send-reminders function pushes
-- to every subscription a member has and deletes ones the push service
-- reports gone. Additive only.
-- ==============================================================================

create table if not exists push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    member_id uuid not null references household_members(id) on delete cascade,
    endpoint text not null,
    p256dh text not null,
    auth text not null,
    user_agent text,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    constraint unique_push_subscription_endpoint unique (endpoint)
);

create index if not exists idx_push_subscriptions_household_id on push_subscriptions(household_id);
create index if not exists idx_push_subscriptions_member_id on push_subscriptions(member_id);

alter table push_subscriptions enable row level security;
drop policy if exists "Allow household access" on push_subscriptions;
create policy "Allow household access" on push_subscriptions for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

grant select, insert, update, delete on push_subscriptions to authenticated;
