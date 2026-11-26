-- Shared, user-defined account order within each type group (#295).
alter table accounts add column if not exists sort_order integer;

-- Backfill by name. Only fills empty values, so re-running keeps a saved order.
with ranked as (
  select id,
         row_number() over (partition by household_id, type order by name) - 1 as rn
  from accounts
)
update accounts a set sort_order = ranked.rn
from ranked where a.id = ranked.id and a.sort_order is null;
