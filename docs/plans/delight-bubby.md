# Delight & Bubby Plan

Date: 2026-11-05
Status: Proposed
Sibling plan: `docs/plans/capture-inbox.md`. This plan uses the inbox's events and does not design the inbox.

## 1. Overview & principles

Goal: opening the app and doing things in it should feel delightful, and people should want to log, not only to protect a streak. The app must still feel crisp.

The idea: **one shared household Bubby** (the penguin from `src/components/ui/BubbyIcon.tsx`) starts as an egg and grows as the household logs. Its mood shows recent logging and gentle budget pacing. Bubby reacts to everyday actions. The bigger celebrations (stage-ups, accessory unlocks, couple days, inbox zero, the weekly recap) are kept for real milestones.

Principles (guardrails, non-negotiable):

1. **Never slow an action.** Feedback starts *after* the save resolves (or alongside an optimistic update) and never sits between the tap and the result. Nothing waits on an animation.
2. **Animations take ≤400ms and never block input.** Overlays use `pointer-events-none`. The only things over 400ms are confetti for real milestones (≤1.2s), which is non-blocking, and the idle blink loop.
3. **Respect `prefers-reduced-motion`** (no motion: state changes are instant and confetti becomes a static sparkle badge) and the existing **sound** and **haptics** toggles (`sound_enabled` / `haptics_enabled` in `bb_notif_prefs_*`, read by `isSoundEffectsEnabled()` in `src/lib/soundEffects.ts:68` and `isHapticsEnabled()` in `src/lib/haptics.ts:45`).
4. **Celebrations are tiered.** Routine save: subtle haptic plus a small Bubby reaction. First log of the day: a slightly bigger reaction. Real milestones: confetti, chime and a Bubby celebration.
5. **No shaming.** Bubby never looks sad because of *spending*. Missed days make Bubby sleepy or a bit lonely, and logging cheers it up straight away.
6. **Zero migrations to ship.** Everything here is derived from existing tables (`daily_checkins`, `expenses`, budgets) plus per-device `localStorage`. The one optional migration (syncing the equipped accessory across devices) is Phase 3 and degrades gracefully.
7. **No new dependencies.** Bubby is inline SVG and motion is CSS keyframes plus `element.animate()` (WAAPI). Confetti is hand-rolled spans. The repo has no framer-motion or confetti library (`package.json`) and this plan keeps it that way.

## 2. What exists today (inventory)

| Piece | Where | Notes |
|---|---|---|
| Bubby portrait | `src/components/ui/BubbyIcon.tsx:10-240` | One static pose: adult penguin, `^ ^` eyes, waving flipper. viewBox `36 64 436 448`. Used in `AppHeader.tsx:199-202`, `DesktopSidebar.tsx:103`, `PinLoginScreen.tsx:231-233` |
| Bubby construction | `src/components/ui/BubbyConstruction.tsx` | The pattern to follow: palette constants (`INK`, `FEATHER`, `COIN`) and a CSS-animated part (`.animate-bubby-hammer`, `src/index.css:465-490`) that stops under reduced motion |
| Streak chip | `src/components/layout/StreakChip.tsx:18-116` | Calls `financeService.getStreakSummary` directly, not TanStack Query, and refetches on `expenseAdded` (`:46-52`). In Combined view it uses `members[0]` (`:20-23`), not the logged-in partner |
| Streak bar | `src/components/dashboard/DailyCheckinStreakBar.tsx` | Personal and couple chips, 7-day dots, No Spend check-in (`:85-139`) with cha-ching and `haptics.celebrate()` |
| Check-ins | `daily_checkins` (`supabase/migrations/20261028_epics_foundation.sql:59-67`), unique on `(member_id, checkin_date)`, type `expense \| no_spend`. Types at `src/types/finance.ts:291-308` |
| Check-in writes | `supabaseFinanceService.ts:1012`: `addExpense` checks in **the payer** on **the expense date**. `bulkAddExpenses` (`:1049`) loops `addExpense`. `recordDailyCheckin` (`:1327`) upserts |
| Streak maths | `supabaseFinanceService.ts:1350-1440`: personal, longest and couple streaks, plus an extra `household_members` fetch on every call |
| Queries | `useStreakSummaryQuery` / `useDailyCheckinsQuery` (`src/hooks/useFinanceQueries.ts:180-195`). **Unused** by components today. `refetchOnWindowFocus: false` (`src/lib/queryClient.ts`) |
| Sounds | `playChaChingSound` / `playBudgetWarningSound` / `playBudgetExceededSound` (`src/lib/soundEffects.ts`), synthesised with Web Audio. **`playSuccessSound()` (named in AGENTS.md §5D) does not exist yet** |
| Haptics | `src/lib/haptics.ts:19-28` patterns, gated on reduced motion and prefs. Uses `navigator.vibrate`, which **iOS Safari does not support**, so on iPhones haptics are no-ops today |
| Expense celebration | `src/components/expenses/ExpenseSuccessCelebration.tsx`: a 3s toast with confetti and sparkles on **every** `expenseAdded` event (`:41-83`), mounted in `App.tsx:227` |
| Global events | `expenseAdded` (dispatched at `ExpenseFormModal.tsx:672-676` and `BulkAddExpenseModal.tsx:356-373`), `openQuickAdd` (`App.tsx:161-165`) |
| Other feedback | Goal deposit `haptics.goalMilestone()` (`QuickDepositModal.tsx:91`), sweep cha-ching and `haptics.sweep()` (`SurplusSweepModal.tsx:206-207`), delete `haptics.destructive()` (`DeleteExpenseModal.tsx:65`), pull-to-refresh `lightTap` |
| Motion CSS | `src/index.css:253-501`: `chaChingPop`, `coinFloat`, confetti and sparkle keyframes. The reduced-motion block (`:487-500`) covers only the hammer and modals |
| Home | `src/pages/DashboardPage.tsx`: deliberately decluttered (`PageHeader` "Home", limit alert, Left to Spend hero, bills). Guarded by `tests/DeclutterHome.test.tsx` |
| Nav | `MobileBottomNav.tsx:81-100`: centre Quick Add FAB (lilac, already has a press transform) |
| Reminders | `src/lib/reminders/rules.ts:41-47,83,153`: `daily_checkin` and `couple_streak_risk` rules, `DEFAULT_CHECKIN_TIME = "18:00"` |

