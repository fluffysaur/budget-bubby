# App Polish Plan: bugs, smoothness, less text

Nine PRs in four lanes. They fix data bugs found in a full audit, make the app feel smooth on phones, and cut text in favour of visuals.

Read this whole section before starting any PR.

## How to use this plan

- **Agent-agnostic.** Any coding agent can run this, and it may use sub-agents. Each PR section stands alone: an agent can start from it plus AGENTS.md.
- **Lanes run in parallel.** PRs inside a lane run in order. Dependencies across lanes are listed on each PR.
- **Model choice** (tiers from AGENTS.md section 8):
  - **strong**: `pro` / `inherit`
  - **fast**: `flash`
  - running checks, grepping and summarising test output: `flash_lite`

  Every PR gets a final review on **strong** before it is raised.
- **Source findings.** These live in [app-polish/audits/](./app-polish/audits/): `bugs.md`, `motion.md` and `copy.md`. IDs like `H1`, `M5`, `1.6` and `2.4` refer to them. Line numbers come from a snapshot taken before `feat/delight-bubby` merged. If a line does not match, search for the quoted code.
- **Backlog.** Anything you find but don't fix becomes a GitHub issue labelled `backlog` (AGENTS.md section 7H). Do not widen a PR. Run `gh issue list --label backlog` to see what is already known.

## Audit findings already tracked as issues

These findings are **not** fixed by the 9 PRs (or only partly). Do not open duplicates, and don't widen a PR to cover them.

| Audit ID | Issue | Note |
|---|---|---|
| H8 | #33 | Past budgets change when salary changes (P0) |
| L2 | #34, #35 | Card due day capped at 28; "paid" toggle fails silently |
| L4 | #36 | Unknown perspective shows every account |
| M6 | #37 | PR #1 narrows the race; the atomic increment stays here |
| motion 4.3 | #38 | PR #5 covers expense add/delete only |
| M11 | #39 | PR #4 settles by expense id; the settle-up history stays here |
| L3 | #40 | Compact money format |
| W2 | #41 | Two sign-out confirms |
| motion 1.14 | #42 | Font reflow |
| L5, motion 4.6 | #43, #48 | Context re-renders; Dashboard split |
| copy audit (platform) | #44 | Android capture steps |
| copy audit (new components) | #45 | Components PR #9 skips |
| M7 | #46 | PR #5 adds refetch on resume; realtime stays here |
| motion section 0 | #47 | Animated number changes |
| motion section 3 | #49 | Haptics on key actions |
| motion 4.5 | #50 | Pull-to-refresh diagonal swipes |
| W3 | #51 | Settings opens via a window event |

## Rules for this plan (one-off exception)

The user has approved these for the PRs in this plan only. AGENTS.md section 7A still applies everywhere else.

- The agent may **commit, push and open PRs** for PRs #1–#9 without asking each time.
- The agent **never merges**. Never force-push to shared branches. Never push to `main`.
- **Stacked PRs.** If a PR depends on one that is not merged yet, branch from the parent branch and open the PR with `--base <parent-branch>`. GitHub retargets it to `main` when the parent merges. If the parent is already merged, branch from an up-to-date `main`.
- **Quality gate before raising each PR.** `npm run lint` must show 0 errors and 0 warnings. `npm run build` and `npm test` must pass. Run `npm run test:e2e` for every PR that changes UI. Report failures as they are.
- **Screenshots.** Every PR that changes UI attaches before/after screenshots, following AGENTS.md section 7G. They come from demo data only, and the PR body must not include names or real figures.
- **Live DB.** No migrations and no SQL against the live DB. Fixes that need a DB change become `backlog` + `needs-db` issues.
- **Dependencies.** The only dependency allowed is `motion`, in PR #6 (the user approved it).
- **Worktrees.** Remove any git worktree you create once its PR is raised.

## Lanes

```
Lane A  #1 fix/demo-data-fallback ──► #2 fix/offline-queue ──► #5 feat/query-smoothness ─┐
Lane B  #3 fix/notifications-member    #4 fix/money-logic (after #1)                     │
Lane C  #6 feat/motion-foundation ─────────────────────────────► #7 feat/motion-surfaces ◄┘
Lane D  #8 refactor/copy-trim ──► #9 feat/visual-meters (also after #6)
```

