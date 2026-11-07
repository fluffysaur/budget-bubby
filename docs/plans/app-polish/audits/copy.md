# Budget Bubby copy and visual audit (read-only)

> Snapshot from 2026-11-07, taken on `feat/delight-bubby` before it merged. Line numbers may drift; search for the quoted code if a line does not match.


Scope: src/pages and src/components. Method: string sweep plus close reads of the densest screens. Paths below are relative to src/. Line numbers are as of branch feat/delight-bubby. This is not a line-by-line read of the biggest form modals (ExpenseFormModal, BaseProfileEditorModal, ManageCategoriesModal, BulkAddExpenseModal, ExpenseFilterBar), so findings there are partial.

Overall: the pages are mostly clean. Page headers (Home, Spend, Accounts, Plan, Budget, Goals, Recurring, Inbox) and the 2-word empty-state titles on the new pages follow AGENTS.md section 6. The debt sits in older components (credit cards, goals, trends, cumulative surplus, category lists, modals) and in number density on phone screens.

---------------------------------------------------------------------
## 0. Top 10 screens, worst on mobile first

1. **Budget page, category list** (pages/BudgetPage.tsx + components/budget/CategoryProgressList.tsx). Each category card shows 3 numbers, a % in the name, a status pill with another %, an over/remaining line and a "Rose Cap Exceeded" badge. With 8+ categories this is 40+ numbers. Replace with a ring or bar row. See section 1.
2. **Goals page, GoalCard** (components/goals/GoalCard.tsx:176-285). Each goal shows a 2x2 grid (Target, Saved, Goal Spend, Balance), a % bar, then Current Monthly and Required Pace rows. That is 7 or more numbers per goal, and the 4 stat tiles repeat the page-level cards.
3. **Spend page, ExpenseTrendsCard** (components/expenses/ExpenseTrendsCard.tsx). Three KPI tiles each with a caption, a delta badge, a bar chart with axis labels and an Avg label, then a per-category "Current / Avg" list. It sits right under four StatCards. Shrink to a sparkline plus one delta badge.
4. **Credit card tracker** (components/accounts/CreditCardTrackerSection.tsx:338-665). It has a long header sentence, three StatCards with sentence subtitles, a 3-column spec grid on every card (Statement Day / Due Day / Limit), a statement block, a due pill and notes. Per-card number count is about 6.
5. **Spend page summary strip** (pages/ExpensesPage.tsx:390-495). 4 StatCards, with a 3-number footer inside the first one and a 160-character tooltip. About 10 numbers before the ledger.
6. **Home hero** (pages/DashboardPage.tsx:150-235). A 2-column grid of category meter cards on a phone, each with a name, %, "S$X left" and a bar. The bar and % duplicate each other. Move to ring plus colour (see section 1).
7. **Notification settings modal** (components/layout/NotificationSettingsModal.tsx:186-620). It has 5 sections, about 10 toggles each with a description, plus thresholds and times. Group into collapsibles and trim copy.
8. **Cumulative surplus card** (components/budget/CumulativeSurplusCard.tsx:255-420). The title is 3 words. Two tiles show the same figure twice ("Historical Rollover" S$X, then "Total Banked Surplus: S$X"). A 40-word tooltip and a mini chart sit beneath.
9. **Budget stat strip + waterfall** (pages/BudgetPage.tsx:255-300 and components/budget/BudgetWaterfall.tsx). 4 StatCards (Gross, Deductions, Take-Home, Spent) and a 10-row waterfall repeat the same pay figures.
10. **Accounts list** (components/accounts/AccountGroupList.tsx:255-300). The group header shows a title, a count pill, a description and a subtotal with "% of assets". Each account card repeats an institution, a notes line, a balance and a "Updated ..." footer.

Honourable mentions: SurplusSweepModal and BankSurplusModal (celebration paragraph plus a callout plus a footer note), PinLoginScreen (long biometric copy), UpdateBalanceModal (subtitle plus counters), AutoCaptureSection setup steps (already collapsed, fine).

### Visual ideas that need NEW shared components (build once, reuse)

| Component | Replaces | Used by |
|---|---|---|
| `ProgressRing` (value, tone auto-from-pct, centre label slot) | per-category %/left/bar triples and goal "x%" | Home hero meters, CategoryProgressList, GoalCard, QuestCard |
| `MeterBar` (spent vs cap, tone thresholds 80/100, optional marker for pace) | five hand-rolled bars (DashboardPage:196-214, CategoriesHeader, ExpensesPage:421-433, CategoryProgressList:261-275, GoalCard) | all of them |
| `Sparkline` (tiny recharts or SVG, no axes, last point highlighted) | ExpenseTrendsCard bar chart + 3 KPI tiles, NetWorthChart on mobile, CumulativeSurplus history | Spend, Accounts, Budget |
| `DeltaBadge` (arrow + %, tone) | "+12% vs 3-mo avg", WeeklyRecap change, "Over/Left" | Spend, Home, Budget |
| `StatusDot` / `StatusPill` (icon + tone from a status enum: ok/near/over/paid/due/overdue) | CC due pills, goal status chips, category status pill, "Rose Cap Exceeded" | Budget, Accounts, Goals |
| `AvatarDot` (member colour/emoji, size xs-sm) with `AvatarDotGroup` | "Shared", "Partner's share", payer text in ledger, owner labels on accounts/goals, "Mine / Shared" | Spend, Accounts, Goals, Inbox |
| `StatCard` variants: `ring`, `sparkline`, and `compact` (value only, tooltip behind info icon) | StatCard subtitle sentences and footers | everywhere |
| `StatRow` (icon + number, label as tooltip/aria only) | "Statement Day / Due Day / Limit", GoalCard 2x2, trends KPIs | Accounts, Goals, Spend |
| `StackedBar` (segments by category colour) | Waterfall rows, Allocation list, Income Flow, bonus split | Budget, Bonus |
| `CalendarStrip` / dot row (day dots with fill state) | Upcoming Bills "Due in X days", CC due countdown, quests | Home, Accounts |
| `InfoCollapsible` (a "Learn more" row built on CollapsibleSection) | long modal blurbs, SurplusSweep callout, PIN biometric text | modals |

---------------------------------------------------------------------
## 1. Cross-cutting findings

- **Percent + bar + amount triples.** Wherever a bar is shown, the % is often printed beside it as well (DashboardPage:196, CategoryProgressList:181/252, GoalCard:253). Pick one: the bar carries the % and colour carries the status; show only the remaining amount.
- **Five hand-rolled progress bars** with different heights and colours (see MeterBar above). Consolidate.
- **Hardcoded colours** in these visuals (`#f76b57`, `#9a1b1b`, `bg-emerald-500`) violate the token rule in section 1/5. Fold them into MeterBar/ProgressRing tone tokens.
- **Rose/slate/indigo utility classes** (`bg-rose-50`, `bg-slate-100`, `text-indigo-600`) remain in StatCard iconBg props (BudgetPage:262-300, ExpensesPage:408-480, RecurringPage:260-275, CreditCardTrackerSection:402-430, AccountsPage:220). AGENTS.md prefers pastel tokens. Not copy, but the same refactor can add a `tone` prop to StatCard.
- **Tooltips are already used well in places** (BudgetPage tooltips are short) but ExpensesPage:404, ExpenseTrendsCard:76, CumulativeSurplusCard:270 and BubbySheet:59 are 30-60 word paragraphs. Keep to one line plus a "Learn more" collapsible.
- **Redundant footer notes** in modals ("This action cannot be undone", "Deploy banked surplus ... anytime", "Click any tag to filter...") should be removed.
- **Date/time suffixes** like `1th`/`2th` ordinal bug: CreditCardTrackerSection:569,577 prints `{card.billing_day}th` for every day (1th, 2th, 22th). Copy bug, fix with an ordinal helper or show the number only.

