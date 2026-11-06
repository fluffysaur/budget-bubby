/**
 * "Fed today": one small avatar dot per partner that lights up once they
 * have fed Bubby today. No counts.
 */

import type { HouseholdMember } from "../../types/finance";

export interface FedTodayDotsProps {
    members: HouseholdMember[];
    fedToday: Set<string>;
    size?: "xs" | "sm";
    className?: string;
}

export function FedTodayDots({ members, fedToday, size = "sm", className = "" }: FedTodayDotsProps) {
    const dot = size === "xs" ? "h-3 w-3 text-[7px]" : "h-6 w-6 text-[10px]";
    return (
        <span className={`inline-flex items-center gap-1 ${className}`} data-testid="fed-today-dots">
            {members.slice(0, 2).map((m) => {
                const fed = fedToday.has(m.id);
                return (
                    <span
                        key={m.id}
                        role="img"
                        aria-label={`${m.display_name}${fed ? ", fed Bubby today" : ""}`}
                        data-fed={fed ? "true" : "false"}
                        className={`flex ${dot} shrink-0 items-center justify-center rounded-full border-2 border-(--border-ink) font-black leading-none transition-colors ${
                            fed ? "bg-(--pastel-mint) text-(--text-ink)" : "bg-(--bg-cream) text-(--text-faint) opacity-60"
                        }`}
                    >
                        {size === "sm" ? m.display_name.charAt(0).toUpperCase() : null}
                    </span>
                );
            })}
        </span>
    );
}

export default FedTodayDots;
