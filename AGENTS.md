# Budget Bubby - Developer & Agent Guidelines

## 1. Tailwind CSS v4 Canonical Classes (`suggestCanonicalClasses`)

Always use canonical Tailwind v4 utilities rather than arbitrary values where standard or shorthand equivalents exist:

- **CSS Variables**: Always use the canonical shorthand `(--variable)` instead of `[var(--variable)]`:
    - `hover:text-(--text-ink)` (NOT `hover:text-[var(--text-ink)]`)
    - `bg-(--bg-card)` (NOT `bg-[var(--bg-card)]`)
    - `border-(--border-ink)` (NOT `border-[var(--border-ink)]`)
    - Use theme pastel tokens: `bg-(--pastel-lilac-light)`, `bg-(--pastel-butter-light)`, `bg-(--pastel-mint-light)`, `bg-(--pastel-coral-light)`, `bg-(--pastel-pink-light)`.
    - Never use hardcoded arbitrary hex color values (e.g. `bg-[#dfc2ff]` or `bg-[#ffe999]`) when theme CSS variables exist.
- **Theme Shadow Utilities**: Theme shadows defined in `@theme` must be written directly as utility classes rather than wrapped in variable parens:
    - `shadow-cute` (NOT `shadow-(--shadow-cute)` or `shadow-[var(--shadow-cute)]`)
    - `shadow-cute-sm` (NOT `shadow-(--shadow-cute-sm)`)
    - `shadow-cute-lg` (NOT `shadow-(--shadow-cute-lg)`)
- **Borders**: Use standard border width tokens:
    - `border-2` (NOT `border-[2px]` or `border-[1.5px]`)
    - `border-t-2` (NOT `border-t-[2px]`)
- **Z-Index & Integer Values**:
    - Use unbracketed integers directly: `z-9999` (NOT `z-[9999]`), `z-50` (NOT `z-[50]`).
- **Transforms & Tactile Press**:
    - `active:translate-x-0.5 active:translate-y-0.5` (NOT `active:translate-x-[1px] active:translate-y-[1px]`)
- **Grid Spacing & Dimensions**:
    - `min-w-40` (160px), `min-w-24` (96px), `max-w-25` (100px), `max-w-65` (260px) instead of arbitrary pixel brackets (`max-w-[260px]`).
- **Text Wrapping**:
    - Use `wrap-break-word` (NOT `break-words`) for `overflow-wrap: break-word`.
- **Icon Strokes**:
    - Use `stroke-3` (NOT `stroke-[3]`).
    - For fractional stroke widths on Lucide icons, use the SVG prop `strokeWidth={2.5}` instead of arbitrary classes like `stroke-[2.5]`.
- **Display Properties**:
    - Never mix conflicting display classes (e.g. `block` and `flex` on the same element). If aligning icons and text within labels, use `flex items-center gap-1`.

## 2. Formatting & Code Style

- **Indentation**: 4 spaces (`tabWidth: 4`, `useTabs: false`).
- **Quotes**: Double quotes (`" "`) for TS/TSX imports, strings, and JSX attributes.
- **Semicolons**: Always included (`semi: true`).
- **Trailing Commas**: Multi-line trailing commas (`trailingComma: "all"`).
- Configured via `.prettierrc`, `.editorconfig`, and `.vscode/settings.json`.

## 3. Component Design & Overflow Guardrails

- **Card Titles & Descriptions**: Any variable-length text (insurance policies, expense items, bank accounts, budget categories) must use `<TruncatedText text={name} />`.
- **Flex Layout Defense**: When building list rows with badges or amounts:
    - Text container must have `min-w-0 flex-1`.
    - Badges and numeric amounts must have `shrink-0`.
- **Interaction Contract**:
    - Desktop: Hover reveals full title in floating popover.
    - Mobile: Tap toggles popover open/closed; outside tap dismisses.

## 4. React & Fast Refresh Hygiene

- **Component File Isolation**: In component files (`.tsx`), avoid exporting non-component helper functions unless annotated with `// eslint-disable-next-line react-refresh/only-export-components`, or extract them to dedicated files in `src/lib/` or `src/services/`.
- **Zero ESLint Warnings Invariant**: Every code modification must keep `npm run lint` at 0 errors and 0 warnings.
- **Strict Rules of Hooks Invariant (`react-hooks/rules-of-hooks`)**:
    - **Never** declare hooks (`useState`, `useMemo`, `useEffect`, `useCallback`, `useRef`, or custom query hooks) below or after any conditional early return statement (e.g. `if (loading) return ...`, `if (!data) return ...`, `if (error) return ...`).
    - All hooks must be grouped unconditionally at the very top of the component body before any branching or early returns to prevent fatal runtime blank-page crashes (`Rendered fewer/more hooks than during previous render`).
