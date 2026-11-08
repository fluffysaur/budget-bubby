/**
 * A short quest checklist. Rewards show as 🍤 food or 💪 exercise.
 */

import { Check } from "lucide-react";
import type { Quest } from "../../lib/bubby/quests";

export interface QuestListProps {
    quests: Quest[];
    label: string;
    className?: string;
}

export function QuestList({ quests, label, className = "" }: QuestListProps) {
    return (
        <ul
            aria-label={label}
            className={`flex flex-wrap gap-1.5 ${className}`}
        >
            {quests.map((q) => (
                <li
                    key={q.id}
                    data-done={q.done ? "true" : "false"}
                    className={`inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[11px] font-bold ${
                        q.done
                            ? "border-(--border-ink) bg-(--pastel-mint-light) text-(--text-ink)"
                            : "border-(--border-subtle) bg-(--bg-cream) text-(--text-muted)"
                    }`}
                >
                    {q.done ? (
                        <Check
                            className="h-3 w-3 shrink-0"
                            strokeWidth={3}
                            aria-label="Done"
                        />
                    ) : (
                        <span aria-hidden="true">
                            {q.reward === "food" ? "🍤" : "💪"}
                        </span>
                    )}
                    <span>{q.label}</span>
                </li>
            ))}
        </ul>
    );
}

export default QuestList;
