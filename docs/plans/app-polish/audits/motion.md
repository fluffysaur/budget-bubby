# Budget Bubby: smoothness audit (read-only)

> Snapshot from 2026-11-07, taken on `feat/delight-bubby` before it merged. Line numbers may drift; search for the quoted code if a line does not match.


Paths relative to `src/`. Effort: S (<1h), M (half day), L (day+). Line numbers from the working tree on `feat/delight-bubby`. This is a static read: the app was not run, so the "how it feels" claims are inferred from code.

## 0. Proposed shared motion system

**Root cause #1 (high impact, trivial to fix):** `animate-in`, `fade-in`, `slide-in-from-*`, `zoom-in-*`, `duration-*` as animation modifiers, and `animate-slide-up` are used in 15 places, but neither `tailwindcss-animate` nor `tw-animate-css` is installed (nothing in package.json, nothing in index.css, no `@plugin`). These classes compile to nothing. Every popover, banner, error message and collapsible that was meant to animate appears instantly. Affected: CollapsibleSection:88, Input:66, Select:84, Textarea:35, AppHeader:228, NotificationCenterPopover:505/519/567, MonthPicker:177, CategoryLimitWarningBanner:245, BudgetEditorModal:929, PinLoginScreen:301/312/321, PWAUpdateToast:36 (`animate-slide-up` is defined nowhere).
Fix: define the utilities yourself in `index.css` (preferred, no new dependency per AGENTS.md "ask before installing") using the tokens below, then keep the existing class names working.

