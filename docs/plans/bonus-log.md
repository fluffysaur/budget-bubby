# Bonus Log

Date: 2026-11-05
Status: Planned
Branch (proposed): `feat/bonus-log`, cut from an up-to-date `main`

## 1. Overview

The Plan > Bonus tab is a stateless calculator today. It has a fixed 20% CPF and a fixed 10/40/10/20/20 split. This plan replaces it with a **bonus log**: dated bonus entries per household member. Each entry feeds that month's income totals and, when saved, actually funds goals.

Goals:

1. Each bonus is a dated entry with recipient, type, date received, gross, CPF (auto 20% of gross, editable), net and an optional note.
2. A bonus counts in that month's income but stays **outside** monthly category caps.
3. Logging a bonus goes straight to a split step. It starts from the recipient's saved default split and can be changed for each bonus. The Goals share becomes real goal contributions. The other shares are recorded as intended destinations.
4. Plan > Bonus shows bonuses grouped by year, with YTD totals per person and for the household, plus Log / Edit / Delete.
5. The calculator is removed from BudgetPage.
6. **The app keeps working before the migration is applied.** The production DB is live, and agents never apply migrations.

### Decisions (settled; do not reopen)

- New `bonus_events` table, household-scoped, with RLS. The user applies the migration file.
- Bonus types: `aws` (13th month / AWS), `performance`, `sign_on`, `other`.
- `monthly_budgets.bonus` is **derived at read time** from logged events and is no longer entered by hand.
- The per-person default split is seeded with Tithing 10 / Goals 40 / Savings 10 / Investments 20 / Lifestyle 20.
- Logging a bonus triggers a celebration (confetti + chime).

### Current state (verified)

| What | Where |
| --- | --- |
| Stateless calculator UI ("Bonus Splitter") | `src/components/budget/BonusAllocationCollapsible.tsx:26-111` |
| Split formula, hardcoded buckets | `src/lib/financialFormulas.ts:602-638` (`calculateBonusAllocation`) |
| Result type | `src/types/finance.ts:506-516` (`BonusAllocationResult`) |
| Plan tab hosts the calculator | `src/pages/PlanPage.tsx:20`, `:81-85` |
| BudgetPage hosts the calculator | `src/pages/BudgetPage.tsx:46` (import), `:390-395` |
| `MonthlyBudget.bonus` column | `src/types/finance.ts:122`; DB `20260915_init.sql:91` (`numeric(12,2) default 0`) |
| BudgetPage Gross = salary + bonus | `src/pages/BudgetPage.tsx:187`, tooltip `:251` |
| Waterfall Gross Pay shows a bonus line | `src/components/budget/BudgetWaterfall.tsx:46-47`, `:100-107` |
| Household combine sums bonus | `src/lib/combineMonthlyBudgets.ts:42` |
| Supabase: synthesized month sets `bonus: 0` | `src/services/supabaseFinanceService.ts:736` |
| Supabase: **bonus is added into `after_deductions`, so it inflates category caps** | `src/services/supabaseFinanceService.ts:784-797` (caps recomputed `:793-796`) |
| Mock: same inflation | `src/services/mockFinanceService.ts:495-502`, `:704-713`; synthesized `bonus: 0` at `:584` |
| No UI writes `bonus` (BudgetEditorModal only writes salary/CPF/taxes/insurance) | `src/components/budget/BudgetEditorModal.tsx:637-660` |
| Goals have no contribution ledger. Funding = increment `saved_so_far` via `updateGoal` | `QuickDepositModal.tsx:65,89`; sweep `src/pages/ExpensesPage.tsx:166-178` |
| `updateGoal` re-derives pacing `status` client-side | `src/services/supabaseFinanceService.ts:1115-1141` |
| Goal distribution UX to copy (select goals, Split evenly / All to top, $/% modes) | `src/components/budget/SurplusSweepModal.tsx:41-230` |
| Celebration: confetti CSS + cha-ching + haptics | `src/components/expenses/ExpenseSuccessCelebration.tsx`, `src/index.css:397-457`, `src/lib/soundEffects.ts:92` |
| Per-member profile CPF rate | `base_budget_profiles.cpf_employee_rate` (`20260915_init.sql:59`) |
| Migration conventions (RLS via `is_household_member`, `grant … to authenticated`) | `supabase/migrations/20261105100000_notification_log.sql` |
| Existing graceful-fallback precedent (try/catch → local fallback) | `src/services/supabaseFinanceService.ts:1551-1566` |

**Note:** AGENTS.md §5D names `playSuccessSound()`, but no such function exists. Only `playChaChingSound()` exists (`soundEffects.ts:92`). See Open Questions.

## 2. Data model

New file: `supabase/migrations/20261107090000_bonus_events.sql`. It sorts after the latest file, `20261106091000_notification_cron.sql`. The migration is additive only: the deployed frontend never reads these objects.

Three tables and two RPCs:

- `bonus_events`: one row per bonus.
- `bonus_goal_contributions`: the goal funding produced by a bonus. It is a ledger, so edits and deletes can be reversed exactly.
- `bonus_split_defaults`: each member's saved default split.
- `save_bonus_event(...)` and `delete_bonus_event(...)`: change the event, its contributions and `savings_goals.saved_so_far` in **one transaction**. They use `saved_so_far = saved_so_far ± x` so a concurrent edit from the partner's phone cannot be lost. Both are `security invoker`, so RLS still applies.

