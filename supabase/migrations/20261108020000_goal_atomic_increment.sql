-- Atomic goal saved balance increment for concurrent deposits/sweeps.
create or replace function public.increment_goal_saved(p_goal_id uuid, p_amount numeric)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
    update public.savings_goals
    set saved_so_far = saved_so_far + p_amount
    where id = p_goal_id;
end;
$$;

grant execute on function public.increment_goal_saved(uuid, numeric) to authenticated;