**Tokens (add to `@theme` in index.css):**
```css
@theme {
  --ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);   /* enter, already used by modals/toasts */
  --ease-in-fast:  cubic-bezier(0.4, 0, 1, 1);      /* exit, already used by modal exit */
  --ease-spring:   cubic-bezier(0.3, 1.4, 0.5, 1);  /* pill-pop / bubby hop */
  --duration-instant: 100ms;  /* press, hover */
  --duration-fast:    160ms;  /* popovers, pills, toggles */
  --duration-base:    220ms;  /* sheets, banners, collapsibles, route fade */
  --duration-slow:    400ms;  /* progress fills, number tweens */
}
```
**Utilities to add (all transform/opacity, all wrapped in the existing reduced-motion block):**
- `.animate-enter` (fade + 4-8px rise), `.animate-pop` (fade + scale .96), `.animate-exit`. Re-alias `animate-in/fade-in/zoom-in-95/slide-in-from-*` onto these so the 15 dead usages start working with no markup change.
- `.transition-press` = `transition: transform, box-shadow, background-color, color, border-color var(--duration-instant) var(--ease-out-soft)`. Use instead of `transition-all` (123 uses; animates layout-affecting props and is the main source of "mushy" feel and wasted paint on Android).
- `.progress-fill` = `transition: width var(--duration-slow) var(--ease-out-soft)` (or `transform: scaleX()` with `origin-left`).
- `.collapsible` (grid-rows 0fr -> 1fr trick) used by CollapsibleSection, banners, sweep banner, and any "conditional block".
- `.route-fade` keyed on `location.pathname` in App.tsx (opacity only, 120ms; no transform so sticky and fixed children don't break).
- A `<ReducedMotion>`-safe global: keep the present targeted overrides, and add one catch-all `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { transition-duration: 1ms !important; animation-duration: 1ms !important; scroll-behavior: auto !important } }`. Today it is a hand-maintained allowlist (index.css:689-736) that misses every Tailwind `transition-*`, `animate-pulse`, `animate-spin`, PullToRefresh, progress bars and `animate-in`.
- `useMountTransition(isOpen, ms)` hook: lets any popover/banner/toast/row play an exit animation before unmount (AnimatedModal already hand-rolls this, lines ~100-130).
- `useTweenedNumber` / or just `<CurrencyText>` + `tabular-nums` for amounts that change after load (see 1.5).
- Query hygiene that removes whole classes of flicker: `placeholderData: keepPreviousData` on month-keyed queries, optimistic `onMutate` for the 6 most common mutations (see 4.3).

**Current inventory (for the record):**
- Durations in Tailwind classes: 75, 100, 120, 150, 200 (16x), 300, 500, plus 123 bare `transition-all` (150ms default) and 77 `transition-colors`.
- Durations in CSS: .12s, 160, 180, 200, 220, 260, 350, 360, 380, 400, 1s, 1.4s, 1.5s, 3s, 5s.
- Easings: `ease`, `ease-out`, `ease-in-out`, `linear`, plus six different custom cubic-beziers (`.16,1,.3,1`; `.4,0,1,1`; `.3,1.4,.5,1`; `.3,1.6,.5,1`; `.22,1,.36,1`; `.2,.7,.4,1`; `.34,1.56,.64,1`). No shared token exists.

---

## 1. Layout shift and jitter

| # | Where | What happens | Fix | Effort |
|---|---|---|---|---|
| 1.1 | App.tsx:199, :287; PinLoginScreen:227 | `h-screen` / `min-h-screen` = `100vh`. On iOS Safari/standalone the toolbar and keyboard change the visual viewport, so the shell is taller than the visible area; bottom nav and the last content row sit behind browser chrome and pages "jump" when the toolbar collapses. AnimatedModal already uses `dvh`, so the app is inconsistent. | `h-dvh` (Tailwind v4 has it), `min-h-dvh` on login. Add `100svh` fallback if needed. | S |
| 1.2 | App.tsx:232 (`<PullToRefresh as="main">` is the scroller, `overflow-y-auto`) | On desktop the scrollbar appears/disappears as content swaps between skeleton and data, shifting the whole column by ~15px. | `[scrollbar-gutter:stable]` on the main scroller (or `.scroll-stable` utility). Mobile unaffected. | S |
| 1.3 | App.tsx:57-90 `RouteSkeletonLoader` vs real pages | Route fallback is a generic (header + 3 cards + 288px card) block that matches no page; then the page's own `*Skeleton` renders (second skeleton, different layout) while queries load, then data. Users see two skeleton swaps per navigation. Also uses raw `dark:bg-slate-800` and its own `animate-pulse` on the wrapper instead of `Skeleton`. | Make the lazy fallback minimal (`PageHeader` height only, or `null` for <150ms via a delayed fallback) so the page-level skeleton is the only one. Preload the lazy chunks on nav hover/idle (`import()` in `requestIdleCallback`). | M |
| 1.4 | Skeleton heights vs final: DashboardPage:133 `DashboardSkeleton`, PageSkeletons.tsx (Dashboard/Goals/Budget/Accounts/Recurring) | Skeletons are well built for StatCard (SkeletonStatValue matches heights), but list/card skeletons are fixed counts (4 category cards, 3 rows) while real content is variable, so the page height changes on load. On the Dashboard, banners (`CategoryLimitWarningBanner single`, `InboxHomeCard`, DashboardPage:138-146) are rendered only after loading, above the hero card, so they push the hero card down after it has already appeared. | Reserve a slot for conditional top cards (e.g. a `min-h` collapsible wrapper that animates 0 -> height) or render those below the hero. Keep skeleton row counts equal to last known count (store in `localStorage`/query cache). | M |
| 1.5 | Numbers changing width | `tabular-nums` is applied in `.font-mono-num` (index.css:193) and `CurrencyText` uses it via `MONEY_BASE_CLASSES`, which is good. Misses: any amount rendered as plain text/`formatSGD` in a `<span>` without `font-mono-num` (47 files use the currency helpers, only 40 files reference tabular/mono). Percent labels next to progress bars and badges (`min-w-5` inbox badge) are not mono. Header text/labels in nav badges. | Audit `formatSGD(` call sites not wrapped in `CurrencyText`; add `tabular-nums` to percent text and counters. Add global `body { font-variant-numeric: tabular-nums }` is too broad for prose, so prefer a `.num` utility. | S |
| 1.6 | OfflineBanner.tsx (~line 85-135) mounted above AppHeader in the flex column (App.tsx:208) | Banner returns `null` -> block on connectivity/sync changes, pushing header and entire content down 28px with no transition. The "Synced" pill auto-hides after 3.5s and pops everything back up. | Make it `position: sticky/absolute` overlay over the header, or animate height with the `.collapsible` utility; keep a stable slot. | S |
| 1.7 | ExpensesPage.tsx:371 `showSweepBanner` and :403+ conditional cards; CategoryLimitWarningBanner (BudgetPage:253) | Conditional banners appear in document flow after data arrives and shove the page. | Same `.collapsible` wrapper (height 0fr -> 1fr + fade), applied inside the banner components. | M |
| 1.8 | InboxPage:367 | Loading state is `Card h-64 animate-pulse`, not `Skeleton`; real `InboxCard` has a different height, plus a second "stack" layer card is added when `next` exists. | Use a skeleton shaped like InboxCard; fixed `min-h` for the card region. | S |
| 1.9 | PWAUpdateToast.tsx:36 | `fixed bottom-20 md:bottom-6` ignores `env(safe-area-inset-bottom)`; on iPhone the toast overlaps the 64px nav + safe area. `animate-slide-up` undefined (see section 0). | `bottom-[calc(5rem+env(safe-area-inset-bottom))]`; define animation. | S |
| 1.10 | CategoryLimitWarningBanner:245 | `fixed top-5 right-5` toast ignores `env(safe-area-inset-top)` (notch/Dynamic Island on iPhone PWA) and on mobile spans `w-full` with `right-5` but no left offset, so it can overflow. Slide-in is a no-op. | `top-[calc(1.25rem+env(safe-area-inset-top))]`, `left-4 right-4 sm:left-auto`. | S |
| 1.11 | AppHeader (sticky?) / index.css:180-184 | `.pt-safe` utilities exist, but `html,body {max-width:100vw}` (index.css:166-169) plus `overflow-x:hidden` on `html, body, #root` can create an extra scroll container and breaks `position: sticky` for descendants in some browsers. Verify AppHeader is outside the scroller (it is: it is a flex sibling of `main`, so fine) but any sticky sub-headers inside pages will fail. | Replace `100vw` with `100%`; use `overflow-x: clip`. | S |
| 1.12 | AnimatedModal.tsx:440-445 | Scroll lock sets `document.body.style.overflow='hidden'` but the real scroller is `main`, so the page behind still scrolls on iOS (rubber-band behind a sheet). On desktop, toggling body overflow can shift layout if the scrollbar lives on body. | Lock the `main` scroller (or set `overscroll-behavior: contain` on overlay, already present) and use `scrollbar-gutter: stable`. | S |
| 1.13 | Mobile keyboard | AnimatedModal uses `max-h-[92dvh]` and the sheet is bottom-anchored (`items-end`); `dvh` does not shrink for the on-screen keyboard on iOS, so focused inputs at the bottom of long forms (ExpenseFormModal, BulkAdd) are hidden by the keyboard until the browser scrolls. No `visualViewport` handling and no `scroll-padding-bottom`. | Use `visualViewport.height` CSS var for sheet max-height when a field is focused, or `scrollIntoView({block:'center'})` on focus in forms. | M |
| 1.14 | Images/icons | Icons are Lucide with explicit `h-/w-` classes, good. `BubbyIcon` and avatar images were not seen with width/height attributes. Web fonts load from Google Fonts with `display=swap` (index.html:17) causing a FOUT reflow for Bricolage/Plus Jakarta (headline and number widths change on swap). | Self-host and preload the 2-3 used weights, add `size-adjust` fallback, or `font-display: optional` for the display font. | M |

## 2. Missing or abrupt transitions

| # | Where | What happens | Fix | Effort |
|---|---|---|---|---|
| 2.1 | CollapsibleSection.tsx:85-90 | `{isOpen && <div ... animate-in fade-in slide-in-from-top-1>}`: mounts and unmounts instantly (animate-in is dead). Closing has no animation at all; content below jumps. The parent has `transition-all` which does nothing useful. | grid-template-rows 0fr <-> 1fr wrapper (keep children mounted or use `useMountTransition`); chevron already animates (`duration-200`), keep. | S |
| 2.2 | pages/SpendPage.tsx:76-77, PlanPage.tsx:79-82, AccountsPage.tsx:172 | Sub-tab content is `activeTab === x && <Page/>`: instant swap, previous tab's component is unmounted (losing state, scroll, filters) and remounted with skeleton. | Wrap in `.animate-enter` keyed by tab (cheap fade); keep expensive tabs mounted with `hidden` or cache filters in URL/query. | S-M |
| 2.3 | App.tsx:226-241 `<Routes>` | No route transition at all. Combined with 1.3 the app flashes: previous page -> blank skeleton -> page skeleton -> content. | `.route-fade` keyed wrapper (opacity only, 120ms, ease-out); avoid slide to keep PullToRefresh transform stable. Optionally View Transitions API (`navigate(..., {viewTransition:true})` in react-router 6.2x/7) which Safari 18+ and Chrome support, degrading gracefully. | S |
| 2.4 | Progress bars: DashboardPage:228 (`transition-all` ok), DashboardPage:190 (`transition-all`), **CategoriesHeader.tsx:63-66 (none)**, **ExpensesPage.tsx:~420-428 (check, no duration seen)**, **BubbySheet.tsx:30 (`transition-all`, default 150ms)**, CategoryProgressList:286 (300ms), GoalCard:253 (500ms), QuickDepositModal:204 (check), ExpenseTrendsCard:236 (`transition-all`, 150ms), CumulativeSurplusCard:440 | Four different durations; CategoriesHeader has none. Bars mount at their final width (no 0 -> value fill on first render), so they only animate on later value changes. `transition-all` on width triggers layout every frame. | One `.progress-fill` class; on mount start from 0 using `requestAnimationFrame` state, or a CSS `@starting-style { width: 0 }` (supported in Chrome 117+/Safari 17.5+). Prefer `transform: scaleX()`. | S |
| 2.5 | Toasts/banners: PWAUpdateToast, CategoryLimitWarningBanner toast, ExpenseSuccessCelebration, OfflineBanner, MonthEndSweepBanner | Entrance mostly dead (see 0); no exit animation anywhere (conditional render removes node). Only `.animate-toast-in` (index.css:658) works, and only where used. | `useMountTransition` + `.animate-exit`. | M |
| 2.6 | Popovers: AppHeader:228 (perspective menu), NotificationCenterPopover:505/519/567, MonthPicker:177, TooltipPopover | Open/close instant (animate-in dead); NotificationCenter mobile full-screen sheet (`fixed inset-0`, :567) pops in without slide. | Same utilities; popovers `origin-top-left` + `.animate-pop`. | S |
| 2.7 | Row delete / add: ExpenseListTable, ExpensesPage:197, RecurringPage:163, GoalsPage, AccountsPage, BonusLogPanel:111, CreditCardTrackerSection:320, ManageCategoriesModal:437 | Delete awaits the server, `refreshHousehold()` re-fetches everything, then the row vanishes and the rest jump up. New rows appear instantly. No keyed enter/exit animation. | Optimistic removal + `.collapsible` exit on the row (height + opacity, 180ms). Consider `@formkit/auto-animate` only after asking about deps. | M |
| 2.8 | Hover/press states | Good coverage (205 `hover:`, 33 files with `active:`), consistent tactile translate in Button/Card/PWAInstallButton. Gaps: StatCard `onClick` variant relies on Card `interactive`; SegmentedTabs buttons (SegmentedTabs.tsx:56) have no `active:` press feedback; MobileBottomNav tab buttons (:41, :67, :134, :158) have no `active:` state (they have `transition-colors` only) and the Quick Add wrapper `<div onClick>` (:97-101) double-handles clicks. CollapsibleSection header has `active:bg` only. | Add `active:scale-95` or the translate press to tabs and bottom-nav buttons (use `transition-press`). | S |
| 2.9 | SegmentedTabs.tsx:56-60 | Active pill switches with `transition-all` between two unrelated button backgrounds, so it cross-fades colors rather than sliding. | Optional: shared sliding indicator (absolute pill with `transform: translateX()`; ~40 lines). Nice-to-have. | M |
| 2.10 | Theme toggle (HouseholdContext.tsx:78-90) | Dark/light flips instantly; some surfaces have `transition-colors duration-200` (sidebar, bottom nav), most don't, so you get a patchy flash. | Add `html.theme-transition *{transition:background-color .2s, color .2s, border-color .2s}` applied for 250ms only during toggle. | S |
| 2.11 | PullToRefresh.tsx:197-203, :219-224 | Indicator mounts/unmounts conditionally (`isPulling \|\| isRefreshing`) and the snap-back uses `transition: transform 200ms ease-out` only on content; indicator itself has `duration-75` transform transition while it is also driven per-frame by touchmove, so it lags the finger by 75ms. After refresh completes, `setTimeout` delays reset (fine). Rotation on the arrow uses `duration-150` while updated per frame. | Remove transitions from per-frame properties while `isPulling`; apply only on release. Keep the indicator always mounted with `opacity`/`translateY` for smooth fade-out. | S |
| 2.12 | Buttons loading swap: Button.tsx:68-73 | When `isLoading`, children remain but icon swaps for a spinner (16px), which may be a different width than the left icon, and `disabled:opacity-50` snaps. | Reserve icon slot width; `transition-opacity`. | S |
| 2.13 | Inline field errors Input.tsx:66, Select:84, Textarea:35 | Error `<p>` mounts under the field, pushing the form down 16px, no transition (dead `animate-in`). | Reserve a min-height line or use `.collapsible`. | S |

## 3. Inconsistent easing, duration, reduced motion

- **No shared tokens.** See inventory in section 0. Modals: 200/220ms enter, 160/180ms exit with `cubic-bezier(.16,1,.3,1)`/`(.4,0,1,1)` (good, keep as the canonical pair). AnimatedModal drag-release uses a third inline copy of the same bezier (AnimatedModal.tsx ~line 478). Nav pill 160ms spring, toast 200ms, FAB 120ms, popovers 100/150ms (dead), collapsible chevron 200ms, GoalCard bar 500ms, CategoryProgress bar 300ms. Effort S once tokens exist (search/replace).
- **`transition-all` x123** (Button.tsx:62, Card.tsx:59, SegmentedTabs.tsx:56, CollapsibleSection:44/69, MobileBottomNav:42+, DesktopSidebar:138, PWAUpdateToast:36, OfflineBanner etc.): animates every property incl. layout (`width`, `padding`, `border`), causes accidental animations when classes change, and is costlier on mid-range Android. Replace in the shared primitives first (Button, Card, SegmentedTabs, Collapsible): `transition-[transform,box-shadow,background-color,color,border-color]`. Effort S for primitives, M for the long tail.
- **Reduced motion.** index.css:689-736 is an allowlist of custom keyframe classes. Not covered: Tailwind `animate-pulse` (Skeleton uses `motion-safe:` so OK), `animate-spin` on Loader2/RotateCw (acceptable, but RouteSkeletonLoader:`animate-pulse` at App.tsx:57 and InboxPage:367 `animate-pulse` are NOT motion-safe), all `transition-*`/`duration-*` utilities, PullToRefresh JS-driven transforms, ConfettiBurst JS, `scrollIntoView({behavior:'smooth'})` at GoalsPage.tsx:216 (not conditional on reduced motion), AnimatedModal drag/slide JS timing (the 1ms override works only for CSS keyframes, not the inline `transition: transform 0.22s`). Fix: add the global catch-all rule from section 0, make `scroll-behavior` conditional, read `matchMedia('(prefers-reduced-motion: reduce)')` in the two JS places. Effort S.
- **Consistency with the sound/haptics**: `feedback.routine('fab')` (MobileBottomNav:107) fires on FAB only; other primary actions (tabs, save) have no haptic. Optional polish, S.

## 4. Interaction friction

### 4.1 Tap targets under 44px
Project rule is `min-h-11` (44px) but only 16 files use it.
- Button.tsx:30/33: `size="sm"` = `px-3 py-1.5 text-xs` (~30px tall); `icon-sm` = `p-1.5` with a 16px icon = ~28px. These are used for delete/edit row actions across lists. Fix: add an invisible hit-area (`relative after:absolute after:-inset-2`) in `sm`/`icon-sm`, or `min-h-9 min-w-9` + extend. Effort S, one place, large effect.
- PWAInstallButton:24 `h-9` (36px); AppHeader icon buttons (theme/refresh/settings) use Button `icon-sm`/`h-9`; CollapsibleSection chevron 28px is inside a full-width row so fine; SegmentedTabs `size="sm"` = `py-1` (~26px) and `md` `py-1.5` (~32px) in a rail. Fix: `min-h-10` on tabs; pad rail. Effort S.
- MobileBottomNav tabs are 64px tall, good; badge is `aria-hidden` overlay, fine. Quick Add wrapper div + inner button both handle onClick (stopPropagation hack, MobileBottomNav:97-112): double-fire risk on some Android WebViews. Effort S.
- Add `touch-action: manipulation` globally on interactive elements (and `-webkit-tap-highlight-color: transparent`) to remove the 300ms/double-tap-zoom delay and the grey flash on Android. Not present in index.css (only `overscroll-behavior`). Effort S, high perceived-speed win.

### 4.2 Double-submit
`isSubmitting`-style flags exist in ~121 places, and the Delete modals pass `isLoading` to Button (disabled), good. Weak spots: inline handlers that are not guarded: ExpensesPage.tsx:197 `handleDeleteExpense`, RecurringPage:163 `handleDeleteItem`, GoalsPage quick-deposit paths, `handleManualRefresh` is guarded. `settleSharedExpenses` (ExpensesPage:~190) has no in-flight guard. Fix: wrap with a `useSubmitLock()` hook or move these to `useMutation` and use `isPending`. Effort M.

### 4.3 No optimistic updates
Zero `useMutation` / `onMutate` in src. All writes go `await financeService.x(); await refreshHousehold()` where `refreshHousehold` -> `queryClient.invalidateQueries({queryKey:['finance']})` (HouseholdContext.tsx:112, financeService.ts:192): every save invalidates and refetches **all** finance queries (expenses, budget, accounts, goals, overview...), and the UI waits for it. Effects: lists flash to skeleton or stale data, Save button spinner lingers 300-1500ms on mobile networks, the modal closes only after the full round trip.
Fix, in priority order: (1) add expense (ExpenseFormModal + Quick Add: insert into `['finance','expenses',...]` cache, close modal immediately, roll back on error), (2) delete expense, (3) inbox accept/skip (the swipe card already feels instant; make cache update synchronous, see `useInboxQueries` setQueryData), (4) goal deposit, (5) toggling recurring items, (6) account balance update. Use targeted `invalidateQueries` (`useInvalidateFinance().invalidateExpenses`, which already exists at useFinanceQueries.ts:222 but appears unused by the pages) instead of the blanket `['finance']`. Effort L overall, S per mutation after the first one defines the pattern.

### 4.4 Skeleton flash on every parameter change
`queryClient` defaults (lib/queryClient.ts) are good (5 min stale, no refetchOnMount). But month-keyed hooks (`useExpensesQuery(filter)`, `useBudgetDetailQuery(month)`, `useMonthlyBudgetQuery(month)`, `useCreditCardStatementsQuery(month)`) have no `placeholderData: keepPreviousData`. Changing month or typing in the expense search box makes `isLoading` true with no data, so pages show the full skeleton (ExpensesPage:121 `expensesLoading && !expensesData`, BudgetPage:105, DashboardPage:67) every time, and the list collapses then re-expands. Fix: `placeholderData: keepPreviousData` + dim the content (`opacity-60 transition-opacity`) using `isPlaceholderData`. Debounce search input if not already. Effort S, big feel win.

### 4.5 Scroll position / focus
- The scroller is the shared `<main>` (PullToRefresh) that is never remounted, so navigating from the bottom of Expenses to Goals keeps the old scrollTop (and Back doesn't restore). No `ScrollRestoration`/manual reset anywhere (only scrollIntoView in GoalsPage:216 and BulkAdd:160). Fix: effect on `location.pathname` (not search) to `main.scrollTo(0,0)`, store per-path scrollTop in a ref map to restore on back. Effort S-M.
- No focus management on route change (keyboard/screen reader focus stays on the old nav button); for sheets, AnimatedModal traps scroll but verify focus return to the trigger on close. Effort S.
- SpendPage.tsx:34-39 `useEffect` syncing `activeTab` <-> URL param can ping-pong (effect depends on `activeTab`) and causes a double render on every tab switch; cause for flicker in the tab body. Derive tab from the URL only. Effort S.
- iOS: `overscroll-behavior-y: none` on html/body (index.css:170) plus custom PullToRefresh is right; `preventDefault` in touchmove is registered non-passive (good). PullToRefresh disambiguation threshold `0.8` can still hijack diagonal scrolls inside horizontal carousels (SegmentedTabs overflow-x). Low priority.
- Haptics are not available on iOS Safari (no Vibration API), so partner's iPhone gets no tactile cue from `haptics.lightTap()`; rely on visual press states there (see 2.8).

### 4.6 Performance contributors to jank
- 31 files use `backdrop-blur` (bottom nav `backdrop-blur-lg`, toasts, modals `backdrop-blur-xs`). On mid-range Android a full-width blur over a scrolling `main` is expensive every frame. Replace bottom-nav blur with the solid `--bg-card` (already 95% opaque) or `will-change: transform` isolate. Effort S.
- `will-change: transform; backface-visibility:hidden` on modal classes (index.css:333-376) is applied permanently while open; fine, but remove after animation end to free the layer (it persists for the sheet's lifetime). Minor.
- Dashboard renders many cards from a single big `DashboardPage` (see `useState` initializers plus heavy memo); after `refreshData()` the entire tree re-renders. Splitting + `React.memo` on StatCard/Card rows helps scroll-time responsiveness. Effort M.
- `html, body, #root {max-width:100vw}`: see 1.11.

---

## Top 10 by value/effort (do these first)
1. Define the missing `animate-in`/`fade-in`/`zoom-in`/`slide-in`/`animate-slide-up` utilities (section 0). One CSS block revives 15 call sites. S
2. `placeholderData: keepPreviousData` on month/filter-keyed queries (4.4). S
3. `h-dvh` + `scrollbar-gutter: stable` + safe-area on toasts (1.1, 1.2, 1.9, 1.10). S
4. `touch-action: manipulation` + `-webkit-tap-highlight-color: transparent`, bigger hit areas for `Button` sm/icon-sm (4.1). S
5. Replace `transition-all` in Button, Card, SegmentedTabs, Collapsible with explicit properties; tokenised durations (section 3). S
6. Collapsible height animation + `.collapsible` helper used by banners (2.1, 1.6, 1.7). S-M
7. Route fade + scroll reset to top on navigation + single skeleton per navigation (1.3, 2.3, 4.5). M
8. Global reduced-motion catch-all and `matchMedia` checks for JS-driven motion (section 3). S
9. Single `.progress-fill` with mount-from-zero fill (2.4). S
10. Optimistic add/delete expense + targeted invalidation instead of blanket `['finance']` (4.3). L (first), then S each