---------------------------------------------------------------------
## 2. Findings by area

Legend: **R6** = AGENTS.md section 6 rule. Each row: location - current text - problem - proposed replacement.

### 2.1 Home (pages/DashboardPage.tsx, components/dashboard, components/bubby)

| Location | Current | Problem | Proposed |
|---|---|---|---|
| pages/DashboardPage.tsx:164 | label "Left to Spend" with `S$X of S$Y spent` line (l.177-180) | Fine headline, but the line repeats what the bar shows. | Keep hero number. Drop "of ... spent" or show as `S$Y cap` muted. Or put the figures behind a tap. |
| pages/DashboardPage.tsx:186-188 | "Budget" shortcut button | OK (1 word). | None. |
| pages/DashboardPage.tsx:193-250 | per-category card: name, `{pct}%`, `S$X left`, bar | Number heavy on a 2-col phone grid: 4 items per tile x 4 tiles. % and bar duplicate. | `ProgressRing` (36px) with category colour dot and icon, amount left under it. Drop the `left` word (use `+`/`-` sign colour). Cap at 4 tiles, rest behind "More". |
| components/dashboard/WeeklyRecapCard.tsx:92-148 | "Last Week" + amount + delta badge + top category + win text + 7 day-dot rows + 2 buttons ("See Spend", "Nice!") | Dense but mostly visual. The win text and two buttons can be one. | Single `See Spend` button plus tap-to-dismiss on the card. Keep dots. |
| components/dashboard/UpcomingBillsWidget.tsx:78 | "Next due from Recurring" | Redundant subtitle under "Upcoming Bills". | Remove subtitle (title says it). |
| components/dashboard/UpcomingBillsWidget.tsx:109 | empty state "Nothing Due" / "Add a recurring item to track due dates." | Title is 2 words, prompt is 1 sentence, but no CTA button. R6 empty states formula violation. | Add `Add Recurring` button. |
| components/dashboard/UpcomingBillsWidget.tsx:140-155 | `Due in 3 days` + `• monthly` + amount + `~S$X/mo` | 4 text items per row. | `StatusPill` (days) + amount. Frequency as a small repeat icon. Drop `~S$X/mo` (show in Recurring page). |
| components/dashboard/QuestCard.tsx:50-70 | "Today" label + dots + quest list + "No Spend Today" button | Fine. | None. |
| components/bubby/BubbySheet.tsx:59-63 | tooltip "Logging spend and petting Bubby are food 🍤. Clearing the inbox, updating balances, adding to goals, month-end sweeps and reading the recap are exercise 💪. Lots of food makes Bubby chubby, lots of exercise makes it lean, and both make it buff." | 4-sentence paragraph. | Replace with two icon rows: `🍤 Log spend, pet Bubby` and `💪 Sort inbox, update balances, add to goals, sweep, read recap`. |
| components/bubby/BubbySheet.tsx:83 | "Finish a week's quests to earn a treat." | OK as a prompt, but this is an empty state with no title. | Title `No Snacks`, keep the sentence. |
| components/inbox/InboxHomeCard.tsx:31-34 | `{n} to sort` + `S$X unsorted` + "Sort Now" | Good. "unsorted" repeats "to sort". | `S$X waiting`. Or show a count badge only. |

### 2.2 Spend / Expenses (pages/ExpensesPage.tsx, components/expenses)

| Location | Current | Problem | Proposed |
|---|---|---|---|
| pages/ExpensesPage.tsx:325,334,350,360 | aria-labels "+ Bulk Add", "+ Add Expense" | Visible labels not checked; "+ Add Expense" is 3 words (OK). | Keep. |
| pages/ExpensesPage.tsx:397-401 | StatCard "Spendable" subtitle `S$X/day · 12d left` or `+S$X surplus` / `-S$X deficit` | Token style, acceptable, but pairs with a footer repeating figures. | Subtitle `12d left`. Move `/day` to tooltip. |
| pages/ExpensesPage.tsx:404 | tooltip "Remaining allowance for day-to-day spendable categories (Food, Lifestyle, Transport, Buffer). Excludes goal-funded purchases. In personal view, shared expenses count at your 50% share." | 3 sentences, 28 words. | `Day-to-day categories only. Goal-funded spends excluded.` Move the personal-view note to a Learn-more line. |
| pages/ExpensesPage.tsx:413-434 | footer `Spent S$X` / `Limit S$Y` + bar + Sweep link | Repeats numbers the card value already implies. | `MeterBar` with the amounts as tooltip. Keep the `Sweep S$X →` link as a `Sweep` button with an icon. |
| pages/ExpensesPage.tsx:454 | "Spent" subtitle `12 transactions` | Fine (token). | None. |
| pages/ExpensesPage.tsx:464 | "Shared" tooltip "Shared couple expenses split 50/50 by default unless a custom ratio is set." | Single sentence, fine. | None. |
| pages/ExpensesPage.tsx:474 | "Unsettled" subtitle = `settlement.settlementText` (sentence such as "X owes Y") | Sentence subtitle. | `AvatarDot(owes) -> AvatarDot(owed)` with the amount as the value. |
| pages/ExpensesPage.tsx:541-545 | "Tags & Trips" with a count pill | OK. | None. |
| pages/ExpensesPage.tsx:~500 | ConfirmModal copy "Mark all shared expenses as settled? The S$X balance resets to S$0.00." | Two sentences; amount already in the card. | `Mark shared expenses settled?` |
| components/expenses/ExpenseTrendsCard.tsx:63 | "Monthly Expense Trends & Averages" | R6: this exact phrase is the banned example; it should be "Spend Trends". | `Spend Trends` (already used on the page wrapper at ExpensesPage:526, so the card header is redundant: remove). |
| ExpenseTrendsCard.tsx:76 | tooltip "Tracks monthly spendable expenses (Food, Lifestyle, Transport, Buffer) including active monthly subscriptions in Lifestyle. In Personal view, shared 50/50 expenses count at your 50% share..." | 40-60 word paragraph. | `Spendable categories plus subscriptions. Personal view uses your share.` |
| ExpenseTrendsCard.tsx:80-83 | `{perspectiveLabel} • 6-month history & category benchmarks` | Redundant subtitle. | Remove, or `6 months`. |
| ExpenseTrendsCard.tsx:98-100 | badge `-8% vs 3-mo avg` | Good, keep as `DeltaBadge`. | None. |
| ExpenseTrendsCard.tsx:107-140 | 3 KPI tiles: "This Month / Spendable + subs", "3-Month Avg / Rolling benchmark", "6-Month Avg / Longer baseline" | The captions are filler. 3 big numbers + 3 captions + chart axis + Avg label = lots at once. | Drop all three captions. Keep this month as the hero, show averages as dashed reference lines on a `Sparkline`. |
| ExpenseTrendsCard.tsx:~190 | "Category Monthly Averages vs This Month" + "Current / Avg" | Long header, plus two numbers per row. | `Vs Average`. Per row: category colour dot + `MeterBar` (current vs avg marker). Amounts on tap. |
| components/expenses/SpendTagsOverviewCard.tsx:126-134 | "Spend Tags Overview" + "Cross-category tracking for big trips, renovations, and milestone events" | R6: header 3 words OK but "Overview" is filler, and the subtitle is a marketing sentence. | Title `Tags`. Delete the subtitle. |
| SpendTagsOverviewCard.tsx:266-267 | "Click any tag to filter the transaction ledger" | Instruction text; "Click" on mobile. | Remove (chips are obviously tappable). Keep `Tagged S$X`. |
| components/expenses/ExpenseListTable.tsx:311-313 | "No expenses found" + "There are no expenses matching your filter criteria. Try changing your filters or add a new expense." | R6 empty states: 3-word title, 2-sentence prompt. | Title `No Expenses`. Prompt `Clear filters or add one.` CTA `Reset Filters` (exists). |
| ExpenseListTable.tsx:293-296, ExpenseFilterBar.tsx:251-254 | sort options "Date (Newest first)", "Date (Oldest first)", "Amount (Highest first)", "Amount (Lowest first)" | Verbose. | `Newest`, `Oldest`, `Highest`, `Lowest`. |
| components/expenses/ExpenseFormModal.tsx:825 | tooltip "Goal spends draw from the goal's savings and are excluded from monthly budget caps." | One sentence, fine, but can be shorter. | `Paid from goal savings. Excluded from caps.` |
| ExpenseFormModal.tsx:875 | "No savings goals found." | Empty state with no CTA. | `No Goals` + `Add Goal` link. |
| ExpenseFormModal.tsx:958,1309 | placeholders "e.g., FairPrice Groceries, Grab, Lunch" and "e.g. VietnamTrip, Reimbursable" | Fine. | None. |
| ExpenseFormModal.tsx:1176 | "Partner's share" | Fine. Could be `AvatarDot` + %. | Optional. |
| ExpenseFormModal.tsx:1259 | "Remarks / Notes" | Two words for one idea. | `Notes`. |
| components/expenses/DeleteExpenseModal.tsx:86 | subtitle "This transaction will be permanently removed." | Redundant with the confirm button. | Remove subtitle. |
| DeleteExpenseModal.tsx:158-181 | Alert titles "Savings Goal Balance Restored:" and "Couple Settlement Adjusted:" with 2-3 line bodies | Sentence-level bodies; colons in titles. | `Goal refunded` / body `S$X returns to the goal.` and `Settlement updates` / body `Shared total recalculates.` Or an icon chip only. |

