import React from "react";

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
    accent?: "lilac" | "butter" | "white";
    size?: "sm" | "md";
    className?: string;
    ariaLabel?: string;
}

const accentMap = {
    lilac: "bg-[#dfc2ff] text-[#1a1a1a] shadow-(--shadow-cute-sm) border-[1.5px] border-(--border-ink)",
    butter: "bg-[#ffe999] text-[#1a1a1a] shadow-(--shadow-cute-sm) border-[1.5px] border-(--border-ink)",
    white: "bg-(--bg-card) text-(--text-ink) shadow-(--shadow-cute-sm) border-[1.5px] border-(--border-ink)",
};

export function SegmentedTabs<T extends string = string>({
    tabs,
    activeTab,
    onChange,
    accent = "lilac",
    size = "md",
    className = "",
    ariaLabel = "Navigation Tabs",
}: SegmentedTabsProps<T>) {
    const sizeStyles = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-xs sm:text-sm";

    return (
        <nav
            aria-label={ariaLabel}
            className={`inline-flex items-center gap-1 p-1 rounded-2xl bg-(--bg-cream) border-[1.5px] border-(--border-subtle) ${className}`}
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
                        className={`flex items-center gap-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${sizeStyles} ${
                            isActive
                                ? accentMap[accent]
                                : "text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-card)/60"
                        }`}
                    >
                        {tab.icon && <span className="shrink-0">{tab.icon}</span>}
                        <span>{tab.label}</span>
                        {tab.badge && <span className="shrink-0">{tab.badge}</span>}
                    </button>
                );
            })}
        </nav>
    );
}

export default SegmentedTabs;