```sql
-- ==============================================================================
-- Budget Bubby: Bonus Log
-- 1. bonus_events: dated bonus entries per household member
-- 2. bonus_goal_contributions: goal funding produced by a bonus (reversible)
-- 3. bonus_split_defaults: per-member default split
-- 4. save_bonus_event / delete_bonus_event RPCs (atomic goal funding)
-- Additive only: the deployed frontend does not read these objects.
-- ==============================================================================

-- 1. Bonus events --------------------------------------------------------------
create table if not exists bonus_events (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    recipient_id uuid not null references household_members(id) on delete cascade,
    type text not null default 'other'
        check (type in ('aws', 'performance', 'sign_on', 'other')),
    received_on date not null default current_date,
    gross numeric(12, 2) not null check (gross > 0),
    cpf numeric(12, 2) not null default 0.00 check (cpf >= 0 and cpf <= gross),
    net numeric(12, 2) generated always as (gross - cpf) stored,
    note text,
    -- Snapshot of the split used: [{"key":"tithing","pct":0.10,"amount":480.00}, ...]
    split jsonb not null default '[]'::jsonb,
    created_by uuid references household_members(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_bonus_events_household_received
    on bonus_events(household_id, received_on desc);
create index if not exists idx_bonus_events_recipient_received
    on bonus_events(recipient_id, received_on);

-- 2. Goal contributions from a bonus -------------------------------------------
create table if not exists bonus_goal_contributions (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    bonus_event_id uuid not null references bonus_events(id) on delete cascade,
    goal_id uuid not null references savings_goals(id) on delete cascade,
    amount numeric(12, 2) not null check (amount > 0),
    created_at timestamptz not null default now(),
    constraint unique_bonus_goal unique (bonus_event_id, goal_id)
);

create index if not exists idx_bonus_goal_contributions_household_id
    on bonus_goal_contributions(household_id);
create index if not exists idx_bonus_goal_contributions_goal_id
    on bonus_goal_contributions(goal_id);

-- 3. Per-member default split --------------------------------------------------
create table if not exists bonus_split_defaults (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    member_id uuid not null references household_members(id) on delete cascade,
    split jsonb not null,  -- [{"key":"tithing","pct":0.10}, ...], sums to 1
    updated_at timestamptz not null default now(),
    constraint unique_member_bonus_split unique (member_id)
);

create index if not exists idx_bonus_split_defaults_household_id
    on bonus_split_defaults(household_id);

-- RLS (same strict household policy as 20261022_strict_auth_rls.sql) -------------
alter table bonus_events enable row level security;
drop policy if exists "Allow household access" on bonus_events;
create policy "Allow household access" on bonus_events for all
using (auth.uid() is not null and public.is_household_member(household_id))
with check (auth.uid() is not null and public.is_household_member(household_id));

alter table bonus_goal_contributions enable row level security;
drop policy if exists "Allow household access" on bonus_goal_contributions;
create policy "Allow household access" on bonus_goal_contributions for all
using (auth.uid() is not null and public.is_household_member(household_id))
with check (auth.uid() is not null and public.is_household_member(household_id));

alter table bonus_split_defaults enable row level security;
drop policy if exists "Allow household access" on bonus_split_defaults;
create policy "Allow household access" on bonus_split_defaults for all
using (auth.uid() is not null and public.is_household_member(household_id))
with check (auth.uid() is not null and public.is_household_member(household_id));

grant select, insert, update, delete on bonus_events to authenticated;
grant select, insert, update, delete on bonus_goal_contributions to authenticated;
grant select, insert, update, delete on bonus_split_defaults to authenticated;

-- 4. RPCs ----------------------------------------------------------------------
-- Reverses the event's previous contributions, then applies the new ones.
-- Contributions to goals outside the event's household are ignored.
create or replace function public.apply_bonus_goal_contributions(
    p_event_id uuid,
    p_contributions jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_household uuid;
begin
    select household_id into v_household
    from bonus_events where id = p_event_id for update;
    if v_household is null then
        raise exception 'Bonus not found';
    end if;

    update savings_goals g
    set saved_so_far = greatest(0, g.saved_so_far - c.amount)
    from bonus_goal_contributions c
    where c.bonus_event_id = p_event_id and c.goal_id = g.id;

    delete from bonus_goal_contributions where bonus_event_id = p_event_id;

    insert into bonus_goal_contributions (household_id, bonus_event_id, goal_id, amount)
    select v_household, p_event_id, (x->>'goal_id')::uuid, round((x->>'amount')::numeric, 2)
    from jsonb_array_elements(coalesce(p_contributions, '[]'::jsonb)) as x
    where (x->>'amount')::numeric > 0
      and exists (
          select 1 from savings_goals sg
          where sg.id = (x->>'goal_id')::uuid and sg.household_id = v_household
      );

    update savings_goals g
    set saved_so_far = g.saved_so_far + c.amount
    from bonus_goal_contributions c
    where c.bonus_event_id = p_event_id and c.goal_id = g.id;
end;
$$;

-- Insert (p_event->>'id' null) or update an event and its goal funding atomically.
create or replace function public.save_bonus_event(
    p_event jsonb,
    p_contributions jsonb
) returns bonus_events
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_row bonus_events;
begin
    if p_event->>'id' is null then
        insert into bonus_events (
            household_id, recipient_id, type, received_on, gross, cpf, note, split, created_by
        ) values (
            (p_event->>'household_id')::uuid,
            (p_event->>'recipient_id')::uuid,
            coalesce(p_event->>'type', 'other'),
            (p_event->>'received_on')::date,
            (p_event->>'gross')::numeric,
            coalesce((p_event->>'cpf')::numeric, 0),
            nullif(p_event->>'note', ''),
            coalesce(p_event->'split', '[]'::jsonb),
            nullif(p_event->>'created_by', '')::uuid
        ) returning * into v_row;
    else
        update bonus_events set
            recipient_id = (p_event->>'recipient_id')::uuid,
            type = coalesce(p_event->>'type', type),
            received_on = (p_event->>'received_on')::date,
            gross = (p_event->>'gross')::numeric,
            cpf = coalesce((p_event->>'cpf')::numeric, 0),
            note = nullif(p_event->>'note', ''),
            split = coalesce(p_event->'split', split),
            updated_at = now()
        where id = (p_event->>'id')::uuid
        returning * into v_row;
        if v_row.id is null then
            raise exception 'Bonus not found';
        end if;
    end if;

    perform public.apply_bonus_goal_contributions(v_row.id, p_contributions);
    return v_row;
end;
$$;

-- Reverses goal funding, then deletes the event.
create or replace function public.delete_bonus_event(p_event_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
    perform public.apply_bonus_goal_contributions(p_event_id, '[]'::jsonb);
    delete from bonus_events where id = p_event_id;
end;
$$;

grant execute on function public.apply_bonus_goal_contributions(uuid, jsonb) to authenticated;
grant execute on function public.save_bonus_event(jsonb, jsonb) to authenticated;
grant execute on function public.delete_bonus_event(uuid) to authenticated;
```

