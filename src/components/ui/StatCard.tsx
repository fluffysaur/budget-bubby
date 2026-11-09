import React from "react";
import { MONEY_BASE_CLASSES, MONEY_SIZE_CLASSES } from "../../lib/moneyStyles";
import { TooltipPopover } from "./TooltipPopover";
import { Card, type CardVariant } from "./Card";
import { SkeletonLine, SkeletonStatValue } from "./Skeleton";

export interface StatCardProps {
    title: React.ReactNode;
    value: React.ReactNode;
    subtitle?: React.ReactNode;
    tooltip?: React.ReactNode;
    tooltipTitle?: string;
    icon?: React.ReactNode;
    iconBg?: string;
    badge?: React.ReactNode;
    footer?: React.ReactNode;
    variant?: CardVariant;
    className?: string;
    onClick?: () => void;
    /** Renders skeleton placeholders for value/subtitle/footer while data loads. */
    loading?: boolean;
}

export function StatCard({
    title,
    value,
    subtitle,
    tooltip,
    tooltipTitle,
    icon,
    iconBg = "bg-(--pastel-lilac-light) text-purple-700 dark:bg-purple-950/40 dark:text-(--pastel-lilac)",
    badge,
    footer,
    variant = "white",
    className = "",
    onClick,
    loading = false,
}: StatCardProps) {
    const Component = onClick ? "button" : "div";

    return (
        <Card
            variant={variant}
            interactive={!!onClick}
            padding="none"
            aria-busy={loading || undefined}
            className={`overflow-hidden text-left ${className}`}
        >
            <Component
                type={onClick ? "button" : undefined}
                onClick={onClick}
                className={`w-full p-3 sm:p-5 text-left block ${onClick ? "cursor-pointer" : ""}`}
            >
                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-(--text-muted) truncate sm:line-clamp-2">
                            {title}
                        </span>
                        {tooltip && (
                            <TooltipPopover
                                className="shrink-0"
                                title={
                                    tooltipTitle ||
                                    (typeof title === "string"
                                        ? title
                                        : "Details")
                                }
                                ariaLabel={`${typeof title === "string" ? title : "Stat"} info`}
                                align="left"
                            >
                                {tooltip}
                            </TooltipPopover>
                        )}
                    </div>
                    {icon && (
                        <div
                            className={`p-1.5 sm:p-2 rounded-xl border-2 border-(--border-ink) shadow-cute-sm shrink-0 ${iconBg}`}
                        >
                            {icon}
                        </div>
                    )}
                </div>

                <div className="mt-1.5 sm:mt-2.5 flex items-baseline justify-between gap-1 sm:gap-2 flex-wrap min-w-0">
                    <div
                        className={`min-w-0 max-w-full ${MONEY_BASE_CLASSES} ${MONEY_SIZE_CLASSES.lg} text-(--text-ink)`}
                    >
                        {loading ? <SkeletonStatValue /> : value}
                    </div>
                    {badge && !loading && (
                        <div className="shrink-0">{badge}</div>
                    )}
                </div>

                {subtitle && (
                    <div className="mt-1 text-[11px] sm:text-xs font-medium text-(--text-muted) truncate sm:line-clamp-2">
                        {loading ? <SkeletonLine /> : subtitle}
                    </div>
                )}
            </Component>

            {footer && (
                <div className="border-t-2 border-(--border-ink) bg-(--bg-cream) px-4 py-2 text-xs font-bold text-(--text-muted)">
                    {loading ? <SkeletonLine className="w-full" /> : footer}
                </div>
            )}
        </Card>
    );
}

export default StatCard;
