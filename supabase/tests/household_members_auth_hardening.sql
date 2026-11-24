-- pgTAP checks for the household_members auth hardening
-- (docs/plans/2026-11-24-auth-hardening-before-beta.md).
-- Run with `supabase test db` against a LOCAL stack only (never the live DB).
-- Everything runs in a transaction and rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fixtures: two households, two linked members, one unlinked member.
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.test', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@example.test', null,  'authenticated', 'authenticated');
insert into households (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'HH A'),
  ('10000000-0000-0000-0000-00000000000b', 'HH B');
insert into household_members (id, household_id, user_id, display_name, email, role) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'A', 'a@example.test', 'member'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'B', 'b@example.test', 'member'),
  ('20000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000b', null, 'C', 'c@example.test', 'member');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"a@example.test","role":"authenticated"}', true);

select ok(
  (public.claim_household_member_profile() ->> 'success')::boolean is true,
  'already-linked member claiming again is a successful no-op');

select is(
  (select count(*) from household_members
    where id = '20000000-0000-0000-0000-00000000000c' and user_id is not null),
  0::bigint,
  'A cannot claim another household''s unlinked row');

select throws_ok(
  $$insert into household_members (household_id, user_id, display_name, email, role)
    values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a1', 'X', 'x@example.test', 'member')$$,
  '42501', null,
  'direct insert into another household is denied');

select throws_ok(
  $$update household_members set household_id = '10000000-0000-0000-0000-00000000000b'
    where id = '20000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'household_id cannot be changed');

select throws_ok(
  $$update household_members set user_id = '00000000-0000-0000-0000-0000000000b1'
    where id = '20000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'a linked row''s user_id cannot be re-pointed');

select is(
  (select count(*) from household_members
    where household_id = '10000000-0000-0000-0000-00000000000b'),
  0::bigint,
  'A cannot read household B members');

-- Unconfirmed email cannot claim.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","email":"c@example.test","role":"authenticated"}', true);
select ok(
  (public.claim_household_member_profile() ->> 'success')::boolean is not true,
  'unconfirmed email cannot claim a profile');

reset role;
select * from finish();
rollback;