### 2.3 Budget (pages/BudgetPage.tsx, components/budget, components/categories)

| Location | Current | Problem | Proposed |
|---|---|---|---|
| pages/BudgetPage.tsx:216-228 | "Budget" + "Edit Budget" button | 2 words, fine. | `Edit` with a settings icon on mobile. |
| BudgetPage.tsx:259-300 | 4 StatCards 2x2 on mobile: Gross, Deductions, Take-Home, Spent | 4 big numbers + 2 bonus subtitles + 1 Over/Left line = 7 numbers before any category. | Collapse Gross/Deductions/Take-Home into the waterfall (already has them). Keep one hero card `Left S$X` with `MeterBar`. |
| BudgetPage.tsx:263,273,284 | tooltips ("Salary plus bonuses received this month." etc.) | Short, fine. | None. |
| BudgetPage.tsx:294-305 | subtitle `Over S$X` / `Left S$X` with coloured text | Token style, fine. | Replace with `DeltaBadge`. |
| BudgetPage.tsx:333 | empty state "No Categories" / "Add categories or restore presets to start tracking." | Follows formula, but it has 2 CTAs (Presets + add). R6 says 1 primary CTA. | Make `Add Category` the primary, `Presets` a ghost link. |
| BudgetPage.tsx:377-378 | "Allocations" subtitle `S$X/mo` | Token. | None. |
| BudgetPage.tsx:388-389 | "Income Flow" subtitle "Take-home pay & CPF" | Matches R6 name, but the subtitle is filler. | Remove subtitle. |
| components/budget/CategoriesHeader.tsx:34-48 | "Categories" + `S$X left of S$Y` + bar | Good. | None. This is the template other lists should follow. |
| components/budget/CategoryProgressList.tsx:166 | `(25%)` next to the category name | The allocation % is shown beside the name AND the status % in the pill. | Remove the allocation % (it lives in the editor). |
| CategoryProgressList.tsx:172-188 | tooltip "Includes S$X/mo from recurring items:" plus a list, plus an inline "Includes S$X recurring" | Same fact stated twice (tooltip + inline line). | Keep the inline `Repeat` icon + amount only; drop the tooltip's lead sentence. |
| CategoryProgressList.tsx:208-217 | pill "Set aside" with PiggyBank icon | Fine. | None. |
| CategoryProgressList.tsx:224-233 | pill `Near Limit (86%)` or `Over (112%)` etc. | % again; status word plus %. | Icon + coloured pill only; % shown as the bar. |
| CategoryProgressList.tsx:236-285 | labels "Spent / Budgeted / Remaining" with 3 amounts | 3 numbers per category. | One line: `S$spent / S$cap` with remaining as a coloured `+/-`. Labels are visible duplicates of column headings. |
| CategoryProgressList.tsx:296-310 | `Over by S$X` + badge "Rose Cap Exceeded" | "Rose Cap" is a typo/jargon (colour name as a word). Both lines say the same thing. | Delete the badge. Pill is already coral. |
| CategoryProgressList.tsx:312 | `S$X remaining` when near limit | Third repetition of remaining. | Delete. |
| CategoryProgressList.tsx:69 | empty "Add budget categories to track monthly spend." | Title? Not shown here (description only). | Add a 2-word title `No Categories`. |
| components/budget/CategoryLimitWarningBanner.tsx:127-128 | toast "Budget Cap Exceeded!" / "{cat} has exceeded cap by S$X!" | R6: alert headline > 6 words? No (3 words), but the message is a sentence with `!`. | Title `{Cat} Over`, message `S$X over cap`. |
| CategoryLimitWarningBanner.tsx:143-144 | toast "Budget Limit Warning" / "{cat} is at 86% (S$X of S$Y) — S$Z left" | 5 numbers in a toast. | Title `{Cat} at 86%`, message `S$Z left`. |
| CategoryLimitWarningBanner.tsx:308 | banner heading "Budget Cap Exceeded (3)" | Fine; could be icon + count. | `Over Cap (3)`. |
| CategoryLimitWarningBanner.tsx:326-330 | row: "{name} has exceeded cap by S$X!" plus `S$spent of S$cap (112%)` | Sentence plus 4 numbers per row. | `{name}` + coloured `+S$X over` + a mini `MeterBar`. |
| CategoryLimitWarningBanner.tsx:344 | "Nearing Limit Warning (2)" | 4 words, redundant ("Warning"). | `Near Limit (2)`. |
| CategoryLimitWarningBanner.tsx:358-368 | row: "{name} is at 86% (S$x of S$y) — S$z left" + View | Sentence, 4 numbers. | `{name}` + `MeterBar` + `S$z left`. |
| components/budget/MonthEndSweepBanner.tsx:35-39 | "S$X unspent from Oct" + "Sweep into savings goals or bank for cushion." | Headline matches R6 pattern. Subtitle partly redundant with the two buttons. | Delete subtitle or `Sweep or bank it.` |
| MonthEndSweepBanner.tsx:44,56 | buttons "Bank Surplus", "Sweep to Goals" | "Sweep to Goals" is 3 words, OK. | None. |
| components/budget/BankSurplusModal.tsx:42 | subtitle "Reserve S$X from Oct" | Redundant with amount shown twice more in the body. | Keep the subtitle; remove the other two amount mentions. |
| BankSurplusModal.tsx:52-54 | callout "Reserve Cushion" + "Bank S$X to cushion future months against unexpected overages." | R6: confirmation should explain benefit and destination, but it is phrased twice (callout + details panel). | One card: shield icon, `S$X -> Banked Surplus`. Tooltip: `Cushion for future overages.` |
| BankSurplusModal.tsx:60-76 | "Unspent Amount: +S$X" and "Destination: Banked Surplus" | Same amount third time. | Merge with the line above. |
| BankSurplusModal.tsx:78 | footer "Deploy banked surplus to savings goals anytime from Budget." | Filler footnote. | Remove. |
| components/budget/SurplusSweepModal.tsx:225 | subtitle "Allocate S$X into goals" | Fine. | None. |
| SurplusSweepModal.tsx:234-242 | callout "🎉 Great job in Oct!" + "You have S$X unspent. Deposit into goals to boost milestone progress." | Two sentences, duplicates the subtitle. | Remove whole callout (confetti plays anyway), or `Great job in Oct 🎉`. |
| SurplusSweepModal.tsx:269 | button "All to Top Goal" | 4 words. | `Top Goal`. |
| SurplusSweepModal.tsx:304 | "No active savings goals found. Create a goal in the Goals tab first!" | Empty state with no CTA, exclamation. | `No Goals` + `Add Goal` button. |
| components/budget/BudgetWaterfall.tsx:106 | "No Budget" + "Set up a budget to see your income flow." + Set Up Budget | Good, follows formula. | None. |
| BudgetWaterfall.tsx:155 | tooltip "Employee CPF, 20% of gross." | Fine. | None. |
| BudgetWaterfall.tsx:193 | tooltip "Bonuses count as income but don't raise category limits. Split them in Plan › Bonus." | Two sentences. | `Outside caps. Split in Plan › Bonus.` (the "Outside caps" badge is already beside it, so the tooltip can be just the link). |
| BudgetWaterfall.tsx:~170-190 | 8 rows: Gross, Bonus, CPF, Bonus CPF, Deductions, Taxes, Insurance, Take-home | Dense numeric ledger. | `StackedBar` (gross split into CPF / tax / insurance / take-home) with the rows behind a "Details" collapsible. |
| components/budget/CumulativeSurplusCard.tsx:263 | "Cumulative Spending Surplus" | R6: 3 words plus a 4th, long header. | `Surplus`. |
| CumulativeSurplusCard.tsx:266-275 | tooltip title "Goal-Funded Protection & Rollover" + 35-word body | Too long. | Title `Rollover`. Body `Unspent cap carries over. Goal-funded spends are excluded.` |
| CumulativeSurplusCard.tsx:316-322 | "Oct Result" / "Surplus this month" or "Deficit this month" | The sign colour already says surplus vs deficit. Sentence under the number. | Drop the caption; tile coloured mint/coral with arrow icon. |
| CumulativeSurplusCard.tsx:348-352 | tile "Historical Rollover" and sub "Total Banked Surplus: +S$X" | Same number shown twice in one tile. R6 jargon. | Title `Banked`, remove the caption. |
| CumulativeSurplusCard.tsx:370-374 | "Recent 6-Month Rollover Breakdown", "Spendable Cap vs Non-Goal Spend" | Two long labels. | `Last 6 Months` plus a `Sparkline`. |
| components/budget/BonusAllocationCollapsible.tsx:39 | subtitle `Net S$X · Split bonus` | Fine, but "Split bonus" duplicates the collapsible title. | `Net S$X`. |
| BonusAllocationCollapsible.tsx:52-76 | labels "Gross Bonus (S$)", "Employee CPF (20%)", "After CPF Take-Home Bonus" | Wordy. | `Gross`, `CPF 20%`, `Take-Home`. |
| components/budget/BaseProfileEditorModal.tsx:762,789,819,861,872 | "Gross Salary (SGD)", "CPF Employee Rate (%)", "Fixed Monthly Deductions", "Monthly Insurance", "From insurance items" | 3-4 word labels. | `Gross`, `CPF Rate`, `Fixed Deductions`, `Insurance`. Remove "From insurance items". |
| BaseProfileEditorModal.tsx:915,921 | button "Auto-Balance to 100%"; tooltip "Locked categories keep their exact amount when you click Auto-Balance." | Button is 3 words OK. Tooltip is a sentence (OK in tooltip). | Keep. Shorten tooltip: `Locked rows stay put.` |
| BaseProfileEditorModal.tsx:1048 | "No categories configured yet." | Empty state without title/CTA. | `No Categories` + `Add Category`. |
| BaseProfileEditorModal.tsx:583,590 | errors "Category allocations must sum to exactly 100% (currently X%)." / "Please enter a valid positive gross salary." | Long error copy; the live total pill (l.1381) already shows the problem. | `Must total 100%` / `Enter a salary`. |
| components/categories/ManageCategoriesModal.tsx:533-538 | "Percentage Allocations (Must Sum to 100%)" + "Calculated from estimated disposable pool of S$X/mo" | 7-word label + explanatory sentence. | `Allocations` with a live `Total 100%` pill; move the pool figure to a tooltip. |
| ManageCategoriesModal.tsx:489 | subtitle "Caps & set-asides" | Good. | None. |
| ManageCategoriesModal.tsx:926-940 | "No Categories" + "You have no categories configured yet. Add custom categories or restore recommended presets." | Prompt is two sentences. | `Add a category or restore presets.` |
| ManageCategoriesModal.tsx:959 | "Spendable Categories (n)" | OK. | `Spendable (n)`. |
| ManageCategoriesModal.tsx:1130-1134 | ConfirmModal "Removing this category will delete associated budget allocations. Existing expense records will have their category cleared." | Two sentences. | `Removes its budget share. Expenses become uncategorised.` Confirm label `Confirm Delete` -> `Delete`. |
| components/categories/CategoryModeToggle.tsx:30 | "Track cap: warns near the limit. Set aside: funded, never warns." | Fine as tooltip. | None. |
| components/budget/UncategorizedRecurringRow.tsx | Not text-heavy | None | None. |