Design notes:

- **`net` is a generated column (`gross - cpf`).** Users edit CPF and the net amount follows. Payslip net = gross − employee CPF, because SG income tax is not withheld.
- **`split` is a jsonb snapshot**, not a child table. Non-goal shares are only intentions, so nothing joins on them. The snapshot records what the household meant to do even if the default changes later. Bucket keys are fixed: `tithing | goals | savings | investments | lifestyle`. Labels and colours live in code (§4).
- **The reversal clamps at 0** (`greatest(0, …)`). If a goal funded by a bonus was later spent down, deleting the bonus cannot push `saved_so_far` negative. The ConfirmModal copy states what will be removed.
- **Why the default split gets its own table, not a column on `base_budget_profiles`:** `updateBaseProfile` (`supabaseFinanceService.ts:562`) upserts the whole profile. If the new frontend sent a `bonus_split` field before the migration is applied, PostgREST would reject it with `PGRST204` and break **Edit Budget**. A separate table keeps any failure inside the bonus feature. localStorage was rejected because the default must sync between the two phones. `notification_preferences` was rejected because it is the wrong domain and uses the older, looser RLS.
- **No `goal_status` recompute in SQL.** Pacing logic lives in TS (`calculateGoalPacing`). After an RPC call, the client calls `updateGoal(id, {})` for each touched goal so `status` is re-derived (§4.3). This is idempotent and harmless if it fails.

### Legacy `monthly_budgets.bonus`

The column stays: no drop and no backfill in this migration. See §5 for the read-time rule. The plan includes an **optional, commented-out** SQL block that converts legacy values into events. The user runs it only if they choose to:

```sql
-- OPTIONAL (run manually after review):
-- select owner_id, month, bonus from monthly_budgets where bonus <> 0;   -- inspect first
-- insert into bonus_events (household_id, recipient_id, type, received_on, gross, cpf, note)
-- select household_id, owner_id, 'other', (month || '-01')::date, bonus, 0, 'Migrated from monthly budget'
-- from monthly_budgets where bonus > 0;
-- update monthly_budgets set bonus = 0 where bonus > 0;
```

## 3. Compat / fallback strategy (migration not yet applied)

The PR must be safe to deploy **before** the user runs the migration.

1. **Detection helper:** `src/lib/supabaseErrors.ts` exports `isMissingRelationError(err): boolean`. It returns true for:
    - `code === "42P01"` (undefined_table)
    - `"PGRST205"` (table not in schema cache)
    - `"42883"` / `"PGRST202"` (function not found, for the RPCs)
2. **Read API returns availability, not an error:** `getBonusEvents(): Promise<BonusEventsResult>` returns `{ available: boolean; events: BonusEvent[] }`.
    - On a missing relation it returns `{ available: false, events: [] }`.
    - Any other error is thrown as usual.
    - The supabase service caches `private bonusTableAvailable: boolean | null` for the session, so budgets don't fire a failing request every time. The cache resets on reload, so the feature appears on the next app open after the migration.
3. **Monthly budget read path:** while unavailable, use the legacy `budget.bonus` column value (§5). The behaviour is identical to today, except that bonus no longer inflates category caps.
4. **Split defaults:** a missing table → seeded `DEFAULT_BONUS_SPLIT`, and "Save as default" is hidden.
5. **Plan > Bonus tab when unavailable:**
    - Show `<Alert variant="info" title="Bonus log not set up">Apply the bonus_events migration to log bonuses.</Alert>`.
    - Render the existing `BonusAllocationCollapsible` below it, so the tab is never empty.
    - The "Log Bonus" button is not rendered.
    - The calculator is removed for good in a follow-up once the migration is confirmed applied (§9 step 8).
