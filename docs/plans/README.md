# Plans: Nov 2026 fixes and enhancements

| Plan | Scope | DB change (user applies) |
|---|---|---|
| [ui-polish.md](./ui-polish.md) | Cap text, waterfall, iPhone zoom, allocation warnings, Track cap / Set aside toggle | `categories.group` column (nullable, app works without it) |
| [bulk-add.md](./bulk-add.md) | Bulk Log → Bulk Add, rows only, mobile cards | None |
| [bonus-log.md](./bonus-log.md) | Dated bonus entries, split, goal funding, Plan > Bonus log | `bonus_events`, `bonus_goal_contributions`, `bonus_split_defaults` + 2 RPCs |
| [capture-inbox.md](./capture-inbox.md) | Apple Pay Shortcut → Inbox, triage, smarter reminders | `inbox_items`, `merchant_rules`, `capture_tokens` + RPC + Edge Function |
| [delight-bubby.md](./delight-bubby.md) | Growing Bubby, moods, couple streak, recap, micro-interactions | None (optional `households.bubby_prefs`) |
| [app-polish.md](./app-polish.md) | Data-bug fixes, offline queue, motion system, copy trim, visual meters (9 PRs, 4 lanes). Leftovers go to [backlog.md](../backlog.md). | None (backlog items may need SQL) |

## Cross-plan decisions (these override the individual plans)

1. **Category guessing has one home: `src/lib/categoryGuess.ts`.** Built from the `ExpenseFormModal` keyword table, as in bulk-add.md. capture-inbox.md must import it instead of extracting `findCategoryByKeyword` from `expenseParser.ts`. The merchant-rule and history lookups from capture-inbox.md sit in front of it.
2. **Inbox event names come from capture-inbox.md:** `inbox:items-arrived`, `inbox:item-confirmed`, `inbox:item-discarded`, `inbox:cleared`, `day:logged`. Map delight-bubby.md's `inboxTriaged` to `inbox:item-confirmed` / `inbox:item-discarded` (the payload carries `remaining`), and map `inboxZero` to `inbox:cleared`. Expenses confirmed from the inbox still dispatch `expenseAdded`, with `detail.source = "inbox"` so the per-save toast is skipped.
3. **Check-ins:** `confirm_inbox_item` checks in on the purchase date, server side. `recordActivityCheckin()` from delight-bubby.md also checks in the logged-in member for today. Both insert with `on conflict do nothing`, so they don't clash.
4. **`playSuccessSound()` does not exist yet.** Whichever plan ships first adds it to `src/lib/soundEffects.ts`.
5. **`expenseParser.ts` is deleted only after** bulk-add and capture-inbox both stop using it, together with the AGENTS.md 5C bullet. This needs the user's OK.

## User decisions (2026-11-05)

- **Devices: one Android (user) and one iPhone (partner).** The Apple Pay Wallet trigger only covers the iPhone. capture-inbox.md needs an Android capture path to the same endpoint and token: an automation app such as MacroDroid or Tasker reads payment notifications (Google Wallet / bank app) and POSTs them. The setup steps and the parsing of notification text still need planning. Haptics work on Android, so the iOS haptics gap affects only the partner.
- **Delete `expenseParser.ts` and the AGENTS.md 5C bullet**, once bulk-add and capture-inbox no longer use it.
- **Each partner sees the other's Inbox** (household-wide read access, and either partner can triage).

## Suggested order

1. UI polish (small and visible; the column migration is optional)
2. Bulk Add (includes the split_ratio bug fix)
3. Capture & Inbox phase 0 (deep-link prefill; fixes the dead `?action=new` shortcut; no DB change)
4. Delight phase 1 (live Bubby, correct check-ins, quieter save toast)
5. Bonus log (after the migration is applied)
6. Capture & Inbox phases 1–5 (after the migration and function deploy)
7. Delight phases 2–3 (milestones, recap, inbox zero)
