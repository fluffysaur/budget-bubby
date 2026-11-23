-- Already applied to the live DB. Recorded here so the migration history matches.
drop function if exists public.save_bonus_event(jsonb, jsonb);
drop function if exists public.delete_bonus_event(uuid);
drop function if exists public.apply_bonus_goal_contributions(uuid, jsonb);
drop function if exists public.record_goal_deposit(uuid, numeric, text, date);
drop function if exists public.increment_goal_saved(uuid, numeric);