6. **Mutations** (`saveBonusEvent`, `deleteBonusEvent`, `saveBonusSplitDefault`) do not fall back silently. If one hits a missing relation, it throws `BonusLogUnavailableError`, and the modal shows an `<Alert variant="danger">`.
7. **Offline:** mutations need a connection. They are not added to `offlineSyncQueue`, because an atomic RPC plus goal changes are not safe to replay blind. If `navigator.onLine === false`, show `Alert variant="warning"` "You're offline" and disable Save.
8. **Mock / demo mode** always reports `available: true` and implements the same semantics in memory.

## 4. Service layer, types, query hooks

### 4.1 Types (`src/types/finance.ts`)

```ts
export type BonusType = 'aws' | 'performance' | 'sign_on' | 'other';
export type BonusSplitKey = 'tithing' | 'goals' | 'savings' | 'investments' | 'lifestyle';

export interface BonusSplitShare { key: BonusSplitKey; pct: number; amount?: number }

export interface BonusEvent {
  id: string;
  household_id: string;
  recipient_id: string;
  type: BonusType;
  received_on: string;   // 'YYYY-MM-DD'
  gross: number;
  cpf: number;
  net: number;           // generated in DB; computed in mock
  note?: string | null;
  split: BonusSplitShare[];
  goal_contributions: BonusGoalContribution[]; // joined on read
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BonusGoalContribution { goal_id: string; amount: number }

export interface SaveBonusEventInput {
  id?: string;
  recipient_id: string;
  type: BonusType;
  received_on: string;
  gross: number;
  cpf: number;
  note?: string | null;
  split: BonusSplitShare[];
  goal_contributions: BonusGoalContribution[];
}

export interface BonusEventsResult { available: boolean; events: BonusEvent[] }

export interface BonusMonthSummary {
  gross: number; cpf: number; net: number; count: number;
  source: 'events' | 'legacy' | 'none';
}
```

Extend `MonthlyBudgetDetail` (`finance.ts:149-162`) with `bonusSummary?: BonusMonthSummary`. `BonusAllocationResult` (`:506`) stays until the calculator is deleted.

### 4.2 Pure logic (`src/lib/bonusFormulas.ts`, new; no React)

- `BONUS_SPLIT_BUCKETS`: key, label, color. Labels: `Tithing`, `Goals`, `Savings`, `Investments`, `Lifestyle`. Colors move here from `financialFormulas.ts:619-625`.
- `DEFAULT_BONUS_SPLIT`: 0.10 / 0.40 / 0.10 / 0.20 / 0.20.
- `BONUS_TYPE_LABELS`: `{ aws: 'AWS', performance: 'Performance', sign_on: 'Sign-on', other: 'Other' }`.
- `defaultBonusCpf(gross, rate = 0.2)`: rate comes from the recipient's `base_budget_profiles.cpf_employee_rate`, falling back to 0.2.
- `computeBonusSplit(net, split)` → shares with amounts rounded to cents. The last non-zero bucket absorbs the rounding remainder, so the shares always sum to `net`. Today's `calculateBonusAllocation` can be off by a cent.
- `distributeGoalShare(amount, goals, mode: 'even' | 'gap' | 'single', singleId?)` → `BonusGoalContribution[]`. Gap mode weights each goal by `target_amount − saved_so_far` (min 0). Cent remainder goes to the last goal. Achieved goals are excluded.
- `summarizeBonusesForMonth(events, month, ownerId | 'household', legacyBonus)` → `BonusMonthSummary`. Implements the §5 rule.
- `summarizeBonusesYtd(events, year, members)` → per-member and household `{ gross, cpf, net, count }`.
- `groupBonusesByYear(events)` → `[{ year, events, totals }]`, newest year first, events by `received_on` desc.
- Percent balancing in the split step reuses `autoBalanceAllocations` (`financialFormulas.ts:1090`), as AGENTS.md §5C requires.

### 4.3 FinanceService (`src/services/financeService.ts`)

Add to the interface (`:48-118`) and the dispatcher (`:145-339`):

```ts
getBonusEvents(): Promise<BonusEventsResult>;
saveBonusEvent(input: SaveBonusEventInput): Promise<BonusEvent>;
deleteBonusEvent(id: string): Promise<void>;
getBonusSplitDefault(memberId: string): Promise<BonusSplitShare[]>;   // seeded default when none/missing
saveBonusSplitDefault(memberId: string, split: BonusSplitShare[]): Promise<void>;
```

All mutations call `invalidateFinanceCache()`. That refreshes goals, monthly budgets and the bonus log together, since all their keys start with `['finance']`.

**Supabase (`supabaseFinanceService.ts`)**

- `getBonusEvents`: `from('bonus_events').select('*, bonus_goal_contributions(goal_id, amount)').order('received_on', { ascending: false })`. Map nested rows to `goal_contributions` and cast numerics with `Number(...)`. On a missing relation → `{ available: false, events: [] }`.
- `saveBonusEvent`: `client.rpc('save_bonus_event', { p_event, p_contributions })`.
    - Resolve `household_id` via `getHouseholdId()` (`:127`) and `created_by` from the current member.
    - Then, for each goal id in the union of old and new contributions, call `this.updateGoal(id, {})` to re-derive pacing `status`. Wrap this in try/catch and only log on failure.
- `deleteBonusEvent`: `rpc('delete_bonus_event', { p_event_id })` + the same status refresh for the affected goals.
- `getBonusSplitDefault` / `saveBonusSplitDefault`: `select … maybeSingle()` / `upsert(…, { onConflict: 'member_id' })`. This follows the notification-preferences pattern (`:1454-1537`). Validate on read: unknown keys are dropped, and a sum ≠ 1 is re-balanced.

