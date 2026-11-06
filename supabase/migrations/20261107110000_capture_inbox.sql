-- ==============================================================================
-- Budget Bubby: Capture Inbox
--   1. capture_tokens   per-member personal access tokens (SHA-256 hash only)
--   2. inbox_items      captured, unconfirmed purchases (never counted as spend)
--   3. merchant_rules   remembered merchant -> category / ignore
--   4. confirm_inbox_item(): atomic confirm (expense + resolve + check-in)
--   5. prune job for resolved inbox items (90 days)
--
-- Additive and re-runnable. Clients cannot INSERT or DELETE inbox_items: the
-- capture-expense Edge Function inserts them with the service role.
--
-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated, so each table revokes everything first and then grants only
-- what the app needs.
--
-- Prerequisite: pg_cron (enabled by 20261106091000_notification_cron.sql).
-- ==============================================================================

-- Helper: is this member row the signed-in user?
create or replace function public.is_own_member(target_member_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.id = target_member_id and hm.user_id = auth.uid()
  );
$$;

-- 1. Tokens -------------------------------------------------------------------
create table if not exists capture_tokens (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    member_id uuid not null references household_members(id) on delete cascade,
    label text not null default 'iPhone' check (char_length(label) between 1 and 40),
    token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),  -- sha256 hex
    token_hint text not null check (char_length(token_hint) = 4),     -- last 4 chars, for display
    created_at timestamptz not null default now(),
    last_used_at timestamptz,
    revoked_at timestamptz,
    constraint unique_capture_token_hash unique (token_hash)
);
create index if not exists idx_capture_tokens_member_id on capture_tokens(member_id);

alter table capture_tokens enable row level security;
drop policy if exists "Own tokens" on capture_tokens;
create policy "Own tokens" on capture_tokens for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
  and public.is_own_member(member_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
  and public.is_own_member(member_id)
);
-- No delete: revoke = set revoked_at. The hash is readable by its owner only
-- (useless without the plaintext).
revoke all on capture_tokens from anon, authenticated;
grant select, insert on capture_tokens to authenticated;
grant update (label, revoked_at) on capture_tokens to authenticated;
grant select, insert, update on capture_tokens to service_role;

