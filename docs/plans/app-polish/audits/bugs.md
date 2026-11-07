# Budget Bubby — read-only bug audit (branch feat/delight-bubby, 2026-11-07)

> Snapshot from 2026-11-07, taken on `feat/delight-bubby` before it merged. Line numbers may drift; search for the quoted code if a line does not match.


Scope: src/lib, src/services, src/hooks, src/context, key pages/components. No files edited.
Confidence: **Confirmed** = traced through the code path. **Plausible** = depends on data or runtime state I could not see.

## Checks

| Check | Result |
|---|---|
| `npm run lint` | exit 0, **1 warning**: `tests/Auth.test.tsx:7` `'AppHeader' is defined but never used` (WIP). This breaks the 0-warning rule. |
| `npx tsc -b --noEmit` | **exit 2**: `tests/Auth.test.tsx(7,1) TS6133 'AppHeader' is declared but its value is never read` (WIP). Same line as the lint warning. |
| `npx vitest run` | 93 files / 828 tests passed |

---

## HIGH

### H1. Offline or any read error silently shows demo seed expenses as real data
- **Where:** `src/services/financeService.ts:316-325` (`getExpenses`)
- **What happens:** If `navigator.onLine` is false, *or the Supabase call throws for any reason*, the app returns `mockFinanceService.getExpenses()`. That is the demo seed dataset from localStorage, not the user's data.
- **Repro 1:** Phone in airplane mode, add an expense. `invalidateFinanceCache()` refetches `["finance","expenses",…]`. The Expenses list, trends and Bubby now show the fake seed expenses plus the new one, replacing the real cached list.
- **Repro 2:** Online, type `coffee, tea` or `(` in the Expenses search box. See H2: PostgREST rejects the `or()` filter, the call throws, and the demo data appears.
- **Repro 3:** An expired JWT or RLS error has the same effect.
- **Impact:** The fake data also feeds surplus, settlement and trend maths.
- **Fix:** Never fall back to mock data in Supabase mode. Throw, so TanStack keeps the last good data and shows the error state. For offline support, merge only the queued optimistic rows into the cached query data.
- **Confidence:** Confirmed.

