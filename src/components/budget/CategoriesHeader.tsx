/**
 * CategoriesHeader
 * Heading for the spendable categories list: bold remaining amount, muted
 * allocation, and a thin progress bar (spent / allocated).
 * Bar colour thresholds match CategoryProgressList (<80 emerald, 80-99 amber,
 * >=100 rose).
 */

import { CurrencyText } from "../ui/CurrencyText";

export interface CategoriesHeaderProps {
    remaining: number;
    allocated: number;
    spent: number;
}

export function CategoriesHeader({
    remaining,
    allocated,
    spent,
}: CategoriesHeaderProps) {
    const hasCap = allocated > 0;
    const rawPercent = hasCap ? (spent / allocated) * 100 : 0;
    const percent = Math.max(0, Math.min(rawPercent, 100));
    const isOver = remaining < 0;
    const barColor =
        rawPercent >= 100
            ? "bg-rose-500"
            : rawPercent >= 80
              ? "bg-amber-500"
              : "bg-emerald-500";

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-(--text-ink)">
                    Categories
                </h2>
                <p className="min-w-0 text-sm wrap-break-word">
                    {isOver ? (
                        <span className="font-black font-display text-rose-600 dark:text-rose-400">
                            <CurrencyText amount={Math.abs(remaining)} /> over
                        </span>
                    ) : (
                        <span className="font-black font-display text-(--text-ink)">
                            <CurrencyText amount={remaining} /> left
                        </span>
                    )}
                    <span className="text-(--text-muted)">
                        {" "}
                        of <CurrencyText amount={allocated} />
                    </span>
                </p>
            </div>
            {hasCap && (
                <div
                    role="progressbar"
                    aria-label="Categories spent"
                    aria-valuenow={Math.round(percent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-(--bg-canvas)"
                >
                    <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}
        </div>
    );
}

export default CategoriesHeader;
