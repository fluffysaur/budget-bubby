import React from "react";
import { ProgressRing, TruncatedText } from "../ui";
import { CurrencyText } from "../ui/CurrencyText";

export interface CategoryMeterCardProps {
    name: string;
    color: string;
    remaining: number;
    pct: number;
}

export const CategoryMeterCard = React.memo(function CategoryMeterCard({
    name,
    color,
    remaining,
    pct,
}: CategoryMeterCardProps) {
    return (
        <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-2.5 shadow-cute-sm flex items-center gap-2.5">
            <ProgressRing
                value={pct}
                size={36}
                strokeWidth={3.5}
                tone={
                    remaining < 0
                        ? "over"
                        : pct >= 80
                          ? "near"
                          : "ok"
                }
                centerContent={
                    <span
                        className="h-2 w-2 rounded-full border border-(--border-ink) shrink-0"
                        style={{
                            backgroundColor: color,
                        }}
                    />
                }
            />
            <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-(--text-ink) truncate font-display">
                    <TruncatedText text={name} />
                </div>
                <div
                    className={`text-xs font-extrabold font-mono-num ${
                        remaining < 0
                            ? "text-(--accent-coral-ink) dark:text-rose-400"
                            : "text-(--text-ink)"
                    }`}
                >
                    <CurrencyText amount={remaining} />
                </div>
            </div>
        </div>
    );
});
CategoryMeterCard.displayName = "CategoryMeterCard";

export default CategoryMeterCard;
