import React from "react";
import { Badge, ProgressRing, TruncatedText } from "../ui";
import { CurrencyText } from "../ui/CurrencyText";

export interface CategoryMeterCardProps {
    name: string;
    color: string;
    remaining: number;
    pct: number;
    ownerName?: string;
}

export const CategoryMeterCard = React.memo(function CategoryMeterCard({
    name,
    color,
    remaining,
    pct,
    ownerName,
}: CategoryMeterCardProps) {
    return (
        <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-2 sm:p-2.5 shadow-cute-sm flex items-center gap-2 sm:gap-2.5">
            <ProgressRing
                value={pct}
                size={36}
                strokeWidth={3.5}
                tone={remaining < 0 ? "over" : pct >= 80 ? "near" : "ok"}
                centerContent={
                    <span
                        className="h-2 w-2 rounded-full border border-(--border-ink) shrink-0"
                        style={{
                            backgroundColor: color,
                        }}
                    />
                }
            />
            <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-1 min-w-0">
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
                    className={
                        remaining < 0
                            ? "text-(--accent-coral-ink) dark:text-rose-400"
                            : "text-(--text-ink)"
                    }
                >
                    <CurrencyText
                        amount={remaining}
                        size="sm"
                        className="block truncate"
                    />
                </div>
            </div>
        </div>
    );
});
CategoryMeterCard.displayName = "CategoryMeterCard";

export default CategoryMeterCard;