### 2.4 Accounts (pages/AccountsPage.tsx, components/accounts)

| Location | Current | Problem | Proposed |
|---|---|---|---|
| pages/AccountsPage.tsx:184-205 | buttons "Add Account", "Update Balances" | Both 2 words; fine. | On mobile show icons only for Add. |
| AccountsPage.tsx:210-220 | StatCard "Net Worth" subtitle `S$X card debt` or `n accounts`; tooltip "Account balances minus unpaid card statements." | Good. | Add `DeltaBadge` vs last month. |
| components/accounts/NetWorthChart.tsx:111-125 | Net Worth header + tooltip "Net Worth Formula" + legend pill repeating "Net Worth" and the number | Header + legend say the same. Number already in StatCard right above. | Remove the legend pill. Use `Sparkline` on mobile. |
| NetWorthChart.tsx:143-153 | "No History" + "Update balances monthly to see your trend." + Update Balances | Compliant. | None. |
| components/accounts/AccountGroupList.tsx:58-79 | group descriptions "Everyday checking, high-yield savings, and liquid emergency reserves", "Equities, ETFs, brokerages (SGX CDP, IBKR, Webull, Moomoo)", "Ordinary Account, Special Account, and MediSave balances", "Miscellaneous stores of value, precious metals, and alternative assets" | Hidden on mobile via `hidden sm:block` (good) but still 10-15 words each on desktop. | Delete the descriptions, or move to the group's info tooltip. |
| AccountGroupList.tsx:168 | empty "No accounts found for this perspective." | No 2-word title or CTA (the empty variant at l.235 is correct). | Title `No Accounts`, CTA `Add Account`. |
| AccountGroupList.tsx:188 | filter label "All Accounts (n)" | 2 words + count, fine. | `All (n)`. |
| AccountGroupList.tsx:272-283 | group header: title + `n accounts` pill + description + subtotal + `12.3% of assets` | 4 pieces of text. | Title + subtotal + a thin `StackedBar` of asset share across groups (drop `% of assets` and count pill). |
| AccountGroupList.tsx:376,395 | title attrs "Click to edit balance", "Edit account details" | "Click" on touch devices. | `Edit balance`, `Edit`. |
| components/accounts/AccountCard.tsx:116 | title "Edit account details" | Same. | `Edit`. |
| AccountCard.tsx:157-175 | "Updated 3 Oct" / "Up to date" plus button "Update Balance" | "Up to date" is ambiguous (appears when no timestamp). Button is also repeated at page level. | Show a freshness dot (green < 35 days, amber, red) + short date; keep a pencil icon button without text. |
| components/accounts/UpdateBalanceModal.tsx:230-234 | "No Accounts Found" + "Add your first bank account or CPF to start tracking..." | Title 3 words, prompt long. | `No Accounts` / `Add an account to start tracking balances.` (same string as AccountGroupList:238). |
| UpdateBalanceModal.tsx:267-268 | subtitle `{name} (institution)` | Duplicates the name that the form shows. | OK, or remove. |
| UpdateBalanceModal.tsx:287,338 | labels "New Balance (S$)", "Notes (Optional)" | Fine. | `Balance`, `Notes`. |
| UpdateBalanceModal.tsx:384-385 | title "Update Account Balances" + subtitle "Type directly into any balance. Only modified accounts will be saved." | R6: header should be `Update Balances` (the button already uses it). Instruction subtitle. | Title `Update Balances`. Remove subtitle (the modified counter explains it). |
| UpdateBalanceModal.tsx:442-447 | `Showing 8 of 12 accounts` + `3 modified` | Two counters. | `3 changed` pill only. |
| UpdateBalanceModal.tsx:461 | `No accounts match "{query}"` | Fine. | `No Matches`. |
| components/accounts/BulkBalanceUpdateModal.tsx:155-156 | "Month-End Check-In" + "Pre-filled with last balances — edit only what changed & save all" | 13-word subtitle; two modals do the same job. | Title `Check-In`. Subtitle `Edit what changed.` Consider merging with UpdateBalanceModal. |
| BulkBalanceUpdateModal.tsx:335 | button "Save Month-End Snapshot" | 3 words but long. | `Save Snapshot`. |
| components/accounts/EditAccountModal.tsx:88-89 | "Edit Account Details" + "Update account name, category, or owner" | Title 3 words; the subtitle just lists the fields. | `Edit Account`, no subtitle. |
| EditAccountModal.tsx:127,145,150,151,190,195,206 | "Bank / Institution", "Account Category *", "Cash / Savings / Current", "Investment / Brokerage / SRS", "Joint Household Account", "CPF accounts cannot be joint in SG", "Notes / Remarks" | Slash-lists everywhere. | `Bank`, `Type`, `Cash`, `Investment`, `Joint`, tooltip for the CPF rule, `Notes`. |
| components/accounts/AddAccountModal.tsx:193,246,272,280 | "More presets...", "Bank / Institution", "Investment / Brokerage", "Starting Balance (SGD) *" | Same pattern. | `More`, `Bank`, `Investment`, `Balance`. |
| components/accounts/DeleteAccountModal.tsx:52,61-80 | subtitle "This action cannot be undone"; body "Are you sure you want to delete {name}?... Deleting this account will permanently remove all historical..." | Two paragraphs. Pattern repeated in CreditCardTrackerSection:851-865. | Use ConfirmModal (per AGENTS.md 5B), `Delete {name}?` + `Removes its balance history.` |
| components/accounts/CreditCardTrackerSection.tsx:343-350 | "Credit Card Statements & Due Dates" + "Track monthly billing statements, 1-tap paid status, and payment due days" | R6: 5-word header and a marketing sentence. Section header duplicates the "Credit Cards" tab. | Delete the header block (the SegmentedTabs tab already names it). Keep the month stepper. |
| CreditCardTrackerSection.tsx:403,406 | StatCard "Total CC Bill Due this Month" / `Across 3 configured cards` | R6: 6-word title; sentence subtitle. | Title `Due`, subtitle `3 cards`. |
| CreditCardTrackerSection.tsx:410,415 | "Total Paid" / "Cleared statements" | "Total" filler. | `Paid` / subtitle none. |
| CreditCardTrackerSection.tsx:420-428 | "Total Unpaid" / "Pending payment" or "All clear for this month!" | Filler; exclamation. | `Unpaid` / `All paid` with a check icon. Better: a single `Paid / Unpaid` `StackedBar` in the Due card. |
| CreditCardTrackerSection.tsx:445-449 | empty state "No Credit Cards Configured" + "Add your DBS, OCBC, UOB, or Citi credit cards to track statement billing cycles and payment due dates." | R6: 4-word title, long prompt. | `No Cards` / `Add a card to track statements.` |
| CreditCardTrackerSection.tsx:461 | CTA "Add Your First Card" | 4 words. | `Add Card`. |
| CreditCardTrackerSection.tsx:562-587 | 3-col spec grid: "Statement Day 3th", "Due Day 28th", "Limit S$X / No limit" | Always visible, never changes; `th` ordinal bug; labels take more space than data. | Move to card edit view or a collapsible. Show only `Due 28` as a `StatusPill` with a utilisation `MeterBar` (needs statement vs limit). |
| CreditCardTrackerSection.tsx:600 | label "Statement Amount" | Obvious from the layout. | Remove the label, show the amount. |
| CreditCardTrackerSection.tsx:613 | `Due 12 Oct` plus pill `Due in 3 days` | Date and countdown both shown. | Pill only (tooltip has the date). |
| CreditCardTrackerSection.tsx:656-659 | "No statement logged for October 2026" | Sentence. | `No statement` + `Log` button. |
| CreditCardTrackerSection.tsx:746,765,808 | modal subtitle `{card} • Oct 2026`, label "Statement Balance (SGD) *", "Notes (Optional)" | Fine. | `Balance`, `Notes`. |
| CreditCardTrackerSection.tsx:283 | error "Please enter a valid statement balance amount (e.g. 842.50)" | Long. | `Enter an amount`. |
| CreditCardTrackerSection.tsx:836 | "Save Statement" | Fine. | None. |
| components/accounts/AddEditCreditCardModal.tsx:220 | subtitle "Track statements, billing cycles, and due dates" | Filler. | Remove. |
| AddEditCreditCardModal.tsx:140-167 | errors "Please select or enter an issuing bank", "Last 4 digits must be exactly 4 digits, or left blank", "Statement day must be between 1 and 31", ... | Long. | `Pick a bank`, `Last 4 digits only`, `Day must be 1-31`. |
| AddEditCreditCardModal.tsx:460 | "Save Changes" / "Add Credit Card" | R6: 3 words OK. | `Save` / `Add Card`. |
| AddEditCreditCardModal.tsx:48-55 | colour names "Sky Blue", "Emerald Green", etc. | Names needed only for aria; fine. | Show swatches only. |