| # | Branch | Base | Model | Size |
|---|---|---|---|---|
| 1 | `fix/demo-data-fallback` | `main` | strong | M |
| 2 | `fix/offline-queue` | #1 | strong | L |
| 3 | `fix/notifications-member` | `main` | strong | M |
| 4 | `fix/money-logic` | #1 (shares `ExpensesPage.tsx` and `supabaseFinanceService.ts`) | strong | M |
| 5 | `feat/query-smoothness` | #2 | strong | L |
| 6 | `feat/motion-foundation` | `main` | strong | M |
| 7 | `feat/motion-surfaces` | #5 and #6. Branch from #5, then merge #6 in. If both are merged, use `main`. | fast, strong review | L |
| 8 | `refactor/copy-trim` | `main` | fast | M |
| 9 | `feat/visual-meters` | #8, plus #6 merged in | fast, strong review | L |

Expect merge conflicts between lanes in `ExpensesPage.tsx`, `supabaseFinanceService.ts` and `ExpenseFormModal.tsx`. When a parent merges, rebase or merge `main` into the child before raising or updating it.

---

## PR #1 `fix/demo-data-fallback`: stop demo data leaking into real data

**Why:** In Supabase mode, offline state or any read error swaps the user's expenses for demo seed data. That fake data then feeds surplus, settle-up, trends and the sweep banner, and the sweep can write fake money into real goals.

**Covers:** H1, H2, H7, M4, M6 (in `audits/bugs.md`).

**Changes**
1. **Mock data is only allowed in mock mode.** Mock mode means Supabase env vars are empty, which is how e2e runs (see `playwright.config.ts`). In Supabase mode, never return `mockFinanceService` data.
   - `src/services/financeService.ts` `getExpenses`: drop the `navigator.onLine` and `catch` fallbacks to mock. Let errors throw, so TanStack keeps the last good cached data.
   - Check every other `mockFinanceService` / `mock*` fallback in `financeService.ts`, `HouseholdContext.tsx:99-104` (`members` = `mockMembers` while loading) and `ExpensesPage.tsx:107-118`. Each must be mock-mode only.
   - Where a page shows real data, a failed query shows `<Alert variant="danger">` with a Retry button, keeping the stale data on screen.
