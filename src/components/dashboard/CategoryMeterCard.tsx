import React from "react";
import { Shield } from "lucide-react";
import { Badge, MeterBar, TruncatedText } from "../ui";
import { CurrencyText } from "../ui/CurrencyText";
import type { SpendableCategoryStatus } from "../../lib/financialFormulas";

export interface CategoryMeterCardProps {
    name: string;
    color: string;
    remaining: number;
    pct: number;
    status?: SpendableCategoryStatus;
    ownerName?: string;
}

export const CategoryMeterCard = React.memo(function CategoryMeterCard({
    name,
    color,
    remaining,
    pct,
    status = "normal",
    ownerName,
}: CategoryMeterCardProps) {
    const isCovered = status === "covered";
    const showShield = isCovered || status === "partially_covered";
    const isWarning =
        status === "buffer_depleted" || (remaining < 0 && !isCovered);
    return (
        <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-2.5 shadow-cute-sm min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0">
                <span
                    className="h-2.5 w-2.5 rounded-full border border-(--border-ink) shrink-0"
                    style={{
                        backgroundColor: color,
                    }}
                />
                <div className="text-xs font-bold text-(--text-ink) truncate font-display min-w-0 flex-1">
                    <TruncatedText text={name} />
                </div>
                {ownerName && (
                    <Badge variant="lilac" size="sm" className="shrink-0">
                        {ownerName}
                    </Badge>
                )}
            </div>
            <div
                className={`mt-1 flex items-center gap-1 min-w-0 ${
                    isWarning
                        ? "text-(--accent-coral-ink) dark:text-rose-400"
                        : "text-(--text-ink)"
                }`}
            >
                <CurrencyText
                    amount={remaining}
                    size="sm"
                    className="block truncate min-w-0"
                />
                {showShield && (
                    <Shield
                        className="h-3.5 w-3.5 shrink-0 text-(--text-muted)"
                        role="img"
                        aria-label={
                            isCovered
                                ? "Covered by Buffer"
                                : "Partly covered by Buffer"
                        }
                        data-testid="covered-by-buffer"
                    />
                )}
            </div>
            <div className="mt-1.5">
                <MeterBar
                    value={pct}
                    max={100}
                    size="sm"
                    aria-label={`${name} progress`}
                />
            </div>
        </div>
    );
});
CategoryMeterCard.displayName = "CategoryMeterCard";

export default CategoryMeterCard;
