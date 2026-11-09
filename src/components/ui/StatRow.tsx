import type { ReactNode } from "react";

export type StatRowTone = "default" | "muted" | "ok" | "near" | "over";

export interface StatRowProps {
    /** Icon element representing the statistic. */
    icon: ReactNode;
    /** Value to display (number, formatted currency, date, etc.). */
    value: ReactNode;
    /** Descriptive label for the statistic (used as aria-label and tooltip). */
    label: string;
    /** Optional custom tooltip content. */
    tooltip?: ReactNode;
    /** Whether to show the text label visibly next to the icon. Defaults to false. */
    showLabel?: boolean;
    /** Value color tone. Defaults to "default". */
    tone?: StatRowTone;
    /** Size option: "sm" or "md". Defaults to "sm". */
    size?: "sm" | "md";
    className?: string;
}

const TONE_CLASSES: Record<StatRowTone, string> = {
    default: "text-(--text-ink)",
    muted: "text-(--text-muted)",
    ok: "text-emerald-700 dark:text-emerald-400",
    near: "text-amber-700 dark:text-amber-400",
    over: "text-rose-700 dark:text-rose-400",
};

export function StatRow({
    icon,
    value,
    label,
    tooltip,
    showLabel = false,
    tone = "default",
    size = "sm",
    className = "",
}: StatRowProps) {
    const toneCls = TONE_CLASSES[tone] ?? TONE_CLASSES.default;
    const valueString =
        typeof value === "string" || typeof value === "number"
            ? String(value)
            : "";
    const accessibleLabel = valueString ? `${label}: ${valueString}` : label;
    const tooltipText = typeof tooltip === "string" ? tooltip : label;

    const textSizeCls = size === "md" ? "text-sm" : "text-xs";
    const iconSizeCls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

    return (
        <div
            title={tooltipText}
            aria-label={accessibleLabel}
            className={`inline-flex items-center gap-1.5 font-mono-num ${textSizeCls} text-(--text-muted) ${className}`}
        >
            <span
                className={`inline-flex items-center justify-center shrink-0 ${iconSizeCls} text-(--text-muted)`}
                aria-hidden="true"
            >
                {icon}
            </span>

            {showLabel && (
                <span className="text-[11px] font-medium text-(--text-muted) truncate">
                    {label}
                </span>
            )}

            <span className={`font-bold ${toneCls} truncate`}>{value}</span>
        </div>
    );
}

export default StatRow;
