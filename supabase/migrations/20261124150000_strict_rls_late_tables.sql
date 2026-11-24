-- Close anonymous access on tables created after 20261022_strict_auth_rls.
--
-- 20261028_epics_foundation (credit_cards, credit_card_statements,
-- daily_checkins) and 20261029_notification_preferences copied the original
-- init pattern `auth.uid() is null or <member check>`. With the public anon key
-- that lets an unauthenticated request read and write every row. Apply the
-- same policy the strict migration gave every other household table.
--
-- Safe for the live app: every real client request is authenticated, and the
-- service role bypasses RLS.

drop policy if exists "Allow household access" on public.credit_cards;
create policy "Allow household access" on public.credit_cards for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

drop policy if exists "Allow household access" on public.credit_card_statements;
create policy "Allow household access" on public.credit_card_statements for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

drop policy if exists "Allow household access" on public.daily_checkins;
create policy "Allow household access" on public.daily_checkins for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

drop policy if exists "Allow household access" on public.notification_preferences;
create policy "Allow household access" on public.notification_preferences for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);
