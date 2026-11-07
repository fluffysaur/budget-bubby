# Capture Inbox Plan

Date: 2026-11-05
Status: Plan only. Nothing implemented.
Branch (when approved): `feat/capture-inbox`, cut from `main` **after** `refactor/unified-expense-form` merges, because this plan builds on the unified `ExpenseFormModal`.
Sibling plan: [`delight-bubby.md`](./delight-bubby.md) owns visuals, Bubby moods, streak, Inbox Zero celebration and recap. This plan only exposes the hooks it needs (see [§10](#10-hooks-for-the-delight-layer)).

---

## 1. Overview

**Problem.** Logging is a chore: they forget, it gives nothing back, and most spending goes through Apple Pay or card.

**Fix (agreed):**

1. **Silent capture.** An iOS Shortcuts personal automation on the Wallet **Transaction** trigger POSTs amount, merchant, card and timestamp to a new endpoint. It authenticates with a per-member personal access token. The purchase lands in an **Inbox** of uncategorised items.
2. **Fast triage.** A swipe-style Inbox screen. The category is guessed from the merchant, merchant→category choices are remembered, and each item can be marked shared, confirmed or discarded in one gesture.
3. **Smarter reminders.** Nudge only when the Inbox has items or nothing was logged today.
4. **Fallback.** If the POST fails, the Shortcut opens the app with the Add Expense form prefilled (`/expenses?action=new&amount=…&merchant=…`).

**Key decisions (reasoned below):**

| Topic | Decision |
|---|---|
| Endpoint host | New **Supabase Edge Function** `capture-expense`, following the existing `send-reminders` pattern |
| Data model | Separate **`inbox_items`** table. Unconfirmed items never touch `expenses` |
| Token | 256-bit random token `bb_cap_…`, created in the browser. Only its SHA-256 hash is stored. It can only insert inbox items |
| Confirm | `confirm_inbox_item` RPC: inserts the expense, resolves the item and records the check-in in one transaction. Idempotent, so offline replay is safe |
| "Day logged" | The member has a `daily_checkins` row for that SGT date. A capture alone does **not** count. Confirming does, for the purchase date |
| New deps | **None**. Swipe uses pointer events and CSS transforms |

### Findings that shape the plan

- **Hosting.** [`vercel.json`](../../vercel.json) only has an SPA rewrite and no `/api` functions. Supabase Edge Functions are already set up: [`supabase/functions/send-reminders/index.ts`](../../supabase/functions/send-reminders/index.ts) is a thin Deno wrapper around a bundle of `src/server/*.ts` built by [`vite.functions.config.ts`](../../vite.functions.config.ts). It is deployed with `--no-verify-jwt` ([`package.json:18`](../../package.json)) and its secrets live in Supabase.
- **The PWA shortcut is broken.** The `Add Expense` manifest shortcut points to `/expenses?action=new` ([`vite.config.ts:57-63`](../../vite.config.ts)). Nothing reads `action`: `/expenses` renders `SpendPage`, which only reads `?tab=` ([`SpendPage.tsx:31-33`](../../src/pages/SpendPage.tsx)). Quick Add opens only from the FAB, the `c` key, `/fast-log` ([`App.tsx:197`](../../src/App.tsx), [`FastLogPage.tsx`](../../src/pages/FastLogPage.tsx)) or the `openQuickAdd` window event ([`App.tsx:160-165`](../../src/App.tsx)). Phase 0 fixes this.
- **`ExpenseFormModal` has no prefill props** for amount, item or date. It only has `expense` (edit mode) and `initialGoalId` ([`ExpenseFormModal.tsx:57-71`](../../src/components/expenses/ExpenseFormModal.tsx)).
- **`addExpense` already records a check-in** for the payer on the expense date ([`supabaseFinanceService.ts:1010-1015`](../../src/services/supabaseFinanceService.ts)). `daily_checkins.type` is limited to `('expense','no_spend')`, with one row per member per day ([`20261028_epics_foundation.sql:59-67`](../../supabase/migrations/20261028_epics_foundation.sql)).
- **Missing-table fallback pattern.** The service catches errors and falls back locally while `localFallback` is true ([`supabaseFinanceService.ts:1550-1565`](../../src/services/supabaseFinanceService.ts)). The server runner builds the service with `localFallback: false` ([`sendReminders.ts:184`](../../src/server/sendReminders.ts)).
- **Query client.** It sets `refetchOnWindowFocus: false` and `staleTime: 5 min` globally ([`queryClient.ts:11-13`](../../src/lib/queryClient.ts)). The inbox query must override both.
- **`expenses` has no card column** (only the tags, goal and FX columns from [`20261028_epics_foundation.sql:10-15`](../../supabase/migrations/20261028_epics_foundation.sql)). `credit_cards` holds `name`, `bank` and `last4` and can be matched to the Wallet card name.
- **Devices.** [`2026-11-04-notifications.md`](./2026-11-04-notifications.md) Decision 13 says "one Android (Chrome) and one iPhone". This brief says both are iPhones. See [Open Questions](#14-open-questions).

---

## 2. Architecture

```
 iPhone (Wallet tap)
   │  Shortcuts automation "Transaction" (Run Immediately)
   │  POST JSON {amount, merchant, card, timestamp}
   │  Authorization: Bearer bb_cap_xxx
   ▼
 Supabase Edge Function  capture-expense  (Deno, --no-verify-jwt, no CORS)
   │  supabase/functions/capture-expense/index.ts   ← thin wrapper
   │  _shared/dist/capture-expense.js               ← bundled from src/server/captureExpense.ts
   │    1. sha256(token) → capture_tokens (not revoked)        ─┐
   │    2. rate limit (count inbox_items by token_id)            │ service-role client,
   │    3. validate + parseCapturedAmount + normalizeMerchant    │ touches ONLY these
   │    4. merchant_rules: ignore? suggested category?           │ three tables
   │    5. idempotent insert inbox_items (status=pending)       ─┘
   │  → 201 {status:"captured", inboxCount}
   ▼
 Postgres  inbox_items ─ merchant_rules ─ capture_tokens   (RLS; clients cannot INSERT inbox_items)
   ▲                         ▲
   │ select/update (RLS)     │ upsert on confirm
   │                         │
 PWA (React)
   ├─ useInboxQuery / useInboxSummary  (refetch on focus + visibilitychange)
   ├─ Home "Inbox" card · Spend tab badge · /inbox triage screen
   ├─ confirm → rpc confirm_inbox_item (expense + resolve + check-in, atomic)
   │             └─ offlineSyncQueue "confirmInboxItem" when offline (idempotent replay)
   ├─ loggingEvents bus → delight layer (inbox:item-confirmed, inbox:cleared, day:logged …)
   └─ Settings → Auto Capture (create / revoke tokens)

 pg_cron hourly → send-reminders → computeRemindersFrom(+ inbox summary)
   → "inbox_pending" push at check-in time; daily_checkin suppressed when Inbox has items

 Fallback: Shortcut "If request failed" → Open URLs
   https://<app>/expenses?action=new&amount=12.50&merchant=Grab&card=DBS&at=<iso>
   → App reads params → ExpenseFormModal opens prefilled
```

### Why a Supabase Edge Function

| Option | Verdict |
|---|---|
| **Supabase Edge Function** (chosen) | The deploy script, Deno import map, Vite bundling of shared TS (tested with Vitest) and service-role secrets already exist. No new hosting or secrets. Same origin as the DB |
| Vercel Function (`/api/capture`) | Would need a new runtime, the service-role key copied into Vercel env, and new deploy wiring. `vercel.json` is only a rewrite today |
| PostgREST RPC called from the Shortcut | No deploy, but the anon key goes in the Shortcut, amount and merchant parsing would be written in plpgsql (hard to test, can't share TS), and there is no good rate limiting |

---

## 3. Data Model

### Why a separate `inbox_items` table instead of `expenses.status`

| | `inbox_items` table (chosen) | `expenses.status` column |
|---|---|---|
| Old PWA builds during rollout | Never see inbox items | **Would count pending items** in budgets, settlement, streaks and trends until both phones update |
| Existing queries | Unchanged (7 `from('expenses')` call sites in `supabaseFinanceService.ts`, plus the mock and every client-side aggregation) | Each needs `status = 'confirmed'`. Missing one is a silent money bug |
| Required columns | `merchant`, `card_name`, `raw_amount` and `captured_at` can be inbox-only | `expenses.item` is `not null`, and expenses have no currency-pending or card columns |
| Inserts | Edge function only. The client role gets no INSERT grant | Can't scope a token to "pending only" without trigger hacks |
| Cost | One RPC to move an item into `expenses` | None |

**Consequence:** budget pacing leaves out unsorted spend. The Home Inbox card shows the unsorted total (`S$84 to sort`) so pacing stays honest.

### Migration draft: `supabase/migrations/20261107090000_capture_inbox.sql`

The file is added only. **The user applies it.** It is additive and re-runnable.

```sql
-- ==============================================================================
-- Budget Bubby: Capture Inbox
--   1. capture_tokens   per-member personal access tokens (hash only)
--   2. inbox_items      captured, unconfirmed purchases (never counted as spend)
--   3. merchant_rules   remembered merchant -> category / ignore
--   4. confirm_inbox_item(): atomic confirm (expense + resolve + check-in)
--   5. prune job for resolved inbox items (90 days)
-- Additive only. Clients cannot INSERT inbox_items; the capture-expense
-- Edge Function inserts with the service role.
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
-- No delete; revoke = set revoked_at. Hash is readable by its owner only
-- (useless without the preimage).
grant select, insert on capture_tokens to authenticated;
grant update (label, revoked_at) on capture_tokens to authenticated;

-- 2. Inbox items --------------------------------------------------------------
create table if not exists inbox_items (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    member_id uuid not null references household_members(id) on delete cascade, -- payer (token owner)
    token_id uuid references capture_tokens(id) on delete set null,
    source text not null default 'wallet' check (source in ('wallet')),
    merchant text not null check (char_length(merchant) between 1 and 120),
    merchant_key text not null check (char_length(merchant_key) between 1 and 120),
    amount numeric(14, 2) not null check (amount > 0 and amount < 1000000000),
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
-- Deliberately NO insert/delete grant: only the Edge Function creates rows.
grant select on inbox_items to authenticated;
grant update (status, resolved_at, resolved_by, expense_id) on inbox_items to authenticated;

-- 3. Merchant rules (household-wide: categories are household-wide) -----------
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
grant select, insert, update, delete on merchant_rules to authenticated;

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

    insert into daily_checkins (household_id, member_id, checkin_date, type)
    values (v_item.household_id, v_payer, v_date, 'expense')
    on conflict (member_id, checkin_date) do nothing;

    return v_expense_id;
end;
$$;
grant execute on function public.confirm_inbox_item(uuid, jsonb) to authenticated;

-- 5. Retention: resolved items older than 90 days ----------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'prune-inbox-items';
select cron.schedule(
    'prune-inbox-items',
    '45 19 * * *', -- 03:45 Singapore time
    $$ delete from public.inbox_items
       where status <> 'pending' and resolved_at < now() - interval '90 days' $$
);
```

Notes:

- `amount` is in the **original currency**. The SGD amount is worked out at confirm time from the client's FX rates (§5.4), the same way `ExpenseFormModal` does it today via `buildExpenseFxFields` ([`currencyConverter.ts:200`](../../src/lib/currencyConverter.ts)).
- `numeric(14,2)` allows IDR and VND amounts. Per-currency sanity caps live in the endpoint.
- `confirm_inbox_item` checks the expense payload only through column types and RLS. The client sends values that `ExpenseFormModal` / `CreateExpenseInput` already validate.
- The cron block needs `pg_cron`, which [`20261106091000_notification_cron.sql`](../../supabase/migrations/20261106091000_notification_cron.sql) already enabled.

### Types (`src/types/finance.ts`)

```ts
export type InboxItemStatus = "pending" | "confirmed" | "discarded" | "duplicate";
export interface InboxItem {
  id: string; household_id: string; member_id: string;
  merchant: string; merchant_key: string;
  amount: number; currency: string; raw_amount?: string | null;
  card_name?: string | null; captured_at: string;
  status: InboxItemStatus;
  suggested_category_id?: string | null;
  likely_duplicate_of?: string | null;
  expense_id?: string | null; created_at?: string;
}
export interface InboxSummary {
  available: boolean;          // false before the migration is applied
  pendingCount: number;
  pendingTotalSgd: number;     // approx, cached FX
  oldestCapturedAt: string | null;
}
export interface CaptureToken {
  id: string; member_id: string; label: string; token_hint: string;
  created_at: string; last_used_at?: string | null; revoked_at?: string | null;
}
export interface MerchantRule {
  id: string; merchant_key: string; action: "categorise" | "ignore";
  category_id?: string | null; is_shared?: boolean | null; hit_count: number;
}
```

### Service methods (`FinanceService`, [`financeService.ts:48-118`](../../src/services/financeService.ts))

Each method is implemented in `supabaseFinanceService` and `mockFinanceService` (localStorage, seeded with 3 demo items so the flow can be tested in demo mode):

- `getInboxItems(memberId?, status = "pending"): Promise<{ available: boolean; items: InboxItem[] }>`
- `getInboxSummary(memberId): Promise<InboxSummary>`
- `confirmInboxItem(itemId, expense: CreateExpenseInput): Promise<string>` (RPC)
- `resolveInboxItem(itemId, status: "discarded" | "duplicate" | "pending")` (`pending` is for Undo)
- `getMerchantRules()`, `upsertMerchantRule(rule)`, `deleteMerchantRule(id)`
- `listCaptureTokens(memberId)`, `createCaptureToken(memberId, label): Promise<{ token: string; row: CaptureToken }>`, `revokeCaptureToken(id)`

**Pre-migration fallback.** Add `isMissingRelation(err)` to `supabaseFinanceService.ts`. It matches PostgREST `PGRST205`/`PGRST202` and Postgres `42P01`/`42883`. When it matches, the read methods return `{ available: false, items: [] }` / `available: false`, and the write methods throw an `InboxUnavailableError`. The UI hides every Inbox entry point while `available === false` (§6.4). Everything else in the app behaves exactly as today.

---

## 4. Endpoint Spec: `capture-expense`

### Files

- `src/server/captureExpense.ts`: pure handler `handleCapture(deps, req): Promise<CaptureResponse>` with injected deps (`findToken`, `countRecentByToken`, `findRule`, `insertItem`, `findLikelyDuplicate`, `touchToken`, `now`). Same testable pattern as `runSendReminders` ([`sendReminders.ts:41-53`](../../src/server/sendReminders.ts)). Also exports `createSupabaseCaptureDeps(client)`.
- `src/lib/capture/parseAmount.ts`: `parseCapturedAmount(raw)`. Shared by the server and the deep link.
- `src/lib/capture/merchant.ts`: `normalizeMerchant(raw)`. Shared by the server and the client.
- `supabase/functions/capture-expense/index.ts` and `deno.json`: thin wrapper. It builds a service-role client and returns JSON. **No CORS headers**, and `OPTIONS` gets 405, so browsers can't call it cross-origin.
- `vite.functions.config.ts`: change `lib.entry` to a map `{ "send-reminders": …, "capture-expense": … }` and `fileName: (_, name) => \`${name}.js\``.
- `package.json` `deploy:functions`: deploy both functions with `--no-verify-jwt`. This is a script change only, no new deps. **The user runs the deploy.**
- Secrets: none new (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are built in).

### Request

```
POST https://<project-ref>.supabase.co/functions/v1/capture-expense
Authorization: Bearer bb_cap_<43 base64url chars>
Content-Type: application/json
```

```json
{
  "amount": "S$12.50",
  "merchant": "GRAB*FOOD 8812",
  "card": "DBS Altitude",
  "timestamp": "2026-11-05T12:34:56+08:00",
  "currency": "SGD"
}
```

| Field | Rules |
|---|---|
| `amount` | Required. A string (as Shortcuts formats it) or a number. Parsed by `parseCapturedAmount` |
| `merchant` | Required. Trimmed, control characters stripped, whitespace collapsed, 1–120 chars |
| `card` | Optional, ≤ 80 chars |
| `timestamp` | Optional ISO-8601. If missing, unparseable, or outside [now − 7 days, now + 10 min], server `now` is used |
| `currency` | Optional ISO code. Overrides what is inferred from the amount |
| Body size | ≤ 4 KB, otherwise 413. Unknown keys are ignored |

**`parseCapturedAmount` (currency handling).**

- Strip spaces and NBSP. Detect a prefix or suffix symbol or code: `S$`→SGD, a bare `$`→**SGD** (iPhone region is SG), `US$`/`USD`→USD, `A$`→AUD, `NT$`→TWD, `HK$`→HKD, `RM`→MYR, `¥`/`JP¥`→JPY, `CN¥`/`RMB`→CNY, `€`→EUR, `£`→GBP, `₩`→KRW, `฿`→THB, `Rp`→IDR, `₫`→VND, `₱`→PHP. A 3-letter ISO code wins over any symbol.
- Handle thousands separators: if the last separator is followed by 3 digits and the currency is zero-decimal, treat it as grouping (`isZeroDecimalCurrency`, [`currencyConverter.ts:35-45`](../../src/lib/currencyConverter.ts)).
- Negative or zero amounts (refunds, card verifications) return `ignored`.
- Per-currency sanity cap: SGD ≤ 20,000. Others ≤ that cap × a generous rate bound, otherwise 400.
- Currencies not in `SUPPORTED_CURRENCIES` (SGD, MYR, VND, JPY, THB, USD, EUR, GBP, KRW, TWD, AUD, IDR, PHP, CNY) are still stored. Triage then sends them to the full form.

**`normalizeMerchant` → `merchant_key`.** Lowercase. Strip processor prefixes (`grab*`, `sq *`, `paypal *`, `sumup *`, `shopee*`, `lazada*` keeps its brand), trailing reference numbers (`#1234`, `8812`), and location suffixes (`singapore`, ` sg`). Collapse punctuation and whitespace. Examples: `GRAB*FOOD 8812` → `grab food`, `NTUC FAIRPRICE-TAMPINES SG` → `ntuc fairprice tampines`. The display `merchant` is the cleaned original (title-cased if all caps).

### Processing order

1. Method must be `POST`, else 405. Bearer token must match `^bb_cap_[A-Za-z0-9_-]{43}$`, else 401 (no DB hit).
2. `sha256(token)` → `capture_tokens` where `token_hash = $1 and revoked_at is null`. If there is no row, 401.
3. Rate limit by counting `inbox_items` with this `token_id`: **> 10 in the last 60 s or > 150 in the last 24 h** returns 429 with `retry_after` seconds. This is enough for real spending and caps spam if a token leaks.
4. Validate and parse. Failures return 400 with a specific code.
5. `merchant_rules` (household, merchant_key):
    - `ignore` returns 200 `{status:"ignored"}` with no insert (for example SimplyGo transit taps).
    - `categorise` sets `suggested_category_id`.
6. Idempotency key = `sha256(member_id | amount | currency | merchant_key | captured_at rounded to 2 min)`.
    - Insert `on conflict (member_id, idempotency_key) do nothing returning id`.
    - If no row comes back, return 200 `{status:"duplicate"}`. This covers Shortcut retries and double-fired triggers.
7. Soft duplicate hint. One query finds an `expenses` row with the same payer, the same SGD amount (or the same `original_amount` and `original_currency`) and a date within ±1 day of `captured_at`. If found, set `likely_duplicate_of`. This catches a purchase that was also logged by hand.
8. `touchToken` sets `last_used_at = now()`. Return 201.

If any capture table is missing (`42P01`), return 503 `{error:"not_ready"}` so the Shortcut falls back.

### Responses

| Status | Body | Shortcut behaviour |
|---|---|---|
| 201 | `{"status":"captured","id":"…","inboxCount":3}` | Silent |
| 200 | `{"status":"duplicate","id":"…"}` / `{"status":"ignored"}` | Silent |
| 400 | `{"error":"invalid_amount" \| "invalid_merchant" \| "invalid_json"}` | Fallback |
| 401 | `{"error":"unauthorized"}` (missing, unknown and revoked all look the same) | Fallback |
| 405 / 413 | `{"error":"method_not_allowed" \| "payload_too_large"}` | Fallback |
| 429 | `{"error":"rate_limited","retry_after":42}` | Fallback |
| 503 | `{"error":"not_ready"}` | Fallback |
| 500 | `{"error":"server_error"}` (details only in function logs, never the token or body) | Fallback |

The Shortcut treats "no `status` key in the response" as a failure (§7). That keeps the If logic simple.

---

## 5. Inbox Triage UI

Route: `/inbox` → lazy `InboxPage` ([`App.tsx:43-47`](../../src/App.tsx) pattern). It sits under the Spend tab for nav highlighting ([`App.tsx:97-103`](../../src/App.tsx)).

### 5.1 Layout (mobile-first, one card at a time)

```
┌──────────────────────────────┐
│ Inbox                3 to sort│  PageHeader + Badge
├──────────────────────────────┤
│ ┌──────────────────────────┐ │  Card elevation="tactile" (top of a 2-deep stack;
│ │ Grab Food          12:34 │ │   next card peeks 6px behind, scaled 0.97)
│ │ S$12.50                  │ │  CurrencyText text-2xl font-black font-display
│ │ DBS Altitude · Today     │ │  text-xs uppercase tracking-wider muted
│ │ [Alert warn: Looks logged]│ │  only when likely_duplicate_of
│ │ (Food✓)(Transport)(Life…)│ │  CategoryBadge chips, guess preselected
│ │ [ Mine | Shared ]        │ │  SegmentedTabs, default from rule / last split
│ └──────────────────────────┘ │
│ [Discard] [Edit]  [Confirm ✓]│  Button ghost / outline / primary, min-h-11
│        Confirm 4 Matched     │  Button secondary, only when ≥ 2 rule-matched items
└──────────────────────────────┘
```

- **Primitives only:** `PageHeader`, `Card`, `CurrencyText`, `CategoryBadge`, `SegmentedTabs`, `Button`, `Badge`, `Alert`, `TruncatedText` (merchant and card name), `EmptyStateCard`, `ConfirmModal`, and `Select` for "More" categories. The `ExpenseFormModal` opens for **Edit**.
- **Category chips.** Show the top 5 categories by this member's last-90-day frequency, with the guess first, then `More` (a `Select`). Tapping a chip only selects it. Confirming is a separate, deliberate action.
- **Flex rules (AGENTS §3):**
    - Merchant row: `min-w-0 flex-1` + `TruncatedText`.
    - Amount and time: `shrink-0`.
- **Desktop** (`md:`): the same card is centred at `max-w-md`. Keyboard: `←` discard, `→`/`Enter` confirm, `1–5` pick chip, `e` edit, `z` undo.

### 5.2 Gestures ("crisp and smooth")

- Pointer events on the top card update a `translateX` and `rotate(dx/20 deg)` via a ref and `requestAnimationFrame` (no React state per frame). Only `transform` and `opacity` are animated.
- Commit threshold: `|dx| > 35% width` or fling velocity `> 0.5 px/ms`.
    - **Right** = confirm with the selected category.
    - **Left** = discard.
    - Below the threshold the card springs back (`transition: transform 180ms cubic-bezier(.2,.8,.2,1)`).
- Lock to the horizontal axis after 8 px, so vertical scroll and `PullToRefresh` aren't hijacked. Set `touch-action: pan-y` on the card.
- Tint overlay as the drag progresses: mint (`--pastel-mint-light`) when confirming, coral (`--pastel-coral-light`) when discarding, with labels `Confirm` / `Discard`.
- On commit: `haptics.triggerHaptic(HAPTIC_PATTERNS.<light>)` ([`haptics.ts:19`](../../src/lib/haptics.ts)). The next card is already rendered, so it promotes with no fetch or layout shift.
- `prefers-reduced-motion`: no rotation or fly-out, just a 120 ms crossfade.
- Swipe is an enhancement. Every action also has a button (accessibility, AGENTS §5D).

### 5.3 Data flow

- `useInboxQuery(memberId)` with key `["finance","inbox",memberId]`. Overrides: `staleTime: 30_000`, `refetchOnWindowFocus: true`. Also refetch on `visibilitychange → visible`, because iOS PWAs resume without a focus event.
- **Optimistic mutations** (TanStack `onMutate`): remove the item from the cache, then call:
    - **Confirm:** `financeService.confirmInboxItem`, then `upsertMerchantRule({merchant_key, category_id, is_shared, hit_count+1})`, then `invalidateFinanceCache()`.
    - **Discard:** `resolveInboxItem(id,"discarded")`, with an **Undo** toast for 5 s (`resolveInboxItem(id,"pending")`).
    - **"Same One"** (duplicate hint): `resolveInboxItem(id,"duplicate")`.
    - On error: roll back the cache, then show `Alert variant="danger" title="Couldn't save"` with a retry.
- **Offline.** Add `confirmInboxItem` and `resolveInboxItem` to `MutationType` ([`offlineSyncQueue.ts:25-30`](../../src/services/offlineSyncQueue.ts)). Replay is safe because the RPC returns the existing `expense_id` when the item is already confirmed, and resolve is a plain update. Category guessing, the duplicate hint and FX conversion are all client-side, so triage works offline on the cached list.
- **Edit.** Opens `ExpenseFormModal` with the new `initialValues` prop (Phase 0) and an `inboxItemId` prop. On save, the modal calls `confirmInboxItem` instead of `addExpense`. This covers goal funding, a custom split, FX overrides, remarks and tags with no second form.

### 5.4 Category guess and FX (pure, `src/lib/capture/guessCategory.ts`)

`guessCategory({ merchantKey, rules, recentExpenses, categories })` returns `{ categoryId, confidence: "rule" | "history" | "keyword" | "none" }`:

1. A `merchant_rules` row for the key gives `rule`.
2. Otherwise, the most frequent category among the member's confirmed expenses whose normalised `item` equals the key (≥ 2 hits) gives `history`.
3. Otherwise, a keyword table gives `keyword`. **Extract** the inline keyword logic from `parseBulkExpenseText` ([`expenseParser.ts:49-96`](../../src/lib/expenseParser.ts)) into a shared `findCategoryByKeyword` in this module, and have `expenseParser` import it. This is a refactor with no behaviour change, covered by the existing bulk-add tests.

"Confirm N Matched" applies only to `rule` confidence.

For foreign items, the SGD amount = `convertToSGD(amount, currency)` from cached rates ([`currencyConverter.ts:179`](../../src/lib/currencyConverter.ts)), and the card shows `≈ S$x · US$4.99`. The expense is saved with `buildExpenseFxFields`. If the currency isn't supported or no rate is cached, swipe-confirm is disabled and **Edit** is the primary action (`FxRateField`).

`findLikelyDuplicate(item, expenses)` is the same rule as the server's soft check. The client re-runs it because a manual expense may be added after the capture.

### 5.5 Copy (AGENTS §6)

| Spot | Copy |
|---|---|
| Page header | `Inbox` · Badge `3 to sort` |
| Actions | `Confirm`, `Discard`, `Edit`, `Undo`, `Confirm 4 Matched`, `Same One` |
| Duplicate hint | Alert warning title `Looks logged already`, body `S$12.50 on 5 Nov.` |
| Empty (has token) | Title `All Sorted` · Prompt `New Apple Pay purchases land here.` · CTA `Add Expense` |
| Empty (no token) | Title `No Captures` · Prompt `Set up Auto Capture to skip typing.` · CTA `Set Up` (opens Settings › Auto Capture) |
| Undo toast | `Discarded` · `Undo` |
| Swipe overlay | `Confirm` / `Discard` |
| Unsupported FX | Alert info `Check rate` · `Edit to set the SGD amount.` |

### 5.6 Where the count shows

- **Home:** an Inbox `Card` at the top of `DashboardPage` (above the spendable card, near [`DashboardPage.tsx:118-125`](../../src/pages/DashboardPage.tsx)). It shows only when `pendingCount > 0`: `3 to sort` / `S$84.20 unsorted` with Button `Sort Now`. This is where pacing gaps are shown honestly.
- **Spend tab badge:** a small count `Badge` on the Spend icon in `MobileBottomNav` ([`MobileBottomNav.tsx:59-80`](../../src/components/layout/MobileBottomNav.tsx)) and on the `DesktopSidebar` Spend item. It caps at `9+`. **Not on the FAB**: the FAB means "add", and mixing meanings costs clarity.
- **Expenses page:** a `Button variant="butter" size="sm"` labelled `Inbox (3)` in the `ExpensesPage` header actions ([`ExpensesPage.tsx:319`](../../src/pages/ExpensesPage.tsx)).
- **Add Expense form:** when pending items exist, add-mode shows a chip row `From Inbox` (up to 3 newest). Picking one prefills the form and turns the save into a confirm. Habitual manual loggers then resolve inbox items instead of creating duplicates.
- **App icon badge:** `navigator.setAppBadge(count)` where supported (iOS 16.4+ Home Screen apps with notification permission). Called after the inbox query settles. `clearAppBadge()` at 0.

---

## 6. Token Management UI

Location: a new **Auto Capture** section in the Settings modal (`NotificationSettingsModal`, titled "Settings", [`NotificationSettingsModal.tsx:184-186`](../../src/components/layout/NotificationSettingsModal.tsx)). Put it between Haptics and Push. Extract it as `src/components/settings/AutoCaptureSection.tsx` so the 714-line modal doesn't grow.

### 6.1 List

One row per non-revoked token for the **signed-in member only**:

- Label (TruncatedText) and `•••• a1B9`.
- `text-xs` muted line: `Used 2h ago` or `Never used`.
- `Button variant="ghost" size="sm"` labelled `Revoke`.

Maximum 3 active tokens per member (enforced in `createCaptureToken`).

### 6.2 Create

1. Button `New Token` → `AnimatedModal` with `ModalHeader title="New Token"`.
2. `Input` label `Device` (default `iPhone`).
3. Generate the token on the client:

    ```ts
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = "bb_cap_" + base64url(bytes);          // 43 chars after prefix
    const hash = hex(await crypto.subtle.digest("SHA-256", utf8(token)));
    ```

4. Insert `{household_id, member_id, label, token_hash: hash, token_hint: token.slice(-4)}`.
5. Show:
    - The token once, in a monospace box, with `Copy`.
    - The endpoint URL (`${VITE_SUPABASE_URL}/functions/v1/capture-expense`) with `Copy`.
    - `Alert variant="warning" title="Shown once"`: `Paste it into your Shortcut now.`
    - A `CollapsibleSection` titled `Setup Steps` with the short version of §7.
6. Footer: `Done`.

The plaintext never leaves the browser except via the user's clipboard. Closing the modal drops it from memory.

### 6.3 Revoke

`ConfirmModal variant="danger" title="Revoke Token?"` with body `The Shortcut using •••• a1B9 stops working.` Confirm sets `revoked_at = now()` and takes effect on the next request.

### 6.4 Unavailable states

- **Before the migration** (`available === false`): the section shows `Alert variant="info" title="Needs database update"`, and `New Token` is disabled.
- **Demo mode:** the mock service creates tokens so the UI can be tested. A note says capture only works with Supabase.

---

## 7. iOS Shortcut Setup (user steps)

**Requirements**

- **iOS 17 or later.** The Wallet **Transaction** automation trigger arrived in iOS 17.
- The card must be in Apple Wallet, and its bank must provide Wallet transaction data. Most SG issuers do. Check that recent taps appear under the card in Wallet.
- **Only Apple Pay taps fire the trigger.** Physical card taps, card-number online checkouts and PayNow don't. Those still need manual logging (see the optional manual Shortcut below).
- Shortcut variable names below are as shown on iOS 17/18. Labels can differ slightly between versions, so verify on device.

**Steps**

1. In Budget Bubby, open Settings › **Auto Capture** › `New Token`. Copy the **token**, and keep the endpoint URL handy.
2. Open the **Shortcuts** app › **Automation** tab › **+** (New Automation).
3. Choose **Transaction**.
    - **Card:** select every Apple Pay card you use.
    - **Category / Merchant:** leave as Any.
    - Choose **Run Immediately** (not "Run After Confirmation").
    - Turn **off** "Notify When Run".
    - Tap **Next** › **New Blank Automation**.
4. Add **Format Date**. Date: **Current Date**. Date Format: **ISO 8601**, with "Include ISO 8601 Time" on.
5. Add **Get Contents of URL**:
    - URL: `https://<project-ref>.supabase.co/functions/v1/capture-expense`
    - Tap **›** to expand.
    - **Method:** `POST`.
    - **Headers:** add `Authorization` with value `Bearer ` followed by your token (one space after "Bearer").
    - **Request Body:** `JSON`. Add these fields:
        - `amount` (Text) → **Shortcut Input** › **Amount**
        - `merchant` (Text) → **Shortcut Input** › **Merchant**
        - `card` (Text) → **Shortcut Input** › **Card or Pass**
        - `timestamp` (Text) → **Formatted Date** (from step 4)
6. Fallback, so a failed capture still gets logged:
    1. Add **Get Dictionary Value**: Key `status` from **Contents of URL**.
    2. Add **If** › Dictionary Value › **does not have any value**.
    3. Inside it, add **URL**: `https://<app-host>/expenses?action=new&amount=` **Amount** `&merchant=` **Merchant** `&card=` **Card or Pass**. Use **URL Encode** on Merchant first if it contains `&`.
    4. Add **Open URLs**.
    5. **End If**.
7. Tap **Done**. Test with a small Apple Pay purchase. Within a few seconds it should appear in Budget Bubby › Inbox. **Do not share this Shortcut**, because it contains your token. If you ever do, revoke the token in Settings.

**Fallback caveat (iOS limitation).** **Open URLs** from a Shortcut opens **Safari**, not the Home Screen app. Since iOS 17, Home Screen apps keep storage separate from Safari. Sign in once with your PIN in Safari so the fallback page is logged in. If the phone is offline when you pay, neither path can reach the server, so log that one by hand. A `Show Notification` "Not captured: S$12.50 Grab" inside the If can be added as a reminder.

**Optional: manual "Log Spend" Shortcut** (for physical card or cash), for the Home Screen or Action Button:

1. **Ask for Input** (Number, "Amount").
2. **Ask for Input** (Text, "Where?").
3. The same **Get Contents of URL** as above, with `amount` and `merchant` set from those inputs.

It lands in the same Inbox.

---

## 8. Phase 0: Deep-Link Prefill (no DB, ships first)

This fixes the dead `/expenses?action=new` shortcut and gives the fallback a target.

- **`ExpenseFormModal`:** add `initialValues?: Partial<Pick<CreateExpenseInput, "amount" | "item" | "date" | "time" | "original_currency" | "original_amount" | "remarks">>`. Apply it in the add-mode reset effect next to `initialGoalId` ([`ExpenseFormModal.tsx:415-431`](../../src/components/expenses/ExpenseFormModal.tsx)).
- **`src/hooks/useQuickAddDeepLink.ts`**, used in `AppLayoutInner`:
    - On location change, if `action=new`, parse `amount` (via `parseCapturedAmount`, so `S$12.50` and `US$4.99` work), `merchant`, `card` and `at`.
    - Clamp lengths and ignore invalid values.
    - Call `openQuickAdd(initialValues)`.
    - Strip the params with `replace: true` so refresh or back doesn't reopen the form.
    - The card name goes to `remarks` only if the user expands "More" (see Open Question 2).
- `handleOpenQuickAdd` in [`App.tsx:120-122`](../../src/App.tsx) accepts optional `initialValues` and passes it to the global `ExpenseFormModal` ([`App.tsx:217-224`](../../src/App.tsx)).
- `/fast-log` keeps working unchanged.

---

## 9. Reminders Changes

Extends the existing system: `rules.ts` → `engine.ts` → `push.ts` → `sendReminders.ts` → `sw.ts`.

- **Data source.** Add `getInboxSummary` to `ReminderDataSource` ([`engine.ts:27-41`](../../src/lib/reminders/engine.ts)) and fetch it in the `Promise.all`. In the engine, wrap it so a failure (table missing, or a server `localFallback:false` throw) becomes `{ available:false, pendingCount:0 }`. The hourly cron must never break before the migration.
- **New rule** `checkInboxReminder(summary, currentHour, memberId, todayStr, checkinTime)` in `rules.ts`:
    - Fires when `pendingCount > 0` and the check-in time has passed (same gate as `isPastCheckinTime`, [`rules.ts:122-125`](../../src/lib/reminders/rules.ts)).
    - Key: `reminder-inbox-{member}-{date}` (once per day).
    - Type: `inbox_pending`. Severity: `info`, or `warning` if the oldest item is older than 3 days.
    - Copy: title `3 Purchases to Sort` (≤ 6 words). Message `S$84.20 waiting.` Action `Sort Now`, `actionType: "view_inbox"`.
- **Change `checkDailyCheckinReminder`** ([`rules.ts:153-176`](../../src/lib/reminders/rules.ts)): take `inboxPendingCount`, and return `null` when it is > 0 (the inbox reminder replaces it). The behaviour is otherwise unchanged: fire only if nothing was logged today.
    - Result: **at most one logging nudge a day.** Sort if there is something to sort, otherwise log or no-spend, otherwise nothing.
- **`couple_streak_risk`** is unchanged. The delight plan may restyle it.
- **Types and routing:**
    - Add `"inbox_pending"` to `ReminderType` and `"view_inbox"` to `ReminderActionType` ([`rules.ts:40-61`](../../src/lib/reminders/rules.ts)).
    - `getReminderUrl` maps `view_inbox` to `/inbox` ([`engine.ts:46-70`](../../src/lib/reminders/engine.ts)).
    - `classifyReminder` treats `inbox_pending` as `immediate` (it is not in `ROUTINE_TYPES`, [`push.ts:16-24`](../../src/lib/reminders/push.ts)), so it goes at check-in time like `daily_checkin`.
- **Preferences.** Gate `inbox_pending` with the existing `streak_and_logging` toggle (no new column, so no migration). Rename the row in Settings from "Daily Streak & Spend Check-in" ([`NotificationSettingsModal.tsx:395-403`](../../src/components/layout/NotificationSettingsModal.tsx)) to `Logging Nudges`. Description: `Sort Inbox or log by check-in time` (≤ 8 words).
- **Bell.** `NotificationCenterPopover` shows the reminder through the shared engine with no extra code. Its action button navigates to `/inbox`.
- **`sw.ts`** needs no change. The payload `url` already carries `/inbox`, and `notificationclick` navigates there ([`sw.ts:90-108`](../../src/sw.ts)).
- **App badge.** Cover only the in-app `setAppBadge` (§5.6). A push-time badge from the SW is left for later.

---

## 10. Hooks for the Delight Layer

This plan emits; [`delight-bubby.md`](./delight-bubby.md) consumes. There are no visuals here.

### 10.1 Definitions (pure, `src/lib/logging/dayLogged.ts`)

```ts
/** A member "logged" an SGT date when daily_checkins has a row for it
 *  (any confirmed expense dated that day, inbox confirm, or explicit No Spend).
 *  Captured-but-unsorted inbox items do NOT count. */
export function isDayLogged(checkins: DailyCheckin[], memberId: string, date: string): boolean;
export function countDaysLogged(checkins: DailyCheckin[], memberId: string, since?: string): number;
export function isCoupleDayLogged(checkins: DailyCheckin[], memberIds: string[], date: string): boolean;
```

The source of truth is `daily_checkins`, which already backs streaks. Confirming an inbox item records a check-in for the **purchase date** through the RPC. Sorting yesterday's items fills in yesterday. It does not mark today as logged.

### 10.2 Event bus (`src/lib/logging/loggingEvents.ts`)

A typed wrapper over `window` `CustomEvent`, the same mechanism as the existing `openQuickAdd` ([`App.tsx:160-165`](../../src/App.tsx)). It exports `emitLoggingEvent` and `onLoggingEvent(type, handler) → unsubscribe`, and lives in a `.ts` file for Fast Refresh hygiene.

| Event | Payload | Emitted from |
|---|---|---|
| `inbox:items-arrived` | `{ newCount, pendingCount }` | Inbox query settle, when the count is higher than the last-seen count (localStorage `bb_inbox_last_seen_v1`) |
| `inbox:item-confirmed` | `{ itemId, expenseId, amountSgd, categoryId, usedSuggestion: boolean, via: "swipe" \| "button" \| "batch" \| "edit", remaining }` | Confirm mutation `onSuccess` (also after offline replay) |
| `inbox:item-discarded` | `{ itemId, reason: "discarded" \| "duplicate", remaining }` | Resolve mutation |
| `inbox:cleared` | `{ clearedCount, durationMs, date }` | When pending goes from > 0 to 0 within one triage session. This is the Inbox Zero hook |
| `day:logged` | `{ memberId, date, source: "expense" \| "inbox" \| "no_spend", firstForDate: boolean }` | `financeService.addExpense` / `recordDailyCheckin` / `confirmInboxItem` wrappers ([`financeService.ts:217-225`](../../src/services/financeService.ts), [`:309-315`](../../src/services/financeService.ts)). `firstForDate` is worked out from the cached `dailyCheckins` query |

### 10.3 Read hooks

- `useInboxSummary()` returns `InboxSummary`. Mood inputs are the pending count and the age of the oldest item.
- The existing `useDailyCheckinsQuery` plus `isDayLogged` cover the growth inputs.

**Rule for the delight plan:** never trigger confetti or sound per confirmed item. Celebrate only on `inbox:cleared` and `day:logged.firstForDate`. This keeps triage fast (AGENTS §5D reserves celebration for milestones).

---

## 11. Security Review

| Risk | Mitigation |
|---|---|
| Token theft from the DB | Only the SHA-256 is stored. The token has 256 bits of entropy, so a fast hash is fine (no password-style KDF needed). The hash is readable only by the owning member (RLS `is_own_member`) |
| Token leaks via a shared Shortcut or screenshot | Shown once. Revocable in one tap, effective immediately. A leaked token can **only create pending inbox items** for that member: no reads, no edits, no expense rows. Rate limits cap spam at 150 a day, and triage can discard them |
| Brute force | 2^256 space. Format check before any DB hit. Every auth failure gets an identical 401 |
| Endpoint scope | It uses the service role (RLS-bypassing), so scope is enforced in code: `handleCapture` deps expose only `capture_tokens` (select + `last_used_at`), `merchant_rules` (select), `inbox_items` (count, insert), and `expenses` (single dup-hint select). A unit test asserts the deps object has no other methods |
| Client-side forging of inbox items | `inbox_items` has **no INSERT/DELETE grant** for `authenticated`. Only listed columns are updatable |
| Cross-member tokens | `with check` requires `is_own_member(member_id)`, so a partner can't mint a token for the other |
| Payload abuse | 4 KB cap, length caps, control-character stripping, numeric bounds, and checks in both the DB and the handler. React escapes on render. Merchant text is never used as HTML or in URLs without encoding |
| CSRF / browser abuse | No CORS headers, `OPTIONS` → 405, and auth is a bearer token, not a cookie |
| Replay / double-fire | Idempotency key unique index, which returns `duplicate` |
| Logs | Never log the token, the Authorization header or the raw body. Log only the token id, status code and error code |
| `confirm_inbox_item` | `security invoker`, so RLS still applies to every write. `for update` row lock prevents double confirm |
| Lock-screen privacy | The push shows totals only (`S$84.20 waiting.`), no merchant names |
| Deep-link fallback | Params are only prefill. Nothing saves without the user tapping Save. Lengths are clamped and parsed through the same validators |
| Single household | Tokens resolve member → household directly, so this doesn't depend on the "exactly one household" guard in `sendReminders.ts` |

---

## 12. Tests

All Vitest files live in `tests/`.

| File | Covers |
|---|---|
| `captureParseAmount.test.ts` | `S$12.50`, `$12.50`, `12.5`, `US$4.99`, `¥1,200`, `Rp 150.000`, `₩12,000`, `RM 8.90`, ISO-code override, `-5.00`/`0` → ignored, garbage → error, cap overflow |
| `captureMerchant.test.ts` | Prefix and suffix stripping, idempotent normalisation, title-casing |
| `captureHandler.test.ts` | Fake deps: 405, malformed token, unknown and revoked → 401, 429 minute and day windows, 400 per field, ignore rule, duplicate, soft dup hint, `not_ready`, 201 shape, `last_used_at` touched, **deps surface assertion** |
| `guessCategory.test.ts` | Rule > history > keyword > none. `findLikelyDuplicate` (FX-tolerant) |
| `expenseParser` (existing) | Still green after the keyword extraction |
| `reminders` rules tests | `checkInboxReminder` key stability and gating. `daily_checkin` suppressed when pending > 0. Engine survives a `getInboxSummary` throw. `classifyReminder(inbox_pending) === "immediate"`. `getReminderUrl(view_inbox) === "/inbox"` |
| `dayLogged.test.ts` | `isDayLogged`, `countDaysLogged`, `isCoupleDayLogged` |
| `loggingEvents.test.ts` | Emit and subscribe, unsubscribe, `inbox:cleared` fires once per session |
| `InboxPage.test.tsx` | Renders the guess. Confirm and discard by button and keyboard. Undo restores. Batch confirm. Dup hint → `Same One`. Both empty states. Unavailable state hides it. Unsupported FX forces Edit |
| `AutoCaptureSection.test.tsx` | Create shows the token once and stores only the hash (the mock records the inserted row). Revoke via ConfirmModal. 3-token limit. Unavailable alert |
| `QuickAddDeepLink.test.tsx` | `?action=new&amount=S$12.50&merchant=Grab` opens a prefilled form and strips params. Invalid params are ignored |
| `OfflineSyncAndPerf.test.tsx` (extend) | Offline confirm queues, replays once, and a double replay makes no second expense |
| `e2e/inbox-triage.spec.ts` | Mobile viewport, demo mode with seeded items: swipe right confirms (pointer drag), swipe left + Undo, Inbox Zero empty state, Home card and Spend badge counts update |

**Manual (user):**

1. Apply the migration on a branch DB or during a quiet window, then run `select confirm_inbox_item(...)` against a test row.
2. Deploy the function.
3. Smoke test with `curl -i -X POST … -H "Authorization: Bearer bb_cap_…" -d '{"amount":"S$1.00","merchant":"Test"}'`.
4. Set up the Shortcut and make a real S$1 Apple Pay purchase.

**Quality gate per commit:** `npm run lint` (0/0), `npm run build`, `npm test`. Also `npm run test:e2e` for the UI phases.

---

## 13. Phased Rollout and Commits

Every phase works before the migration is applied.

| Phase | Commits (conventional, small) | Works without migration? | User action |
|---|---|---|---|
| **0. Deep link** | `fix(pwa): open Add Expense from ?action=new with prefill` | Yes (no DB) | none |
| **1. Schema + service** | `feat(db): add capture inbox migration` · `refactor(expenses): share merchant keyword matcher` · `feat(inbox): inbox service methods with pre-migration fallback` · `feat(inbox): mock inbox for demo mode` | Yes (`available:false` hides everything) | Review the SQL |
| **2. Endpoint + tokens** | `feat(capture): parse captured amount and merchant` · `feat(capture): capture-expense edge function` · `build(functions): bundle multiple edge functions` · `feat(settings): Auto Capture token management` | Yes (endpoint → 503, settings shows the alert) | **Apply the migration.** `npm run deploy:functions`. Create a token. Set up the Shortcut (§7) |
| **3. Triage** | `feat(inbox): triage screen with swipe actions` · `feat(inbox): offline confirm and discard` · `feat(inbox): inbox count on Home, nav and app badge` · `feat(inbox): duplicate hints and From Inbox chips` | Yes | Use it for a few days. Seed ignore rules (SimplyGo etc.) |
| **4. Reminders** | `feat(reminders): inbox-aware logging nudge` | Yes (summary failure → today's behaviour) | Redeploy functions so the cron picks up the new rule |
| **5. Delight hooks** | `feat(inbox): logging events and day-logged helpers` | Yes | Hand off to the delight plan |

One PR per phase (or 0+1 and 3+5 combined). Each PR description states what changed, why, and how it was verified. No commits, pushes or PRs without explicit approval (AGENTS §7A).

---

## 14. Open Questions

1. **Devices.** The notifications plan says one Android and one iPhone. This brief says both are iPhones. If one partner is on Android there is no Wallet trigger, so they get the deep link, the manual "Log Spend" path and the Inbox only. Which is right?
2. **Card name on the expense.** `expenses` has no card column. Options:
    - (a) drop it after triage
    - (b) save it to `remarks`
    - (c) add `tags` like `#dbs`
    - (d) a future migration adding `expenses.card_id` matched to `credit_cards` (useful for statement reconciliation)

    The plan defaults to (a).
3. **Partner's Inbox.** RLS lets both members read both inboxes. Should triage show only your own (the default in this plan), or also a read-only `Rachel's Inbox (2)` row?
4. **Shared default.** Should a merchant rule also remember Mine/Shared (the plan does), or should split always default to the last split used?
5. **Foreign transactions.** Confirm at triage time using cached FX (the plan), or keep foreign items pending until the card statement gives the real SGD amount?
6. **Default ignore list.** Seed `ignore` rules for transit (SimplyGo / TransitLink) and petrol pre-auths? Transit fares are usually tracked as one monthly figure.
7. **Shortcut template.** Should the user publish one iCloud Shortcut with an Import Question for the token, so the partner's setup is one tap? The token stays out of the shared link.
8. **Retention.** Is 90 days for resolved inbox items OK? This adds one `pg_cron` job in the same migration.
9. **Capture vs streak.** The plan says captures alone don't count as a logged day; confirming does. Confirm this matches what the delight plan wants for Bubby's growth.
10. **Dependencies.** None are planned (swipe uses pointer events). Say if you'd rather use a gesture/animation library. That would be a new dependency and needs your approval.