### 2.5 Plan: Goals, Recurring, Loans, Bonus

| Location | Current | Problem | Proposed |
|---|---|---|---|
| pages/PlanPage.tsx | Not text-heavy | None | None. |
| pages/GoalsPage.tsx:299-318 | "Goals" + "+ New Goal" | 2 words, fine. | Icon-only on mobile. |
| GoalsPage.tsx:339-372 | 4 StatCards: Target (`Across n goals`), Saved (`S$X remaining`), Progress (`n achieved`), Monthly Pace (`Target monthly pace`) | 4 cards before the first goal; sentence-like subtitles; "Target monthly pace" repeats the title. | One summary card with a `ProgressRing` (saved/target), `n achieved` as a badge and `S$X/mo` as a chip. |
| GoalsPage.tsx:372 | subtitle "Target monthly pace" | Filler. | Remove. |
| GoalsPage.tsx:383-404 | tabs "All Goals", "In Progress", "Achieved" with count pills | `In Progress` is 2 words, count pills fine. | `All`, `Active`, `Done`. |
| GoalsPage.tsx:424-428 | empty "No Goals" + "Add a goal to start tracking savings progress." or "No goals found in this view." | Follows formula. The alternate view has a second prompt that is neither action. | `Switch tabs to see more.` or hide CTA. Keep. |
| components/goals/GoalCard.tsx:160-170 | status chip + `Oct 2027 • 12 months left` | Date and months-left both. | Months-left as a `StatusPill` with the date on tap. |
| GoalCard.tsx:176-225 | 2x2 grid "Target Amount", "Total Saved", "Goal Spend", "Balance" | 4 numbers plus labels; Total Saved and Balance are almost always equal-ish. | Ring with `Saved / Target` in the centre. `Goal Spend` and `Balance` only when `Goal Spend > 0` (collapsible). |
| GoalCard.tsx:236-253 | "Milestone Progress" + `45%` + bar | Label is filler. | Remove label, keep bar (or ring). |
| GoalCard.tsx:263-283 | "Current Monthly: S$X/mo" and "Required Pace: S$Y/mo needed" / "Target Met" | Two rows of text. | `S$X/mo` vs `S$Y/mo` as one `MeterBar` with a marker, or a `DeltaBadge`. |
| GoalCard.tsx:290-293 | note "+ S$X/mo to stay on track" | Fine, short. | Keep. |
| GoalCard.tsx:303 | button "Linked Goal Expenses (n)" | 4 words. | `Spends (n)` (already collapsible, good). |
| components/goals/AddEditGoalModal.tsx:127,135 | errors "Please enter a goal title (e.g. Wedding Banquet, HDB Reno)", "Please enter a valid target amount greater than S$0.00" | Long. | `Add a title`, `Target must exceed 0`. |
| AddEditGoalModal.tsx:209 | subtitle "Track couple milestones, target dates, and monthly savings pace" | Marketing sentence. | Remove. |
| AddEditGoalModal.tsx:224,288,314,343,359 | "Goal Icon / Emoji", "Target Amount (S$) *", "Saved So Far (S$)", "Target Date (Optional)", "Monthly Contribution (S$)" | 3-4 words. | `Icon`, `Target`, `Saved`, `Target Date`, `Monthly`. |
| AddEditGoalModal.tsx:387-430 | "Pacing Projection" + status chip + "Required Pace:" + "Time to Target: N months" | Two label/value pairs plus a chip. | `StatusPill` + `S$X/mo` + `N mo`. |
| AddEditGoalModal.tsx:459 | "Save Changes" / "Create Goal" | Fine. | `Save` / `Create`. |
| components/goals/QuickDepositModal.tsx:128 | subtitle `Deposit into {title}` | Fine. | None. |
| QuickDepositModal.tsx:143,171,232 | "Quick Deposit Presets", "Deposit Amount (S$) *", "Confirm Deposit" | Long. | `Presets`, `Amount`, `Deposit`. |
| pages/RecurringPage.tsx:252-271 | StatCards "Annual Outflow" (`S$X/mo`) and "Next Renewal" (name; `Oct • S$X`) | Good. Subtitle `No annual items` is a sentence-ish fallback. | `None` or hide. |
| RecurringPage.tsx:288 / components/recurring/RecurringTable.tsx:230 | table title "All Recurring"; column "Monthly Amortized" | "Monthly Amortized" is jargon and 2 words. | `Per Month`. |
| RecurringTable.tsx:250-256 | empty "Nothing Recurring" / "No Matches" with prompts | Compliant. | None. |
| components/recurring/AddRecurringModal.tsx:271,378,381,434 | placeholder "e.g. Netflix, gym, phone plan, cloud storage", options "Once a year (Annual)", "Every month (Monthly)", label "Start (Optional)" | Doubled labels. | `Yearly`, `Monthly`, `Start`. |
| components/recurring/RenewalCalendar.tsx | Visual already (12-month calendar) | Good. | None. |
| components/loans/LoansPlaceholder.tsx:8-9 | "Under Construction" + "Bubby is building something for your loans." | Allowed placeholder exception. | None. |
| components/bonus/BonusLogPanel.tsx:131-132 | Alert "Bonus log not set up" / "Apply the bonus_events migration to log bonuses." | Developer-facing text in UI. | Hide or `Bonus log unavailable`. |
| BonusLogPanel.tsx:160-163 | empty state (title not read) / "Log a bonus to track it and fund goals." | Verify a 2-word title exists (EmptyStateCard has `title`). | Title `No Bonuses`. |
| BonusLogPanel.tsx:176-186,245 | StatCard subtitles `n bonuses`, `n% avg`, `2026 YTD`, group `S$X net · n bonuses` | Token style, fine. | None. |
| components/bonus/BonusFormModal.tsx:475,695,713,740 | "Reconnect to save bonuses.", "Goals share is recorded only.", "Goal amounts no longer match the Goals share.", "Save as default for {name}" | Short enough, but 713 can shrink. | `Amounts don't match Goals share.` |
| BonusFormModal.tsx:769 | "Log Bonus" / "Save" | Fine. | None. |
| components/bonus/BonusGoalPicker.tsx:25-27 | "Even", "By gap", "One goal" | Good. | None. |

