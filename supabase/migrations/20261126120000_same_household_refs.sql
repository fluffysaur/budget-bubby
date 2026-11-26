-- Stop rows pointing at another household's data (#272).
--
-- RLS only checks the row's own household_id, so a member of household A could
-- attach an A row to household B's members, categories, cards, goals, etc.
--
-- Approach: triggers, not composite foreign keys.
--   * Composite FKs beside the current ones make PostgREST embeds such as
--     categories(*) and credit_cards(*) ambiguous; replacing the current ones
--     needs a new household_id column on two junction tables.
--   * Triggers fire on every write path, including the service role and
--     security definer functions.
--
-- Safe for the live app: no column or data changes. Only references that a
-- write adds or changes are checked, so ON DELETE SET NULL cascades are never
-- blocked. Columns are read by name from the row, so one that the live DB does
-- not have yet is skipped and is covered as soon as it is added.
--
-- Existing rows are NOT re-checked: verify there are no cross-household
-- references before applying.

-- Child side ------------------------------------------------------------------
-- Arguments are (column, parent table) pairs. A table with no household_id
-- takes its household from the first pair's parent. loan_payments is not listed:
-- its only reference is the loan that RLS already scopes it by.
--
-- security definer: the lookup must see parent rows the caller's RLS hides.
-- A reference to a row that does not exist is left to the foreign key (23503).
create or replace function public.assert_same_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_row jsonb := to_jsonb(new);
    old_row jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
    has_household boolean := new_row ? 'household_id';
    -- The column that decides which household the row belongs to.
    anchor text := case when has_household then 'household_id' else tg_argv[0] end;
    anchor_changed boolean := tg_op = 'INSERT' or (old_row -> anchor) is distinct from (new_row -> anchor);
    row_household uuid;
    ref_id uuid;
    ref_household uuid;
begin
    for i in 0 .. tg_nargs - 1 by 2 loop
        ref_id := new_row ->> tg_argv[i];
        continue when ref_id is null;
        continue when not anchor_changed
            and (old_row -> tg_argv[i]) is not distinct from (new_row -> tg_argv[i]);

        -- Resolved once, and only when a reference actually needs checking.
        if row_household is null then
            if has_household then
                row_household := new_row ->> 'household_id';
            else
                execute format('select household_id from public.%I where id = $1', tg_argv[1])
                    into row_household
                    using (new_row ->> tg_argv[0])::uuid;
                if row_household is null then
                    return new; -- anchor parent missing: the foreign key rejects it
                end if;
            end if;
        end if;

        execute format('select household_id from public.%I where id = $1', tg_argv[i + 1])
            into ref_household
            using ref_id;

        if ref_household is distinct from row_household and ref_household is not null then
            raise exception '%.% must reference a row in the same household', tg_table_name, tg_argv[i]
                using errcode = '42501';
        end if;
    end loop;

    return new;
end;
$$;

revoke all on function public.assert_same_household() from public, anon, authenticated;

drop trigger if exists same_household on public.account_snapshots;
create trigger same_household before insert or update on public.account_snapshots
for each row execute function public.assert_same_household('account_id', 'accounts');

drop trigger if exists same_household on public.accounts;
create trigger same_household before insert or update on public.accounts
for each row execute function public.assert_same_household('owner_id', 'household_members');

drop trigger if exists same_household on public.base_budget_profiles;
create trigger same_household before insert or update on public.base_budget_profiles
for each row execute function public.assert_same_household('owner_id', 'household_members');

drop trigger if exists same_household on public.base_profile_allocations;
create trigger same_household before insert or update on public.base_profile_allocations
for each row execute function public.assert_same_household(
    'profile_id', 'base_budget_profiles',
    'category_id', 'categories');

drop trigger if exists same_household on public.bonus_events;
create trigger same_household before insert or update on public.bonus_events
for each row execute function public.assert_same_household(
    'recipient_id', 'household_members',
    'created_by', 'household_members');

drop trigger if exists same_household on public.bonus_split_defaults;
create trigger same_household before insert or update on public.bonus_split_defaults
for each row execute function public.assert_same_household('member_id', 'household_members');

drop trigger if exists same_household on public.capture_tokens;
create trigger same_household before insert or update on public.capture_tokens
for each row execute function public.assert_same_household('member_id', 'household_members');

drop trigger if exists same_household on public.categories;
create trigger same_household before insert or update on public.categories
for each row execute function public.assert_same_household('member_id', 'household_members');

drop trigger if exists same_household on public.credit_card_statements;
create trigger same_household before insert or update on public.credit_card_statements
for each row execute function public.assert_same_household('card_id', 'credit_cards');

drop trigger if exists same_household on public.credit_cards;
create trigger same_household before insert or update on public.credit_cards
for each row execute function public.assert_same_household('owner_id', 'household_members');

