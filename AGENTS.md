# Budget Bubby - Developer & Agent Guidelines

## 1. Tailwind CSS v4 Canonical Classes (`suggestCanonicalClasses`)

Always use canonical Tailwind v4 utilities rather than arbitrary values where standard or shorthand equivalents exist:

- **CSS Variables**: Always use the canonical shorthand `(--variable)` instead of `[var(--variable)]`:
    - `hover:text-(--text-ink)` (NOT `hover:text-[var(--text-ink)]`)
    - `bg-(--bg-card)` (NOT `bg-[var(--bg-card)]`)
    - `border-(--border-ink)` (NOT `border-[var(--border-ink)]`)
    - `shadow-(--shadow-cute-sm)` (NOT `shadow-[var(--shadow-cute-sm)]`)
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

- In component files (`.tsx`), avoid exporting non-component helper functions unless annotated with `// eslint-disable-next-line react-refresh/only-export-components`, or extract them to dedicated files in `src/lib/` or `src/services/`.
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
- **Borders & Shadows**: Standard `border-2 border-(--border-ink)` and `shadow-(--shadow-cute)` or `shadow-(--shadow-cute-sm)`.
- **Theme Tokens**: Always prefer project tokens:
    - Backgrounds: `bg-(--bg-canvas)`, `bg-(--bg-cream)`, `bg-(--bg-card)`.
    - Text: `text-(--text-ink)`, `text-(--text-muted)`, `text-(--text-faint)`.
    - Pastel Accents: `bg-(--accent-lilac-subtle)`, `bg-(--accent-butter-subtle)`, `bg-emerald-50`, `bg-rose-50`, etc.

### B. Mandatory Reusable Primitives (Zero Reinventing the Wheel)
Never roll custom raw containers or ad-hoc wrappers when standard primitives exist in `src/components/ui/`:
- **Cards & Stats**: Use `<Card variant="..." />` and `<StatCard />`. Use the `footer`, `subtitle`, and `badge` props of `StatCard` for pacing/limits rather than building custom cards from scratch.
- **Buttons**: Always `<Button variant="primary" | "secondary" | "danger" | "ghost" />` with `leftIcon` or `rightIcon`.
- **Dialogs & Modals**: Always `<AnimatedModal />` with `<ModalHeader />`, `<ModalBody />`, and `<ModalFooter />`.
- **Badges & Indicators**: Always `<Badge variant="..." />`.
- **Currency & Numbers**: Use `<CurrencyText amount={...} />` or `formatSGD(...)`.
- **Tooltips & Popovers**: Always `<TooltipPopover />` for definitions or contextual calculations.
- **Overflow Protection**: Always wrap dynamic labels with `<TruncatedText text={...} />`.

### C. Usability & User Experience Defaults
- **Touch & Accessibility**: Minimum touch target height `min-h-11` (or `h-10` compact) with tactile press transforms (`active:translate-x-0.5 active:translate-y-0.5`).
- **Clear Information Hierarchy**: Bold, primary figures in `text-2xl font-black font-display tracking-tight text-(--text-ink)` paired with uppercase tracked secondary labels in `text-xs font-bold uppercase tracking-wider text-(--text-muted)`.
- **Sensory & Visual Feedback**: For positive financial milestones (e.g., month-end surplus sweep, reaching a savings goal), trigger celebratory feedback (confetti and soft chime sound effects via `playSuccessSound()`).
- **Actionable Notification & Banner UX**:
    - **Scannable Copy**: Keep banner headlines short and metric-focused (e.g., `S$X,XXX unspent from [Month] budget`) paired with a single actionable subtitle.
    - **Meaningful Actions Over Generic 'X'**: For financial milestone or rollover banners, avoid passive dismiss ('X') buttons. Provide dual explicit actions (e.g., primary `Sweep to Goals` and secondary `Bank as Surplus`).
    - **Reserve Confirmation**: Actions that bank or defer funds must provide a clear confirmation modal explaining the reserve cushion benefit and destination.
- **Responsive Layout**: Always provide mobile-first responsive grid defaults (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).

