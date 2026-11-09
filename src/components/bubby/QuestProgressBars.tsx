/**
 * One progress bar per quest tier (done / total) with the count at the end.
 * Uses the same MeterBar and tone as the Left to Spend meter. Tiers with no
 * quests are left out.
 */

import { MeterBar } from "../ui/MeterBar";
import type { Quest } from "../../lib/bubby/quests";

export interface QuestTier {
    label: string;
    quests: readonly Quest[];
}

export interface QuestProgressBarsProps {
    tiers: readonly QuestTier[];
    className?: string;
}

export function QuestProgressBars({
    tiers,
    className = "",
}: QuestProgressBarsProps) {
    const shown = tiers.filter((t) => t.quests.length > 0);
    if (shown.length === 0) return null;
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {shown.map((tier) => {
                const total = tier.quests.length;
                const done = tier.quests.filter((q) => q.done).length;
                return (
                    <div key={tier.label} className="flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-wider text-(--text-muted)"
                        >
                            {tier.label}
                        </span>
                        <MeterBar
                            value={done}
                            max={total}
                            tone="ok"
                            size="md"
                            className="min-w-0 flex-1"
                            aria-label={`${tier.label}: ${done} of ${total} done`}
                        />
                        <span
                            aria-hidden="true"
                            className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums text-(--text-muted)"
                        >
                            {done}/{total}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default QuestProgressBars;
