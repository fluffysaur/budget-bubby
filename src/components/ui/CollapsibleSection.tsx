import React, { useState } from "react";
import { ChevronRight } from "lucide-react";

export interface CollapsibleSectionProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    badge?: React.ReactNode;
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
    summaryRight,
    icon,
    defaultOpen = false,
    children,
    className = "",
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

    return (
        <div
            className={`rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute) overflow-hidden transition-all ${className}`}
        >
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-(--bg-cream) transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className={`flex h-6 w-6 items-center justify-center rounded-lg border border-(--border-ink) transition-transform duration-200 ${
                            isOpen ? "bg-[#dfc2ff] rotate-90 text-[#1a1a1a]" : "bg-(--bg-cream) text-(--text-muted)"
                        }`}
                    >
                        <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
                    </div>
                    {icon && <div className="shrink-0">{icon}</div>}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-(--text-ink) truncate font-display">
                                {title}
                            </span>
                            {badge && <div className="shrink-0">{badge}</div>}
                        </div>
                        {subtitle && (
                            <p className="text-xs text-(--text-muted) truncate mt-0.5">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {summaryRight && (
                    <div className="shrink-0 flex items-center gap-2">
                        {summaryRight}
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="border-t-[1.5px] border-(--border-ink) p-4 sm:p-5 bg-(--bg-card) animate-in fade-in slide-in-from-top-1 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}

export default CollapsibleSection;