- **TanStack Query Fallback Memoization (`react-hooks/exhaustive-deps`)**:
    - Never write inline fallback array/object literals for query data used in dependency arrays:
        - Avoid: `const accounts = accountsData || [];`
        - Prefer: `const accounts = useMemo(() => accountsData || [], [accountsData]);`
        - Or use a top-level immutable constant: `const EMPTY_LIST = []; const accounts = accountsData ?? EMPTY_LIST;`

## 5. UI System, Reusable Primitives & Usability Standards

### A. Design System & Token Discipline

Budget Bubby uses a tactile, friendly "Warm Oat" aesthetic with neo-brutalist / cute design touches:

- **Borders & Shadows**: Standard `border-2 border-(--border-ink)` and `shadow-cute` or `shadow-cute-sm`.
- **Theme Tokens**: Always prefer project tokens:
    - Backgrounds: `bg-(--bg-canvas)`, `bg-(--bg-cream)`, `bg-(--bg-card)`.
    - Text: `text-(--text-ink)`, `text-(--text-muted)`, `text-(--text-faint)`.
    - Pastel Accents: `bg-(--pastel-lilac-light)`, `bg-(--pastel-butter-light)`, `bg-(--pastel-mint-light)`, `bg-(--pastel-coral-light)`, `bg-(--pastel-pink-light)`.

### B. Mandatory Reusable Primitives (Zero Reinventing the Wheel)

Never roll custom raw containers, ad-hoc dialogs, or handwritten alert boxes when standard primitives exist in `src/components/ui/`:

- **Alert Banners**: Always use `<Alert variant="danger" | "warning" | "info" | "success" title={...}>{children}</Alert>` for form error messages, validation warnings, and feedback banners. Never write inline ad-hoc alert containers (e.g. `p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700`).
- **Confirmation Dialogs**: Always use `<ConfirmModal isOpen={...} onClose={...} onConfirm={...} title="..." variant="danger" | "warning" | "primary" />` for deletion confirmations and destructive state transitions.
- **Category Badges**: Always use `<CategoryBadge name={...} color={...} icon={...} size="sm" | "md" />` for displaying category dots, icons, and labels.
- **Cards & Stats**: Use `<Card variant="..." elevation="tactile" | "sm" | "flat" | "subtle" />` and `<StatCard />`. Use `elevation="sm"` for clean bordered cards with `shadow-cute-sm`. Use the `footer`, `subtitle`, and `badge` props of `StatCard` for pacing/limits rather than building custom cards from scratch.
- **Buttons**: Always `<Button variant="primary" | "secondary" | "danger" | "butter" | "ghost" | "outline" size="sm" | "md" | "lg" | "icon-sm" | "icon-md" />` with `leftIcon` or `rightIcon`.
- **Dialogs & Modals**: Always `<AnimatedModal />` with `<ModalHeader />`, `<ModalBody />`, and `<ModalFooter />`.
- **Badges & Indicators**: Always `<Badge variant="..." />`.
- **Inputs & Selects**: Always `<Input />` and `<Select />`.
- **Currency & Numbers**: Use `<CurrencyText amount={...} />` or `formatSGD(...)`.
- **Tooltips & Popovers**: Always `<TooltipPopover />` for definitions or contextual calculations.
- **Overflow Protection**: Always wrap dynamic labels with `<TruncatedText text={...} />`.

### C. Shared Utilities, Constants & Logic (Zero Redundancy)

Never re-declare shared constants or calculations locally across feature modules:

- **Month Names**: Always import `MONTH_NAMES_SHORT` or `MONTH_NAMES_FULL` (or the canonical `MONTH_NAMES` alias) from `src/lib/dateUtils`. Never re-declare `const MONTH_NAMES = ['Jan', 'Feb', ...]`.
- **Category Presets & Icons**: Always import `PRESET_COLORS`, `PRESET_ICONS`, and `getCategoryIconComponent` from `src/lib/categoryPresets`. Never recreate color lists or icon mapping tables in modals.
- **Allocation Auto-Balancing**: Always use `autoBalanceAllocations` from `src/lib/financialFormulas` to adjust unlocked category percentages proportionally to sum to 100%.
- **DOM & Dirty Checking**: Always use `checkContainerDirty` and `findScrollableAncestor` from `src/lib/domUtils`.

### D. Usability & User Experience Defaults

- **Touch & Accessibility**: Minimum touch target height `min-h-11` (or `h-10` compact) with tactile press transforms (`active:translate-x-0.5 active:translate-y-0.5`).
- **Clear Information Hierarchy**: Bold, primary figures in `text-2xl font-black font-display tracking-tight text-(--text-ink)` paired with uppercase tracked secondary labels in `text-xs font-bold uppercase tracking-wider text-(--text-muted)`.
- **Sensory & Visual Feedback**: For positive financial milestones (e.g., month-end surplus sweep, reaching a savings goal), trigger celebratory feedback (confetti and soft chime sound effects via `playSuccessSound()`).
- **Actionable Notification & Banner UX**:
    - **Scannable Copy**: Keep banner headlines short and metric-focused (e.g., `S$X,XXX unspent from [Month] budget`) paired with a single actionable subtitle.
    - **Meaningful Actions Over Generic 'X'**: For financial milestone or rollover banners, avoid passive dismiss ('X') buttons. Provide dual explicit actions (e.g., primary `Sweep to Goals` and secondary `Bank as Surplus`).
    - **Reserve Confirmation**: Actions that bank or defer funds must provide a clear confirmation modal explaining the reserve cushion benefit and destination.
