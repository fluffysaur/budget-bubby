-- ==============================================================================
-- Auth hardening 2/2: split household_members RLS by command.
-- See docs/plans/2026-11-24-auth-hardening-before-beta.md (steps 2-3).
-- Apply AFTER 20261124110000_claim_member_verified_identity.sql.
--
-- Step 3 audit of 20261022_strict_auth_rls.sql: every other `for all` policy
-- uses a single is_household_member()/owner helper in BOTH using and with check
-- (no OR branch), so a row can only be written into a household the user
-- already belongs to. household_members was the only policy with an
-- `user_id = auth.uid() OR ...` with check, so it is the only one changed here.
-- ==============================================================================

drop policy if exists "Allow household member access" on household_members;
drop policy if exists "household_members_select" on household_members;
drop policy if exists "household_members_update" on household_members;
drop policy if exists "household_members_delete" on household_members;

-- SELECT: own row, or any row in a household you belong to.
create policy "household_members_select" on household_members for select
using (
  auth.uid() is not null
  and (
    user_id = auth.uid()
    or public.is_household_member(household_id)
  )
);

-- INSERT: no policy on purpose. Direct inserts are denied for clients.
-- New members arrive only via a security-definer invite RPC (#227) or the
-- onboarding RPC (#224).

-- UPDATE: own row only. household_id/user_id immutability is enforced by trigger.
create policy "household_members_update" on household_members for update
using (auth.uid() is not null and user_id = auth.uid())
with check (auth.uid() is not null and user_id = auth.uid());

-- DELETE: own row only (full leave/removal flow deferred to #232).
create policy "household_members_delete" on household_members for delete
using (auth.uid() is not null and user_id = auth.uid());

-- household_id and user_id are immutable for client roles. The claim RPC runs as
-- the function owner (security definer), so its null -> uid link is allowed.
create or replace function public.household_members_protect_identity()
returns trigger
language plpgsql
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_members.household_id is immutable'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id
     and not (old.user_id is null and new.user_id = auth.uid()) then
    raise exception 'household_members.user_id is immutable once linked'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists household_members_protect_identity on household_members;
create trigger household_members_protect_identity
before update on household_members
for each row execute function public.household_members_protect_identity();