## 3. The Bubby system

### 3.1 What counts as a "day logged"

A **member-day** is a `(member_id, date)` pair with a row in `daily_checkins` (`expense` or `no_spend`).
A **household day** is any date with at least one member-day.
A **couple day** is a date where both members have a member-day.

Two gaps in today's semantics would make this wrong:

1. **Payer ≠ logger.** `addExpense` checks in `payer_id`. If Yi Jia logs a dinner Rachel paid for, Rachel gets the check-in.
2. **Expense date ≠ today.** Logging Monday's receipt on Wednesday checks in Monday. Inbox triage hits this all the time, because Apple Pay items are often confirmed a day or more later.

**Fix (client-only, no migration):** add a `recordActivityCheckin()` helper (`src/lib/bubby/activity.ts`). After any successful add, bulk add, inbox confirm or inbox clear, it upserts a check-in for **the logged-in member on today's SGT date** (`getTodayDateString()`), type `expense`. The server-side payer/date check-in stays as it is, so backfilling a past day still fills that day.

- The logged-in member comes from `useAuth().loggedInPartner` and is matched to a `HouseholdMember` using the logic now inlined at `BulkAddExpenseModal.tsx:108-112`. Extract that to `src/lib/members.ts` as `resolveLoggedInMember(members, loggedInPartner)`, falling back to `activeMember ?? members[0]` in demo mode.
- It is fire-and-forget (`void`). It goes through `financeService.recordDailyCheckin`, so it is already offline-queued (`offlineSyncQueue.ts:324`), and the upsert is idempotent.
- **Inbox-confirmed purchases count.** Each confirm calls it, and reaching inbox zero calls it even if every item was dismissed. That is the "cleared their inbox" case in the couple-streak definition.
- Upserting `expense` over an existing `no_spend` row for today is fine and more accurate.

This also makes the existing `couple_streak_risk` / `daily_checkin` reminders (`rules.ts`) more accurate, without changing them.

### 3.2 Growth curve

Growth uses **Bubby points (🐾)**, derived from the full check-in history by summing over household days:

| Per household day | 🐾 |
|---|---|
| Anyone logged | +1 |
| Both logged (couple day) | +1 |
| On a roll: household streak including this day ≥ 7 | +1 |

That gives at most 3 🐾 per day. Streaks only *speed up* growth, and missing a day costs nothing. The total is a sum over history, so it **never regresses**. As a belt-and-braces measure, `points = max(derived, localStorage high-water mark)` covers deleted rows and partial fetches.

An engaged couple earns about 2.3 🐾 a day (roughly 1 + 0.7 couple + 0.6 on a roll).

| # | Stage | 🐾 needed | ≈ at 2.3/day | Look |
|---|---|---|---|---|
| 0 | Egg | 0 | day 1 | Speckled cream egg in a little nest of coins |
| 1 | Wobbly Egg | 6 | ~3 days | Hairline cracks, and the egg wiggles on reactions |
| 2 | Hatchling | 20 | ~9 days | Grey fluffball with half a shell worn as a hat |
| 3 | Chick | 60 | ~4 weeks | Fluffy grey chick with stubby flippers and big eyes |
| 4 | Fledgling | 150 | ~2 months | Penguin shape with patchy fluff tufts |
| 5 | Bubby | 300 | ~4 months | Today's `BubbyIcon` adult |

Check-ins started on 2026-10-28, so at launch the household will already be at Wobbly Egg or Hatchling. **The first open after shipping triggers a real "Bubby hatched!" moment.** This is intended.

### 3.3 Accessories

Accessories unlock from Hatchling onward. Each one sits in a **slot** (`head`, `face`, `neck`, `hand`) and only one item per slot can be equipped. Locked items show as ink silhouettes with the 🐾 left to go.