2. **Escape search text** in `supabaseFinanceService.ts` (`getExpenses`, `filter.search`). Quote the value for PostgREST `or()`: wrap it in `"…"` and escape `"` and `\`. Also debounce the search input by 250ms in the expense filter UI.
3. **Sweep banner guard** (`ExpensesPage.tsx`, `financialFormulas.ts` around the surplus detector):
   - Only show the banner when every query it reads has `isSuccess`.
   - Compute the amount from `useBudgetDetailQuery(lastMonth)` `spendableRemaining`, the same figure the Budget page shows.
   - Remove the hard-coded `1500` cap.
   - With no base profile, show no banner.
4. **Fresh goal balance before sweep writes (M6).** Before adding to `saved_so_far`, fetch that goal's current row (a new `getGoal(id)` read is fine). Then write `fresh + amount`. The server-side increment RPC is already issue #37.
5. **Reject mock IDs in Supabase mode (M4).**
   - `addExpense` / `updateBaseProfile` must throw on a non-UUID member or category id, instead of mapping it to `members[0]` / `categories[0]`.
   - Member pickers render only once real members have loaded.

**Tests**
- Unit test: in Supabase mode, a failing `getExpenses` rejects and does not return mock rows.
- Unit test: search escaping, covering `coffee, tea`, `(a)` and `"q"`.
- Unit test: the sweep detector returns nothing while queries are loading or there is no profile.
- Unit test: the sweep uses the fresh goal balance.
- E2E (mock mode) still passes unchanged.

**Screenshots:** Expenses page with an error state (force a query error in a test), 360 and 390 widths.

---

## PR #2 `fix/offline-queue`: offline changes that actually sync

**Base:** #1. **Covers:** H4, H5, H6.

**Approach:** Patch the existing queue in `src/services/offlineSyncQueue.ts`, with a test per failure. Do not rewrite it.

**Changes**
1. **Dedupe (H4).** Cancel a queued mutation only when the match is an `addExpense` whose `optimisticId === id`. In that case also drop any queued updates for that id. A delete of a server-side row is always queued.
2. **Temp IDs (H4).**
   - Generate the expense `id` on the client (`crypto.randomUUID()`) when queuing an add, and send it in the insert. Later edits and deletes then reference the real id.
   - On replay, treat a duplicate-key error (Postgres `23505`) on that insert as success. This also fixes duplicates after a timeout (H5).
   - First check that the insert path allows an explicit `id`. It should, since `id uuid default gen_random_uuid()`.
3. **Offline edits of server rows (H5).** Queue the update without calling `mockFinanceService.updateExpense`. Patch the TanStack cache for the optimistic view.
4. **Only network errors queue (H5).**
   - `addExpense`, `updateExpense`, `deleteExpense` and `bulkAddExpenses` fall back to the queue only when `isNetworkError(err)` is true. This matches `confirmInboxItem`.
   - Any other error rethrows, so the UI shows it.
5. **Flush triggers (H6).**
   - Call `flushOutbox()` on app start and on `visibilitychange` to visible, as well as on `online`.
   - After a flush, call `queryClient.invalidateQueries({ queryKey: ["finance"] })`.
   - Remove the race with `OfflineBanner` calling `refreshData()` in parallel: the banner should wait for the flush.
6. **No dropped mutations (H6).** When a flush finishes, re-read the outbox and remove only the processed entries. Do not overwrite the outbox with the snapshot taken at start.
7. **Failure surfacing.**
   - After 5 failed attempts, mark the mutation `failed`.
   - Show a count in `OfflineBanner` (`2 not synced`) that opens a small list with Retry and Discard. Use existing primitives.

**Tests:** One vitest case per item above, using fake storage and a fake backend. Add an offline e2e case: go offline, add an expense, edit it, delete another, go online, and assert the final state.

**Screenshots:** The `OfflineBanner` states: offline, syncing and failed.

---

## PR #3 `fix/notifications-member`: device follows the logged-in partner

**Base:** `main`. **Covers:** H3, M9, M12, and platform-aware UI (user decision).

**Changes**
1. **Use the logged-in member (H3).** In `NotificationCenterPopover.tsx` (and anything it calls), use `useLoggedInMember().me` for:
   - push subscription sync (`syncPushSubscription`)
   - reminder claims in `evaluateAndDispatchReminders`
   - read and dismiss state
   - the "No spend today" check-in

   Keep the perspective for display filtering only. Grep for other uses of `activeMember` that write device- or user-scoped data, and fix the same way.
2. **iOS permission prompt (M12).**
   - Call `Notification.requestPermission()` only from a button tap.
   - Remove the automatic call on mount (`notificationScheduler.ts:96-110`).
   - Don't set `bb_notif_initial_prompted` unless the user actually saw the prompt.
3. **Number fields (M9).** In `NotificationSettingsModal.tsx` (budget warning %, settlement threshold), keep a local draft string. Clamp and save on blur or Enter, not on every keystroke.
4. **Haptics toggle.** Hide it when `!("vibrate" in navigator)`, which is the case on iOS Safari.
5. **Auto Capture setup order.** In the Auto Capture settings section, detect the platform from `navigator.userAgent` (Android or iOS) and show the matching steps first, with the other platform's steps collapsed. Android gets the automation-app steps (MacroDroid/Tasker posting to the capture endpoint). If those steps don't exist yet, leave a placeholder and link issue #44 rather than inventing them. iOS gets the Apple Pay Shortcut steps.

**Tests**
- Unit test: in Combined view, push sync and check-in use `me.id`.
- Unit test: no permission request happens on mount.
- Unit test: typing `65` into the % field gives `65`.
- Unit test: the haptics row is hidden when `navigator.vibrate` is missing.

**Screenshots:** The Notification settings modal and the Auto Capture section, with an Android user agent and an iPhone user agent.

---

## PR #4 `fix/money-logic`: correctness fixes

**Base:** #1. **Covers:** M1, M2, M3, M5, M8, M10, M11, L1, L6, plus the `1th`/`22th` ordinal bug from `audits/copy.md` section 1.

**Changes**
1. **Joint recurring items (M1).**
   - Count `owner_id === "joint"` items once in combined budgets: skip them in per-member budgets and add them once in `combineMonthlyBudgets.ts`, or split 50/50. Pick one and document it in a code comment.
   - Make `RecurringPage` perspective filtering consistent with that choice. It currently hard-codes member-name strings (L8): replace them with member ids.
2. **Ended policies (M2).** Pass `month` into the insurance and tax deduction maths in `financialFormulas.ts` and filter with `isRecurringItemActiveInMonth`.
3. **Payer default (M3).** `ExpenseFormModal` defaults the payer to `useLoggedInMember().me` in Combined view, matching `BulkAddExpenseModal`.
4. **Base profile save (M5).**
   - `Number(rate) || 0.20` → `Number.isFinite(n) ? n : 0.2`, so 0% saves.
   - Replace delete-all-then-insert for allocations with upsert-then-delete-the-rest. Check the unique constraint in `supabase/migrations/` and use it as `onConflict`.
5. **1,000-row cap (M8).**
   - `getAllAccountSnapshots`: order descending, or select the latest per account plus the trend window.
   - `getExpenses` with no filter and `getDailyCheckins`: add a date window (the trends need about 6 months) or paginate until exhausted.
6. **Stale date chips (M10).** Derive Today/Yesterday from `useSgtClock().today`.
7. **Settle-up (M11).** Pass the explicit expense ids behind the displayed amount to `settleSharedExpenses`, and settle only those.
8. **`addMonths` overflow (L1).** Clamp the day to the target month's length.
9. **Esc on stacked modals (L6).** In `AnimatedModal.tsx`, only the top-most open modal handles Escape and restores body overflow. Use a module-level stack.
10. **Ordinals.** Add `ordinal(n)` to `src/lib/dateUtils.ts`. Use it in `CreditCardTrackerSection.tsx` for the statement and due days.

**Tests:** One unit test per item. Most are pure functions in `src/lib`.

**Screenshots:** The credit card tracker (ordinals) and the payer field in Combined view.

---

## PR #5 `feat/query-smoothness`: no skeleton flashes, instant expense add/delete

**Base:** #2. **Covers:** motion audit 4.2, 4.3 and 4.4, and M7.

**Changes**
1. **Keep the previous month's data visible.**
   - Add `placeholderData: keepPreviousData` to the month- and filter-keyed hooks in `src/hooks/useFinanceQueries.ts`: expenses, budget detail, monthly budget, CC statements and any others keyed by month or filter.
   - Pages show the full skeleton only when there is no data at all. While `isPlaceholderData` is true, dim the content (`opacity-60 transition-opacity`).
2. **Targeted invalidation.** Replace the blanket `refreshHousehold()` / `invalidateQueries(["finance"])` after common writes with the existing `useInvalidateFinance()` helpers (`invalidateExpenses`, etc.). Keep the blanket refresh for pull-to-refresh only.
3. **Refetch on resume (M7).** Turn on `refetchOnWindowFocus: true` for `["finance"]` queries, either in `src/lib/queryClient.ts` or per hook. Keep the 5-minute `staleTime`.
4. **Instant add and delete for expenses.**
   - Move add and delete to `useMutation`, with `onMutate` patching the cache, `onError` rolling back with an `<Alert>` or toast, and `onSettled` running a targeted invalidate.
   - Add sheets close immediately on Save.
   - This must work with the offline queue from #2: when offline, the queued item stays in the cache.
   - All other writes keep their current flow. Moving every write is issue #38.
5. **Double-submit guards** (motion audit 4.2) on `handleDeleteExpense`, `handleDeleteItem` (Recurring), goal quick-deposit and settle-up. Use `isPending` from the mutation, or a small `useSubmitLock()` in `src/hooks/`.

**Tests**
- Hook tests: data from the previous month stays during a month change.
- Optimistic add appears before the server responds.
- Rollback on error.
- The delete button is disabled while a delete is pending.

**Screenshots:** A short sequence on Expenses: tap next month, then add an expense. Before shows a skeleton flash; after shows dimmed data.

---

## PR #6 `feat/motion-foundation`: shared motion system and layout stability

**Base:** `main`. **Covers:** motion audit sections 0, 1.1, 1.2, 1.9–1.12, 2.8, 2.10, 2.13, 3, 4.1, 4.6, and L7.

**Changes**
1. **Install `motion`.**
   - Run `npm install motion` and commit `package.json` and the lockfile.
   - Wrap the app in `<LazyMotion features={domAnimation} strict>` and `<MotionConfig reducedMotion="user">` in `App.tsx` or `main.tsx`.
   - Use `m.*` components, not `motion.*`, so `strict` keeps the bundle small.
   - Put shared presets in `src/lib/motion.ts`: `fadeRise` (opacity 0→1, y 4→0, 180ms), `pop` (opacity and scale 0.96→1, 160ms), `collapse` (height auto plus opacity, 220ms), `listItem` (layout plus fade-out on exit), and `springSnappy`. Their easing and duration values must match the CSS tokens.
   - Record the gzipped bundle-size change in the PR body. It should be about +15 kB.
2. **CSS tokens.**
   - In `src/index.css` `@theme`, add `--ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-in-fast: cubic-bezier(0.4, 0, 1, 1)` and `--ease-spring: cubic-bezier(0.3, 1.4, 0.5, 1)`.
   - In `:root`, add `--duration-instant: 100ms`, `--duration-fast: 160ms`, `--duration-base: 220ms` and `--duration-slow: 400ms`.
   - Swap the existing custom cubic-beziers and durations in `index.css` to these tokens.
3. **CSS utilities** (all transform and opacity only):
   - `.animate-enter`: fade plus a 4px rise.
   - `.animate-pop`: fade plus scale.
   - `.transition-press`: transform, box-shadow and colours, over `--duration-instant`.
   - `.progress-fill`: width or `scaleX`, over `--duration-slow`, using `@starting-style` so it fills from 0 on mount.
4. **Fix the dead animation classes.** Replace every `animate-in`, `fade-in`, `zoom-in-*`, `slide-in-from-*` and `animate-slide-up` usage with `.animate-enter` or `.animate-pop`. The list is in motion audit section 0: CollapsibleSection, Input, Select, Textarea, AppHeader, NotificationCenterPopover, MonthPicker, CategoryLimitWarningBanner, BaseProfileEditorModal, PinLoginScreen and PWAUpdateToast. Confirm none are left with `grep -rn "animate-in\|slide-in-from\|zoom-in-\|animate-slide-up" src`.
5. **`transition-all`.**
   - In `Button`, `Card`, `SegmentedTabs`, `CollapsibleSection`, `MobileBottomNav` and `DesktopSidebar`, replace it with `transition-press` or explicit properties.
   - Replace the remaining long tail where the change is purely mechanical. Leave any uncertain ones and note the count in the PR body.
6. **Reduced motion.**
   - Add a global catch-all `@media (prefers-reduced-motion: reduce)` that sets 1ms durations and `scroll-behavior: auto`.
   - Make `animate-pulse` in `App.tsx` and `InboxPage.tsx` `motion-safe:`.
   - Gate `scrollIntoView({ behavior: "smooth" })` in GoalsPage, the `PullToRefresh` JS motion and the `AnimatedModal` drag transitions on `matchMedia("(prefers-reduced-motion: reduce)")`.
7. **Viewport and scroll.**
   - `h-screen`/`min-h-screen` → `h-dvh`/`min-h-dvh` (in `App.tsx` and `PinLoginScreen`).
   - Add `[scrollbar-gutter:stable]` to the main scroller.
   - In `html, body`, change `max-width: 100vw` → `100%` and `overflow-x: hidden` → `clip`.
   - Make `AnimatedModal` lock the `main` scroller as well as `body`.
8. **Touch.**
   - Add global `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` on interactive elements.
   - Give the `Button` `sm` and `icon-sm` sizes and the `SegmentedTabs` buttons a 44px hit area with an invisible pseudo-element (`relative after:absolute after:-inset-2` or similar). The visual size stays the same.
   - Add `active:` press feedback to the bottom-nav and segmented tabs.
9. **Quick Add double-fire.** In `MobileBottomNav.tsx`, remove the wrapper `div` click handler so only the button handles the tap.
10. **Safe areas.**
    - `PWAUpdateToast`: `bottom-[calc(5rem+env(safe-area-inset-bottom))]`.
    - `CategoryLimitWarningBanner` toast: account for `safe-area-inset-top`, and use `left-4 right-4 sm:left-auto`.
11. **Theme switch.** Briefly add a class during the toggle that transitions colours for 200ms.
12. **Tokens instead of hard-coded colours (L7).** Swap the hard-coded colours in `PWAUpdateToast` and `OfflineBanner` for tokens.
13. **Bottom nav blur.** Swap `backdrop-blur-lg` on the bottom nav for the solid card token. It is expensive on mid-range Android.

**Tests**
- Existing unit and e2e tests still pass.
- Add a vitest that `Button size="sm"` has the hit-area class.
- Add an e2e check at 390×844 that the bottom nav is fully visible: its bounding box is within the viewport.

**Screenshots:** Home, Spend and Budget at 360 and 390 widths, light and dark. Also a frame of a popover mid-animation if your capture setup can manage it, otherwise skip.

---

## PR #7 `feat/motion-surfaces`: animate what users touch

**Base:** #5 and #6. **Covers:** motion audit 1.3, 1.4, 1.6–1.8, 1.13, 2.1–2.3, 2.5–2.7, 2.9, 2.11, 2.12 and 4.5. Use the `src/lib/motion.ts` presets and CSS utilities from #6. Don't add new easings.

**Do not touch progress bars here.** PR #9 replaces them.

**Changes**
1. **Page transitions.** In `App.tsx`, key a wrapper on `location.pathname` with the `fadeRise` enter animation and no exit wait. Navigation must never feel slower. Don't slide or transform the main scroller, so `PullToRefresh` stays stable.
2. **Scroll.** On pathname change, scroll `main` to the top. On back/forward (`POP`), restore that path's saved `scrollTop`. Keep the saved positions in a ref map. On route change, move focus to the page `h1`.
3. **One skeleton per navigation.** Make the lazy-route fallback minimal (header height only, delayed about 150ms) so the page skeleton is the only one. Preload the lazy page chunks with `requestIdleCallback` after first paint.
4. **Tabs.**
   - `SpendPage`, `PlanPage`, `AccountsPage`: tab content enters with `fadeRise`.
   - Fix the `SpendPage` tab ↔ URL effect ping-pong by deriving the tab from the URL only.
   - Give the `SegmentedTabs` active pill a sliding indicator via a shared `layoutId`.
5. **Collapsible.** `CollapsibleSection` animates height open and closed using `collapse` with `AnimatePresence`, or a CSS grid-rows transition.
6. **Banners that don't shove content.**
   - Wrap `OfflineBanner`, the sweep banner, the category-limit banners and the conditional cards at the top of Home (`InboxHomeCard`, warning banner) in a `collapse` presence, so they animate height in and out.
   - On Home, render conditional banners below the hero card.
7. **Exit animations.** Toasts, `PWAUpdateToast`, the header perspective menu, `NotificationCenterPopover` (including the mobile sheet), `MonthPicker` and `TooltipPopover` all animate out through `AnimatePresence`.
8. **List rows.**
   - Rows in the expense list, Recurring, Goals, Accounts, Bonus log, the credit card list and Manage Categories get `layout` plus the `listItem` exit, so a deleted row fades and the rows below slide up.
   - New rows fade in.
   - Expense deletes are already optimistic after #5, so they animate instantly.
9. **Skeleton shapes.**
   - `InboxPage`: use a skeleton shaped like `InboxCard` instead of `Card h-64 animate-pulse`.
   - Keep list skeleton row counts close to the real counts. Using the last known count from the query cache is fine.
10. **Small jitters.**
    - `Input`/`Select`/`Textarea` errors use `collapse` instead of popping in.
    - The `Button` loading spinner keeps the icon slot's width.
    - In `PullToRefresh`, remove CSS transitions from the properties set every frame while pulling, apply them only on release, and keep the indicator mounted using opacity.
11. **Keyboard.** In bottom sheets (`AnimatedModal`), when an input gets focus on a touch device, `scrollIntoView({ block: "center" })` after the keyboard opens (use `visualViewport` resize).

**Tests**
- E2E: navigate Home→Spend→back and assert the scroll position is restored.
- Delete an expense and assert the row is gone.
- With reduced motion emulated, assert there are no transforms.

**Screenshots:** Before and after of the Home banner area and the Inbox loading state. Where the capture tool allows, add a short screen recording (WebM) of a tab switch and a row delete, also uploaded to the screenshots branch.

---

## PR #8 `refactor/copy-trim`: say less

**Base:** `main`. **Source:** `audits/copy.md` sections 1–3.

Text only, using existing components. Number density and new visuals are #9.

**Changes**
1. **Headers and buttons over 3 words** (section 3.1): shorten them all, using AGENTS.md section 6.
2. **StatCard subtitles** (section 3.2): turn them into data tokens.
3. **Empty states** (section 3.3): all 14 must follow the 2-word title, one-sentence prompt, one-CTA formula. Add the missing buttons (UpcomingBills, SurplusSweep, AccountGroupList, ExpenseForm).
4. **Tooltips and paragraphs** (section 3.4): keep each tooltip to one line. Move longer explanations into a "Learn more" `CollapsibleSection` inside the tooltip or modal. Also rewrite BubbySheet's paragraph as two icon rows.
5. **Confirm modals** (BankSurplus, SurplusSweep, DeleteAccount, DeleteExpense): one sentence each. Drop "This action cannot be undone" when the button already says Delete.
6. **Developer-facing text.** Alerts that mention migrations, Supabase or tables become user-facing copy (`Couldn't load. Retry?`). Keep technical details in `console.error`.
7. **"Rose Cap Exceeded"** → `Over` (and fix any other colour words used as copy).
8. **Gap in the audit.** The audit did not read these modals line by line, so do that now and apply the same rules: `ExpenseFormModal`, `BaseProfileEditorModal`, `ManageCategoriesModal`, `BulkAddExpenseModal`, `ExpenseFilterBar`.
9. Update unit and e2e tests that assert on old strings. Change the assertion, never delete the test.

