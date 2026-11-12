-- Goal deposits ledger: monthly pace is derived from what is actually deposited.

-- 1. Timestamped deposits into savings goals
create table if not exists public.goal_deposits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  bonus_event_id uuid references public.bonus_events(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  source text not null check (source in ('quick_deposit', 'sweep', 'bonus')),
  deposited_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_goal_deposits_goal_date
  on public.goal_deposits(goal_id, deposited_at);
create index if not exists idx_goal_deposits_household_id
  on public.goal_deposits(household_id);
create index if not exists idx_goal_deposits_bonus_event_id
  on public.goal_deposits(bonus_event_id);

alter table public.goal_deposits enable row level security;
drop policy if exists "Allow household access" on public.goal_deposits;
create policy "Allow household access" on public.goal_deposits for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

grant select, insert, update, delete on public.goal_deposits to authenticated;

-- 2. Record a deposit atomically alongside the saved_so_far increment
create or replace function public.record_goal_deposit(
  p_goal_id uuid,
  p_amount numeric,
  p_source text,
  p_deposited_at date default current_date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  update public.savings_goals
  set saved_so_far = greatest(0, saved_so_far + p_amount)
  where id = p_goal_id
  returning household_id into v_household_id;

  if v_household_id is not null and p_amount > 0 then
    insert into public.goal_deposits (household_id, goal_id, amount, source, deposited_at)
    values (v_household_id, p_goal_id, round(p_amount, 2), p_source, p_deposited_at);
  end if;
end;
$$;

grant execute on function public.record_goal_deposit(uuid, numeric, text, date) to authenticated;

-- 3. Bonus funding mirrors into the ledger (replaced on every edit, removed on delete)
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
    delete from goal_deposits where bonus_event_id = p_event_id;

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

    insert into goal_deposits (household_id, goal_id, bonus_event_id, amount, source)
    select v_household, c.goal_id, p_event_id, c.amount, 'bonus'
    from bonus_goal_contributions c
    where c.bonus_event_id = p_event_id;
end;
$$;

-- 4. Pace is derived, so the manual column goes
alter table public.savings_goals drop column if exists monthly_contribution;
