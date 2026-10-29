import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge, BadgeVariant } from "./Badge";

export interface CollapsibleSectionProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    badge?: React.ReactNode;
    badgeVariant?: BadgeVariant;
    summaryRight?: React.ReactNode;
    icon?: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
    className?: string;
}

export function CollapsibleSection({
    title,
    subtitle,
    badge,
    badgeVariant = "slate",
    summaryRight,
    icon,
    defaultOpen = false,
    children,
    className = "",
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

    const renderBadge = () => {
        if (!badge) return null;
        if (typeof badge === "string" || typeof badge === "number") {
            return (
                <Badge variant={badgeVariant} size="sm" className="shrink-0 font-bold">
                    {badge}
                </Badge>
            );
        }
        return <div className="shrink-0">{badge}</div>;
    };

    return (
        <div
            className={`rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute) overflow-hidden transition-all ${className}`}
        >
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-3 sm:px-5 sm:py-4 text-left hover:bg-(--bg-cream) active:bg-(--bg-canvas) transition-colors cursor-pointer group"
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {icon && (
                        <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) shadow-cute-sm">
                            {icon}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <span className="block text-sm sm:text-base font-bold text-(--text-ink) truncate font-display">
                            {title}
                        </span>
                        {subtitle && (
                            <p className="text-xs text-(--text-muted) truncate mt-0.5">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 sm:gap-2.5">
                    {renderBadge()}
                    {summaryRight && (
                        <div className="text-xs font-bold text-(--text-muted) hidden sm:block">
                            {summaryRight}
                        </div>
                    )}
                    <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border border-(--border-ink) bg-(--bg-canvas) text-(--text-muted) transition-all duration-200 group-hover:text-(--text-ink) ${
                            isOpen ? "bg-[#dfc2ff] rotate-90 text-[#1a1a1a]" : ""
                        }`}
                    >
                        <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="border-t-2 border-(--border-ink) p-4 sm:p-5 bg-(--bg-card) animate-in fade-in slide-in-from-top-1 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}

export default CollapsibleSection;