### 2.6 Inbox, notifications, settings, auth

| Location | Current | Problem | Proposed |
|---|---|---|---|
| pages/InboxPage.tsx:447-481 | "All Sorted" / "New card purchases land here."; "No Captures" / "Set up Auto Capture to skip typing."; "Discarded" | Follows formula. | None. |
| components/inbox/InboxCard.tsx:145-160 | Alert "Looks logged already" body `S$X on 12 Oct.` plus button "Same One"; Alert "Check rate" / "Edit to set the SGD amount." | Fine, brief. | None. |
| components/layout/NotificationCenterPopover.tsx:394 | "Get alerts on this device?" + Enable | Fine. | None. |
| NotificationCenterPopover.tsx:417 | empty "No Reminders" / "You're all caught up." | Compliant. | None. |
| lib/reminders/rules.ts:229-230,260-261,361,587-588 | `3 Purchases to Sort` / `S$X waiting.`; `Update Balances` / `No snapshot for Oct.`; `{card} Statement Needed` / `Cycle closed on day 3.`; `{goal} Behind Pace` / `45% saved` | Already token-style. Trailing full stops on messages. | Drop trailing periods for consistency. |
| lib/reminders/rules.ts:630 | `Review Oct Budget` / "Lock in your allocations." | Fine. | None. |
| components/layout/NotificationSettingsModal.tsx:186 | subtitle "Customize sound effects, push notifications & alert thresholds" | R6: 8+ words listing the sections. | Remove. |
| NotificationSettingsModal.tsx:195-209 | section "Sound Effects" then row "Sound Effects" + "Cha-ching spend logging chime & alert sounds" | Section title and row title are identical. | Drop the row title; description `Chime on log, alert sounds`. |
| NotificationSettingsModal.tsx:249-262 | section "Haptic Feedback" then row "Haptic Feedback" + "Tactile vibration for pulls, sweeps, logs & alerts" | Same duplication; 9 words. | `Vibrate on actions`. Note: Android vs iPhone households; iOS Safari has no vibration API, so hide this row on iOS instead of showing a dead toggle. |
| NotificationSettingsModal.tsx:316,331 | "Push Notifications" / "System alerts on this device" | OK. | None. |
| NotificationSettingsModal.tsx:381-462 | descriptions: "Alert before statement due date", "Alert when statement is not yet logged", "Month-end balance refresh prompt", "Partner spend and split updates", "Warn when categories near budget limit", "Remind before recurring items are due", "Goal pacing and achievement alerts", "Early month budget review prompt" | R6 limit is < 8 words; all pass but the section is 9 toggles x 2 lines. Titles are 3-4 words ("Partner & Shared Spend Alerts", "Missing Credit Card Statement", "Credit Card Payment Due"). | Titles: `Card Due`, `Card Statement`, `Balances`, `Partner Spend`, `Budget Limits`, `Recurring`, `Goals`, `Budget Review`. Drop descriptions on obvious rows, keep one short line on `Partner Spend` and `Card Statement`. Use icon per row. |
| NotificationSettingsModal.tsx:473-540 | section "Custom Thresholds" with "CC Due Reminders", "Budget Warning %", "Settlement Cap" | OK but separated from the toggles they affect. | Put each threshold inline under its toggle, collapsed until the toggle is on. |
| NotificationSettingsModal.tsx:604 | "Push notifications are turned off. Turn on Push Notifications above to customize alert types and thresholds." | Two sentences. | `Push is off.` |
| components/settings/AutoCaptureSection.tsx:157 | "Phone Tokens" + "Card taps land in Inbox to sort" | Fine. | None. |
| AutoCaptureSection.tsx:174,180 | Alert "Needs database update" / "Apply the capture inbox migration to turn this on."; "Demo mode" / "Capture only works with Supabase." | Developer-facing. | `Not available` / `Needs backend update.` |
| AutoCaptureSection.tsx:69-78 | collapsed "Setup Steps": 5 steps and a 30-word Android paragraph | Already behind a collapsible (good). Steps are iPhone first; the user's phone is Android. | Add a segmented iOS/Android toggle so each person sees only theirs (consistent with household devices). |
| AutoCaptureSection.tsx:233 | Alert "Shown once" / "Paste it into your Shortcut now." | OK. | `Copy it now.` |
| components/auth/PinLoginScreen.tsx:239-247 | "Enter your 6-digit PIN to unlock • Demo PIN: 000000" | Instruction visible while six dots already show. Demo PIN link inline in production copy. | Remove the sentence; keep the dots. Show the demo PIN only in demo mode. |
| PinLoginScreen.tsx:262-267 | "Scanning Biometrics..." / "Unlock with Fingerprint / Face ID" | 5 words. | `Biometric Unlock` with fingerprint icon (device-agnostic: Face ID vs fingerprint). |
| PinLoginScreen.tsx:323 | "Unlocking household..." | Fine. | `Unlocking...`. |
| PinLoginScreen.tsx:384,389 | "Disable biometric unlock", "Biometric unlock supported on this device" | Extra line of status text always showing on the keypad screen. | Remove the "supported" line (the enrol prompt already offers it). |
| PinLoginScreen.tsx:409-415 | modal "Enable Biometric Login?" + 3-line paragraph "Unlock Budget Bubby faster next time using Touch ID, Face ID, or your device fingerprint without entering your 6-digit PIN." | Paragraph. | `Unlock faster with biometrics.` |
| PinLoginScreen.tsx:85,91 | errors "Biometric verification failed. Please enter your PIN.", "Biometric authentication was cancelled or unavailable." | Long. | `Biometrics failed. Use PIN.` / `Biometrics cancelled.` |
| components/layout/AppHeader.tsx:421,446 | title "Running in local Demo Mode with sample seed data"; modal "Lock & Sign Out?" | Tooltip fine. Modal title 3 words OK. | `Demo Mode`. |
| components/layout/DesktopSidebar.tsx:43-61,276 | descriptions "Daily spend check & quick actions", "Expenses ledger & monthly budget caps", "Month-end balances & asset trends", "Goals & recurring commitments"; modal "You will need your PIN to unlock the app and access your..." | Descriptions are redundant under 1-word nav labels; modal is a sentence. | Delete descriptions (or tooltip only). Modal: `Lock the app? You'll need your PIN.` |
| components/layout/MobileBottomNav.tsx | Labels not text-heavy | None | None. |
| components/pwa/IOSInstallModal.tsx:19,33,58-74 | subtitle "Save to your iPhone or iPad home screen"; intro "Install Budget Bubby as a standalone app on your home screen for full-screen mode and faster access:"; steps each with a bold line plus a sentence | 3 steps x 2 lines + intro. Partner-only (iPhone), so a high-visibility moment. | Replace with 3 icon steps (Share icon, Plus-square, Add) with a one-line caption each: `Tap Share`, `Add to Home Screen`, `Tap Add`. Remove intro and subtitle. |
| components/pwa/PWAUpdateToast.tsx:55-60 | "New version available" / "An updated version of Budget Bubby is ready to reload." ; "Ready for offline use" / "App assets are cached. You can open Budget Bubby without network." | Sub-sentences restate the headline. Buttons `Update now` / `Later` fine. | `Update ready` with `Update` / `Later`. `Offline ready` with no body. |
| components/pwa/OfflineBanner.tsx:~85-120 | "Offline Mode — 3 expenses", "You are offline. Showing cached Budget Bubby view.", "Syncing offline changes to Supabase..." | Sentences; backend name leaks. | `Offline · 3 queued` / `Offline` / `Syncing...` with icons. |
| components/pwa/PWAInstallButton.tsx:22 | title "Install Budget Bubby App" | 4 words. | `Install`. |
| components/bubby/DelightHost.tsx:104-105,141-142 | toast `Treat: Prawn Crackers!` / "Weekly quests done"; `Inbox zero! 🎉` / `4 sorted` | Brief. | None. |
| components/bubby/MilestoneToast.tsx | no long copy | None | None. |

