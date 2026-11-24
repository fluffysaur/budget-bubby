-- ==============================================================================
-- Auth hardening 1/2 (additive): server-verified member linking.
-- See docs/plans/2026-11-24-auth-hardening-before-beta.md (step 1).
--
-- * New claim_household_member_profile() takes NO client input. The email comes
--   from auth.jwt() and must be confirmed in auth.users.
-- * Only a member row that is still unlinked (user_id is null) can be claimed.
--   Linked rows are never re-pointed.
-- * The old claim_household_member_profile(user_email text) stays as a compat
--   wrapper for one release. It ignores its argument.
-- ==============================================================================

create or replace function public.claim_household_member_profile()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  verified_email text;
  matched_member record;
begin
  if current_user_id is null then
    return json_build_object('success', false, 'error', 'Unauthenticated');
  end if;

  -- Email must come from the verified token and be confirmed.
  select lower(u.email) into verified_email
  from auth.users u
  where u.id = current_user_id
    and u.email_confirmed_at is not null
    and lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  if verified_email is null then
    return json_build_object('success', false, 'error', 'Email not verified');
  end if;

  -- Already linked to this user: no-op (existing members).
  select * into matched_member
  from public.household_members
  where user_id = current_user_id
  limit 1;

  if matched_member.id is null then
    -- Claim a still-unlinked row; lock it to avoid double-claim races.
    select * into matched_member
    from public.household_members
    where lower(email) = verified_email
      and user_id is null
    order by id
    limit 1
    for update;

    if matched_member.id is null then
      return json_build_object('success', false, 'error', 'Member profile not found for email');
    end if;

    update public.household_members
    set user_id = current_user_id
    where id = matched_member.id
      and user_id is null;
  end if;

  return json_build_object(
    'success', true,
    'member_id', matched_member.id,
    'display_name', matched_member.display_name,
    'role', matched_member.role
  );
end;
$$;

-- Compat wrapper for clients that still send an email. The argument is ignored.
create or replace function public.claim_household_member_profile(user_email text)
returns json
language sql
security definer
set search_path = public
as $$
  select public.claim_household_member_profile();
$$;

revoke all on function public.claim_household_member_profile() from public, anon;
revoke all on function public.claim_household_member_profile(text) from public, anon;
grant execute on function public.claim_household_member_profile() to authenticated;
grant execute on function public.claim_household_member_profile(text) to authenticated;