**Mock (`mockFinanceService.ts`)**

- Add `bonusEvents`, `bonusGoalContributions` and `bonusSplitDefaults` to state and persistence.
- `saveBonusEvent` / `deleteBonusEvent` apply the same reverse-then-apply delta to `state.goals[].saved_so_far`, clamped at 0, and recompute status with `calculateGoalPacing`.
- Optionally seed 2 sample events in `src/data/mockSeedData.ts` (e.g. Yi Jia AWS 2025-12, Rachel Performance 2026-03). Check `tests/mockSeedData.test.ts` for count assertions first.

### 4.4 Query hooks (`src/hooks/useFinanceQueries.ts`)

```ts
queryKeys.bonusEvents = ["finance", "bonus-events"] as const;
queryKeys.bonusSplitDefault = (memberId?: string) => ["finance", "bonus-split-default", memberId ?? "none"] as const;

export function useBonusEventsQuery()            // useQuery<BonusEventsResult>
export function useBonusSplitDefaultQuery(memberId?: string) // enabled: Boolean(memberId)
```

In components, follow the AGENTS.md §4 memo rule:

```ts
const EMPTY_BONUSES: BonusEvent[] = [];
const events = bonusData?.events ?? EMPTY_BONUSES;
```

All hooks sit at the top of each component, before any `if (isLoading) return`.

## 5. Monthly budget, waterfall and income totals

### Rule: bonus is income, not budget

- **`after_deductions` and `disposablePool` = salary take-home only.** Category `allocated_amount` stays `after_deductions × pct`. A bonus never raises the Food or Lifestyle caps.
- **The bonus is reported next to the salary**, via `detail.bonusSummary` and `budget.bonus`.

### Read-time derivation (both services, in `getMonthlyBudget`)

1. Fetch the month's events for the member: `bonus_events` where `recipient_id = owner_id` and `received_on ∈ [month-01, nextMonth-01)`. Run this in the existing `Promise.all` with expenses (`supabaseFinanceService.ts:760-767`). Use the cached availability flag to skip the query when the table is missing.
2. `bonusSummary = summarizeBonusesForMonth(events, month, owner, legacy = Number(budgetData?.bonus || 0))`:
    - **Events exist for that member-month** → `source: 'events'`, sums of gross / cpf / net. The legacy column is ignored, which prevents double counting after conversion.
    - **No events, legacy column > 0** → `source: 'legacy'`, `gross = net = legacy`, `cpf = 0`. The old formula added the bonus to take-home without CPF, so the household's existing numbers keep their meaning.
    - Otherwise → `source: 'none'`, zeros.
3. Set `budget.bonus = bonusSummary.gross`. This is a derived value, so existing consumers (`BudgetWaterfall`, `combineMonthlyBudgets`) keep working.
4. **Remove `+ bonus` from the `after_deductions` recompute:**
    - Supabase `:784-797`
    - Mock `:495-502` and `:704-713` (mock `updateMonthlyBudget`)
5. **Legacy rows whose stored `after_deductions` already includes a bonus:**
    - For **unlocked** months with `bonus > 0`, normalize at read time: `after_deductions = gross − cpf − taxes − insurance`, and re-derive category allocations.
    - **Locked** months (`is_locked`) are frozen snapshots and are left untouched. See Open Questions.
6. **Never write `bonus` back.** In `supabaseFinanceService.updateMonthlyBudget` (`:876-893`), strip `bonus` from `budgetUpdates`, so the derived value can't round-trip into the column. Do the same in mock.
7. Synthesized months (`supabase :736`, `mock :584`) also get `bonus` from events. A bonus received in a month with no `monthly_budgets` row still shows up.

### `combineMonthlyBudgets` (`src/lib/combineMonthlyBudgets.ts:42`)

- Keep summing `bonus`.
- Add `bonusSummary` = field-wise sum. `source` = `'events'` if any member has events, else `'legacy'` if any member has legacy, else `'none'`.
- `combinedAfter` (`:34`) already excludes the bonus once step 4 lands.

### BudgetPage (`src/pages/BudgetPage.tsx`)

| Card | Change |
| --- | --- |
| Gross (`:246-254`) | `salary + bonusSummary.gross`; subtitle `+S$X bonus` when > 0; tooltip "Salary plus bonuses received this month." |
| Deductions (`:256-264`) | adds `bonusSummary.cpf`; tooltip "CPF, taxes and insurance, incl. bonus CPF." |
| Take-Home (`:266-273`) | value unchanged (salary pool); subtitle `+S$X bonus` (net) when > 0; tooltip "Salary take-home for category caps. Bonuses are tracked separately." |
| Spent | unchanged |

Remove the `BonusAllocationCollapsible` import (`:46`) and its block (`:390-395`), and update the header doc comment (`:11`).

### BudgetWaterfall (`src/components/budget/BudgetWaterfall.tsx`)

- Accept a new optional prop `bonusSummary?: BonusMonthSummary`, falling back to `budget.bonus` with net = gross.
- The Gross Pay card keeps the `Bonus:` line (`:100-107`).
- The CPF card stays salary CPF. Add a `Bonus CPF` sub-line when `bonusSummary.cpf > 0`.
- Add one compact strip under the 4 steps, only when the bonus is > 0:
    - `Bonus` label · `S$X net` · Badge `Outside caps`
    - `<TooltipPopover>`: "Bonuses count as income but don't raise category limits. Split them in Plan › Bonus."
    - A ghost `Button size="sm"` "View" that navigates to `/plan?tab=bonus`.