| Accessory | Slot | Unlock (all derived) |
|---|---|---|
| Butter Scarf | neck | 40 🐾 |
| Kopi Cup | hand | 100 🐾 |
| Round Specs | face | 200 🐾 |
| Hard Hat (reuses the `BubbyConstruction` hat paths) | head | 250 🐾 |
| Party Hat | head | Longest couple streak ≥ 14 |
| Heart Balloon | hand | Longest couple streak ≥ 30 |
| Bucket Hat | head | 400 🐾 |
| Ang Bao | hand | 30 household days logged in a single month |
| Crown | head | 600 🐾 |
| Sparkle Bow | head | 10 inbox-zero days (**depends on the inbox plan** exposing triage timestamps. If it doesn't, count per device and treat it as cosmetic) |

The default equip is the newest unlock in each slot, and the user can change it. Equipped choices are stored per device (`localStorage`) in Phase 1. Section 3.6 covers optional cross-device sync.

### 3.4 Moods (state machine)

Mood is **base mood**, derived and persistent, plus an optional **transient reaction**, event-driven and lasting ≤1.2s. Priority: `reaction > absence > pacing > neutral`.

**Base mood**, recomputed from data and the clock:

```
gap = days since the last household day (0 = someone logged today)
mine = logged-in member has a member-day today
pace = (spendableSpent / spendableAllocated) / (dayOfMonth / daysInMonth)
       (from useBudgetDetailQuery, as Dashboard uses it; null if allocated = 0)

if gap >= 3                      → "lonely"   (droopy eyes, holding a single coin)  copy: "Bubby missed you"
else if gap >= 1 && now >= checkin_time → "sleepy" (half-closed eyes, Zzz)   copy: "Log something to wake Bubby"
else if gap >= 1                 → "idle"     (neutral, blinking)  — mornings are never sad
else if couple day today         → "proud"    (^ ^ eyes, blush, tiny hearts)
else if pace != null && pace > 1.15 → "snug"  (wrapped in scarf, steady smile)  copy: "Easy does it"
else if pace != null && pace > 1.0  → "focused" (determined brows, smile)
else                              → "happy"   (^ ^ eyes, blush — current art)
```

- `checkin_time` comes from notification prefs, with `DEFAULT_CHECKIN_TIME` (`rules.ts:83`) as the fallback.
- Pacing moods only apply once someone has logged today. Absence moods take priority, so a Bubby that is sleepy *and* over budget is just sleepy. Spending never produces a negative face: "snug" and "focused" are both warm.

**Transient reactions** come from `bubby:react` events (section 6):
`cheer` (hop and flipper wave), `nod` (edit saved), `poof` (delete: small dust puff with a reassuring wink), `wave` (app open), `munch` (no-spend check-in: Bubby eats a coin), `wiggle` (Egg and Wobbly Egg stages respond to everything with a wiggle), `celebrate` (milestones: jump, sparkles and stage glow).

Logging while sleepy or lonely plays `cheer`, and the base mood switches to happy or proud on the same frame, so the cheer-up is immediate.

### 3.5 Deriving it from data (zero migration)

Add a pure module, `src/lib/bubby/growth.ts`, with no React, so it can be unit-tested:

```ts
deriveBubbyState(checkins: DailyCheckin[], memberIds: [string, string?], today: string): {
  points, stage, nextStageAt, householdDays, coupleDays,
  householdStreak, coupleStreak, longestCoupleStreak,
  todayLoggedBy: Set<memberId>, gapDays, unlocked: AccessoryId[]
}
```

- **Source:** one `useDailyCheckinsQuery()` call with no member filter, so it returns all members' rows. That is about 730 rows a year for two people, O(n) to derive, and memoised. A new hook, `useBubby()`, wraps it with `useMemo` and merges in the high-water mark.
- **Couple streak** is computed here as well. This replaces `getStreakSummary`'s extra `household_members` round-trip for the new UI. `StreakChip` moves to the same query in Phase 1, which removes its manual `useEffect` fetching (`StreakChip.tsx:30-52`).
- **Freshness:** `refetchOnWindowFocus` is off globally. `useBubby` opts in with `refetchOnWindowFocus: true` and `staleTime: 60_000` so the partner's logs show up on resume. `expenseAdded`, `bubby:react` and inbox events invalidate `queryKeys.dailyCheckins()` and apply an optimistic local member-day for today.
- **Per-device state:** a single `localStorage` key, `bb_bubby_v1`, holds `{ hwmPoints, seenStage, seenAccessories[], equipped: {slot: id}, lastGreetingAt, recapSeenWeek, inboxZeroDays[] }`. Every access is wrapped in try/catch, and the app works correctly if the key is empty. "Seen" is per device on purpose: each partner gets their own "Bubby grew!" moment.

### 3.6 Optional Phase 3 sync (only if wanted)

To make the equipped accessories match across both phones, add an **additive** migration, `YYYYMMDDHHMMSS_household_bubby_prefs.sql`, with `alter table households add column if not exists bubby_prefs jsonb`. The user applies it.

The client reads it with a guarded select. If the column is missing or the read errors, the client falls back to `localStorage`. Writes are best-effort. Nothing else needs storage. **Open question 3.**

### 3.7 Art approach: hand-built inline SVG, layered

There are no image assets. A new `<Bubby>` component renders one `<svg viewBox="0 0 512 512">`. Parts are small `.tsx` components that reuse `BubbyIcon`'s palette (`#141414` ink, `#2b333c` feather, `#f59e42` beak, `#f7a8c9` blush) and its thick rounded strokes, so the cute neo-brutalist look stays consistent.

```
<svg data-stage data-mood role="img" aria-label="Bubby, chick, happy">
  <g data-layer="ground">      ellipse shadow (+ coin nest for Egg)
  <g data-layer="fx-back">     glow ring (celebrate), heart balloon string
  <g data-layer="body" class="bubby-body">       ← transform target for hop/wiggle
     <StageBody stage/>        Egg | WobblyEgg | Hatchling | Chick | Fledgling | Adult
     <g data-layer="belly">
     <g data-layer="flipper-l" class="bubby-flipper-l">  ← wave target (transform-origin at shoulder)
     <g data-layer="flipper-r">
     <g data-layer="face" transform={anchors[stage].face}>
        <Eyes mood/>  <Brows mood/>  <Cheeks/>  <Beak mood/>
     <g data-layer="acc-neck"  transform={anchors[stage].neck}>   Scarf
     <g data-layer="acc-face"  transform={anchors[stage].face}>   Specs
     <g data-layer="acc-head"  transform={anchors[stage].head}>   Hat/Crown/Bow
     <g data-layer="acc-hand"  transform={anchors[stage].handR}>  Kopi/AngBao/Balloon
  <g data-layer="fx-front">    Zzz, sparkles, hearts, dust puff
```

- **Anchors** are a per-stage `{ head, face, neck, handR: "translate(x y) scale(s)" }` table in `src/lib/bubby/anchors.ts`. Each accessory is drawn once, centred at the origin, and the anchor places it. That is why it works on every stage from Hatchling up.
- **Egg stages** hide the face and accessory layers. The Egg shows two small eye dots peeking through a crack only from Wobbly Egg on.
- **Mood parts** are small path variants (eyes: `arc`, `dot`, `half`, `droop`, `sparkle`; beak: `open`, `closed`, `munch`), chosen from a `MOOD_FACE` map in `src/lib/bubby/moods.ts`.
- **Size budget:** all parts together should be ≤8 KB gzipped. The 28px header render uses the same SVG. At that size fx layers and accessory details still render, but `size="xs"` skips `fx-back`, `fx-front` and blush lines.
- `BubbyIcon` stays as the static brand mark for PIN login and favicon-like uses. Header and sidebar move to `<Bubby size="xs">`.

### 3.8 Where Bubby lives

1. **Header avatar** (mobile `AppHeader.tsx:199-202`, desktop `DesktopSidebar.tsx:103`): becomes a button showing the live `<Bubby size="xs">` with mood and equipped items. Tapping it opens the Bubby sheet. `min-h-11` hit area, press transform.
2. **Bubby sheet**: `AnimatedModal` with `ModalHeader` "Bubby" and `ModalBody`, lazy-loaded with `React.lazy`. It contains:
   - large Bubby
   - stage name and a progress bar to the next stage ("12 🐾 to Chick")
   - **Today** row: two partner pills (✓ / ·), followed by a couple streak chip
   - accessories grid (2×5) with tap-to-equip
   - a "How Bubby grows" `TooltipPopover` holding the points rules (progressive disclosure)
3. **Home greeting** (section 8): a small speech bubble next to the "Home" `PageHeader`. **No new card**, so Home stays decluttered.
4. **Toasts**: `ExpenseSuccessCelebration` swaps its coin badge for a `cheer`-ing `<Bubby size="xs">`.

`StreakChip` stays in the header (flame and count). Its popover gains a "See Bubby" link. Phase 4 could merge them (open question 6).

## 4. Couple streak

- **Definition:** consecutive SGT dates on which **both** members have a member-day (expense, no-spend, inbox confirm or inbox clear, per section 3.1). Today counts as *pending*: it doesn't break the streak until the day is over. This matches today's maths (`supabaseFinanceService.ts:1376-1393`), now fed by the logged-in-member check-ins.
- **Source:** `deriveBubbyState` (section 3.5). The existing `StreakSummary.coupleStreak` keeps working for the server reminder engine.
- **UI:** the Bubby sheet's Today row shows "You ✓ · Rachel ·" and, once both have logged, "Couple day ✓ · 🔥 12". When only one has logged, the copy is neutral: "Waiting on Rachel". There's no nag text.
- **Couple-day completion:** when the *second* partner's check-in lands (seen on resume or after your own log), play a **milestone-lite** moment once per device per day. Bubby plays `celebrate` with hearts, then `playSuccessSound()` and `haptics.celebrate()`, and the toast says "Couple day! 🔥 12". No full-screen confetti, unless it is also a streak milestone (7, 14, 30, 50, 100), which gets full confetti.
- **Push to partner** ("Rachel logged, your turn") is out of scope here. It belongs to the notifications plan (`partner_shared_spend`, `couple_streak_risk`). See open question 5.

## 5. Inbox-zero hook (consumer only)

The inbox is designed in `docs/plans/capture-inbox.md`. This plan needs the following **contract** from it. If that plan names things differently, adapt the names; the semantics are what matter.

| Event (window `CustomEvent`) | Detail | Delight response |
|---|---|---|
| `inboxTriaged` | `{ memberId, action: "confirm" \| "dismiss" \| "split", remaining: number, expense?: Expense }` | Per swipe: `feedback.routine("triage")`, i.e. a soft pop, `haptics.lightTap()` and Bubby `nod`. **No** cha-ching toast per item. If the inbox's confirm path dispatches `expenseAdded`, it must pass `detail.source = "inbox"` so that `ExpenseSuccessCelebration` skips its toast |
| `inboxZero` (or `inboxTriaged` with `remaining === 0`) | `{ memberId, clearedCount }` | Only when the count goes from >0 to 0 **because of a user action this session**, never on load. Plays full confetti, `playSuccessSound()`, `haptics.celebrate()` and Bubby `celebrate`. Headline: "Inbox zero! 🎉", subtitle: "`clearedCount` sorted". Calls `recordActivityCheckin()`. At most once per member per day. Appends today to `inboxZeroDays` for the Sparkle Bow |

The inbox screen's own empty state (2-word title per AGENTS.md §6, e.g. "All Sorted") can embed `<Bubby mood="proud" size="md">`. That is the inbox plan's decision, and this component makes it easy.

## 6. Weekly recap card

- **When:** on Home, from the first open on or after Monday 00:00 SGT, about the **previous Mon–Sun**. It shows until acknowledged (`recapSeenWeek` in `bb_bubby_v1`) or until Thursday, whichever comes first. It sits under the Left to Spend hero. This is the one extra Home block, and it's temporary.
- **Data:** a pure `src/lib/bubby/recap.ts` working on the week's expenses, check-ins and budget.
  - `ExpenseFilter` (`types/finance.ts:224`) only filters by `month`. Use `useExpensesQuery({ month })` for the one or two months the week spans, then filter by date in memory. No new service method is needed.
  - Use the household perspective, because Bubby is shared (open question 7).
- **Content**, with `Card elevation="sm"` and the title "Last Week":
  - **Spent**: `CurrencyText` at `lg`, with a neutral `Badge` showing the change vs the week before ("↓ 12%"). No red or green judgement.
  - **Top category**: `CategoryBadge` plus the amount.
  - **A win**: the first of these that applies:
    1. Bubby stage-up or accessory unlocked that week
    2. ≥5 couple days ("5 couple days")
    3. Spent below the pro-rata weekly budget ("S$84 under pace")
    4. Inbox zero ≥3 days
    5. ≥2 no-spend days
    6. Lowest-spend week in 4
    7. Fallback: "Logged `n` of 7 days"

    There is always a win.
  - Bubby in `proud`.
  - **Actions:** primary "See Spend" (navigates to `/spend?tab=expenses`) and secondary "Nice!" (acknowledges with Bubby `cheer` and a soft pop). There is no passive X, per AGENTS.md §5D.

## 7. Micro-interaction catalogue

Everything goes through one `feedback` module (`src/lib/delight/feedback.ts`), which centralises the guardrails:

- mute and haptics prefs
- reduced motion
- a rate limit of ≤1 big celebration per 8s; extra ones degrade to `routine`
- dedupe keys
- dispatching `bubby:react`

| Action | Haptic | Sound | Visual / Bubby | Tier |
|---|---|---|---|---|
| Any `Button` / FAB / tab press | none (iOS can't, Android `lightTap` on FAB only) | none | existing `active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`. Add a 120ms `scale(0.96)` on the FAB and a 1-frame active-tab pill pop (`MobileBottomNav.tsx:46-52`) | — |
| Add expense (save) | `success` | `playChaChingSound()` (signature, kept) | Compact toast, 2s (was 3s), with a cheering Bubby in place of the coin badge and **no confetti**. "+1 🐾" pip floats from the toast to the header Bubby (`coinFloat`, 400ms) on the first log of the day only | routine |
| First log of the day (member) | `celebrate` | cha-ching | As above, plus the header Bubby wakes up (sleepy → cheer → happy) | routine+ |
| Edit expense saved | `lightTap` | `playSoftPop()` (new) | Bubby `nod`, plus a 300ms row flash (`bg-(--pastel-mint-light)`) on the edited row | routine |
| Delete expense | `destructive` (existing) | none | Row collapses (200ms height and opacity), Bubby `poof` | routine |
| Bulk add (n) | `success` | cha-ching once | One toast, "n logged", one pip | routine |
| No Spend check-in | `celebrate` (existing) | cha-ching (existing) | Bubby `munch`, and the day dot pops (`DailyCheckinStreakBar.tsx:278-283`) | routine+ |
| Inbox swipe triage | `lightTap` | `playSoftPop()` | Card flies off (owned by the inbox plan), Bubby `nod` | routine |
| Inbox zero | `celebrate` | `playSuccessSound()` | Confetti burst, Bubby `celebrate`, toast | **milestone** |
| Couple day completed | `celebrate` | `playSuccessSound()` | Bubby hearts, toast "Couple day! 🔥 n" | milestone-lite |
| Couple streak 7/14/30/50/100 | `celebrate` | `playSuccessSound()` | Confetti and toast | **milestone** |
| Stage up | `celebrate` | `playSuccessSound()` | Confetti, a 350ms glow-and-swap from old to new body, non-modal banner "Bubby hatched!" / "Bubby grew!" with "Meet Bubby" (opens sheet) and "Nice!" | **milestone** |
| Accessory unlocked | `goalMilestone` | `playSuccessSound()` | Toast "New: Kopi Cup" with "Try it on" (opens sheet on the item) | milestone-lite |
| Equip accessory | `lightTap` | `playSoftPop()` | Item drops onto Bubby (250ms), then Bubby `cheer` | routine |
| Goal deposit | `goalMilestone` (existing) | `playSoftPop()` | Bubby `cheer`. Reaching 100% of a goal is a **milestone** (confetti and success chime) | routine / milestone |
| Surplus sweep / bank | `sweep` (existing) | cha-ching (existing) | Bubby `celebrate`, confetti only on sweep | milestone |
| Pull to refresh | `lightTap` (existing) | none | Bubby peeks over the refresh indicator (`PullToRefresh.tsx`) | — |
| Category crosses 80% / 100% | existing warning/alert | existing | Bubby **does not** react negatively. Base mood may become `focused` or `snug` on the next derive | — |
| Save error | `warning` | none | Existing `<Alert variant="danger">`. Bubby stays as it is (no sad face for errors) | — |

**Sounds (new, in `soundEffects.ts`, same Web Audio pattern and gate):**
- `playSoftPop()`: a ~70ms sine blip at 880→660Hz, gain 0.06
- `playSuccessSound()`: a C6-E6-G6 arpeggio, ~420ms, gain ≤0.18. This makes the AGENTS.md §5D reference real.

**Haptics:** add `haptics.tick` (8ms) and reuse the existing patterns. iOS has no `navigator.vibrate`, so on iPhones the visual and audio cues carry the feedback (open question 2).

## 8. App-open moment

- **Trigger:** first render of the app shell after a cold start, or a `visibilitychange` to visible after ≥4h away (`lastGreetingAt`). At most once per 4h.
- **What happens** (no splash; it renders **with** the page, never before it):
  1. Content paints normally: `Suspense` route skeleton → page.
  2. After the first data paint (`requestIdleCallback`, with a `setTimeout(…, 150)` fallback), the header Bubby plays `wave` (350ms).
  3. A speech bubble appears next to the Home `PageHeader` (Home only) for 2.5s, then fades out (150ms).
  4. It is `pointer-events-none`, apart from the bubble being tappable to open the Bubby sheet. It never sits over the FAB or a primary control.
- **Greeting copy** is ≤4 words and picks one line from state:
  - inbox has items: "3 to sort", which is tappable and opens the inbox (needs the inbox plan)
  - sleepy or lonely: "Missed you!"
  - not logged today and after 18:00: "Log today?"
  - morning: "Morning! ☕"
  - lunch, 11:30–14:00: "Makan time?"
  - logged and couple day: "Couple day ✓"
  - otherwise: "Hi again!"
- **Skips:**
  - the greeting is cancelled as soon as the user taps anything, so the first interaction always wins
  - not shown during the PIN screen (`PinLoginScreen`)
  - not shown when deep-linked into a modal (`/fast-log`)
  - reduced motion: no wave, and the bubble appears and disappears instantly
- **Stage-up and unlock checks** run here too. A pending "Bubby grew!" takes the slot instead of the greeting, so only one moment plays per open.

## 9. Performance & accessibility budget

| Budget | Target |
|---|---|
| Added JS, initial route | ≤6 KB gz (`<Bubby>` core, `feedback`, `growth`). Sheet, recap and confetti are lazy |
| SVG parts, total | ≤8 KB gz. No raster assets |
| Derivation | `deriveBubbyState` ≤2ms for 2,000 rows (unit-benchmarked), memoised on `checkins` and `today` |
| Network | +0 requests on open. `StreakChip` moves to the shared query, which **removes** the per-call `household_members` fetch. `useBubby` refetches on focus at most once a minute |
| Animation | `transform`/`opacity` only. Reactions ≤400ms. Confetti ≤1.2s, at most 24 nodes, unmounted on end, `pointer-events-none`. `will-change` only while running |
| Input | No feedback awaits anything before `onClose()` / navigation. Toast and greeting never capture taps outside their own box |
| Idle | Blink loop every 5s ±1s (CSS, 120ms), paused when `document.hidden` and when reduced motion is on. No other infinite loops |
| Reduced motion | Extend the `@media (prefers-reduced-motion: reduce)` block (`index.css:487`) to cover every new `bubby-*`, `confetti-*`, `pip-float` and toast class (`animation: none`). `feedback.ts` also checks `matchMedia` and skips confetti mounts. The existing `chaChingPop`/confetti classes (`index.css:389-462`) should be added too (today they still animate) |
| Mute | All sounds via `isSoundEffectsEnabled()`. All haptics via `isHapticsEnabled()` |
| A11y | `<Bubby>` gets `role="img"` and an aria-label with stage and mood ("Bubby, chick, sleepy"). `size="xs"` inside a button is `aria-hidden`, and the button is labelled "Bubby". Milestone toasts use `role="status" aria-live="polite"`. Routine reactions are silent to screen readers. Accessory grid uses buttons with `aria-pressed`. Locked items say "Locked, 40 🐾" |

## 10. Components & files

**Add**

| File | What |
|---|---|
| `src/lib/bubby/growth.ts` | `deriveBubbyState`, `STAGES`, `pointsForDay`, high-water-mark merge |
| `src/lib/bubby/accessories.ts` | `ACCESSORIES` (id, slot, label, unlock rule), `getUnlocked(state)` |
| `src/lib/bubby/moods.ts` | `deriveBaseMood(state, pace, now, checkinTime)`, `MOOD_FACE` map, reaction types |
| `src/lib/bubby/anchors.ts` | Per-stage anchor transforms |
| `src/lib/bubby/storage.ts` | Safe `bb_bubby_v1` read/write |
| `src/lib/bubby/activity.ts` | `recordActivityCheckin(memberId)` |
| `src/lib/bubby/recap.ts` | `buildWeeklyRecap(...)` with win selection |
| `src/lib/delight/feedback.ts` | `feedback.routine(kind)`, `feedback.milestone(kind, payload)`, rate limit and dedupe, dispatches `bubby:react` |
| `src/lib/members.ts` | `resolveLoggedInMember` (extracted from `BulkAddExpenseModal.tsx:108-112`) |
| `src/hooks/useBubby.ts` | Query, derive, mood, `react(kind)` subscription (latest reaction with auto-clear) |
| `src/components/bubby/Bubby.tsx` | Layered SVG root (`stage`, `mood`, `reaction`, `equipped`, `size`) |
| `src/components/bubby/parts/*.tsx` | `StageBody` (6 bodies), `Eyes`, `Brows`, `Beak`, `Cheeks`, `Fx` |
| `src/components/bubby/accessories/*.tsx` | One small component per accessory |
| `src/components/bubby/BubbyAvatarButton.tsx` | Header and sidebar button |
| `src/components/bubby/BubbySheet.tsx` | Lazy modal (stage, progress, today row, accessories) |
| `src/components/bubby/BubbyGreeting.tsx` | Speech bubble for the app-open moment |
| `src/components/bubby/MilestoneToast.tsx` | Shared milestone toast and banner (stage up, unlock, couple day, inbox zero) with dual actions |
| `src/components/ui/ConfettiBurst.tsx` | Lightweight, reduced-motion aware |
| `src/components/dashboard/WeeklyRecapCard.tsx` | Lazy |
| `src/components/bubby/DelightHost.tsx` | Mounted once in `App.tsx`. Listens for `bubby:react`, `expenseAdded`, inbox events and stage diffs, and hosts confetti and milestone toasts |

**Touch**

| File | Change |
|---|---|
| `src/App.tsx:227` | Mount `<DelightHost />` next to `ExpenseSuccessCelebration` |
| `src/components/layout/AppHeader.tsx:199-202` | `BubbyIcon` → `BubbyAvatarButton` |
| `src/components/layout/DesktopSidebar.tsx:103` | Same |
| `src/components/layout/StreakChip.tsx` | Switch to `useBubby` / shared query; logged-in member instead of `members[0]`; "See Bubby" link |
| `src/components/dashboard/DailyCheckinStreakBar.tsx:85-139` | Use `feedback`, `munch`, invalidate query |
| `src/components/expenses/ExpenseSuccessCelebration.tsx` | Bubby badge, 2s, no confetti, skip `source: "inbox"`, first-of-day pip |
| `src/components/expenses/ExpenseFormModal.tsx:~640-680` | `recordActivityCheckin`; edit → `feedback.routine("edit")` |
| `src/components/expenses/BulkAddExpenseModal.tsx:356` | `recordActivityCheckin`; uses `resolveLoggedInMember` |
| `src/components/expenses/DeleteExpenseModal.tsx:65` | `feedback.routine("delete")` |
| `src/components/goals/QuickDepositModal.tsx:91` | `feedback` (goal 100% = milestone) |
| `src/components/budget/SurplusSweepModal.tsx:206` | `feedback.milestone("sweep")` |
| `src/components/layout/MobileBottomNav.tsx:86-96` | FAB press scale; optional Android `tick` |
| `src/pages/DashboardPage.tsx:111` | `PageHeader` hosts `BubbyGreeting`; lazy `WeeklyRecapCard` under the hero |
| `src/lib/soundEffects.ts` | `playSoftPop`, `playSuccessSound` |
| `src/lib/haptics.ts` | `tick` |
| `src/index.css` | `bubby-hop`, `bubby-wave`, `bubby-wiggle`, `bubby-blink`, `bubby-poof`, `pip-float`, `confetti-fall` keyframes; reduced-motion block extension |
| `src/components/ui/index.ts` | Export `ConfettiBurst` |

## 11. Tests

Unit tests (Vitest, new files in `tests/`):

- `bubbyGrowth.test.ts`:
  - points per day (single, couple, on-a-roll)
  - stage thresholds at the boundaries (5/6, 19/20…)
  - never regresses (high-water mark; deleted rows)
  - couple streak with a pending today
  - SGT date boundaries
  - logger-vs-payer rows
- `bubbyAccessories.test.ts`: each unlock rule, and slot exclusivity.
- `bubbyMoods.test.ts`: table-driven state machine, including:
  - morning gap = idle, not sleepy
  - pacing never produces a negative mood
  - absence beats pacing
  - a reaction overrides then clears
- `weeklyRecap.test.ts`: week bounds (Mon–Sun SGT, weeks spanning a month boundary), top category, win priority, fallback win always present.
- `delightFeedback.test.ts`:
  - mute skips sound
  - reduced motion skips confetti and haptics
  - rate limit degrades a second milestone within 8s
  - dedupe (inbox zero once a day)
- `soundEffects.test.ts` / `haptics.test.ts`: extend for `playSoftPop`, `playSuccessSound` and `tick` gating.

Component tests (RTL):

- `Bubby.test.tsx`: renders the right `data-layer` set per stage; accessories appear only from Hatchling up; aria-label.
- `DelightHost.test.tsx`:
  - `expenseAdded` → routine
  - `expenseAdded` with `source: "inbox"` → no toast
  - `inboxTriaged remaining 0` after >0 → confetti once
  - inbox at 0 on load → nothing
- `BubbyGreeting.test.tsx`:
  - the FAB stays clickable while the greeting shows
  - any pointerdown cancels the greeting
  - suppressed within 4h
- Update `tests/hapticsTouchpoints.test.tsx`, `tests/StreakAndNotifications.test.tsx` (StreakChip now on the query) and `tests/DeclutterHome.test.tsx`. Home stays decluttered: the recap is conditional and the greeting is not a card.

E2E (Playwright):

- `e2e/delight.spec.ts`: add an expense via the FAB, then check the toast shows and the header Bubby `data-mood` becomes happy. With `reducedMotion: 'reduce'`, check no element has a running animation (`getAnimations()` is empty).
- Re-run `quick-add-expense.spec.ts` to confirm no regression in time-to-close.

The quality gate (`npm run lint` 0/0, `npm run build`, `npm test`, and `npm run test:e2e` for UI changes) applies to every commit (AGENTS.md §7C).

## 12. Phased rollout & commit breakdown

Ordered by delight per unit of effort. Each phase is its own branch and PR from an up-to-date `main`. Nothing ships a migration until Phase 3, and only if the user wants it.

**Phase 1: "Bubby comes alive"** (`feat/bubby-core`): the biggest win. A living, growing mascot in the header, honest check-ins, and quieter routine saves.
1. `feat(delight): add feedback module, soft pop and success sounds`: `feedback.ts`, `playSoftPop`, `playSuccessSound`, `haptics.tick`, tests.
2. `fix(streak): check in the logged-in member for today on every log`: `members.ts`, `activity.ts`, wired into the expense form and bulk add, tests.
3. `feat(bubby): derive growth, stages and moods from check-ins`: `growth.ts`, `moods.ts`, `accessories.ts`, `storage.ts`, `useBubby`, tests.
4. `feat(bubby): layered SVG Bubby with stage bodies and mood faces`: `Bubby.tsx`, parts, anchors, CSS keyframes and reduced motion.
5. `feat(bubby): live Bubby avatar in header and sidebar`: `BubbyAvatarButton`, `DelightHost`, reactions on add, edit, delete and no-spend.
6. `refactor(streak): StreakChip on shared check-in query`.
7. `feat(expenses): compact Bubby save toast, first-log pip`: `ExpenseSuccessCelebration` changes.

**Phase 2: "Moments"** (`feat/bubby-moments`)
1. `feat(ui): ConfettiBurst primitive`.
2. `feat(bubby): stage-up and unlock milestones`: `MilestoneToast`, seen-state diffing.
3. `feat(bubby): app-open greeting`: `BubbyGreeting`.
4. `feat(bubby): Bubby sheet with progress, today row and accessories`.
5. `feat(bubby): couple-day and couple-streak milestones`.
6. `feat(delight): micro-interactions on FAB, nav, goals, sweep`: the remaining catalogue rows.

**Phase 3: "Rituals"** (`feat/weekly-recap`, `feat/inbox-zero-delight`)
1. `feat(home): weekly recap card`: `recap.ts`, `WeeklyRecapCard`, tests.
2. `feat(delight): inbox triage and inbox-zero celebration`. **Blocked on the capture-inbox plan landing.** Wires the section 5 contract and adds the Sparkle Bow.
3. *(Optional, needs user approval and a user-applied migration)* `feat(bubby): sync equipped accessories via households.bubby_prefs` with `localStorage` fallback.

**Phase 4 (later, optional):** merge `StreakChip` into the Bubby avatar; seasonal accessories (CNY Ang Bao skin, National Day); partner push "Couple day ✓" via the notifications plan.

## 13. Open questions

1. **Expense toast:** OK to drop the confetti from the per-expense toast and shorten it to 2s (confetti is then only for milestones), while keeping the cha-ching sound? (Recommended: yes.)
2. **iOS haptics:** `navigator.vibrate` doesn't work in iOS Safari or PWAs, so both partners on iPhone get no haptics today. A known workaround is toggling a hidden `<input type="checkbox" switch>` (iOS 18+ system haptic). It's hacky, but needs no dependency. Try it behind a flag, or accept audio and visual feedback only?
3. **Equipped accessory sync:** is per-device fine (zero migration), or do you want the Phase 3 `households.bubby_prefs jsonb` column (additive; you apply it)?
4. **Growth pace:** reaching adult Bubby takes about 4 months, and the Crown about 8 months, at ~2.3 🐾/day. Faster or slower? Should past history count (Bubby hatches on day one of shipping), or should everyone start from a fresh egg?
5. **Partner nudge:** should completing a couple day, or "your partner logged", send a push? That would belong in the notifications plan rather than here.
6. **Streak chip:** keep the flame chip next to the Bubby avatar, or eventually fold it into Bubby (one header item fewer)?
7. **Recap perspective:** household totals always (recommended, since Bubby is shared), or follow the current perspective switcher?
8. **A "Celebrations" toggle:** add one in Notification Settings (sounds and haptics already exist), or rely on mute plus reduced motion?
9. **Inbox contract:** confirm the event names and payloads in section 5 with `capture-inbox.md`, especially `source: "inbox"` on `expenseAdded` and whether triage timestamps are stored (needed for a cross-device Sparkle Bow).
10. **New dependency:** none proposed. If hand-rolled confetti or SVG motion feels too limited after Phase 2, `canvas-confetti` (~6 KB) or `motion` would need your approval first.
