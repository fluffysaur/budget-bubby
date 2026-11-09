/**
 * A short quest checklist. Pending quests show an empty box and are tappable
 * when `onSelect` is given; finished ones show a green check, strikethrough
 * text and are disabled.
 */

import { Check } from "lucide-react";
import type { Quest } from "../../lib/bubby/quests";

export interface QuestListProps {
    quests: Quest[];
    label: string;
    onSelect?: (quest: Quest) => void;
    className?: string;
}

export function QuestList({
    quests,
    label,
    onSelect,
    className = "",
}: QuestListProps) {
    return (
        <ul aria-label={label} className={`flex flex-col ${className}`}>
            {quests.map((q) => (
                <li key={q.id} data-done={q.done ? "true" : "false"}>
                    <button
                        type="button"
                        disabled={q.done || !onSelect}
                        onClick={() => onSelect?.(q)}
                        className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-1 text-left text-sm font-bold ${
                            q.done
                                ? "text-(--text-muted)"
                                : "cursor-pointer text-(--text-ink) active:translate-x-0.5 active:translate-y-0.5"
                        }`}
                    >
                        <span
                            aria-hidden="true"
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                                q.done
                                    ? "border-(--border-ink) bg-(--pastel-mint-light)"
                                    : "border-(--border-subtle) bg-(--bg-cream)"
                            }`}
                        >
                            {q.done && (
                                <Check
                                    className="h-3.5 w-3.5 text-(--text-ink)"
                                    strokeWidth={3}
                                />
                            )}
                        </span>
                        <span
                            className={`min-w-0 flex-1 truncate ${q.done ? "line-through" : ""}`}
                        >
                            {q.label}
                        </span>
                        <span aria-hidden="true" className="shrink-0 text-xs">
                            {q.reward === "food" ? "🍤" : "💪"}
                        </span>
                        {q.done && <span className="sr-only">Done</span>}
                    </button>
                </li>
            ))}
        </ul>
    );
}

export default QuestList;