---------------------------------------------------------------------
## 3. Lists you asked for

### 3.1 Headers and buttons over 3 words (R6 "1-3 punchy words")
- CreditCardTrackerSection.tsx:343 "Credit Card Statements & Due Dates" (5)
- CreditCardTrackerSection.tsx:403 StatCard "Total CC Bill Due this Month" (6)
- CreditCardTrackerSection.tsx:445 "No Credit Cards Configured" (4, also breaks the 2-word empty state title)
- CreditCardTrackerSection.tsx:461 button "Add Your First Card" (4)
- ExpenseTrendsCard.tsx:63 "Monthly Expense Trends & Averages" (4, listed in R6 as banned)
- ExpenseTrendsCard.tsx:204 "Category Monthly Averages vs This Month" (6)
- CumulativeSurplusCard.tsx:263 "Cumulative Spending Surplus" (3, but filler; use `Surplus`) and :370 "Recent 6-Month Rollover Breakdown" (4)
- SurplusSweepModal.tsx:269 button "All to Top Goal" (4)
- BulkBalanceUpdateModal.tsx:335 button "Save Month-End Snapshot" (3 but long; use `Save Snapshot`)
- UpdateBalanceModal.tsx:384 "Update Account Balances" (3, diverges from the `Update Balances` button)
- EditAccountModal.tsx:88 "Edit Account Details" (3, use `Edit Account`)
- ManageCategoriesModal.tsx:533 "Percentage Allocations (Must Sum to 100%)" (6)
- BaseProfileEditorModal.tsx:819 "Fixed Monthly Deductions" (3), :789 "CPF Employee Rate (%)" (3)
- NotificationSettingsModal.tsx:421 "Partner & Shared Spend Alerts" (4), :391 "Missing Credit Card Statement" (4), :381 "Credit Card Payment Due" (4), :461 "Monthly Budget Review" (3)
- GoalCard.tsx:303 "Linked Goal Expenses (n)" (4)
- AddEditGoalModal.tsx:224 "Goal Icon / Emoji", :359 "Monthly Contribution (S$)", :343 "Target Date (Optional)"
- PinLoginScreen.tsx:267 "Unlock with Fingerprint / Face ID" (5), :409 "Enable Biometric Login?" (3)
- PWAInstallButton.tsx:22 "Install Budget Bubby App" (4)
- SpendTagsOverviewCard.tsx:126 "Spend Tags Overview" (3, filler)
- RecurringTable.tsx:230 column "Monthly Amortized"
- AddAccountModal.tsx:280 "Starting Balance (SGD) *"

