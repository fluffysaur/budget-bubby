import type { ReactNode } from "react";
import { formatCountdown } from "../../lib/dateUtils";

export type CalendarStripStatus = "ok" | "near" | "urgent" | "overdue" | "paid";

export interface CalendarStripProps {
    /**
     * Number of days until due:
     * - positive: days remaining (e.g. 3)
     * - 0: due today
     * - negative: overdue (e.g. -2)
     * - null: unknown or annual cycle
     */
    daysRemaining: number | null;
    /** Number of dots displayed in the countdown strip. Defaults to 7. */
    totalDots?: number;
    /** Urgency status override. If omitted, derived from daysRemaining. */
    status?: CalendarStripStatus;
    /** Dot size: "xs" (6px), "sm" (9px), "md" (12px). Defaults to "sm". */
    size?: "xs" | "sm" | "md";
    /** Optional accessible label. */
    ariaLabel?: string;
    /** Optional badge or label displayed beside the dots. */
    label?: ReactNode;
    className?: string;
}

const DOT_SIZE_CLASSES = {
    xs: "h-1.5 w-1.5",
    sm: "h-2.5 w-2.5",
    md: "h-3.5 w-3.5",
};

export function CalendarStrip({
    daysRemaining,
    totalDots = 7,
    status: statusOverride,
    size = "sm",
    ariaLabel,
    label,
    className = "",
}: CalendarStripProps) {
    // Derive status if not explicitly provided
    const status: CalendarStripStatus =
        statusOverride ??
        (daysRemaining === null
            ? "ok"
            : daysRemaining < 0
              ? "overdue"
              : daysRemaining === 0
                ? "urgent"
                : daysRemaining <= 3
                  ? "urgent"
                  : daysRemaining <= 7
                    ? "near"
                    : "ok");

    const dotSize = DOT_SIZE_CLASSES[size] ?? DOT_SIZE_CLASSES.sm;

    const defaultAriaLabel =
        daysRemaining === null
            ? "Payment countdown"
            : formatCountdown(daysRemaining);

    const effectiveAriaLabel = ariaLabel || defaultAriaLabel;

    // Get color classes for active/target dots based on status
    const getActiveDotClasses = (isTarget: boolean) => {
        switch (status) {
            case "paid":
                return "bg-(--tone-ok) border-(--border-ink)";
            case "overdue":
                return "bg-(--tone-over) border-(--border-ink) animate-pulse";
            case "urgent":
                return isTarget
                    ? "bg-(--tone-over) border-(--border-ink) shadow-cute-sm"
                    : "bg-(--pastel-coral-light) border-(--border-ink)";
            case "near":
                return isTarget
                    ? "bg-(--tone-near) border-(--border-ink)"
                    : "bg-(--pastel-butter-light) border-(--border-subtle)";
            case "ok":
            default:
                return isTarget
                    ? "bg-(--pastel-mint) border-(--border-ink)"
                    : "bg-(--pastel-mint-light) border-(--border-subtle)";
        }
    };

    // Number of active indicator dots: clamped to totalDots
    const activeDotsCount =
        status === "paid"
            ? totalDots
            : daysRemaining === null
              ? 0
              : status === "overdue"
                ? totalDots
                : Math.max(
                      1,
                      Math.min(
                          totalDots,
                          totalDots - Math.min(daysRemaining, totalDots) + 1,
                      ),
                  );

    return (
        <div
            className={`inline-flex items-center gap-1.5 select-none ${className}`}
        >
            <div
                role="img"
                aria-label={effectiveAriaLabel}
                title={effectiveAriaLabel}
                className="flex items-center gap-1"
            >
                {Array.from({ length: totalDots }).map((_, i) => {
                    const isActive = i < activeDotsCount;
                    const isTarget =
                        i === activeDotsCount - 1 ||
                        (status === "urgent" && i === totalDots - 1);

                    return (
                        <span
                            key={i}
                            aria-hidden="true"
                            className={`rounded-full border ${dotSize} ${
                                isActive
                                    ? getActiveDotClasses(isTarget)
                                    : "bg-(--meter-track)/40 border-transparent dark:bg-neutral-800"
                            }`}
                        />
                    );
                })}
            </div>
            {label && (
                <span className="text-xs font-semibold text-(--text-muted) truncate">
                    {label}
                </span>
            )}
        </div>
    );
}

export default CalendarStrip;
