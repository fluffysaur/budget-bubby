-- pgTAP: household A can never read or write household B's data (issue #235).
-- Run with `supabase test db` against a LOCAL stack only (never the live DB).
--
-- Catalog-driven on purpose: every base table in `public` is discovered at run
-- time, so a new table is covered automatically and one without RLS or
-- policies fails the build. Fixtures are generated from column metadata. If a
-- new table needs a value the generator cannot guess (a tricky CHECK), the
-- file fails loudly with "FIXTURE <table>"; add a row to `fixture_overrides`
-- below (table, column, jsonb value).
--
-- One fixture row per table is seeded for household A and for household B.
-- Acting as user A (role authenticated), per table it asserts:
--   positive control: auth.uid() is A, A can select its own row, A can update
--     its own row (when the policy/privileges allow it);
--   attacks: select household B rows -> 0, insert into household B -> 42501,
--     insert or update an own-household row pointing at a B parent -> 42501,
--     update/delete B rows -> 0 rows, move an own row into household B ->
--     denied, B's data unchanged afterwards;
--   as service_role (bypasses RLS): the same cross-household references and
--     moving a referenced row to another household are still rejected;
-- plus anon sees nothing, no open policies, and no view without
-- security_invoker; finally, ON DELETE cascades still run. Everything rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (side text not null, tbl text not null, body jsonb not null, primary key (side, tbl));
create temp table res (n serial, name text not null, pass boolean not null, detail text);

-- Optional per-table column values. `side` null applies to both households;
-- set it ('a' or 'b') for columns that must differ, e.g. unique ones.
create temp table fixture_overrides (tbl text, col text, val jsonb, side text);
insert into fixture_overrides (tbl, col, val, side) values
  ('capture_tokens', 'token_hash', to_jsonb(repeat('a', 64)), 'a'),
  ('capture_tokens', 'token_hash', to_jsonb(repeat('b', 64)), 'b'),
  ('capture_tokens', 'token_hint', to_jsonb('abcd'::text), null);

-- Identities ----------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.test', now(), 'authenticated', 'authenticated');
insert into public.households (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'HH A'),
  ('10000000-0000-0000-0000-00000000000b', 'HH B');
insert into public.household_members (id, household_id, user_id, display_name, email, role) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'A', 'a@example.test', 'member'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'B', 'b@example.test', 'member');

insert into fx values
  ('a', 'households', (select to_jsonb(h) from public.households h where id = '10000000-0000-0000-0000-00000000000a')),
  ('b', 'households', (select to_jsonb(h) from public.households h where id = '10000000-0000-0000-0000-00000000000b')),
  ('a', 'household_members', (select to_jsonb(m) from public.household_members m where id = '20000000-0000-0000-0000-00000000000a')),
  ('b', 'household_members', (select to_jsonb(m) from public.household_members m where id = '20000000-0000-0000-0000-00000000000b')),
  ('a', '__user', '{"id": "00000000-0000-0000-0000-0000000000a1"}'),
  ('b', '__user', '{"id": "00000000-0000-0000-0000-0000000000b1"}');

-- Row generator: a value for every writable column that has no default --------
create function pg_temp.gen_row(p_tbl text, p_side text) returns jsonb
language plpgsql as $f$
declare
  r record; j jsonb := '{}'; v jsonb; fk record; lit text; lbl text;