-- 2. Inbox items --------------------------------------------------------------
-- Household-wide: either partner can see and sort both inboxes.
create table if not exists inbox_items (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    member_id uuid not null references household_members(id) on delete cascade, -- payer (token owner)
    token_id uuid references capture_tokens(id) on delete set null,
    -- Free label from the caller: 'wallet' (iPhone Shortcut), 'android', 'manual', ...
    source text not null default 'api' check (source ~ '^[a-z0-9_-]{1,24}$'),
    merchant text not null check (char_length(merchant) between 1 and 120),
    merchant_key text not null check (char_length(merchant_key) between 1 and 120),
    amount numeric(14, 2) not null check (amount > 0 and amount < 1000000000), -- original currency
    currency text not null default 'SGD' check (currency ~ '^[A-Z]{3}$'),
    raw_amount text check (char_length(raw_amount) <= 40),
    card_name text check (char_length(card_name) <= 80),
    captured_at timestamptz not null,
    idempotency_key text not null,
    status text not null default 'pending'
        check (status in ('pending', 'confirmed', 'discarded', 'duplicate')),
    suggested_category_id uuid references categories(id) on delete set null,
    likely_duplicate_of uuid references expenses(id) on delete set null,
    expense_id uuid references expenses(id) on delete set null,
    resolved_at timestamptz,
    resolved_by uuid references household_members(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint unique_inbox_idempotency unique (member_id, idempotency_key)
);
create index if not exists idx_inbox_items_household_status
    on inbox_items(household_id, status, captured_at desc);
create index if not exists idx_inbox_items_token_created
    on inbox_items(token_id, created_at desc);

alter table inbox_items enable row level security;
drop policy if exists "Allow household access" on inbox_items;
create policy "Allow household access" on inbox_items for all
using (auth.uid() is not null and public.is_household_member(household_id))
with check (auth.uid() is not null and public.is_household_member(household_id));
-- Deliberately NO insert/delete for clients: only the Edge Function creates rows.
revoke all on inbox_items from anon, authenticated;
grant select on inbox_items to authenticated;
grant update (status, resolved_at, resolved_by, expense_id) on inbox_items to authenticated;
grant select, insert, update, delete on inbox_items to service_role;

-- 3. Merchant rules (household-wide, like categories) ------------------------
create table if not exists merchant_rules (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    merchant_key text not null check (char_length(merchant_key) between 1 and 120),
    action text not null default 'categorise' check (action in ('categorise', 'ignore')),
    category_id uuid references categories(id) on delete cascade,
    is_shared boolean,
    hit_count integer not null default 0,
    updated_at timestamptz not null default now(),
    constraint unique_household_merchant_rule unique (household_id, merchant_key),
    constraint merchant_rule_category_required
        check (action = 'ignore' or category_id is not null)
);

alter table merchant_rules enable row level security;
drop policy if exists "Allow household access" on merchant_rules;
create policy "Allow household access" on merchant_rules for all
using (auth.uid() is not null and public.is_household_member(household_id))
with check (auth.uid() is not null and public.is_household_member(household_id));
revoke all on merchant_rules from anon;
grant select, insert, update, delete on merchant_rules to authenticated;
grant select on merchant_rules to service_role;

-- 4. Atomic, idempotent confirm ----------------------------------------------
-- security invoker: RLS on expenses / inbox_items / daily_checkins still applies.
create or replace function public.confirm_inbox_item(p_item_id uuid, p_expense jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_item inbox_items;
    v_expense_id uuid;
    v_payer uuid;
    v_date date;
    v_resolver uuid;
begin
    select * into v_item from inbox_items where id = p_item_id for update;
    if not found then
        raise exception 'inbox_item_not_found' using errcode = 'P0002';
    end if;
    if v_item.status = 'confirmed' then
        return v_item.expense_id;            -- replay-safe
    end if;
    if v_item.status <> 'pending' then
        raise exception 'inbox_item_resolved' using errcode = 'P0001';
    end if;

    v_payer := coalesce((p_expense->>'payer_id')::uuid, v_item.member_id);
    v_date  := coalesce((p_expense->>'date')::date,
                        (v_item.captured_at at time zone 'Asia/Singapore')::date);

    insert into expenses (
        household_id, payer_id, category_id, date, time, item, amount, remarks,
        is_shared, split_ratio, settled, tags, goal_id,
        original_amount, original_currency, exchange_rate
    ) values (
        v_item.household_id,
        v_payer,
        (p_expense->>'category_id')::uuid,
        v_date,
        coalesce((p_expense->>'time')::time,
                 (v_item.captured_at at time zone 'Asia/Singapore')::time),
        coalesce(nullif(p_expense->>'item', ''), v_item.merchant),
        (p_expense->>'amount')::numeric,          -- SGD, computed by the client
        nullif(p_expense->>'remarks', ''),
        coalesce((p_expense->>'is_shared')::boolean, false),
        coalesce((p_expense->>'split_ratio')::numeric, 0.5),
        false,
        coalesce(array(select jsonb_array_elements_text(p_expense->'tags')), '{}'),
        (p_expense->>'goal_id')::uuid,
        (p_expense->>'original_amount')::numeric,
        coalesce(p_expense->>'original_currency', 'SGD'),
        (p_expense->>'exchange_rate')::numeric
    ) returning id into v_expense_id;

    select id into v_resolver from household_members
     where user_id = auth.uid() and household_id = v_item.household_id;

    update inbox_items
       set status = 'confirmed', expense_id = v_expense_id,
           resolved_at = now(), resolved_by = v_resolver
     where id = p_item_id;

    -- Confirming counts as logging the purchase date (not today)
    insert into daily_checkins (household_id, member_id, checkin_date, type)
    values (v_item.household_id, v_payer, v_date, 'expense')
    on conflict (member_id, checkin_date) do nothing;

    return v_expense_id;
end;
$$;
revoke all on function public.confirm_inbox_item(uuid, jsonb) from public, anon;
grant execute on function public.confirm_inbox_item(uuid, jsonb) to authenticated;

-- 5. Retention: resolved items older than 90 days ----------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'prune-inbox-items';
select cron.schedule(
    'prune-inbox-items',
    '45 19 * * *', -- 03:45 Singapore time
    $$ delete from public.inbox_items
       where status <> 'pending' and resolved_at < now() - interval '90 days' $$
);