drop trigger if exists same_household on public.daily_checkins;
create trigger same_household before insert or update on public.daily_checkins
for each row execute function public.assert_same_household('member_id', 'household_members');

drop trigger if exists same_household on public.expenses;
create trigger same_household before insert or update on public.expenses
for each row execute function public.assert_same_household(
    'payer_id', 'household_members',
    'category_id', 'categories',
    'partner_category_id', 'categories',
    'goal_id', 'savings_goals');

drop trigger if exists same_household on public.inbox_items;
create trigger same_household before insert or update on public.inbox_items
for each row execute function public.assert_same_household(
    'member_id', 'household_members',
    'resolved_by', 'household_members',
    'suggested_category_id', 'categories',
    'expense_id', 'expenses',
    'likely_duplicate_of', 'expenses',
    'token_id', 'capture_tokens');

drop trigger if exists same_household on public.loans;
create trigger same_household before insert or update on public.loans
for each row execute function public.assert_same_household('borrower_id', 'household_members');

drop trigger if exists same_household on public.merchant_rules;
create trigger same_household before insert or update on public.merchant_rules
for each row execute function public.assert_same_household('category_id', 'categories');

drop trigger if exists same_household on public.monthly_budget_categories;
create trigger same_household before insert or update on public.monthly_budget_categories
for each row execute function public.assert_same_household(
    'monthly_budget_id', 'monthly_budgets',
    'category_id', 'categories');

drop trigger if exists same_household on public.monthly_budgets;
create trigger same_household before insert or update on public.monthly_budgets
for each row execute function public.assert_same_household('owner_id', 'household_members');

drop trigger if exists same_household on public.notification_log;
create trigger same_household before insert or update on public.notification_log
for each row execute function public.assert_same_household('member_id', 'household_members');

drop trigger if exists same_household on public.notification_preferences;
create trigger same_household before insert or update on public.notification_preferences
for each row execute function public.assert_same_household('member_id', 'household_members');

drop trigger if exists same_household on public.push_subscriptions;
create trigger same_household before insert or update on public.push_subscriptions
for each row execute function public.assert_same_household('member_id', 'household_members');

drop trigger if exists same_household on public.recurring_items;
create trigger same_household before insert or update on public.recurring_items
for each row execute function public.assert_same_household(
    'owner_id', 'household_members',
    'category_id', 'categories',
    'goal_id', 'savings_goals');

drop trigger if exists same_household on public.savings_goals;
create trigger same_household before insert or update on public.savings_goals
for each row execute function public.assert_same_household('owner_id', 'household_members');

drop trigger if exists same_household on public.settle_ups;
create trigger same_household before insert or update on public.settle_ups
for each row execute function public.assert_same_household(
    'payer_id', 'household_members',
    'payee_id', 'household_members',
    'created_by', 'household_members');

-- Parent side -----------------------------------------------------------------
-- A referenced row cannot change household, which would break valid references
-- after the fact. household_members already has this guard.
create or replace function public.forbid_household_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.household_id is distinct from old.household_id then
        raise exception '%.household_id is immutable', tg_table_name
            using errcode = '42501';
    end if;
    return new;
end;
$$;

revoke all on function public.forbid_household_change() from public, anon, authenticated;

drop trigger if exists household_immutable on public.accounts;
create trigger household_immutable before update on public.accounts
for each row execute function public.forbid_household_change();

drop trigger if exists household_immutable on public.base_budget_profiles;
create trigger household_immutable before update on public.base_budget_profiles
for each row execute function public.forbid_household_change();

drop trigger if exists household_immutable on public.bonus_events;
create trigger household_immutable before update on public.bonus_events
for each row execute function public.forbid_household_change();

drop trigger if exists household_immutable on public.capture_tokens;
create trigger household_immutable before update on public.capture_tokens
for each row execute function public.forbid_household_change();

drop trigger if exists household_immutable on public.categories;
create trigger household_immutable before update on public.categories
for each row execute function public.forbid_household_change();

drop trigger if exists household_immutable on public.credit_cards;
create trigger household_immutable before update on public.credit_cards
for each row execute function public.forbid_household_change();

drop trigger if exists household_immutable on public.expenses;
create trigger household_immutable before update on public.expenses
for each row execute function public.forbid_household_change();

drop trigger if exists household_immutable on public.loans;
create trigger household_immutable before update on public.loans
for each row execute function public.forbid_household_change();

drop trigger if exists household_immutable on public.monthly_budgets;
create trigger household_immutable before update on public.monthly_budgets
for each row execute function public.forbid_household_change();

drop trigger if exists household_immutable on public.savings_goals;
create trigger household_immutable before update on public.savings_goals
for each row execute function public.forbid_household_change();
