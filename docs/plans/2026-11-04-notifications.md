# Notifications Overhaul Plan

Date: 2026-11-04
Status: Phases 1 and 2 merged (#10, #14). Phase 3 implemented on `feat/server-push` (uncommitted).

## Problem

Notifications are worked out in the browser on every app launch
([`src/lib/notificationScheduler.ts`](../../src/lib/notificationScheduler.ts)).
Push dedup is kept in `sessionStorage` (`bb_notif_dispatched_*`), which is
cleared whenever the PWA is closed, so every active alert is pushed again on
each cold launch. For example, "Dining Nearing Cap" arrives again the next day.

Other issues found:

| Issue | Where |
|---|---|
| Settlement reminder ID includes `Math.floor(netBalance)`, so every new shared expense creates a "new" alert | `checkSettlementReminder` |
| Goal-behind ID has no time key, so once it's dismissed it never comes back | `checkGoalPacingReminders` |
| One push per partner shared expense (noisy) | `checkPartnerSharedSpendReminders` |
| Dismissals are stored per device in `localStorage` | `dismissReminderId` |
| No server push. The "6 PM check-in" only fires if the app is opened after 6 PM | whole engine |
| "Check In Now" silently records a `no_spend` check-in | `NotificationCenterPopover.handleAction` |
| Month/day keys use `toISOString()` (UTC) when a `referenceDate` is passed, not SGT | `computeActiveReminders`, several checkers |
| `haptics_enabled` is in the `NotificationPreferences` type but no migration adds the column, so preference upserts probably fail and silently fall back to `localStorage` (verify) | `20261029_notification_preferences.sql`, `supabaseFinanceService.updateNotificationPreferences` |
| Copy breaks the concise copy rule ("Daily Spend Check-in (Evening)", "Couple Streak At Risk! 🔥") | all checkers |

## Decisions

1. **Sent, read and dismissed state lives in Supabase** (`notification_log`), per member, shared across devices.
2. **Push once per cycle, keep it in the bell.** A push fires once per reminder key. The bell keeps showing an alert while its condition is still true and it hasn't been dismissed.
3. **Budget limits:** one push at "nearing" (≥ warning %) and one at "exceeded" (≥ 100%), per category per month. Going back and forth over the line in the same month doesn't push again. Changing the warning % mid-month doesn't push again.
4. **Once-per rule for each type:**

    | Type | Reminder key (once per…) | Recipient |
    |---|---|---|
    | `daily_checkin` | `checkin-{member}-{date}` | owner |
    | `balance_update` | `balance-{member}-{month}` | owner |
    | `credit_card_due` | `cc-due-{stmt}-d{offset}` for each configured offset (7/3/1/0), plus `cc-due-{stmt}-overdue` | card owner |
    | `credit_card_missing_stmt` | `cc-missing-{card}-{month}` | card owner |
    | `partner_shared_spend` | `partner-spend-{member}-{date}`: one daily summary | partner who didn't pay |
    | `settlement_due` | `settlement-{member}-{month}` (threshold crossed) and `settlement-monthend-{member}-{month}` | both |
    | `couple_streak_risk` | `couple-streak-{member}-{date}` | member who has checked in |
    | `budget_limit` | `budget-{nearing\|exceeded}-{member}-{category}-{month}` | owner |
    | `recurring_bill_due` | `recurring-{item}-{dueDate}` | owner |
    | `goal_pacing` (behind) | `goal-behind-{goal}-{month}` | both |
    | `goal_pacing` (achieved) | `goal-achieved-{goal}` | both |
    | `monthly_budget_review` | `budget-review-{member}-{month}` | owner |

    All dates and months are in Singapore time.

    As built, IDs keep the existing `reminder-…` prefix, so old dismissals carry over. Only CC due, settlement, goal behind and partner spend got new IDs (for example `reminder-cc-due-{stmt}-d3`, `reminder-settlement-monthend-{member}-{month}`).

5. **CC due offsets** are chips in Settings: 7, 3 and 1 days before, plus the due day. All are on by default and each can be turned off. A push fires for the most urgent offset reached that hasn't been sent yet, so opening the app first at 2 days out sends `d3` only.
6. **"Check In Now"** is replaced by two buttons on the check-in reminder card: **No Spend** (records an explicit no-spend check-in) and **Add Expense** (opens Quick Add). No check-in sheet exists, so the card serves as one. The couple-streak reminder's action now opens the dashboard instead of recording a check-in.
7. **Permission prompt** stays on first launch (unchanged).
8. **Copy pass:** titles ≤ 6 words and one short message, with no filler or emoji. Examples: `Dining at 85%` / `S$120 left`. `Citi Due in 3 Days` / `S$1,240 statement`.
9. **Bell number** counts unread alerts. Opening the bell or tapping a push marks alerts read.
10. **Real scheduled pushes:** a server-side cron sends every push, and the browser stops sending pushes. The bell still works out its list live from the data.
11. **Timing (SGT):** the cron runs every hour.
    - Routine alerts are bundled into one push at about 9 AM.
    - Check-in and couple streak alerts go at the member's check-in time (default 6 PM).
    - Budget and settlement-threshold alerts go on the next hourly run.
    - Urgent alerts (CC due in ≤ 1 day, budget exceeded) always push on their own.
    - Quiet hours (default 10 PM to 8 AM) hold pushes until they end.
    - Check-in time and quiet hours are adjustable.
12. **Tapping a push** opens the relevant screen (budget category, card statement, recurring item, goal) and marks the alert read.
13. **Devices:** one Android (Chrome) and one iPhone, both installed on the Home Screen. No install hint is needed.
14. **Rollout:** all changes are additive, so no compatibility view is needed. A brief overlap with the old on-launch pushes is acceptable until both phones update.
15. **Retention:** the cron deletes `notification_log` rows older than 90 days.
16. **Migrations** are added as files only. The user applies them to the live database.

## Phase 1: Fix repeats (`fix/notification-dedup`)

Goal: each push fires once per cycle, using the existing browser-based sending.

### Migration `20261105100000_notification_log.sql`

```sql
create table if not exists notification_log (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    member_id uuid not null references household_members(id) on delete cascade,
    reminder_key text not null,
    type text not null,
    sent_at timestamptz,
    read_at timestamptz,
    dismissed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint unique_member_reminder_key unique (member_id, reminder_key)
);
create index if not exists idx_notification_log_member_id on notification_log(member_id);
create index if not exists idx_notification_log_created_at on notification_log(created_at);
-- RLS: same "Allow household access" policy as recurring_items (is_household_member)
```

### Code

- **Split the engine** so the pure rules can be reused by the Edge Function in Phase 3:
    - `src/lib/reminders/rules.ts`: the pure `check*` functions. They take data, preferences and an SGT reference date, and return `AppReminder[]` with the new keys from Decision 4. They don't import `financeService` or `window`.
    - [`src/lib/notificationScheduler.ts`](../../src/lib/notificationScheduler.ts): only fetching and dispatching.
- **Fix SGT handling:** replace every `referenceDate.toISOString().slice(...)` with SGT-aware `dateUtils` helpers.
- **Add service methods** to `financeService`, implemented in both `supabaseFinanceService` and `mockFinanceService`:
    - `getNotificationLog(memberId, keys?)`
    - `claimNotificationSend(memberId, reminder)`: `upsert … onConflict: member_id,reminder_key, ignoreDuplicates: true` then `.select()`. A returned row means this caller owns the send. An empty result means it was already sent or dismissed.
    - `markNotificationsRead(memberId, keys)` and `dismissNotification(memberId, key)`: upserts that set `read_at` / `dismissed_at`.
- **`evaluateAndDispatchReminders`:** push only when `claimNotificationSend` returns a row. Remove the `sessionStorage` and `inFlightDispatches` dedup.
- **Move dismissals:** the bell reads dismissed and read state from `notification_log`. On first load, migrate the existing `bb_notif_dismissed_{member}` entries into the table (best effort), then delete the key.
- **Fallback:** `src/services/localNotificationLog.ts` is the mock service's store, and the Supabase service falls back to it if `notification_log` can't be reached (for example, before the migration is applied).
- **Rule changes:** settlement key (no balance in the key), goal-behind month key, partner-spend daily summary (one reminder that lists the count and total), and CC due offsets. Phase 1 uses `[cc_due_days_before]` until Phase 2 adds the array.
- **[`NotificationCenterPopover.tsx`](../../src/components/layout/NotificationCenterPopover.tsx):**
    - Badge shows unread count. Opening the bell marks visible alerts read.
    - "Check In Now" opens the check-in sheet.
- **Copy pass** over all titles, messages and action labels, following the copy rule.

### Tests

- Unit tests in `tests/` for each rule: key stability across days in the same cycle, and new keys in the next cycle.
- Budget: nearing → exceeded → drop below → exceeded again in the same month sends 2 pushes in total.
- Settlement: the balance changes within a month and still sends only 1 push.
- `claimNotificationSend` is idempotent in the mock service. Calling dispatch twice sends 1 push.
- Update `tests/StreakAndNotifications.test.tsx` to the new copy and keys.
- E2E: open the bell, then check that the badge clears and a dismissed alert stays dismissed after reload.

## Phase 2: Settings (`feat/cc-due-reminders`)

### Migration `20261105110000_notification_preferences_timing.sql`

```sql
alter table notification_preferences
    add column if not exists cc_due_reminder_days integer[] not null default '{7,3,1,0}',
    add column if not exists checkin_time time not null default '18:00',
    add column if not exists quiet_hours_start time not null default '22:00',
    add column if not exists quiet_hours_end time not null default '08:00',
    add column if not exists haptics_enabled boolean not null default true;
alter table notification_preferences
    add constraint notification_preferences_cc_due_days_check
    check (cc_due_reminder_days <@ array[0,1,2,3,4,5,6,7,14]);
-- Keep cc_due_days_before for the deployed frontend. Drop it in a later migration.
```

### Code

- Add the new fields to `NotificationPreferences` and to the defaults in both services and `evaluateAndDispatchReminders`.
- [`NotificationSettingsModal.tsx`](../../src/components/layout/NotificationSettingsModal.tsx):
    - Replace the `cc_due_days_before` input with toggle chips: `7d`, `3d`, `1d`, `Due day`.
    - Add a check-in time picker and quiet-hours start and end pickers.
    - Toggle descriptions stay under 8 words.
- Rules read `cc_due_reminder_days` and the check-in time (also used for the couple streak reminder).
- Quiet hours are already respected by the browser sender: during quiet hours nothing is claimed, so held reminders push on the first app open after they end. Phase 3 moves this to the server.
- Turning chips on or off also writes `cc_due_days_before` as the largest selected offset (clamped to 1–14), so the old frontend keeps a sensible value.
- Reading preferences fills fields missing from older rows with defaults and trims Postgres `time` values to `HH:MM`.
- The preference save now checks the Supabase error instead of ignoring it. The migration adds the missing `haptics_enabled` column, which was making every save fail.

### Tests

- The CC offset picker chooses the most urgent offset reached, and offsets that are turned off never fire.
- The settings modal saves and reloads all new fields.

## Phase 3: Real scheduled pushes (`feat/server-push`)

### Spike result

- The app's Supabase service scopes almost every query through RLS, not explicit `household_id` filters. **Decision:** the server reuses that service with a service-role client, and refuses to run unless exactly one household exists. No budget, goal or settlement logic is duplicated.
- The Edge Function can't import the app's TypeScript directly (extensionless imports, `import.meta.env`). `npm run build:functions` uses Vite in library mode to bundle `src/server/sendReminders.ts` into `supabase/functions/_shared/dist/send-reminders.js`. That file is gitignored. `envPrefix` is set so no `VITE_*` values end up in the bundle.
- `@supabase/supabase-js` stays external and is resolved by the function's `deno.json` import map, along with `npm:web-push`.

### As built

```
src/lib/reminders/
├── rules.ts          # pure rules (Phase 1-2)
├── engine.ts         # computeRemindersFrom(source, options) + getReminderUrl
├── push.ts           # classify / selectForPush / buildPushMessages
└── pushMessage.ts    # PushMessage + withReadKeys (no imports; used by sw.ts)
src/server/sendReminders.ts      # runSendReminders(deps) + createSupabaseSendDeps(client)
src/lib/pushSubscription.ts      # syncPushSubscription, isServerPushEnabled
src/sw.ts                        # injectManifest service worker
supabase/functions/send-reminders/{index.ts,deno.json}
supabase/migrations/20261106090000_push_subscriptions.sql
supabase/migrations/20261106091000_notification_cron.sql
```

- **Service:** `SupabaseFinanceServiceImpl(client?, { localFallback })`. The server passes `localFallback: false`, so notification-log errors throw instead of being recorded in memory, which would push again every hour. Marking read now updates existing rows first, so the `type` set when the alert was pushed is kept.
- **Selection:** pushes are sorted into three groups.
    - *Urgent* (CC due ≤ 1 day or overdue, budget exceeded): one push each.
    - *Routine* (balance, CC due, statement missing, recurring, budget review, goals, partner spend): from 9 AM, bundled as "N Reminders" when there are two or more.
    - *Immediate* (check-in, couple streak, budget nearing, settlement): one push each on the next run.
    - Nothing is pushed during quiet hours, and held alerts go out on the first run after.
- **Server push mode** is on when `VITE_VAPID_PUBLIC_KEY` is set. The app then stops sending pushes itself and only subscribes the device. Without the key, Phase 1–2 behavior is unchanged.
- **Tapping a push:** the service worker opens or focuses the app at `url?read=key1,key2`. The bell marks those keys read and removes the parameter. Each tap opens the right page; only goals also highlight the item (`?goalId=`).
- **Notification icon:** fixed to `/pwa-192x192.png`. The old `/icons/icon-192x192.png` path didn't exist.

### Tests

- `tests/sendReminders.test.ts`: classification, the morning bundle, message building, URLs and read keys, the single-household guard, once per key across hourly runs, dry run, skips (push off, no devices, quiet hours), and removing devices that are gone.
- `tests/serverPush.test.tsx`: subscribe and save, unsubscribe and delete, no-op without a key, no app-sent pushes in server mode, and `?read=` handling.
- Browser smoke test (Playwright, production build): the service worker registers, a push delivered through DevTools shows the notification with the right data, and there are no page errors.

## Rollout

1. Merge Phase 1, apply `notification_log`, and deploy. *(done)*
2. Merge Phase 2, apply the timing migration, and deploy. *(done)*
3. Phase 3, in this order:
    1. Generate VAPID keys: `npx web-push generate-vapid-keys`.
    2. Set the function secrets: `npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=<random>`.
    3. Deploy the function: `npm run deploy:functions`. This builds the bundle and deploys with `--no-verify-jwt`, since the function checks `CRON_SECRET` itself.
    4. Apply `20261106090000_push_subscriptions.sql`.
    5. Create the two Vault secrets listed at the top of `20261106091000_notification_cron.sql`, then apply that migration.
    6. Set `VITE_VAPID_PUBLIC_KEY` in Vercel and redeploy the frontend.
    7. Open the app once on each phone, so it subscribes.
    8. Check with a dry run: `curl -X POST <function-url> -H "Authorization: Bearer <CRON_SECRET>" -d '{"dryRun":true}'`.
4. In a later migration, drop `cc_due_days_before` once every client is on the new version.

## Out of scope

- Email or SMS channels.
- Real-time push on every partner expense (replaced by the daily summary).
