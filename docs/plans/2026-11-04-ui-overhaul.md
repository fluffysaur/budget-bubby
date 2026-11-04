# UI Overhaul Plan

Date: 2026-11-04
Status: Agreed, in progress (PR 2 ready for review)

## Problem

The app feels complex and cluttered, and its styling is inconsistent. This plan
covers the open items in [`Comments for Site 1.md`](../../src/pages/Comments%20for%20Site%201.md),
plus an audit against `AGENTS.md`.

What we found:

| Issue | Where |
|---|---|
| Amounts use different weights and sizes on each page. `<CurrencyText>` is used once and `formatSGD()` 184 times, each styled by hand | all pages |
| The Dashboard has about 8 blocks competing for attention | `DashboardPage` |
| Add Expense shows about 13 controls at once | `QuickAddExpenseModal` (1,187 lines) |
| There are two separate expense-logging UIs | `QuickAddExpenseModal`, `FastLogWidget` |
| Each of 7 pages handles perspective (Yi Jia / Rachel / Combined) itself. `PerspectiveBanner` is unused | pages, `layout/PerspectiveBanner.tsx` |
| Cards don't stand out enough from the background, and some text may be low contrast | tokens in `index.css` |
| Loans aren't used | `components/loans`, `LoansPage` |
| "Cannot coerce the result to a single JSON object" when adding an expense | add-expense save path |

Already done: the demo PIN 000000, the logout confirmation, removing the SGD and Live Supabase labels from the header, the expense celebration, search in Update Balances, and the `max-w-5xl` content width.

## Decisions

1. **Simplify first, then polish.**
2. **Mobile PWA first.** Desktop must work well, but comes second.
3. **Keep the Warm Oat style.** Fix how consistently it's used. Don't restyle.
4. **Backlog:** the comments file plus an `AGENTS.md` audit.
5. **Ship small PRs, one theme each**, each cut from an up-to-date `main`.
6. **Three core jobs** get the prime spots:
    - log an expense
    - see how much budget is left this month
    - update balances
7. **Dashboard:**
    - Keep budget left (the main figure), Add Expense, at most one alert, and upcoming bills.
    - Move net worth to Accounts, shared goals to Plan, and settlement to Spend.
    - The streak becomes a small chip in the header.
8. **Add Expense:**
    - Show amount, category and note by default.
    - Everything else goes under a closed "More" section, with defaults of today, the current user, and the last split used.
9. **One logging flow:** `FastLogWidget` merges into Add Expense, and `/fast-log` opens it.
10. **Perspective switch:** lives only in the header avatar menu. Remove the per-page chips and delete `PerspectiveBanner`.
11. **Feature cuts:** only loans. Tags, FX, the streak and fund-from-goal stay, but are tucked away.
12. **Loans removal:**
    - Remove the page, components, simulator, services, mock and seed data, and tests.
    - Keep the `loans` table and its rows. There's no migration.
    - Keep a **Loans** tab showing a placeholder.
13. **Loans placeholder:**
    - A new inline SVG `BubbyConstruction`: Bubby in a butter hard hat, tapping a hammer on coin-bricks. The hammer stays still when reduced motion is on.
    - Copy: **Under Construction** / "Bubby is building something for your loans." / no button.
    - `AGENTS.md` gets a note allowing a placeholder state with no button.
14. **Net worth:** liabilities came only from loans, and credit cards were never counted, so net worth is now **total assets**. The numbers shown don't change. Remove the "Debt Payoff Phase" and "% Covered" pills and the Liabilities card and chart series.
15. **Plan tabs:** Goals · Recurring · Bonus · Loans. Goals is the default and Loans is last.
16. **Money display:**
    - Every amount uses `<CurrencyText>` with the sizes `hero`, `lg`, `md` and `sm`, each with one fixed weight.
    - A lint or test guard flags styled `formatSGD` in JSX.
17. **Cards and contrast:**
    - Token-level fixes, with `elevation="sm"` as the default for cards.
    - More separation between the canvas and cards.
    - Text below WCAG AA contrast is darkened.
18. **Modals:** every form modal is a bottom sheet that slides up on mobile and a centred dialog that fades and scales on desktop (`AnimatedModal` with `isDrawerOnMobile`).
19. **Verification:** each UI PR includes before/after Playwright screenshots at 390px and 1280px of the pages it changes.

## PRs (in order)

1. ~~**`fix/add-expense-coerce`**~~: **already fixed** in `67592f7` (Oct 22). `addExpense` no longer uses `.single()`, and every add path goes through it. No PR needed.
2. **`refactor/remove-loans`**: Decisions 12–15.
3. **`refactor/declutter`**: Decisions 7 and 10.
4. **`feat/ui-tokens`**: Decisions 16–17.
5. **`refactor/add-expense-minimal`**: Decisions 8–9.
6. **`feat/ui-modals`**: Decision 18.

## Coordination with the notifications work

[`2026-11-04-notifications.md`](2026-11-04-notifications.md) is being worked on in parallel. These areas overlap:

- **PR 2 and notifications Phase 1** both edit `src/types/finance.ts` and the finance services. Rebase on whichever merges first.
- **PR 3** edits `AppHeader` (perspective switch, streak chip), which hosts `NotificationCenterPopover`. Don't change the popover itself. The notifications work owns it, its copy, and the check-in sheet.
- **PR 6** should leave `NotificationSettingsModal` until notifications Phase 2 has merged, then convert it.

## Follow-ups found during the work

- **Fake net-worth history:** when no data is passed, `NetWorthChart` invents the previous 4 months by multiplying today's total by 0.93–0.985. Replace this with real `account_snapshots` history (the unused `calculateMonthlyBalanceTrends` already does that), or hide the chart until there is history.
- **Card debt in net worth:** optionally count unpaid credit-card statements as liabilities. That would be a new behaviour, so it's a separate decision.

## Out of scope

- Removing other features.
- Database migrations of any kind.