### 3.2 StatCard subtitles that are sentences or filler
- GoalsPage.tsx:342 `Across n goals`; :372 "Target monthly pace"
- CreditCardTrackerSection.tsx:406 `Across n configured cards`; :415 "Cleared statements"; :424-428 "Pending payment" / "All clear for this month!"
- ExpensesPage.tsx:474 `settlement.settlementText` (a sentence about who owes whom)
- BudgetPage.tsx:389 "Take-home pay & CPF" (Income Flow card)
- RecurringPage.tsx:140 fallback "No annual items"
- ExpensesPage.tsx:397 acceptable, but combine two data tokens with a middle dot; shorten to one token.

### 3.3 Empty states not matching the formula (2-word title + 1 sentence + 1 CTA)
- UpcomingBillsWidget.tsx:~105 "Nothing Due": no CTA button.
- ExpenseListTable.tsx:311 "No expenses found": 3-word title; 2-sentence prompt.
- CreditCardTrackerSection.tsx:445-461 "No Credit Cards Configured": 4-word title; long prompt; 4-word CTA.
- UpdateBalanceModal.tsx:230 "No Accounts Found": 3-word title; long prompt.
- AccountGroupList.tsx:168 "No accounts found for this perspective.": no title, no CTA.
- ManageCategoriesModal.tsx:926-940 "No Categories": prompt is 2 sentences.
- BudgetPage.tsx:333 "No Categories": two CTAs (Presets + add).
- CategoryProgressList.tsx:69: no title.
- BaseProfileEditorModal.tsx:1048 "No categories configured yet.": no title, no CTA.
- SurplusSweepModal.tsx:304 "No active savings goals found. ... first!": no title, no CTA, exclamation.
- ExpenseFormModal.tsx:875 "No savings goals found.": no title, no CTA.
- BubbySheet.tsx:83 snacks: sentence with no title.
- BonusLogPanel.tsx:160: verify title is 2 words (prompt is OK).
- GoalsPage.tsx:428 alternate prompt "No goals found in this view." is not an action.
Compliant: BudgetWaterfall "No Budget", NetWorthChart "No History", NotificationCenter "No Reminders", InboxPage ("All Sorted", "No Captures"), RecurringTable ("Nothing Recurring" / "No Matches"), LoansPlaceholder (exception).

### 3.4 Multi-sentence paragraphs on dashboards or primary screens
- ExpensesPage.tsx:404 tooltip (3 sentences)
- ExpenseTrendsCard.tsx:76 tooltip (3 sentences)
- CumulativeSurplusCard.tsx:270-276 tooltip (2 sentences)
- BubbySheet.tsx:59-63 tooltip (4 sentences)
- CreditCardTrackerSection.tsx:347 (sentence under header, always visible)
- SpendTagsOverviewCard.tsx:134 (marketing sentence under header, always visible)
- SurplusSweepModal.tsx:234-242 (celebration + 2-sentence paragraph)
- BankSurplusModal.tsx:52-56 and :78 (two paragraphs)
- DeleteAccountModal.tsx:61-80, DeleteExpenseModal.tsx:158-181, ManageCategoriesModal.tsx:1130 (2-3 sentence confirm bodies)
- PinLoginScreen.tsx:409-415, IOSInstallModal.tsx:33 and 58-74, PWAUpdateToast.tsx:55-60

### 3.5 Places where many numbers show at once on a phone
- Budget category cards (3 amounts + 2 percentages + remaining line each).
- GoalCard (7+ numbers each).
- Spend page strip (4 cards + footer with 3 numbers = about 10) plus ExpenseTrendsCard (3 KPIs + chart + per-category pairs).
- Home hero 2-col tile grid (4 numbers per tile).
- Credit card tile (6 numbers).
- Budget top strip (4 StatCards, 2x2).
- CategoryLimitWarningBanner rows (4 numbers per row, and the same figures reappear in the toast).
- CumulativeSurplusCard (2 tiles + mini chart + month list).
- NotificationSettingsModal (10 toggles, 3 thresholds, 3 time fields).
- UpdateBalanceModal (one input per account plus two counters).

---------------------------------------------------------------------
## 4. Suggested fix order
1. Build `MeterBar`, `ProgressRing`, `StatusPill`, `DeltaBadge`, `AvatarDot` (small primitives) and add a `tone` prop to StatCard.
2. Swap into CategoryProgressList, GoalCard, Home hero meters, CategoryLimitWarningBanner (largest mobile wins).
3. Copy-only pass (no new components): items in 3.1, 3.2, 3.3 and the modal subtitles. About 60 strings across 25 files.
4. Collapse/progressive-disclosure pass: ExpenseTrendsCard KPIs, CC spec grid, Waterfall rows, Notification settings sections, IOSInstallModal steps.
5. Fix the `1th/2th` ordinal bug at CreditCardTrackerSection.tsx:569,577 (not copy, but visible in the same area).