- **Responsive Layout**: Always provide mobile-first responsive grid defaults (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).

## 6. Microcopy, UX Writing & Brevity Guidelines (`conciseCopyRule`)

Always maintain a direct, functional, and concise editorial style across all UI text:

- **Direct & Functional Naming**: Strip explanatory clauses from UI headers and labels. Prefer punchy nouns or active verbs:
    - Prefer `Bonus Splitter` over `Bonus Allocation Calculator`.
    - Prefer `Subscriptions` over `Auto-Deducted Monthly Subscriptions`.
    - Prefer `Sweep Surplus` over `Sweep Unspent Surplus`.
    - Prefer `Income Flow` over `Monthly CPF & Take-Home Flow`.
    - Prefer `Spend Trends` over `Monthly Spend Trends & Averages`.
    - Prefer `Add Expense` over `Quick Add Expense`.
- **Aggressive Header & Action Brevity**: Keep page headers, card titles, and primary action buttons to 1–3 punchy words (e.g. `Budget`, `Expenses`, `Accounts`, `Goals`, `Loans`, `Recurring`, `Save`, `Bank Surplus`, `Update Balances`).
- **StatCard & Metric Subtitles**: Limit subtitles to short data tokens (e.g. `12 transactions`, `S$450 remaining`, `5% of budget`), never full conversational sentences or filler phrases.
- **Empty States Formula**: Always follow the formula:
    - **Title**: Exactly 2 words (e.g. `No Accounts`, `No Goals`, `No Loans`).
    - **Prompt**: Exactly 1 concise action prompt sentence (e.g. `Add an account to start tracking balances.`).
    - **Action**: 1 primary direct CTA button.
    - **Placeholder exception**: "Under Construction" placeholders for unbuilt features (e.g. Plan > Loans) have no button, since there is nothing to act on yet.
- **Progressive Disclosure**: Keep high-level views uncluttered. Do not place multi-sentence explanatory paragraphs on primary page dashboards; offload deep background rules or calculation logic into `<TooltipPopover>` or collapsible sections.
- **Notification & Alert Copy**:
    - **Notification Settings**: Keep toggle descriptions under 8 words (e.g. `Remind before credit card statement due date`, `Daily 6 PM reminder to log spending`).
    - **Alert Banners**: Metric-focused headline ≤ 6 words paired with a single concise actionable subtitle.

## 7. Git & Workflow

### A. Approval Gates

- Editing files and running local checks is free. **Never commit, push, or open/update a PR until the user explicitly says so.**
- Each commit, push, and PR needs its own approval. Approval for one does not carry over to the next.
- History-altering or destructive git commands (`stash`, `reset`, `rebase`, `clean`, branch/worktree deletion) also need explicit approval.

### B. Branching

- **Never commit or push directly to `main`.** Never force-push.
- Work on a branch cut from an up-to-date `main`, named `feat/<slug>`, `fix/<slug>`, `refactor/<slug>`, `docs/<slug>`, or `chore/<slug>`.
- Changes reach `main` only through a pull request. Agents never merge PRs.
- Do not create `subagent-*` branches. Remove any worktree you create once finished.

### C. Quality Gate (before proposing a commit or PR)

- `npm run lint` (0 errors, 0 warnings), `npm run build`, and `npm test` must pass. Run `npm run test:e2e` when UI flows changed.
- Report failures as they are. Never use `--no-verify`, skip hooks, or delete/disable tests to get green.

### D. Commits & Pull Requests

- Conventional commits: `feat(budget): ...`, `fix(mobile): ...`, `refactor: ...`. Keep commits small and focused.
- PR descriptions state what changed, why, and how it was verified.

### E. Repo Hygiene

- Never commit secrets or `.env*` files (only `.env.example` is tracked), or build artifacts (`dist/`, `playwright-report/`, `test-results/`, `*.tsbuildinfo`).
- Do not install or upgrade dependencies without asking.
- Do not mix unrelated refactors or reformatting into a feature branch.
- Ask before destructive actions: deleting files, dropping data, resetting the DB.

### F. Supabase Migrations

- Name files with a full timestamp: `YYYYMMDDHHMMSS_name.sql`.
- Edit a migration in place only while it is unapplied and unpushed. Once applied, add a new migration instead.
- Do not squash migrations without asking.
