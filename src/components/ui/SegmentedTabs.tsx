import React, { useId } from "react";
import { m } from "motion/react";
import { springSnappy } from "../../lib/motion";

export interface TabItem<T extends string = string> {
    id: T;
    label: React.ReactNode;
    icon?: React.ReactNode;
    badge?: React.ReactNode;
}

export interface SegmentedTabsProps<T extends string = string> {
    tabs: TabItem<T>[];
    activeTab: T;
    onChange: (tabId: T) => void;
    accent?: "lilac" | "butter" | "white" | "mint";
    size?: "sm" | "md";
    className?: string;
    ariaLabel?: string;
    layoutId?: string;
}

const accentMap = {
    lilac: "bg-(--pastel-lilac) text-(--text-ink) shadow-cute-sm border-2 border-(--border-ink)",
    butter: "bg-(--pastel-butter) text-(--text-ink) shadow-cute-sm border-2 border-(--border-ink)",
    mint: "bg-(--pastel-mint) text-(--text-ink) shadow-cute-sm border-2 border-(--border-ink)",
    white: "bg-(--bg-card) text-(--text-ink) shadow-cute-sm border-2 border-(--border-ink)",
};

export function SegmentedTabs<T extends string = string>({
    tabs,
    activeTab,
    onChange,
    accent = "lilac",
    size = "md",
    className = "",
    ariaLabel = "Navigation Tabs",
    layoutId,
}: SegmentedTabsProps<T>) {
    const generatedId = useId();
    const activeLayoutId = layoutId || generatedId;

    const sizeStyles =
        size === "sm"
            ? "px-2.5 py-1 text-xs"
            : "px-3 py-1.5 text-xs sm:text-sm";

    return (
        <nav
            aria-label={ariaLabel}
            className={`flex w-full sm:w-auto overflow-x-auto no-scrollbar items-center gap-1 p-1 rounded-2xl bg-(--bg-cream) border-2 border-(--border-subtle) ${className}`}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(tab.id)}
                        className={`relative after:absolute after:-inset-2 after:content-[''] flex flex-1 sm:flex-initial justify-center items-center gap-1.5 rounded-xl font-bold whitespace-nowrap transition-press active:translate-x-0.5 active:translate-y-0.5 cursor-pointer border-2 border-transparent ${sizeStyles} ${
                            isActive
                                ? "text-(--text-ink)"
                                : "text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-card)/60"
                        }`}
                    >
                        {isActive && (
                            <m.div
                                layoutId={`segmented-indicator-${activeLayoutId}`}
                                className={`absolute inset-0 rounded-xl ${accentMap[accent]}`}
                                transition={springSnappy}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                            {tab.icon && (
                                <span className="shrink-0">{tab.icon}</span>
                            )}
                            <span>{tab.label}</span>
                            {tab.badge && (
                                <span className="shrink-0">{tab.badge}</span>
                            )}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}

export default SegmentedTabs;
