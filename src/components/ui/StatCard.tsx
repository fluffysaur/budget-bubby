import type { ReactNode } from "react";
import { usePrivacy } from "../../context/PrivacyContext";
import { maskMoneyNode } from "../../lib/maskMoney";
import { MONEY_BASE_CLASSES, MONEY_SIZE_CLASSES } from "../../lib/moneyStyles";
import { TooltipPopover } from "./TooltipPopover";
import { Card, type CardVariant } from "./Card";
import { SkeletonLine, SkeletonStatValue } from "./Skeleton";

export type StatCardTone =
    "default" | "ok" | "near" | "over" | "lilac" | "mint" | "butter" | "coral";

export interface StatCardProps {
    title: ReactNode;
    value: ReactNode;
    subtitle?: ReactNode;
    tooltip?: ReactNode;
    tooltipTitle?: string;
    icon?: ReactNode;
    iconBg?: string;
    badge?: ReactNode;
    footer?: ReactNode;
    variant?: CardVariant;
    className?: string;
    onClick?: () => void;
    /** Renders skeleton placeholders for value/subtitle/footer while data loads. */
    loading?: boolean;
    /** Semantic pastel tone for the card icon background. */
    tone?: StatCardTone;
}

const TONE_ICON_BG: Record<StatCardTone, string> = {
    default:
        "bg-(--pastel-lilac-light) text-purple-700 dark:bg-purple-950/40 dark:text-(--pastel-lilac)",
    lilac: "bg-(--pastel-lilac-light) text-purple-700 dark:bg-purple-950/40 dark:text-(--pastel-lilac)",
    mint: "bg-(--pastel-mint-light) text-emerald-800 dark:bg-emerald-950/40 dark:text-(--pastel-mint)",
    ok: "bg-(--pastel-mint-light) text-emerald-800 dark:bg-emerald-950/40 dark:text-(--pastel-mint)",
    butter: "bg-(--pastel-butter-light) text-amber-800 dark:bg-amber-950/40 dark:text-(--pastel-butter)",
    near: "bg-(--pastel-butter-light) text-amber-800 dark:bg-amber-950/40 dark:text-(--pastel-butter)",
    coral: "bg-(--pastel-coral-light) text-rose-800 dark:bg-rose-950/40 dark:text-(--pastel-coral)",
    over: "bg-(--pastel-coral-light) text-rose-800 dark:bg-rose-950/40 dark:text-(--pastel-coral)",
};

export function StatCard({
    title,
    value,
    subtitle,
    tooltip,
    tooltipTitle,
    icon,
    iconBg,
    badge,
    footer,
    variant = "white",
    className = "",
    onClick,
    loading = false,
    tone,
}: StatCardProps) {
    const Component = onClick ? "button" : "div";
    const { isPrivacyMode } = usePrivacy();
    const mask = (node: ReactNode) => maskMoneyNode(node, isPrivacyMode);

    const effectiveIconBg = tone
        ? (TONE_ICON_BG[tone] ?? TONE_ICON_BG.default)
        : (iconBg ?? TONE_ICON_BG.default);

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
                                {mask(tooltip)}
                            </TooltipPopover>
                        )}
                    </div>
                    {icon ? (
                        <div
                            className={`p-1.5 sm:p-2 rounded-xl border-2 border-(--border-ink) shadow-cute-sm shrink-0 ${effectiveIconBg}`}
                        >
                            {icon}
                        </div>
                    ) : null}
                </div>

                <div className="mt-1.5 sm:mt-2.5 flex items-baseline justify-between gap-1 sm:gap-2 flex-wrap min-w-0">
                    <div
                        className={`min-w-0 max-w-full ${MONEY_BASE_CLASSES} ${MONEY_SIZE_CLASSES.lg} text-(--text-ink)`}
                    >
                        {loading ? <SkeletonStatValue /> : mask(value)}
                    </div>
                    {badge && !loading && (
                        <div className="shrink-0">{badge}</div>
                    )}
                </div>

                {subtitle && (
                    <div className="mt-1 text-[11px] sm:text-xs font-medium text-(--text-muted) truncate sm:line-clamp-2">
                        {loading ? <SkeletonLine /> : mask(subtitle)}
                    </div>
                )}
            </Component>

            {footer && (
                <div className="border-t-2 border-(--border-ink) bg-(--bg-cream) px-4 py-2 text-xs font-bold text-(--text-muted)">
                    {loading ? (
                        <SkeletonLine className="w-full" />
                    ) : (
                        mask(footer)
                    )}
                </div>
            )}
        </Card>
    );
}

export default StatCard;