**Screenshots:** The 10 screens in `audits/copy.md` section 0, at 360 wide, light mode. Dark mode is not needed for a text-only PR.

---

## PR #9 `feat/visual-meters`: show it, don't print it

**Base:** #8, with #6 merged in. **Source:** `audits/copy.md` sections 0, 1 and 3.5. Follow the AGENTS.md section 6 rule "one figure, one representation".

**New shared components** go in `src/components/ui/`, are exported from `index.ts`, and each gets its own test file:
- **`MeterBar`.** Props: `value`, `max`, optional `marker` (pace), `size`. Its tone comes from one helper, `getSpendTone(pct)` in `src/lib/` (<80 ok, 80–99 near, ≥100 over), and it uses `.progress-fill`. It must replace all five hand-built bars: `DashboardPage`, `CategoriesHeader`, `ExpensesPage`, `CategoryProgressList` and `GoalCard`. Use tone colour tokens (add `--tone-ok/near/over` with dark values if they are missing). No hex values.
- **`ProgressRing`.** Props: `value`, `size`, a centre slot and a tone. It is an SVG `stroke-dasharray` ring, animated with `motion`, and respects reduced motion.
- **`Sparkline`.** A hand-written SVG polyline with no axes and the last point highlighted. Don't use Recharts.
- **`DeltaBadge`.** An arrow plus a %, with its tone set by direction and a `goodWhen="down" | "up"` prop.
- **`Badge` status variants.** Add `ok`, `near`, `over`, `due` and `paid` variants (each an icon plus a tone) to the existing `Badge`. Don't create a new pill component.