- The Net Take-Home card (`~:160-175`) keeps showing `after_deductions`. Its `||` fallback at `:52` must drop `bonus`: `grossSalary − cpf − fixed`.

### Other effects (confirm, no change needed)

- `detectUnspentMonthEndSurplus` / `calculateCumulativeSurplus` work on `disposablePool − spent`. The bonus is no longer counted as "unspent surplus" to sweep. That's intended, because it already went through its own split.
- Home/Dashboard figures that use `disposablePool` lose the inflated bonus. That is correct.

## 6. UI

New folder `src/components/bonus/`. All components use the primitives from `src/components/ui/`: `AnimatedModal`, `ModalHeader`, `ModalBody`, `ModalFooter`, `Button`, `Input`, `Select`, `Badge`, `Alert`, `ConfirmModal`, `CurrencyText`, `TruncatedText`, `StatCard`, `Card`, `CollapsibleSection`, `SegmentedTabs`, `EmptyStateCard` and `TooltipPopover`.

### 6.1 `BonusLogPanel.tsx` (Plan > Bonus tab body)

`PlanPage.tsx:81-85` renders `<BonusLogPanel />`. Update the doc comment at `:5`.

The layout is mobile-first, from top to bottom:

1. **Header row:** `<h2>` "Bonuses" + `Button variant="primary" leftIcon={<Plus/>}` **"Log Bonus"**. The button is full width on mobile (`w-full sm:w-auto min-h-11`).
2. **YTD cards** for the current year: `grid grid-cols-1 sm:grid-cols-3 gap-2.5`.
    - `StatCard title="Gross"`, `"CPF"`, `"Net"` show household totals.
    - Subtitles are data tokens (`3 bonuses`, `20% avg`).
3. **YTD by person:** a `Card elevation="sm"` with a compact table.
    - Rows: each member + **Household**. Columns: Gross / CPF / Net.
    - Member names use `TruncatedText` with `min-w-0 flex-1`. Amounts use `CurrencyText`, `shrink-0`, `font-mono-num`.
    - A year `Select` switches YTD to past years when more than one year has data. The label is "Year".
4. **Log grouped by year:** one `CollapsibleSection` per year.
    - The current year opens by default.
    - Title is `2026`; subtitle `S$12,400 net · 3 bonuses`.
    - Each row is a `BonusRow`:
        - **Left (`min-w-0 flex-1`):** type `Badge`, recipient name, `TruncatedText` of the note (falling back to the type label), and the date (`5 Nov`, built with `MONTH_NAMES_SHORT` from `dateUtils`).
        - **Right (`shrink-0`):** net `CurrencyText` (bold), and gross in `text-xs text-(--text-muted)` below it.
        - A goal-funded hint: `Badge` `S$X to goals` when contributions > 0.
        - Actions: `Button variant="ghost" size="icon-sm"` Edit (Pencil) and Delete (Trash2), each with an `aria-label`. Tapping the row also opens Edit. Touch targets are `min-h-11`.
5. **Empty state** when there are no events (AGENTS §6 formula):
    - `EmptyStateCard title="No Bonuses" description="Log a bonus to track it and fund goals." action={<Button>Log Bonus</Button>}`
6. **Unavailable state:** the §3 fallback (Alert + legacy calculator).
7. **Loading:** skeletons from `PageSkeletons` / `Skeleton`.

### 6.2 `BonusFormModal.tsx` (log + edit, two steps)

`AnimatedModal` + `ModalHeader` (title **"Log Bonus"** or **"Edit Bonus"**, icon `Sparkles`). A 2-step indicator uses `SegmentedTabs` (`Details`, `Split`) and is only clickable back to Details.

**Step 1 – Details**

| Field | Control | Behaviour |
| --- | --- | --- |
| Recipient | `Select` "Recipient" | members; default = active member (Combined view → first member) |
| Type | chip group (`Button variant="outline"/"secondary"` toggles) "Type" | AWS · Performance · Sign-on · Other; default AWS in Dec, otherwise Performance |
| Date | `Input type="date"` "Received" | default today; date chips "Today" / "Last month" optional (reuse ExpenseFormModal pattern) |
| Gross | `Input inputMode="decimal"` "Gross" | required, > 0 |
| CPF | `Input` "CPF" + `Badge` "Auto" while auto | auto = `defaultBonusCpf(gross, recipientRate)` until the user edits it; a ghost "Reset" restores auto; validate `0 ≤ cpf ≤ gross` |
| Net | read-only `CurrencyText` row | `gross − cpf` |
| Note | `Input` "Note" (optional) | e.g. "FY26 AWS" |

Footer: `Button variant="ghost"` "Cancel" and `Button variant="primary"` **"Next"**, which is disabled until the step is valid. Validation errors appear as `<Alert variant="danger">`.

**Step 2 – Split**

- Summary line: `S$X net to split`.
- Five bucket rows, each with a label, a `%` `Input` (whole numbers) and a `CurrencyText` amount. Amounts come from `computeBonusSplit`.
    - Editing one % rebalances the unlocked buckets with `autoBalanceAllocations`. A lock toggle per row follows the BudgetEditorModal precedent.
    - A ghost "Reset" restores the saved default.
