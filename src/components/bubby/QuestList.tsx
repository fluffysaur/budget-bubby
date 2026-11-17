/**
 * A short quest checklist. Pending quests show an empty box and are tappable
 * when `onSelect` is given; finished ones show a green check, strikethrough
 * text and are disabled.
 */

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { Quest } from "../../lib/bubby/quests";
import { Badge } from "../ui/Badge";

export interface QuestListProps {
    quests: Quest[];
    label: string;
    onSelect?: (quest: Quest) => void;
    /** Pending quests this returns false for are shown but not tappable. */
    isSelectable?: (quest: Quest) => boolean;
    /** Optional extra content under a quest row (e.g. a shortcut button). */
    renderExtra?: (quest: Quest) => ReactNode;
    className?: string;
}

export function QuestList({
    quests,
    label,
    onSelect,
    isSelectable,
    renderExtra,
    className = "",
}: QuestListProps) {
    return (
        <ul aria-label={label} className={`flex flex-col gap-2 ${className}`}>
            {quests.map((q) => (
                <li
                    key={q.id}
                    data-done={q.done ? "true" : "false"}
                    className={`rounded-2xl border-2 transition-colors ${
                        q.done
                            ? "border-(--border-subtle) bg-(--bg-cream) opacity-75"
                            : "border-(--border-ink) bg-(--bg-card) shadow-cute-sm"
                    }`}
                >
                    <button
                        type="button"
                        disabled={
                            q.done ||
                            !onSelect ||
                            (isSelectable ? !isSelectable(q) : false)
                        }
                        onClick={() => onSelect?.(q)}
                        className={`flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-bold ${
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
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span
                                className={`truncate ${q.done ? "line-through" : ""}`}
                            >
                                {q.label}
                            </span>
                            {q.description && (
                                <span className="truncate text-xs font-medium text-(--text-muted)">
                                    {q.description}
                                </span>
                            )}
                        </span>
                        <Badge
                            variant={q.reward === "food" ? "butter" : "mint"}
                            size="sm"
                            className={`shrink-0 ${q.done ? "opacity-60" : ""}`}
                        >
                            {q.reward === "food" ? "🍤 Food" : "💪 Exercise"}
                        </Badge>
                        {q.done && <span className="sr-only">Done</span>}
                    </button>
                    {renderExtra?.(q)}
                </li>
            ))}
        </ul>
    );
}

export default QuestList;
