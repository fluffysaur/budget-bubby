# Backlog

Fixes and improvements that are known but not scheduled. Upkeep rules are in AGENTS.md section 7H.

**Tiers**
- **P0:** money or data is wrong.
- **P1:** something is broken or blocks a flow.
- **P2:** friction or polish.
- **P3:** ideas.

Each tier is in priority order, top first. IDs are never reused.

**Format**
```
### BL-000 Title
- **Story:** As a <who>, I want <what>, so that <why>.
- **Where:** file:line
- **Done when:** acceptance criteria
- **Refs:** plan, audit ID or PR
- **DB change:** none | SQL the user must run
```

Audit IDs (H1, M5, 1.14…) refer to [docs/plans/app-polish/audits/](./plans/app-polish/audits/).

---

## P0

### BL-001 Save monthly budgets, so past months don't change
- **Story:** As a couple, we want last month's budget to stay as it was when we edit salary, so that history, surplus and pacing stay true.
- **Where:**
  - `src/services/supabaseFinanceService.ts:840-886`: every month is built live from the current base profile.
  - `updateMonthlyBudget`: returns silently for synthetic ids.
  - Nothing inserts into `monthly_budgets`.
- **Done when:**
  - A month's budget is saved to the existing `monthly_budgets` and `monthly_budget_categories` tables, either when first viewed or when the month ends.
  - Past months are locked (`is_locked`).
  - Editing salary changes only the current and future months.
  - A partner with no base profile gets an empty "no profile" budget, not the other partner's profile (`profs[0]`) and not an invented S$5,000.
  - Edits to a month are saved, or show an error. They are never dropped silently.
- **Refs:** H8. Write a full plan in `docs/plans/` before starting.
- **DB change:** none expected, since the tables and `is_locked` already exist. Check the RLS insert policies first.

---

## P1

### BL-002 Card due day can be 29–31
- **Story:** As a card owner whose bill is due on the 31st, I want the right due date, so that reminders aren't 3 days early.
- **Where:** `src/components/accounts/CreditCardTrackerSection.tsx:263-267` clamps the default statement due date to day 28.
- **Done when:** The due date uses the real day, clamped to the length of the month (31 → 30 in Nov, 28/29 in Feb). Add a unit test for each month length.
- **Refs:** bugs L2.
- **DB change:** none. The `due_day` check already allows 1–31.

### BL-003 Card "paid" toggle fails silently
- **Story:** As a user marking a statement paid, I want to see when it fails, so that I don't think it's paid when it isn't.
- **Where:** `CreditCardTrackerSection.tsx:228-249` `handleTogglePaid` only calls `console.error`.
- **Done when:** A failure rolls the toggle back and shows an `<Alert>` or toast.
- **Refs:** bugs L2.
- **DB change:** none.

### BL-004 Unknown perspective shows every account
- **Story:** As a partner, I want an unrecognised view to show nothing rather than everything, so that the wrong data never appears.
- **Where:** `supabaseFinanceService.getAccounts` (around lines 363-386).
- **Done when:** An unknown perspective returns `[]`, covered by a unit test.
- **Refs:** bugs L4.
- **DB change:** none.

### BL-005 Server-side goal increment
- **Story:** As a couple depositing into the same goal, we want both deposits to count, so that neither overwrites the other.
- **Where:** `ExpensesPage` sweep, goal deposits, `supabaseFinanceService.updateGoal`. PR #1 narrows the race by re-reading the goal first, but the race still exists.
- **Done when:** Deposits use an atomic increment.
- **Refs:** bugs M6.
- **DB change:** an `increment_goal_saved(goal_id, amount)` RPC, run by the user.

---

## P2

### BL-006 Move all saves to `useMutation`
- **Story:** As a user, I want every save to feel instant, so that the app never waits on the network for routine edits.
- **Where:** All `await financeService.x(); await refreshHousehold()` call sites. PR #5 covers expense add and delete only.
- **Done when:** Goal deposit, recurring toggles, account balances, inbox confirm, categories and budgets use `useMutation` with optimistic updates and targeted invalidation.
- **Refs:** motion 4.3, plan app-polish #5.
- **DB change:** none.

### BL-007 Keep a record of settle-ups
- **Story:** As a couple, we want a history of settle-ups, so that we can see who paid whom and when.
- **Where:** `supabaseFinanceService.settleSharedExpenses`.
- **Done when:** Each settle-up stores the amount, the direction, the date and its expense ids, and a list of past settle-ups is shown.
- **Refs:** bugs M11.
- **DB change:** a new table, SQL run by the user.