### H2. Search text is injected unescaped into the PostgREST `or()` filter
- **Where:** `src/services/supabaseFinanceService.ts:1098-1100`
- **What happens:** `query.or(\`item.ilike.%${search}%,remarks.ilike.%${search}%\`)`. A comma, `(`, `)` or `.` in the text breaks the filter grammar. Through H1 that error turns into demo data. A query also fires on every keystroke because there is no debounce.
- **Fix:** Escape or quote the value (wrap in `"…"` and escape `"` and `\`), or filter on the client. Debounce the input.
- **Confidence:** Confirmed by reading the code. I did not check how PostgREST parses each special character.

### H3. Notification popover and push subscription bind the device to whoever is being *viewed*, not the logged-in partner
- **Where:** `src/components/layout/NotificationCenterPopover.tsx:94-95` (`activeMemberId = activeMember?.id || members[0]?.id || "mem-…0011"`), used at lines 141-168, 289-312
- **What happens:** On the iPhone, Partner B switches to the Combined view (or to Partner A's view).
  - `syncPushSubscription(activeMemberId)` upserts this device's endpoint with `member_id` = Partner A. `savePushSubscription` uses `onConflict: 'endpoint'`, so the device now follows Partner A. Partner B's phone gets Partner A's server pushes and stops getting her own.
  - `evaluateAndDispatchReminders` claims Partner A's reminders in the shared notification log, so Partner A's own phone never pushes them.
  - The "No spend today" action records the check-in for Partner A.
- **Fix:** Use `useLoggedInMember().me` for everything that is about the device or user: push sync, claims, read/dismiss state and check-ins. Keep the perspective for display only.
- **Confidence:** Confirmed.

### H4. Offline delete of an expense that was edited offline is never sent to the server
- **Where:** `src/services/offlineSyncQueue.ts:195-221` (`enqueueMutation` dedupe)
- **What happens:** The second clause of the match, `(m.payload)?.id === targetId`, matches *any* queued mutation with that id, including `updateExpense`.
- **Repro:** Offline, edit real expense X (this queues `updateExpense{id:X}`; but see H5), then delete X. The dedupe removes the queued update and returns `cancelled-…` without queueing the delete. After reconnecting, X still exists on the server.
- **Related problem:** For an expense *created* offline and then edited, the queue holds `add{optimisticId:O}` and `update{id:O}`. Replay inserts a new row with a new UUID, then `update(O)` fails on every flush. The edit is lost and the error retries forever.
- **Fix:**
  - Only cancel when the matched mutation is an `addExpense` with `optimisticId === id`. Also drop any queued updates for that id.
  - When replaying an add, map optimistic id to server id and rewrite later mutations that use it.
- **Confidence:** Confirmed.

### H5. Offline edit or delete of a server-side expense fails, and server errors are disguised as "queued offline"
- **Where:** `src/services/offlineSyncQueue.ts:256-305`. Mock lookup at `mockFinanceService.ts:884-888`.
- **What happens:**
  - `updateExpense` offline calls `mockFinanceService.updateExpense(realUuid)`. The mock store has no such row, so it throws `Expense with id "…" not found` and nothing is queued. Offline edits of real data always fail.
  - `addExpense`, `updateExpense`, `deleteExpense` and `bulkAddExpenses` catch *every* backend error, not only network errors. An RLS rejection or validation error therefore returns a fake optimistic success, and the mutation sits in the outbox failing on every flush. `confirmInboxItem` already uses `isNetworkError` correctly.
  - A timeout after the server committed the insert leads to a duplicate on replay, because there is no idempotency key.
- **Fix:**
  - Fall back to the queue only when `isNetworkError(err)` is true.
  - Queue the update without the mock (patch the TanStack cache optimistically instead).
  - Send a client-generated UUID as the expense `id` so replay can upsert.
- **Confidence:** Confirmed.

### H6. Offline outbox is not flushed on app launch, and the UI is not refreshed after a flush
- **Where:** `src/services/offlineSyncQueue.ts:540-547` (only the `online` event triggers a flush). Race with `src/components/pwa/OfflineBanner.tsx:45-63`.
- **What happens:**
  - **Repro:** Queue expenses offline, swipe the PWA closed, reopen it online. No `online` event fires, so the queue sits until the next connectivity flip. The banner says "Will sync automatically".
  - On reconnect, `OfflineBanner` calls `refreshData()` at the same time as `flushOutbox()`. The refetch often finishes first. `flushOutbox` calls the backend directly and invalidates nothing, so queued expenses stay missing for up to 5 minutes (`staleTime`).
  - `flushOutbox` writes `saveOutbox(remainingQueue)`, which drops any mutation enqueued while the flush was running.
  - Retries have no limit, and failures are not shown to the user.
- **Fix:**
  - Call `flushOutbox()` on startup and on `visibilitychange`.
  - Call `queryClient.invalidateQueries({queryKey:['finance']})` after a flush.
  - Re-read the outbox and merge instead of overwriting it.
  - Show items that keep failing.
- **Confidence:** Confirmed.

### H7. Month-end sweep banner can offer to sweep a surplus computed from mock salary data
- **Where:**
  - `src/pages/ExpensesPage.tsx:107-118`: falls back to `mockCategories`, `mockBaseProfiles` and `mockBaseAllocations` when the queries are empty *or still loading*.
  - `ExpensesPage.tsx:297-307` and `src/lib/financialFormulas.ts:878-880` (cap falls back to a hard-coded `1500`), 958-997.
- **Repro:** Cold-open Expenses. While `baseProfilesData` is undefined and `allExpensesData` is undefined (so `allExpenses` = current month only), last month's spend is 0 and the cap comes from mock salaries. "S$X unspent from Oct" appears. Tapping Sweep writes `saved_so_far += amount` to real goals (`ExpensesPage.tsx:167-180`).
- **Also wrong even after loading:**
  - The detector ignores the real `monthlyBudget` and recurring spend, so its figure disagrees with the Budget page.
  - A household with no base profile gets a fake S$1,500 surplus every month.
- **Fix:**
  - Remove the mock fallbacks in production mode.
  - Gate the banner on every query having `isSuccess`.
  - Compute the surplus from `useBudgetDetailQuery(lastMonth)` (`spendableRemaining`).
  - Never use a hard-coded cap.
- **Confidence:** Confirmed by reading. How long the window lasts depends on network timing.

### H8. Budgets are never persisted, so editing salary rewrites every past month; a partner without a profile gets the other partner's salary
- **Where:** `src/services/supabaseFinanceService.ts:840-886`. Nothing in `src/` inserts into `monthly_budgets`; it is only selected or updated. `updateMonthlyBudget` returns silently for synthetic ids (line 1046).
- **What happens:**
  - All months are synthesized live from the *current* base profile. Change gross salary in November and July–October budgets, caps, the surplus history and pacing all change after the fact.
  - `profs.find(p => !memberId || p.owner_id === memberId) || profs[0]`: if Partner B has no base profile, her budget uses Partner A's salary and allocations. Combined view then double-counts Partner A's income.
  - With no profile at all, the budget uses `gross = 5000`, an invented salary.
- **Fix:**
  - Snapshot a `monthly_budgets` row when a month is first viewed, or lock past months. Note the memory rule: no remote migrations, so do this with existing columns.
  - Return an empty "no profile" budget instead of `profs[0]` or 5000.
- **Confidence:** Confirmed by reading code.

---

## MEDIUM

### M1. Joint recurring items are double-counted in the Combined budget
- **Where:** `src/lib/recurringItems.ts:121-127` and `financialFormulas.ts:1053-1060` (both include `owner_id === "joint"` for each member), summed by `src/lib/combineMonthlyBudgets.ts:56-110`.
- **What happens:** A joint S$100 subscription counts S$100 in each member's budget, so S$200 in Combined. The same goes for joint insurance and tax deductions. Trends in household mode count it once, so Home/Budget disagree with Expenses.
- **Why this is not certain:** The Add Recurring UI no longer offers "Joint" (`AddRecurringModal.tsx:310`), so this only affects legacy rows.
- **Fix:** Split joint items 50/50 per member, or skip joint items in per-member budgets and add them once when combining.
- **Confidence:** Confirmed logic; plausible data.

### M2. Insurance and tax deductions ignore start/end dates
- **Where:** `src/lib/financialFormulas.ts:1053-1092`. Used by `supabaseFinanceService.ts:854, 918`.
- **Repro:** A policy with `end_date` 2026-03 still reduces take-home in Nov 2026. A policy starting 2027-01 already reduces it now. Spend items do check `isRecurringItemActiveInMonth`, so the two are inconsistent.
- **Fix:** Pass `month` and filter with `isRecurringItemActiveInMonth`.
- **Confidence:** Confirmed.

### M3. Combined view on Partner B's phone defaults the payer to Partner A
- **Where:** `src/components/expenses/ExpenseFormModal.tsx:219-223, 381-384` (`activeMember ? … : members[0]`)
- **What happens:** The payer field is folded into "More", so Partner B easily logs expenses as paid by Partner A. That flips the settlement direction. `BulkAddExpenseModal.tsx:85-95` already falls back to `loggedInPartner`.
- **Fix:** Default to `useLoggedInMember().me`.
- **Confidence:** Confirmed.

### M4. Mock IDs silently reassigned to the first member or category on save
- **Where:**
  - `supabaseFinanceService.ts:1116-1142` (`addExpense`)
  - `supabaseFinanceService.ts:704-722, 776-782` (`updateBaseProfile`)
  - `HouseholdContext.tsx:99-104` (`members` = `mockMembers` while the overview loads or fails)
- **Repro:** Offline cold start, or overview still loading. The payer is `mem-00000000-0011`. On replay the name match (a hard-coded member-name match) fails, so `members[0]` is used and the expense is attributed to the wrong partner. Unknown category ids become `categories[0]`.
- **Fix:** Reject non-UUID ids in Supabase mode. Do not render member pickers until the real members have loaded.
- **Confidence:** Confirmed fallback; plausible trigger.

### M5. `updateBaseProfile` is not atomic, and a 0% CPF rate cannot be saved
- **Where:** `supabaseFinanceService.ts:746` (`Number(rate) || 0.20` turns 0 into 20%), 766-805 (delete all allocations, then insert)
- **What happens:**
  - If the insert fails (for example a duplicate after mapping categories to `categories[0]`), the member's allocations are already deleted and the budget becomes empty.
  - A member with no CPF (foreigner or self-employed) is forced to 20%.
- **Fix:** Use an upsert followed by deleting rows not in the new set, or an RPC. Use `?? 0.2` instead of `|| 0.20`.
- **Confidence:** Confirmed.

### M6. Read-modify-write on goal balances loses concurrent updates
- **Where:** `src/pages/ExpensesPage.tsx:167-176` (sweep). `supabaseFinanceService.updateGoal` (1284-1309) does the same.
- **What happens:** `saved_so_far: goal.saved_so_far + alloc.amount` uses the *cached* goal, which can be up to 5 minutes stale. If the partner deposited in that window, their deposit is overwritten.
- **Fix:** Increment on the server: an RPC, or `rpc('increment_goal')` built with existing SQL objects only.
- **Confidence:** Confirmed.

### M7. Partner's changes are not seen when the app resumes
- **Where:** `src/lib/queryClient.ts:10-13` (`staleTime` 5 min, `refetchOnWindowFocus: false`, `refetchOnMount: false`). There is no realtime subscription.
- **Repro:** Partner A adds an expense. Partner B brings the PWA back from the background and sees the old totals or settlement until 5 minutes pass and she navigates. Only inbox and check-ins refetch on focus.
- **Fix:** Enable `refetchOnWindowFocus` for `["finance"]` (TanStack wires it to `visibilitychange`), or add Supabase realtime on `expenses`.
- **Confidence:** Confirmed.

### M8. Unbounded selects hit PostgREST's 1000-row cap without any sign
- **Where:**
  - `getExpenses()` with no filter (`useAllExpensesQuery`)
  - `getAllAccountSnapshots` (ordered **ascending**, so the *newest* snapshots are cut off)
  - `getDailyCheckins`
- **What happens:** After about 1000 snapshots, the net-worth trend freezes. After about 1000 expenses, the all-expenses trends and surplus become incomplete.
- **Fix:** Paginate, or filter by a date window (trends only need about 6 months). Order snapshots descending, or select the latest per account.
- **Confidence:** Confirmed code; plausible data volume.

### M9. Notification settings number inputs clamp on every keystroke
- **Where:** `src/components/layout/NotificationSettingsModal.tsx` (`budget-warning-pct-input` about line 524, `settlement-threshold-input` about line 553)
- **Repro:**
  - Clear the field and type `65`: "6" clamps to 50, so you get "505" and then 99.
  - Typing `300` for the cap: "3" becomes 10. A cleared field resets to 80 or 200.
  - Every keystroke also writes to the backend.
- **Fix:** Keep a local draft string and clamp and save on blur.
- **Confidence:** Confirmed.

### M10. "Today/Yesterday" chips go stale when the modal stays open past midnight
- **Where:** `src/components/expenses/ExpenseFormModal.tsx:521-533` (`useMemo(..., [])`)
- **What happens:** If the modal component stays mounted (the PWA is left open overnight), "Today" sets yesterday's date.
- **Fix:** Derive the dates from `useSgtClock().today`.
- **Confidence:** Plausible (depends on whether the modal stays mounted).

### M11. Settle-up marks every unsettled shared expense, including ones added after the amount was shown
- **Where:** `supabaseFinanceService.ts:1233-1242`
- **What happens:** The partner adds a shared expense while the Settle modal is open. Confirming marks it settled without it being in the displayed figure. No settlement record is kept.
- **Fix:** Settle by the explicit list of expense ids that made up the shown amount.
- **Confidence:** Confirmed.

### M12. First-launch notification prompt is triggered without a user gesture (iOS)
- **Where:** `src/lib/notificationScheduler.ts:96-110`, called on mount from `NotificationCenterPopover.tsx:137`
- **What happens:** iOS PWAs only allow `requestPermission` from a user gesture. The call fails, `bb_notif_initial_prompted` is still set, and the app never asks again. This is a problem for the iPhone partner.
- **Fix:** Only prompt from a button tap.
- **Confidence:** Plausible.

---

## LOW

- **L1.** `src/lib/dateUtils.ts:183-202` `addMonths("2026-01-31", 1)` returns `2026-03-03` (day overflow). Current callers only pass `YYYY-MM`, so nothing is broken yet. Clamp with `clampDueDay`. *Confirmed latent.*
- **L2.** `CreditCardTrackerSection.tsx:263-267`: the default statement due date is clamped to day 28 instead of the real day (31 becomes 28). `handleTogglePaid` (228-249) swallows errors with only `console.error`, so the user sees nothing. *Confirmed.*
- **L3.** `src/lib/currency.ts:44-50` `formatSGDCompact(999_999)` gives `S$1000.0k`. `formatSGDCompact(1_950)` gives `S$2.0k`. *Confirmed.*
- **L4.** `supabaseFinanceService.getAccounts` (363-386): an unknown perspective returns **all** accounts instead of none. *Confirmed.*
- **L5.** `HouseholdContext.tsx:136-147`: `contextValue` is not memoized, so every consumer re-renders on each provider render. `OfflineBanner`'s effect depends on `household` and re-subscribes its listeners on every render. *Confirmed perf.*
- **L6.** `AnimatedModal.tsx:421-445`: every open modal adds its own window `Escape` listener and body-overflow save/restore. Stacked modals (a ConfirmModal over a form) all close on one Esc, and closing them out of order restores the wrong overflow. *Plausible.*
- **L7.** `PWAUpdateToast.tsx:36` uses hard-coded `slate`/`white` colours instead of tokens (dark-mode drift). `OfflineBanner` amber/sky/emerald bars do the same.
- **L8.** `RecurringPage.tsx:81-110`: perspective filtering hard-codes member name strings and mock IDs. When the perspective is a member UUID, joint items are excluded even though budgets include them (see M1).

---

## In-progress (uncommitted) changes on feat/delight-bubby

- **W1.** `tests/Auth.test.tsx:7` has an unused `AppHeader` import. It causes the lint warning and the `tsc -b` failure, so the quality gate fails. *Confirmed.*
- **W2.** `DesktopSidebar.tsx`: the sign-out `ConfirmModal` calls `signOut()` and then closes. The header version closes first. This is harmless, but sign out now exists in two places with two copies of the text ("You will need your PIN…" vs "6-digit PIN"). Consider one shared component.
- **W3.** `DesktopSidebar.tsx`: Settings now relies on the `openSettings` window event, which `AppHeader` listens for (lines 102-107). That works because `AppHeader` is always mounted on desktop. If the header is ever lazy-loaded or hidden on a route, the Settings button silently does nothing. Low.
- **W4.** All new tokens used in the diff exist in `src/index.css` (`--accent-mint-ink`, `--pastel-mint-dark`, `--accent-coral`, `--border-subtle`). In `App.tsx` the skeleton still pairs `bg-(--border-subtle)/60` with `dark:bg-slate-800`. `--border-subtle` already has a dark value (#38322e), so the `dark:` override is redundant and off-palette. Cosmetic.
