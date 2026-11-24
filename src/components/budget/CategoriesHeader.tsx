/**
 * CategoriesHeader
 * Heading for the spendable categories list: bold remaining amount, muted
 * allocation, and a MeterBar (spent / allocated).
 */

import { CurrencyText } from "../ui/CurrencyText";
import { MeterBar } from "../ui/MeterBar";

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
    const isOver = remaining < 0;

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-(--text-ink)">
                    Categories
                </h2>
                <p className="min-w-0 text-sm wrap-break-word">
                    {isOver ? (
                        <span className="font-black font-display text-amber-700 dark:text-amber-300">
                            <CurrencyText amount={Math.abs(remaining)} /> from
                            next month
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
                <MeterBar
                    value={spent}
                    max={allocated}
                    size="sm"
                    tone={isOver ? "near" : undefined}
                    aria-label="Categories spent"
                />
            )}
        </div>
    );
}

export default CategoriesHeader;
