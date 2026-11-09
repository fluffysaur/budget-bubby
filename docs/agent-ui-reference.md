# Budget Bubby - UI Reference

Loaded on demand from [AGENTS.md](../AGENTS.md). Read the relevant section before touching UI, styles or copy.

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

## 3. Component Design & Overflow Guardrails

- **Card Titles & Descriptions**: Any variable-length text (insurance policies, expense items, bank accounts, budget categories) must use `<TruncatedText text={name} />`.
- **Flex Layout Defense**: When building list rows with badges or amounts:
    - Text container must have `min-w-0 flex-1`.
    - Badges and numeric amounts must have `shrink-0`.
- **Interaction Contract**:
    - Desktop: Hover reveals full title in floating popover.
    - Mobile: Tap toggles popover open/closed; outside tap dismisses.


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
- **Confirmation Dialogs**: Always use `<ConfirmModal isOpen={...} onClose={...} onConfirm={...} title="..." variant="danger" | "warning" | "primary" />` for deletion confirmations and destructive state transitions. Handlers passed to `onConfirm` must be `async`, must `await` the operation (or mutation), and must only invoke `onClose()` upon successful completion. This ensures `<ConfirmModal />` displays its internal loading state during the operation and catches rejections into an in-modal alert without closing prematurely.
- **Category Badges**: Always use `<CategoryBadge name={...} color={...} icon={...} size="sm" | "md" />` for displaying category dots, icons, and labels.
- **Cards & Stats**: Use `<Card variant="..." elevation="tactile" | "sm" | "flat" | "subtle" />` and `<StatCard />`. Use `elevation="sm"` for clean bordered cards with `shadow-cute-sm`. Use the `footer`, `subtitle`, and `badge` props of `StatCard` for pacing/limits rather than building custom cards from scratch.
- **Buttons**: Always `<Button variant="primary" | "secondary" | "danger" | "butter" | "ghost" | "outline" size="sm" | "md" | "lg" | "icon-sm" | "icon-md" />` with `leftIcon` or `rightIcon`.
- **Dialogs & Modals**: Always `<AnimatedModal />` with `<ModalHeader />`, `<ModalBody />`, and `<ModalFooter />`.
- **Badges & Indicators**: Always `<Badge variant="..." />`. Static badges/chips are not live regions; never use `role="status"`. Use `<span aria-label={...}>` or `<Badge />`. Short labels must remain clear (e.g. `Insur.`, not cryptic `Ins`).
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

### E. Motion & Animation

- **Which tool:**
    - Use `motion` (Framer Motion, imported from `motion/react`) for anything with an exit or layout animation: route and tab changes, toasts, popovers, sheets, list rows added or removed, and shared indicators.
    - Use the CSS tokens and utilities for press, hover, progress fills and colour changes.
- **Bundle:** Use `m.*` components inside the app-wide `<LazyMotion features={domAnimation} strict>`. Never import `motion.*` directly, since `strict` rejects it.
- **Presets, never ad-hoc values:**
    - Reuse the presets in `src/lib/motion.ts` (`fadeRise`, `pop`, `collapse`, `listItem`).
    - Use the easing tokens (`--ease-out-soft`, `--ease-in-fast`, `--ease-spring`) and duration tokens (`--duration-instant/fast/base/slow`).
    - Never add a new cubic-bezier or a one-off duration.
- **CSS utilities:** `.animate-enter`, `.animate-pop`, `.transition-press` and `.progress-fill`. Never use `animate-in` / `fade-in` / `slide-in-from-*`: no plugin defines them, so they do nothing.
- **Property choice:**
    - Animate `transform` and `opacity` only. Height is the exception: animate it only through the `collapse` preset.
    - Never use `transition-all`. List the properties instead (`transition-colors`, `.transition-press`).
- **Reduced motion:**
    - Every animation must respect `prefers-reduced-motion`.
    - `MotionConfig reducedMotion="user"` covers `motion`. The global CSS rule covers CSS.
    - Any JS-driven motion (smooth scroll, drag, pull-to-refresh) must check `matchMedia("(prefers-reduced-motion: reduce)")`.
- **No layout shift:**
    - Conditional banners and cards animate their height in and out through `collapse`. They never pop into the page flow.
    - Async content keeps its previous data visible (`placeholderData: keepPreviousData`) instead of falling back to a skeleton.
    - Numbers use `tabular-nums`.
- **Viewport:** Use `dvh` (`h-dvh`, `min-h-dvh`), never `h-screen`. Fixed elements near the screen edges add `env(safe-area-inset-*)`.
- **Never slower:** Navigation never waits for an exit animation to finish. Keep enter animations at 220ms or less.

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
    - **Clamped Values**: Use clamped values in copy when business rules adjust dates/amounts (e.g. day 30 in short months).
- **One Figure, One Representation**:
    - Show each figure once.
    - When a bar or ring is shown, pair it with **one** amount, usually what's left.
    - Don't also print the %, the spent and the cap next to it. Colour and the visual carry the status.
    - Put secondary figures (%, spent, cap, pace) behind a tap `<TooltipPopover>`.
    - Prefer the shared visuals (`MeterBar`, `ProgressRing`, `Sparkline`, `DeltaBadge`, `Badge` status variants) over extra numbers or labels.