- **The Goals bucket expands into a goal picker (`BonusGoalPicker.tsx`):**
    - Eligible goals: active (`status !== 'achieved'`, saved < target) and owned by the recipient or joint (`owner_id` null). Recipient's goals are listed first.
    - Each goal is a checkbox row: emoji + `TruncatedText` title + progress `S$saved / S$target` + amount `Input`.
    - Preset chips: **"Even"**, **"By gap"** and **"One goal"** (the first selected goal), all via `distributeGoalShare`.
    - Default selection when opened: the recipient's single goal if there is exactly one; otherwise all eligible goals with "By gap".
    - Footer line `S$X unassigned` (amber) or `Fully assigned` (emerald).
    - Over-assigning → `Alert variant="danger"` "Over by S$X" and Save is disabled.
    - Under-assigning is allowed. The remainder stays recorded as an intent only.
    - No eligible goals → `Alert variant="info" title="No active goals"` "Goals share is recorded only." and the picker is hidden.
    - Pull the selection/preset logic out of `SurplusSweepModal.tsx:105-165` into a small shared hook or helper (`src/lib/goalDistribution.ts`) so the two flows don't drift. Refactor SurplusSweepModal to use it only if that is trivial; otherwise leave it for a follow-up (no unrelated refactors on the feature branch).
- Checkbox **"Save as default for {name}"**. It is unchecked by default and hidden when split defaults are unavailable.
- Footer: "Back" (ghost) and the primary button: **"Log Bonus"** when creating, **"Save"** when editing.

**Submit**

1. `financeService.saveBonusEvent(input)`.
2. If "Save as default" is checked, call `saveBonusSplitDefault`.
3. Close the modal.
4. When **creating** (not editing), fire the celebration.

**Editing a bonus with goal contributions**

- Pre-fill the existing contributions.
- If gross or CPF changes, the split amounts recompute. The goal amounts are **not** auto-rescaled. Instead show `Alert variant="warning"` "Goal amounts no longer match the Goals share." with a "Rebalance" action.
- The RPC applies the delta.

### 6.3 Delete

`ConfirmModal variant="danger" title="Delete Bonus?"`

- Message: `S$X {type} for {name}.` When contributions exist, add: `Removes S$Y from goals.`
- Confirm label: "Delete".

### 6.4 Celebration (`BonusCelebration.tsx`)

- A toast that copies the `ExpenseSuccessCelebration` layout, using the confetti classes `animate-confetti-left` / `animate-confetti-right` from `src/index.css`.
- Headline: `S$X bonus logged`. Subtitle: `S$Y to goals` when goals were funded.
- Sound and haptics: `playChaChingSound()` (or `playSuccessSound`, see Open Questions) and `haptics.success()`. Both respect the user's sound setting via `isSoundEffectsEnabled`.
- Auto-dismisses after 3 s.
- Mounted inside `BonusLogPanel` and driven by local state. No new global window event is needed.
- When a goal reaches its target as a result of the funding, reuse the goal-achieved feedback if one exists. If not, the toast subtitle becomes `🎉 {goal} reached`.

### 6.5 Copy summary (AGENTS §6)

| Spot | Copy |
| --- | --- |
| Tab | Bonus (unchanged) |
| Primary CTA | Log Bonus |
| Modal titles | Log Bonus / Edit Bonus |
| Steps | Details / Split |
| Empty state | No Bonuses · "Log a bonus to track it and fund goals." · Log Bonus |
| Unavailable | Alert "Bonus log not set up" · "Apply the bonus_events migration to log bonuses." |
| Delete | Delete Bonus? · "Removes S$Y from goals." |
| Celebration | S$X bonus logged · S$Y to goals |
| Waterfall badge | Outside caps |

## 7. Goals funding mechanics (summary)

- Only the **Goals** share moves money. Funding = `saved_so_far += amount` per goal, which matches QuickDeposit and Sweep. It is recorded in `bonus_goal_contributions`, so the funding can be traced and reversed.
- Create, edit and delete all go through one RPC transaction: reverse the old contributions, then apply the new ones. Concurrent edits are safe because the RPC uses relative updates and a `for update` lock on the event row.
- Afterwards the client re-derives goal `status` via `updateGoal(id, {})`.
- Tithing, Savings, Investments and Lifestyle are stored in `split` only. They do not touch accounts, categories or caps.
- A deleted goal cascades away its contribution rows. The event's `split.goals.amount` still records the intent.
- Goal history: a later enhancement could show "From bonus" entries on `GoalCard` by reading `bonus_goal_contributions`. This is out of scope for v1.

## 8. Tests

### Unit (Vitest, `tests/`)

- **`tests/bonusFormulas.test.ts` (new):**
    - `defaultBonusCpf` for rate 0.2 and a custom rate.
    - `computeBonusSplit`: shares sum exactly to net, including amounts like S$3,333.33.
    - `distributeGoalShare` in even / gap / single modes: the cent remainder, achieved goals excluded, zero-gap goals.
    - `summarizeBonusesForMonth` covers all three sources:
        - events present → the legacy value is ignored
        - legacy only
        - none
    - `summarizeBonusesYtd` per member and household.
    - `groupBonusesByYear` ordering.
- **`tests/supabaseFinanceService.test.ts` (extend):**
    - A `42P01` / `PGRST205` error → `getBonusEvents` returns `{ available: false }` and caches the flag.
    - Other errors throw.
    - `getMonthlyBudget`:
        - excludes the bonus from `after_deductions` and allocations
        - sets `bonusSummary` from events
        - falls back to the legacy column when the table is missing
        - normalizes unlocked legacy rows; leaves locked rows untouched
    - `updateMonthlyBudget` strips `bonus`.
    - `saveBonusEvent` calls `rpc('save_bonus_event', …)` with the right payload, then refreshes goal status.