**Swap-ins, worst screens first.** For each screen, keep one amount (usually what's left) plus the visual. Move the % and secondary figures into a tap `TooltipPopover`.
1. Budget category list (`CategoryProgressList`): `MeterBar` plus the amount left, and a status `Badge` only when the category is over.
2. `GoalCard`: a `ProgressRing` plus `saved / target`. Move the 2×2 grid and the pace rows behind a tap.
3. `ExpenseTrendsCard`: a `Sparkline` plus one `DeltaBadge`. Remove the 3 KPI tiles and the per-category Current/Avg list, or put them behind "More".
4. The credit card tracker: a `due` status badge (a countdown instead of the date text). Show statement and due day as icon rows.
5. The Spend summary strip: a `MeterBar` in the Spendable card footer instead of the Spent/Limit text.
6. Home hero category tiles: a `ProgressRing` with the category icon and the amount left. Show at most 4 tiles, with the rest behind "More".
7. `CumulativeSurplusCard`: remove the duplicated total and use a `Sparkline` for history.
8. Budget stat strip: remove the figures the waterfall already shows.

**Tests:** Component tests (tone thresholds, clamping, reduced motion). Update page tests for removed text. E2E: Budget and Goals render rings and bars at 360 wide with no horizontal scroll.

**Screenshots:** The same 10 screens as #8, at 360 and 390 widths, light and dark.

---

## Done when

- All 9 PRs are raised, their gates are green, and their screenshots are attached.
- Everything found but not fixed is a `backlog` issue.
- The worktrees are removed.
- The agent posts a final summary listing every PR link, its base branch, merge order and any gate failures.
