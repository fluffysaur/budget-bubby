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
