# Budget Bubby - Developer & Agent Guidelines

Read the linked file before working in its area. Rules below are the always-on core.

## Hard rules

- **Never commit, push, or open/update a PR until the user explicitly says so.** Each needs its own approval. Never commit to `main`, never force-push, never merge PRs.
- Quality gate before proposing a commit: `npm run check` (lint 0 warnings, build, test). Add `npm run test:e2e` when UI flows changed. Never use `--no-verify` or disable tests.
- Don't install or upgrade dependencies without asking. Never commit `.env*` or build artifacts.
- The repo is public: no real names, balances or emails in code, issues, PRs or screenshots.

Full git, PR, migration, screenshot and backlog rules: [docs/agent-workflow.md](docs/agent-workflow.md).

## UI & copy (summary)

Details in [docs/agent-ui-reference.md](docs/agent-ui-reference.md). Read it before touching UI, styles or copy.

- **Tailwind v4 canonical classes:** `bg-(--token)` not `bg-[var(--token)]`, `shadow-cute`, `border-2`, `z-50`, `wrap-break-word`. No hardcoded hex colours.
- **Primitives, never ad-hoc:** `Alert`, `ConfirmModal`, `CategoryBadge`, `Card`/`StatCard`, `Button`, `AnimatedModal`, `Badge`, `Input`/`Select`, `CurrencyText`, `TooltipPopover`, `TruncatedText` (all in `src/components/ui/`).
- **Shared utils:** import month names from `src/lib/dateUtils`, presets from `src/lib/categoryPresets`, `autoBalanceAllocations` from `src/lib/financialFormulas`, dirty checks from `src/lib/domUtils`.
- **Motion:** `m.*` from `motion/react`, presets in `src/lib/motion.ts`, animate `transform`/`opacity` only, never `transition-all`, honour reduced motion.
- **Copy:** headers and buttons 1-3 words, empty states = 2-word title + one prompt + one CTA, one figure per visual.
- **Layout:** variable text in `<TruncatedText>`, `min-w-0 flex-1` on text, `shrink-0` on badges/amounts, `min-h-11` touch targets, mobile-first grids, `dvh` not `screen`.

## Formatting & Code Style

- **Indentation**: 4 spaces (`tabWidth: 4`, `useTabs: false`).
- **Quotes**: Double quotes (`" "`) for TS/TSX imports, strings, and JSX attributes.
- **Semicolons**: Always included (`semi: true`).
- **Trailing Commas**: Multi-line trailing commas (`trailingComma: "all"`).
- Configured via `.prettierrc`, `.editorconfig`, and `.vscode/settings.json`.


## React & Fast Refresh Hygiene

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
- **Test Consumer Purity**: In mock test consumers, record context/props in `useEffect`, never mutating external test variables during render.


## Subagents & model tiering

Use the cheapest model that can do the job; set `model` explicitly and never default to inheriting the parent's tier. A fork inherits the parent model, so prefer a typed agent.

- **Claude Code:** Haiku for searches, greps and running checks. Sonnet for implementation with a clear spec. Opus only for planning, hard debugging and final review.
- **Antigravity (Gemini):** `flash_lite` for trivial lookups. `flash` is the default workhorse. `pro`/`inherit` (Argon) only for planning or heavily complex tasks, never routine implementation, testing or research.
- Don't split small tasks across subagents; each one re-reads context.
