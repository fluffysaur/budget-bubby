-- ==============================================================================
-- Budget Bubby: Recurring Items
-- Generalizes recurring_policies into recurring_items:
--   1. Renames the table, its indexes, constraints and RLS policy.
--   2. Creates a temporary recurring_policies compatibility view so the
--      previously deployed frontend keeps working during rollout.
-- ==============================================================================

-- 1. Rename table ---------------------------------------------------------------
alter table if exists recurring_policies rename to recurring_items;

alter index if exists idx_recurring_policies_household_id
    rename to idx_recurring_items_household_id;
alter index if exists idx_recurring_policies_owner_id
    rename to idx_recurring_items_owner_id;

-- Rename auto-generated constraints (pkey, fkeys, checks) to the new prefix
do $$
declare
    con record;
begin
    for con in
        select conname
        from pg_constraint
        where conrelid = 'public.recurring_items'::regclass
          and conname like 'recurring_policies_%'
    loop
        execute format(
            'alter table public.recurring_items rename constraint %I to %I',
            con.conname,
            replace(con.conname, 'recurring_policies_', 'recurring_items_')
        );
    end loop;
end $$;

-- Recreate RLS policy on the renamed table (same rules as strict auth RLS)
alter table recurring_items enable row level security;
drop policy if exists "Allow household access" on recurring_items;
create policy "Allow household access" on recurring_items for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

-- 2. Temporary compatibility view -----------------------------------------------
-- TEMPORARY: lets the previously deployed frontend keep using
-- .from('recurring_policies') for reads and writes while the new frontend
-- (which uses recurring_items) rolls out. It will be dropped in a later
-- migration once the new frontend is deployed everywhere.
-- Simple single-table select, so Postgres keeps it auto-updatable; omitted
-- columns fall back to the base table defaults.
-- security_invoker makes the base table's RLS apply to the caller.
create or replace view recurring_policies
with (security_invoker = true)
as select * from recurring_items;

alter view recurring_policies alter column id set default gen_random_uuid();

grant select, insert, update, delete on recurring_policies to authenticated;
