import React from "react";

export interface MetaListProps {
    /** Facts to show; falsy entries are skipped so callers can inline conditions. */
    items: React.ReactNode[];
    className?: string;
    /** Keep on one line and truncate facts instead of wrapping (collapsed headers). */
    nowrap?: boolean;
    "data-testid"?: string;
}

/**
 * A row of short facts split by 1px hairline rules, e.g.
 * "S$27,080.67 spent │ 9 expenses". Use instead of "·" separators.
 *
 * Facts wrap as whole units. Each rule is the left border of the fact after
 * it; the inner row is pulled left by (margin + border + padding) and the outer box clips,
 * so a rule that lands at the start of a wrapped line is hidden. A visually
 * hidden ", " between facts keeps them separate for assistive tech.
 */
export function MetaList({
    items,
    className = "",
    nowrap = false,
    "data-testid": testId,
}: MetaListProps) {
    const facts = items.filter(
        (item) =>
            item !== null &&
            item !== undefined &&
            item !== false &&
            item !== "",
    );
    return (
        <span
            className={`block min-w-0 overflow-hidden ${className}`}
            data-testid={testId}
        >
            <span
                className={`-ml-[calc(1rem+1px)] flex items-center ${nowrap ? "flex-nowrap" : "flex-wrap"}`}
            >
                {facts.map((fact, i) => (
                    <span
                        key={i}
                        className={`ml-2 min-w-0 max-w-full border-l border-(--border-subtle) pl-2 leading-tight ${nowrap ? "truncate" : ""}`}
                    >
                        {/* Screen readers (and textContent) hear "a, b" not "ab". */}
                        {i > 0 && <span className="sr-only">, </span>}
                        {fact}
                    </span>
                ))}
            </span>
        </span>
    );
}

/**
 * A standalone hairline rule for rows that are already single-line flex
 * layouts (link rows, pills). Prefer MetaList for wrapping text.
 */
export function MetaRule({ className = "" }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={`inline-block h-3 w-px shrink-0 self-center bg-(--border-subtle) ${className}`}
        />
    );
}

/** Bold ink-coloured figure inside a MetaList fact: <MetaFigure>9</MetaFigure> expenses. */
export function MetaFigure({ children }: { children: React.ReactNode }) {
    return <span className="font-bold text-(--text-ink)">{children}</span>;
}