- **`tests/financeService.test.ts` (mock path):**
    - Create → goal `saved_so_far` increases.
    - Edit with changed allocations → the delta is applied.
    - Delete → reversed, clamped at 0.
    - `invalidateFinanceCache` runs on each mutation.
- **`tests/combineMonthlyBudgets.test.ts`:** `bonusSummary` sums; `after_deductions` has no bonus.
- **`tests/BudgetComponents.test.tsx:203`:** update the waterfall bonus test for the new strip and badge. Assert that category caps are unchanged when a bonus is present.
- **`tests/PlanPage.test.tsx:43`:** replace the "Bonus Splitter" expectation with the log empty state / "Log Bonus". Add a case where the service reports `available: false` → Alert + calculator.
- **`tests/BonusLog.test.tsx` (new):**
    - Empty state formula.
    - Log flow: CPF auto-fills 20% and the user can override and reset it; Next is disabled until valid; split % rebalances; goal presets; over-assign blocks Save.
    - The celebration fires on create and not on edit.
    - Edit pre-fills.
    - Delete uses ConfirmModal with the "Removes S$Y from goals" copy.
    - The year grouping and YTD table render.

### E2E (Playwright, mock mode via `playwright.config.ts:30-35`)

`e2e/bonus-log.spec.ts`:

1. Go to `/plan?tab=bonus` → see "No Bonuses" (or the seeded rows).
2. Log Bonus → Rachel, Performance, gross 10,000 → CPF shows 2,000 → Next → Goals 40% = S$3,200 → "By gap" → Log Bonus → celebration toast visible → row appears under the current year, and YTD Net includes S$8,000.
3. Goals tab → the funded goals' saved amounts increased by the assigned amounts.
4. Budget page for that month → the Gross card includes S$10,000, the waterfall shows the "Outside caps" strip, and the Lifestyle cap is unchanged.
5. Edit → change gross → warning → Rebalance → Save. Delete → confirm → the goals are reverted.
6. Mobile viewport project: no horizontal scroll, and the modal footer is reachable. Follow the patterns in `e2e/mobile-viewport.spec.ts`.

### Quality gate (AGENTS §7C)

`npm run lint` (0 warnings), `npm run build`, `npm test` and `npm run test:e2e` before proposing a commit or PR.

## 9. Rollout order and commit breakdown

Each commit leaves the app green and runnable against a DB **without** the migration.

1. `feat(db): add bonus_events migration`: SQL file only, plus the optional legacy-conversion block (commented out).
2. `feat(bonus): add bonus types and formulas`: types, `src/lib/bonusFormulas.ts`, `src/lib/supabaseErrors.ts`, unit tests.
3. `feat(bonus): add bonus service with missing-table fallback`: FinanceService interface, dispatcher, supabase and mock implementations, query hooks, tests.
4. `fix(budget): keep bonus outside category caps and derive it from events`: the `getMonthlyBudget` changes in both services, `updateMonthlyBudget` strip, `combineMonthlyBudgets`, BudgetPage cards, BudgetWaterfall strip, tests.
5. `feat(bonus): bonus log tab with log, edit and delete`: `BonusLogPanel`, `BonusRow`, `BonusFormModal`, `BonusGoalPicker`, `BonusCelebration`, PlanPage wiring, unavailable fallback, component tests.
6. `refactor(budget): remove bonus calculator from Budget page`.
7. `test(e2e): bonus log flow`.
8. **After the user confirms the migration is applied (separate follow-up PR):** `refactor(bonus): remove legacy bonus calculator`. Delete `BonusAllocationCollapsible.tsx`, `calculateBonusAllocation` and `BonusAllocationResult`, and simplify the unavailable branch to the Alert only. Keep the legacy-column read fallback until the optional conversion SQL has been run.

Deploy sequence for the user:

1. Merge the PR (feature dormant: Alert + calculator).
2. Apply `20261107090000_bonus_events.sql` in Supabase.
3. Reopen the app → the bonus log appears.
4. Optionally inspect or convert legacy `monthly_budgets.bonus` rows.

## 10. Open questions

1. **Legacy bonus values in prod.** Run `select owner_id, month, bonus, is_locked from monthly_budgets where bonus <> 0;`. If there are none, the legacy fallback is defensive only. If some exist, should we convert them to events with the optional SQL, or keep the fallback?
2. **Locked months.** Is it OK to leave locked months with an inflated `after_deductions` as historical snapshots, or should those be normalized too?
3. **Sound naming.** AGENTS.md references `playSuccessSound()`, which doesn't exist. Should we add it as a softer chime in `soundEffects.ts`, alias it to `playChaChingSound`, or update AGENTS.md?
4. **CPF accuracy.** The 20% default ignores the Additional Wage ceiling and age-band rates. Is pulling the default from the recipient's `cpf_employee_rate` with per-bonus override enough?
5. **Eligible goals.** Recipient's + joint goals only, or all household goals? Partner-owned goals are hidden by default in this plan.
6. **Perspective.** Should the log and YTD cards follow the Yi Jia / Rachel / Combined perspective, or always show the household? The plan always shows the household, with per-person rows.
7. **Lifestyle share.** It is recorded only, per the decision. Should a later iteration offer a "bonus pot" so this share can be spent without touching monthly caps?
8. **Unassigned Goals remainder.** Allowed (recorded as intent), or require it to be fully assigned before Save?