### BL-008 Compact money format edge cases
- **Story:** As a user, I want `S$1.0M`, not `S$1000.0k`.
- **Where:** `src/lib/currency.ts:44-50` `formatSGDCompact`.
- **Done when:** `999_999` → `S$1M`, `1_950` → `S$1.9k` or `S$2k` (pick one rule and document it), with tests.
- **Refs:** bugs L3.
- **DB change:** none.

### BL-009 One shared sign-out confirm
- **Story:** As a user, I want the same sign-out prompt everywhere.
- **Where:** `DesktopSidebar.tsx` and `AppHeader.tsx` each have their own sign-out `ConfirmModal`, with different copy.
- **Done when:** A single `SignOutConfirm` component is used in both places.
- **Refs:** bugs W2.
- **DB change:** none.

### BL-010 Fonts load without reflow
- **Story:** As a phone user, I don't want headings and numbers to jump when fonts load.
- **Where:** `index.html:17` (Google Fonts with `display=swap`).
- **Done when:** The 2–3 weights in use are self-hosted and preloaded, and either `size-adjust` fallbacks or `font-display: optional` is used for the display font.
- **Refs:** motion 1.14.
- **DB change:** none.

### BL-011 Stop needless re-renders from HouseholdContext
- **Story:** As a phone user, I want scrolling to stay smooth after a refresh.
- **Where:**
  - `HouseholdContext.tsx:136-147`: the context value is not memoized.
  - `OfflineBanner` re-subscribes its listeners on every render.
- **Done when:** The context value is memoized, and the listeners are stable.
- **Refs:** bugs L5, motion 4.6.
- **DB change:** none.

### BL-012 Android capture steps
- **Story:** As the Android partner, I want setup steps for automatic expense capture, so that my card payments land in the Inbox like the iPhone's do.
- **Where:** The Auto Capture settings section and `docs/capture-setup.md`.
- **Done when:** MacroDroid or Tasker steps (reading the payment notification and posting to the capture endpoint) are written and tested on a real phone, and the parsing of notification text is handled. PR #3 shows the Android steps first once they exist.
- **Refs:** docs/plans/README.md user decisions (2026-11-05).
- **DB change:** none.

---

## P3

### BL-013 More visual components
- **Story:** As a phone user, I want owners, due dates and splits shown as visuals instead of text.
- **Where:** The copy audit, section "Visual ideas that need NEW shared components".
- **Done when:** Any of these exist and are used where the copy audit lists them:
  - `AvatarDot` / `AvatarDotGroup` (payer, owner, shared)
  - `CalendarStrip` (upcoming bills, card due dates)
  - `StackedBar` (waterfall, allocations, bonus split)
  - `StatRow`
  - `StatCard` `ring`/`sparkline`/`compact` variants
- **Refs:** copy audit, plan app-polish #9.
- **DB change:** none.

### BL-014 Live updates from your partner
- **Story:** As a couple, we want each other's expenses to appear without reopening the app.
- **Where:** `src/lib/queryClient.ts`. PR #5 adds refetch-on-resume.
- **Done when:** A Supabase realtime subscription on `expenses` (and maybe `inbox_items`) invalidates the matching queries.
- **Refs:** bugs M7.
- **DB change:** maybe enable realtime on the tables, done by the user.

### BL-015 Animated number changes
- **Story:** As a user, I want totals to count up or down when they change, instead of snapping.
- **Where:** `CurrencyText`.
- **Done when:** A `useTweenedNumber` hook drives `CurrencyText` when its `animate` prop is set. It respects reduced motion and uses `tabular-nums`.
- **Refs:** motion section 0.
- **DB change:** none.

### BL-016 Split up the Dashboard for smoother scrolling
- **Where:** `DashboardPage.tsx`.
- **Done when:** It is split into memoized child components. `StatCard` and the card rows use `React.memo`.
- **Refs:** motion 4.6.
- **DB change:** none.

### BL-017 Haptics on key actions
- **Story:** As the Android user, I want a light tap on save and on tab switches.
- **Where:** `feedback.routine` exists, but only the add button uses it.
- **Done when:** Save, delete and tab switch fire the light haptic, gated by the haptics setting.
- **Refs:** motion section 3.
- **DB change:** none.

### BL-018 Pull-to-refresh hijacks diagonal swipes
- **Where:** `PullToRefresh.tsx`, which uses a disambiguation threshold of `0.8`.
- **Done when:** Diagonal swipes inside horizontal scrollers never trigger a refresh.
- **Refs:** motion 4.5.
- **DB change:** none.

### BL-019 Settings button relies on the header listener
- **Where:** `DesktopSidebar.tsx` Settings sends the `openSettings` window event, which only works because `AppHeader` is always mounted.
- **Done when:** The settings modal state lives in a shared context or route, rather than a window event.
- **Refs:** bugs W3.
- **DB change:** none.