begin
  for r in
    select a.attnum, a.attname, a.attnotnull, t.typname, t.typtype, t.oid as typoid, a.attrelid
      from pg_attribute a join pg_type t on t.oid = a.atttypid
     where a.attrelid = format('public.%I', p_tbl)::regclass
       and a.attnum > 0 and not a.attisdropped
       and a.attgenerated = '' and a.attidentity = '' and not a.atthasdef
     order by a.attnum
  loop
    v := null;
    select o.val into v from fixture_overrides o
     where o.tbl = p_tbl and o.col = r.attname and (o.side is null or o.side = p_side)
     order by o.side nulls last limit 1;
    if v is null then
      select c.confrelid::regclass::text as ref, af.attname as refcol into fk
        from pg_constraint c
        join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
       where c.contype = 'f' and c.conrelid = r.attrelid
         and c.conkey = array[r.attnum]::smallint[];
      if fk.ref is not null then
        if fk.ref = 'auth.users' then
          v := (select body -> 'id' from fx where side = p_side and tbl = '__user');
        elsif fk.ref = p_tbl or fk.ref = 'public.' || p_tbl then
          v := null; -- self reference: leave null
        else
          v := (select body -> fk.refcol from fx where side = p_side and tbl = replace(fk.ref, 'public.', ''));
          if v is null and r.attnotnull then
            raise exception 'FIXTURE %: parent % not seeded for %', p_tbl, fk.ref, r.attname;
          end if;
        end if;
      else
        -- first quoted literal of a single-column IN/ANY check, if any
        select (regexp_match(pg_get_constraintdef(c.oid), '''([^'']+)''::'))[1] into lit
          from pg_constraint c
         where c.contype = 'c' and c.conrelid = r.attrelid
           and c.conkey = array[r.attnum]::smallint[]
           and pg_get_constraintdef(c.oid) ~* '(= any|in \()'
         limit 1;
        if lit is not null then
          v := to_jsonb(lit);
        elsif r.typtype = 'e' then
          select enumlabel into lbl from pg_enum where enumtypid = r.typoid order by enumsortorder limit 1;
          v := to_jsonb(lbl);
        else
          v := case
            when r.typname in ('text', 'varchar', 'bpchar', 'citext') then to_jsonb('fx' || substr(md5(random()::text), 1, 8))
            when r.typname in ('int2', 'int4', 'int8', 'numeric', 'float4', 'float8') then to_jsonb(1)
            when r.typname = 'bool' then to_jsonb(false)
            when r.typname = 'uuid' then to_jsonb(gen_random_uuid()::text)
            when r.typname = 'date' then to_jsonb(current_date::text)
            when r.typname in ('timestamptz', 'timestamp') then to_jsonb(now()::text)
            when r.typname = 'time' then to_jsonb('12:00'::text)
            when r.typname in ('jsonb', 'json') then '{}'::jsonb
            else null
          end;
          if v is null and r.attnotnull then
            raise exception 'FIXTURE %: no value for % (type %)', p_tbl, r.attname, r.typname;
          end if;
        end if;
      end if;
    end if;
    if v is not null and v <> 'null'::jsonb then
      j := j || jsonb_build_object(r.attname, v);
    end if;
  end loop;
  return j;
end $f$;

-- INSERT statement naming only the columns present in j (omitted columns keep
-- their defaults instead of being sent as explicit NULLs).
create function pg_temp.ins_sql(p_tbl text, j jsonb) returns text
language plpgsql as $f$
declare cols text;
begin
  select string_agg(quote_ident(k), ', ' order by k) into cols from jsonb_object_keys(j) as k;
  if cols is null then
    return format('insert into public.%I as t default values', p_tbl);
  end if;
  return format(
    'insert into public.%1$I as t (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, %3$L)',
    p_tbl, cols, j::text);
end $f$;

-- WHERE clause matching one household's rows in a table.
create function pg_temp.row_pred(p_tbl text, p_side text) returns text
language plpgsql as $f$
declare hh text := case p_side when 'a' then '10000000-0000-0000-0000-00000000000a'
                               else '10000000-0000-0000-0000-00000000000b' end;
begin
  if exists (select 1 from pg_attribute a where a.attrelid = format('public.%I', p_tbl)::regclass
              and a.attname = 'household_id' and not a.attisdropped) then
    return format('household_id = %L', hh);
  elsif p_tbl = 'households' then
    return format('id = %L', hh);
  end if;
  return format('to_jsonb(%I) = %L::jsonb', p_tbl, (select body::text from fx where side = p_side and tbl = p_tbl));
end $f$;

-- Run a statement as a role; returns the count, or -1 if privilege was denied.
create function pg_temp.attempt_count(p_role text, p_sql text) returns bigint
language plpgsql as $f$
declare n bigint;
begin
  execute format('set local role %I', p_role);
  begin
    execute p_sql into n;
  exception when insufficient_privilege then n := -1;
  end;
  reset role;
  return n;
end $f$;

-- Run a DML statement as a role; returns 'ok:<rows>' or 'err:<sqlstate> <message>'.
create function pg_temp.attempt_dml(p_role text, p_sql text) returns text
language plpgsql as $f$
declare n bigint; state text;
begin
  execute format('set local role %I', p_role);
  begin
    execute p_sql;
    get diagnostics n = row_count;
    state := 'ok:' || n;
  exception when others then
    state := 'err:' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  return state;
end $f$;

-- Seed one row per table for each household, parents first --------------------
do $$
declare
  s text; t record; progress boolean; ins jsonb; blocked int;
begin
  foreach s in array array['a', 'b'] loop
    loop
      progress := false;
      for t in
        select c.relname from pg_class c
         where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
           and not exists (select 1 from fx where fx.side = s and fx.tbl = c.relname)
         order by c.relname
      loop
        select count(*) into blocked
          from pg_constraint k
         where k.contype = 'f' and k.conrelid = format('public.%I', t.relname)::regclass
           and k.confrelid <> format('public.%I', t.relname)::regclass
           and k.confrelid::regclass::text <> 'auth.users'
           and not exists (select 1 from fx where fx.side = s
                            and fx.tbl = replace(k.confrelid::regclass::text, 'public.', ''));
        if blocked = 0 then
          begin
            execute pg_temp.ins_sql(t.relname, pg_temp.gen_row(t.relname, s)) || ' returning to_jsonb(t)' into ins;
          exception when others then
            raise exception 'FIXTURE % (%): % (%)', t.relname, s, sqlerrm, sqlstate;
          end;
          insert into fx values (s, t.relname, ins);
          progress := true;
        end if;
      end loop;
      exit when not progress;
    end loop;
    if exists (
      select 1 from pg_class c where c.relnamespace = 'public'::regnamespace
         and c.relkind in ('r', 'p') and not exists (select 1 from fx where fx.side = s and fx.tbl = c.relname)
    ) then
      raise exception 'FIXTURE: unresolved FK cycle (%) for %', s,
        (select string_agg(c.relname, ', ') from pg_class c where c.relnamespace = 'public'::regnamespace
          and c.relkind in ('r', 'p') and not exists (select 1 from fx where fx.side = s and fx.tbl = c.relname));
    end if;
  end loop;
end $$;

-- Structural guards -----------------------------------------------------------
insert into res (name, pass, detail)
select 'RLS enabled on public.' || c.relname, c.relrowsecurity, null
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p');

insert into res (name, pass, detail)
select 'public.' || c.relname || ' has at least one policy',
       exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname), null
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p');

insert into res (name, pass, detail)
select 'policy "' || p.policyname || '" on ' || p.tablename || ' is not open to everyone',
       not (coalesce(p.qual, 'false') ~* '^\(?true\)?$' or coalesce(p.with_check, 'false') ~* '^\(?true\)?$'),
       p.qual
  from pg_policies p
 where p.schemaname = 'public' and p.roles <> array['service_role']::name[];

-- Views and materialized views bypass RLS unless security_invoker is set.
insert into res (name, pass, detail)
select 'public.' || c.relname || ' is a view with security_invoker',
       c.relkind = 'v' and coalesce(c.reloptions, '{}') && array['security_invoker=true', 'security_invoker=on'],
       c.relkind::text
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm');

-- Behavioural checks ----------------------------------------------------------
do $$
declare
  t record; fk record; bpred text; apred text; col text; n bigint; b_before bigint; b_after bigint;
  state text; atk jsonb; pv jsonb; repoint text;
  hh_b constant text := '10000000-0000-0000-0000-00000000000b';
  uid_a constant text := '00000000-0000-0000-0000-0000000000a1';
begin
  for t in select c.relname from pg_class c
            where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') order by 1
  loop
    bpred := pg_temp.row_pred(t.relname, 'b');
    apred := pg_temp.row_pred(t.relname, 'a');
    select a.attname into col from pg_attribute a
     where a.attrelid = format('public.%I', t.relname)::regclass and a.attnum > 0
       and not a.attisdropped and a.attgenerated = '' order by a.attnum limit 1;

    execute format('select count(*) from public.%I where %s', t.relname, bpred) into b_before;
    insert into res (name, pass, detail)
      values ('household B fixture row exists in ' || t.relname, b_before > 0, 'rows=' || b_before);

    perform set_config('request.jwt.claims',
      '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"a@example.test","role":"authenticated"}', true);
    perform set_config('request.jwt.claim.sub', uid_a, true);

    -- Positive controls: the checks below are meaningless unless A is really A
    -- and can use its own data.
    n := pg_temp.attempt_count('authenticated', format('select (auth.uid() = %L)::int', uid_a));
    insert into res (name, pass, detail)
      values ('auth.uid() is user A while testing ' || t.relname, n = 1, 'match=' || n);

    n := pg_temp.attempt_count('authenticated',
      format('select count(*) from public.%I where %s', t.relname, apred));
    insert into res (name, pass, detail)
      values ('A can SELECT its own row in ' || t.relname, n > 0, 'rows=' || n);

    state := pg_temp.attempt_dml('authenticated',
      format('update public.%1$I set %2$I = %2$I where %3$s', t.relname, col, apred));
    insert into res (name, pass, detail)
      values ('A can UPDATE its own row in ' || t.relname || ' (or lacks privilege)',
              state = 'ok:1' or state like 'err:42501%', state);

    -- Attack: SELECT
    n := pg_temp.attempt_count('authenticated',
      format('select count(*) from public.%I where %s', t.relname, bpred));
    insert into res (name, pass, detail)
      values ('A cannot SELECT household B rows in ' || t.relname, n <= 0, 'rows=' || n);

    -- Attack: INSERT a row hanging off household B's parents
    state := pg_temp.attempt_dml('authenticated',
      pg_temp.ins_sql(t.relname, pg_temp.gen_row(t.relname, 'b')));
    insert into res (name, pass, detail)
      values ('A cannot INSERT into household B via ' || t.relname, state like 'err:42501%', state);

    -- Attack: own-household row pointing at a B parent through each FK column
    for fk in
      select a.attname as col, c.confrelid::regclass::text as ref, af.attname as refcol
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
       where c.contype = 'f' and c.conrelid = format('public.%I', t.relname)::regclass
         and array_length(c.conkey, 1) = 1
         and a.attname <> 'household_id'
         and c.confrelid <> c.conrelid
         and replace(c.confrelid::regclass::text, 'public.', '') not in ('auth.users', 'households')
    loop
      select body -> fk.refcol into pv from fx where side = 'b' and tbl = replace(fk.ref, 'public.', '');
      continue when pv is null;
      atk := pg_temp.gen_row(t.relname, 'a') || jsonb_build_object(fk.col, pv);
      state := pg_temp.attempt_dml('authenticated', pg_temp.ins_sql(t.relname, atk));
      insert into res (name, pass, detail)
        values ('A cannot INSERT own row in ' || t.relname || ' pointing at B ' || fk.ref || ' via ' || fk.col,
                state like 'err:42501%', state);

      repoint := format('update public.%I set %I = %L where %s', t.relname, fk.col, pv #>> '{}', apred);
      state := pg_temp.attempt_dml('authenticated', repoint);
      insert into res (name, pass, detail)
        values ('A cannot UPDATE own row in ' || t.relname || ' to point at B ' || fk.ref || ' via ' || fk.col,
                state like 'err:42501%', state);

      -- RLS does not apply here, so only the database guard (#272) can refuse.
      -- Single-parent tables (loan_payments) have nothing to cross-reference.
      if bpred like 'household_id = %'
         or (select count(*) from pg_constraint k
              where k.contype = 'f' and k.conrelid = format('public.%I', t.relname)::regclass) > 1 then
        state := pg_temp.attempt_dml('service_role', repoint);
        insert into res (name, pass, detail)
          values ('service_role cannot point ' || t.relname || ' at another household via ' || fk.col,
                  state like 'err:42501%same household%', state);
      end if;
    end loop;

    -- Attack: UPDATE B rows
    state := pg_temp.attempt_dml('authenticated',
      format('update public.%1$I set %2$I = %2$I where %3$s', t.relname, col, bpred));
    insert into res (name, pass, detail)
      values ('A cannot UPDATE household B rows in ' || t.relname,
              state = 'ok:0' or state like 'err:42501%', state);

    -- Attack: move A's own row into household B
    if bpred like 'household_id = %' then
      state := pg_temp.attempt_dml('authenticated',
        format('update public.%I set household_id = %L where %s', t.relname, hh_b, apred));
      insert into res (name, pass, detail)
        values ('A cannot move its own row in ' || t.relname || ' into household B',
                state = 'ok:0' or state like 'err:42501%', state);
    end if;

    -- Attack: DELETE B rows
    state := pg_temp.attempt_dml('authenticated',
      format('delete from public.%I where %s', t.relname, bpred));
    insert into res (name, pass, detail)
      values ('A cannot DELETE household B rows in ' || t.relname,
              state = 'ok:0' or state like 'err:42501%', state);

    execute format('select count(*) from public.%I where %s', t.relname, bpred) into b_after;
    insert into res (name, pass, detail)
      values ('household B data intact in ' || t.relname, b_after = b_before, b_before || ' -> ' || b_after);

    -- anon sees nothing
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('request.jwt.claim.sub', '', true);
    n := pg_temp.attempt_count('anon', format('select count(*) from public.%I', t.relname));
    insert into res (name, pass, detail)
      values ('anon sees no rows in ' || t.relname, n <= 0, 'rows=' || n);
  end loop;
end $$;

-- Referenced rows cannot change household, even without RLS in the way.
do $$
declare
  t record; state text;
begin
  for t in
    select distinct p.relname from pg_constraint c
      join pg_class p on p.oid = c.confrelid
     where c.contype = 'f' and p.relnamespace = 'public'::regnamespace and p.relname <> 'households'
     order by 1
  loop
    state := pg_temp.attempt_dml('service_role',
      format('update public.%I set household_id = %L where %s', t.relname,
             '10000000-0000-0000-0000-00000000000b', pg_temp.row_pred(t.relname, 'a')));
    insert into res (name, pass, detail)
      values ('referenced rows in ' || t.relname || ' cannot change household',
              state like 'err:42501%immutable%', state);
  end loop;
end $$;

-- A missing parent is still the foreign key's error, not a household mismatch.
insert into res (name, pass, detail)
select 'a reference to a missing row still fails the foreign key', state like 'err:23503%', state
  from (select pg_temp.attempt_dml('service_role', format(
          'update public.expenses set category_id = %L where %s',
          gen_random_uuid(), pg_temp.row_pred('expenses', 'a'))) as state) s;

-- The guards must not block ON DELETE CASCADE / SET NULL. Runs last: it
-- destroys the fixtures (rolled back like everything else).
do $$
declare
  s text; state text;
begin
  foreach s in array array['a', 'b'] loop
    state := pg_temp.attempt_dml('postgres', format(
      case s when 'a' then 'delete from public.household_members where id = %L'
             else 'delete from public.households where id = %L' end,
      case s when 'a' then '20000000-0000-0000-0000-00000000000a'
             else '10000000-0000-0000-0000-00000000000b' end));
    insert into res (name, pass, detail)
      values (case s when 'a' then 'deleting a referenced member cascades cleanly'
                     else 'deleting a household cascades cleanly' end,
              state = 'ok:1', state);
  end loop;
end $$;

select ok(pass, name || coalesce(' [' || detail || ']', '')) from res order by n;
select * from finish();
rollback;
