-- ==============================================================================
-- Budget Bubby: Notification Log
-- One row per member per reminder key. Records when a reminder was pushed,
-- read and dismissed so each push fires once per cycle across all devices.
-- Additive only: the deployed frontend does not read this table.
-- ==============================================================================

create table if not exists notification_log (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    member_id uuid not null references household_members(id) on delete cascade,
    reminder_key text not null,
    type text not null,
    sent_at timestamptz,
    read_at timestamptz,
    dismissed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint unique_member_reminder_key unique (member_id, reminder_key)
);

create index if not exists idx_notification_log_household_id on notification_log(household_id);
create index if not exists idx_notification_log_member_id on notification_log(member_id);
create index if not exists idx_notification_log_created_at on notification_log(created_at);

alter table notification_log enable row level security;
drop policy if exists "Allow household access" on notification_log;
create policy "Allow household access" on notification_log for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

grant select, insert, update, delete on notification_log to authenticated;
