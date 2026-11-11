-- ==============================================================================
-- Budget Bubby: Settle-up history
-- settle_ups: one row per settle-up (who paid whom, how much, when, which expenses)
-- Additive only: the deployed frontend tolerates this table being absent.
-- ==============================================================================

create table if not exists settle_ups (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    payer_id uuid not null references household_members(id) on delete cascade,    -- who paid
    payee_id uuid not null references household_members(id) on delete cascade,    -- who received
    amount numeric(12, 2) not null check (amount > 0),
    settled_on date not null default current_date,
    expense_ids uuid[] not null default '{}',
    created_by uuid references household_members(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_settle_ups_household_settled
    on settle_ups(household_id, settled_on desc);

alter table settle_ups enable row level security;
drop policy if exists "Allow household access" on settle_ups;
create policy "Allow household access" on settle_ups for all
using (auth.uid() is not null and public.is_household_member(household_id))
with check (auth.uid() is not null and public.is_household_member(household_id));

grant select, insert, update, delete on settle_ups to authenticated;
