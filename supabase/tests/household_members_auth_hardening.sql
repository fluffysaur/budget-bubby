-- Manual RLS checks for docs/plans/2026-11-24-auth-hardening-before-beta.md.
-- NOT run in CI. Run against a LOCAL Supabase copy only (never the live DB).
-- Everything runs in a transaction and rolls back. Each `do` block raises on failure.
-- To be folded into the #235 harness once it exists.

begin;

-- Fixtures: two households, two linked members, one unlinked member.
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.test', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@example.test', null,  'authenticated', 'authenticated');
insert into households (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'HH A'),
  ('10000000-0000-0000-0000-00000000000b', 'HH B');
insert into household_members (id, household_id, user_id, display_name, email, role) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'A', 'a@example.test', 'partner'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'B', 'b@example.test', 'partner'),
  ('20000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000b', null, 'C', 'c@example.test', 'partner');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"a@example.test","role":"authenticated"}', true);

-- 1. Linked member claiming again is a no-op (existing members unaffected).
do $$ begin
  if (public.claim_household_member_profile() ->> 'success')::boolean is not true then
    raise exception 'FAIL: already-linked member should succeed as no-op';
  end if;
end $$;

-- 2. A cannot claim another household's unlinked row (email mismatch).
do $$ begin
  if exists (select 1 from household_members where id = '20000000-0000-0000-0000-00000000000c' and user_id is not null) then
    raise exception 'FAIL: A linked someone else''s row';
  end if;
end $$;

-- 3. Direct insert into another household fails.
do $$ begin
  begin
    insert into household_members (household_id, user_id, display_name, email, role)
    values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a1', 'X', 'x@example.test', 'partner');
    raise exception 'FAIL: insert into other household succeeded';
  exception when insufficient_privilege or others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- 4. Changing household_id fails.
do $$ begin
  begin
    update household_members set household_id = '10000000-0000-0000-0000-00000000000b'
    where id = '20000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: household_id changed';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- 5. Re-pointing a linked row's user_id fails.
do $$ begin
  begin
    update household_members set user_id = '00000000-0000-0000-0000-0000000000b1'
    where id = '20000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: user_id re-pointed';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- 6. A cannot see household B's members.
do $$ begin
  if exists (select 1 from household_members where household_id = '10000000-0000-0000-0000-00000000000b') then
    raise exception 'FAIL: A can read household B members';
  end if;
end $$;

-- 7. Unconfirmed email cannot claim.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","email":"c@example.test","role":"authenticated"}', true);
do $$ begin
  if (public.claim_household_member_profile() ->> 'success')::boolean is true then
    raise exception 'FAIL: unconfirmed email claimed a profile';
  end if;
end $$;

rollback;
