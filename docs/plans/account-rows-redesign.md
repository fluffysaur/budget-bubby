# Account rows redesign (#295)

Brokerage-style account rows and cards: institution logos, aligned columns, a
visible 6-month sparkline with a $/% change, and drag-to-reorder.

## Decisions

- **List header:** a bare row (no card) above the groups: "HOLDINGS" on the
  left; `$ | %` · compact/cards · `Edit` on the right. Every control is 36px
  tall in one chip style, with 44px tap targets. `$ | %` is stored per device
  (`bb:account-change-mode`); while editing it fades out but keeps its width,
  so nothing shifts.
- **Rows:** grid of avatar, name, sparkline, amount. The amount track is
  `--acct-amount`, in `ch` of the widest visible balance, so all rows and groups
  line up. Sparkline track is `clamp(4rem, 18vw, 7.5rem)`.
- **Figure size:** steps down as the widest balance grows, so the name keeps
  about 80px at 360px.
- **Change colour:** green when up, muted otherwise. Never red.
- **Logos:** `public/logos/<key>.png`, 128px square, drawn as a circle. Aliases
  live in `src/lib/institutionLogos.ts`. Unknown institutions get a coloured
  initial. Precached by the service worker; no third-party requests.
- **Order:** `accounts.sort_order`, shared by the household. Queries order by
  `sort_order nulls last, name`. `reorderAccounts(ids)` merges the visible ids
  into their type group (hidden accounts keep their slots) and writes only
  `sort_order`, never `updated_at`.
- **Drag:** motion `Reorder` + `useDragControls`, from the handle only. `Reorder`
  needs full `motion` components, so the edit list sits in its own non-strict
  `LazyMotion` with `domMax`. The app-wide provider stays strict.
- **Stale marker:** rows show the amber dot on the avatar. Cards show only the
  amber footer and its `(i)`, so the marker isn't repeated.
- **Cards in edit mode:** one column, because `Reorder` sorts along one axis.

## Database

`supabase/migrations/20261126000000_account_sort_order.sql` (already applied to
the live database). The backfill only fills empty values, so re-running it keeps
a saved order.

## Logo rights

Logos are third-party trademarks. Fine while the repo is private; revisit before
it goes public.
