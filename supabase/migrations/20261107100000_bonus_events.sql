-- ==============================================================================
-- Budget Bubby: Bonus Log
-- 1. bonus_events: dated bonus entries per household member
-- 2. bonus_goal_contributions: goal funding produced by a bonus (reversible)
-- 3. bonus_split_defaults: per-member default split
-- 4. save_bonus_event / delete_bonus_event RPCs (atomic goal funding)
-- Additive only: the deployed frontend does not read these objects.
-- ==============================================================================

-- 1. Bonus events --------------------------------------------------------------
create table if not exists bonus_events (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    recipient_id uuid not null references household_members(id) on delete cascade,
    type text not null default 'other'
        check (type in ('aws', 'performance', 'sign_on', 'other')),
    received_on date not null default current_date,
    gross numeric(12, 2) not null check (gross > 0),
    cpf numeric(12, 2) not null default 0.00 check (cpf >= 0 and cpf <= gross),
    net numeric(12, 2) generated always as (gross - cpf) stored,
    note text,
    -- Snapshot of the split used: [{"key":"tithing","pct":0.10,"amount":480.00}, ...]
    split jsonb not null default '[]'::jsonb,
    created_by uuid references household_members(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_bonus_events_household_received
    on bonus_events(household_id, received_on desc);
create index if not exists idx_bonus_events_recipient_received
    on bonus_events(recipient_id, received_on);

-- 2. Goal contributions from a bonus -------------------------------------------
create table if not exists bonus_goal_contributions (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    bonus_event_id uuid not null references bonus_events(id) on delete cascade,
    goal_id uuid not null references savings_goals(id) on delete cascade,
    amount numeric(12, 2) not null check (amount > 0),
    created_at timestamptz not null default now(),
    constraint unique_bonus_goal unique (bonus_event_id, goal_id)
);

create index if not exists idx_bonus_goal_contributions_household_id
    on bonus_goal_contributions(household_id);
create index if not exists idx_bonus_goal_contributions_goal_id
    on bonus_goal_contributions(goal_id);

-- 3. Per-member default split --------------------------------------------------
create table if not exists bonus_split_defaults (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    member_id uuid not null references household_members(id) on delete cascade,
    split jsonb not null,  -- [{"key":"tithing","pct":0.10}, ...], sums to 1
    updated_at timestamptz not null default now(),
    constraint unique_member_bonus_split unique (member_id)
);

create index if not exists idx_bonus_split_defaults_household_id
    on bonus_split_defaults(household_id);

-- RLS (same strict household policy as 20261022_strict_auth_rls.sql) -------------
alter table bonus_events enable row level security;
drop policy if exists "Allow household access" on bonus_events;
create policy "Allow household access" on bonus_events for all
using (auth.uid() is not null and public.is_household_member(household_id))
with check (auth.uid() is not null and public.is_household_member(household_id));

alter table bonus_goal_contributions enable row level security;
drop policy if exists "Allow household access" on bonus_goal_contributions;
create policy "Allow household access" on bonus_goal_contributions for all
using (auth.uid() is not null and public.is_household_member(household_id))
with check (auth.uid() is not null and public.is_household_member(household_id));

alter table bonus_split_defaults enable row level security;
drop policy if exists "Allow household access" on bonus_split_defaults;
create policy "Allow household access" on bonus_split_defaults for all
using (auth.uid() is not null and public.is_household_member(household_id))
with check (auth.uid() is not null and public.is_household_member(household_id));

grant select, insert, update, delete on bonus_events to authenticated;
grant select, insert, update, delete on bonus_goal_contributions to authenticated;
grant select, insert, update, delete on bonus_split_defaults to authenticated;

-- 4. RPCs ----------------------------------------------------------------------
-- Reverses the event's previous contributions, then applies the new ones.
-- Contributions to goals outside the event's household are ignored.
-- The reversal clamps at 0 so a goal that was spent down never goes negative.
create or replace function public.apply_bonus_goal_contributions(
    p_event_id uuid,
    p_contributions jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_household uuid;
begin
    select household_id into v_household
    from bonus_events where id = p_event_id for update;
    if v_household is null then
        raise exception 'Bonus not found';
    end if;

    update savings_goals g
    set saved_so_far = greatest(0, g.saved_so_far - c.amount)
    from bonus_goal_contributions c
    where c.bonus_event_id = p_event_id and c.goal_id = g.id;

    delete from bonus_goal_contributions where bonus_event_id = p_event_id;

    insert into bonus_goal_contributions (household_id, bonus_event_id, goal_id, amount)
    select v_household, p_event_id, (x->>'goal_id')::uuid, round((x->>'amount')::numeric, 2)
    from jsonb_array_elements(coalesce(p_contributions, '[]'::jsonb)) as x
    where (x->>'amount')::numeric > 0
      and exists (
          select 1 from savings_goals sg
          where sg.id = (x->>'goal_id')::uuid and sg.household_id = v_household
      );

    update savings_goals g
    set saved_so_far = g.saved_so_far + c.amount
    from bonus_goal_contributions c
    where c.bonus_event_id = p_event_id and c.goal_id = g.id;
end;
$$;

-- Insert (p_event->>'id' null) or update an event and its goal funding atomically.
create or replace function public.save_bonus_event(
    p_event jsonb,
    p_contributions jsonb
) returns bonus_events
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_row bonus_events;
begin
    if p_event->>'id' is null then
        insert into bonus_events (
            household_id, recipient_id, type, received_on, gross, cpf, note, split, created_by
        ) values (
            (p_event->>'household_id')::uuid,
            (p_event->>'recipient_id')::uuid,
            coalesce(p_event->>'type', 'other'),
            (p_event->>'received_on')::date,
            (p_event->>'gross')::numeric,
            coalesce((p_event->>'cpf')::numeric, 0),
            nullif(p_event->>'note', ''),
            coalesce(p_event->'split', '[]'::jsonb),
            nullif(p_event->>'created_by', '')::uuid
        ) returning * into v_row;
    else
        update bonus_events set
            recipient_id = (p_event->>'recipient_id')::uuid,
            type = coalesce(p_event->>'type', type),
            received_on = (p_event->>'received_on')::date,
            gross = (p_event->>'gross')::numeric,
            cpf = coalesce((p_event->>'cpf')::numeric, 0),
            note = nullif(p_event->>'note', ''),
            split = coalesce(p_event->'split', split),
            updated_at = now()
        where id = (p_event->>'id')::uuid
        returning * into v_row;
        if v_row.id is null then
            raise exception 'Bonus not found';
        end if;
    end if;

    perform public.apply_bonus_goal_contributions(v_row.id, p_contributions);
    return v_row;
end;
$$;

-- Reverses goal funding, then deletes the event.
create or replace function public.delete_bonus_event(p_event_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
    perform public.apply_bonus_goal_contributions(p_event_id, '[]'::jsonb);
    delete from bonus_events where id = p_event_id;
end;
$$;

grant execute on function public.apply_bonus_goal_contributions(uuid, jsonb) to authenticated;
grant execute on function public.save_bonus_event(jsonb, jsonb) to authenticated;
grant execute on function public.delete_bonus_event(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- OPTIONAL legacy conversion. Not run by this migration; review and run by hand.
-- Moves hand-entered monthly_budgets.bonus values into bonus_events.
-- ------------------------------------------------------------------------------
-- select owner_id, month, bonus, is_locked from monthly_budgets where bonus <> 0;   -- inspect first
-- insert into bonus_events (household_id, recipient_id, type, received_on, gross, cpf, note)
-- select household_id, owner_id, 'other', (month || '-01')::date, bonus, 0, 'Migrated from monthly budget'
-- from monthly_budgets where bonus > 0;
-- update monthly_budgets set bonus = 0 where bonus > 0;
