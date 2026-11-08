/**
 * Desktop Sidebar Navigation
 * Fixed-width sidebar for desktop viewports providing grouped navigation:
 * - Core Daily & Monthly tabs (Dashboard, Expenses, Budget, Accounts & Net Worth)
 * - Long-Term Plan tabs (Goals, Recurring, Bonus, Loans)
 */

import { useState, useCallback, type ComponentType } from "react";
import {
    LayoutDashboard,
    Receipt,
    Landmark,
    Compass,
    Heart,
    Settings,
    Sun,
    Moon,
    RotateCw,
    LogOut,
} from "lucide-react";
import { useOptionalHousehold } from "../../context/HouseholdContext";
import { useAuth } from "../../context/AuthContext";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import { PWAInstallButton } from "../pwa/PWAInstallButton";
import { SignOutConfirm } from "../auth/SignOutConfirm";
import { BubbyIcon } from "../ui/BubbyIcon";
import { Badge } from "../ui/Badge";
import { formatBadgeCount } from "../../hooks/useInboxBadge";

export interface NavItem {
    id: string;
    label: string;
    icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
    section?: "core" | "plan";
}

const NAV_ITEMS: NavItem[] = [
    {
        id: "dashboard",
        label: "Home",
        icon: LayoutDashboard,
    },
    {
        id: "spend",
        label: "Spend",
        icon: Receipt,
    },
    {
        id: "accounts",
        label: "Accounts",
        icon: Landmark,
    },
    {
        id: "plan",
        label: "Plan",
        icon: Compass,
    },
];

export interface DesktopSidebarProps {
    activeTab?: string;
    onSelectTab?: (tab: string) => void;
    /** Inbox items to sort, shown on the Spend item. */
    spendBadgeCount?: number;
    className?: string;
}

export function DesktopSidebar({
    activeTab = "dashboard",
    onSelectTab,
    spendBadgeCount = 0,
    className = "",
}: DesktopSidebarProps) {
    const household = useOptionalHousehold();
    const members = household?.members || [];
    const subtitleText =
        members.length > 0
            ? members.map((m) => m.display_name).join(" & ")
            : "Household Finance";

    const { isAuthenticated } = useAuth();
    const { canInstall, isInstalled } = usePWAInstall();
    const theme = household?.theme ?? "light";
    const toggleTheme = household?.toggleTheme ?? (() => {});
    const refreshData = household?.refreshData;
    const isMockMode = household?.isMockMode ?? false;

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

    const handleManualRefresh = useCallback(async () => {
        if (isRefreshing || !refreshData) return;
        setIsRefreshing(true);
        const startTime = Date.now();
        try {
            await refreshData();
        } finally {
            // Ensure animation spins for at least 500ms for tactile feedback
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 500 - elapsed);
            setTimeout(() => {
                setIsRefreshing(false);
            }, remaining);
        }
    }, [refreshData, isRefreshing]);

    const handleOpenSettings = () => {
        window.dispatchEvent(new Event("openSettings"));
    };

    const isItemActive = (itemId: string) => {
        if (itemId === "spend") {
            return (
                activeTab === "spend" ||
                activeTab === "expenses" ||
                activeTab === "budget"
            );
        }
        if (itemId === "plan") {
            return ["plan", "goals", "loans", "recurring"].includes(activeTab);
        }
        return activeTab === itemId;
    };

    const renderNavItem = (item: NavItem) => {
        const Icon = item.icon;
        const isActive = isItemActive(item.id);
        return (
            <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab?.(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-press cursor-pointer ${
                    isActive
                        ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-extrabold"
                        : "text-(--text-muted) hover:bg-(--bg-cream) hover:text-(--text-ink)"
                }`}
            >
                <Icon
                    strokeWidth={2.5}
                    className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-(--text-ink)" : "text-(--text-muted)"
                    }`}
                />
                <div className="flex min-w-0 flex-1 flex-col text-left truncate">
                    <span className="truncate">{item.label}</span>
                </div>
                {item.id === "spend" && spendBadgeCount > 0 && (
                    <Badge variant="coral" size="sm" className="shrink-0">
                        <span aria-label={`${spendBadgeCount} to sort`}>
                            {formatBadgeCount(spendBadgeCount)}
                        </span>
                    </Badge>
                )}
            </button>
        );
    };

    return (
        <aside
            className={`hidden md:flex flex-col w-60 lg:w-64 bg-(--bg-card) border-r-2 border-(--border-ink) shrink-0 transition-colors duration-200 ${className}`}
        >
            {/* Brand Header */}
            <div className="h-16 flex items-center px-5 border-b-2 border-(--border-ink) gap-3 bg-(--bg-cream)">
                <div className="flex h-9 w-9 items-end justify-center rounded-xl bg-(--accent-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm overflow-hidden shrink-0 pt-0.5">
                    <BubbyIcon className="h-8 w-8" />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 font-black text-(--text-ink) tracking-tight text-sm font-display">
                        <span>Budget Bubby</span>
                        <Heart className="h-3.5 w-3.5 text-(--pastel-pink) fill-(--pastel-pink) stroke-(--border-ink) strokeWidth={1.5}" />
                    </div>
                    <span className="text-xs font-semibold text-(--text-muted) truncate max-w-35">
                        {subtitleText}
                    </span>
                </div>
            </div>

            {/* Navigation Links */}
            <nav
                className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5"
                aria-label="Sidebar"
            >
                {NAV_ITEMS.map(renderNavItem)}
            </nav>

            {/* Desktop Utilities Footer */}
            <div className="border-t-2 border-(--border-ink) bg-(--bg-card) p-3 space-y-2">
                {canInstall && !isInstalled && (
                    <PWAInstallButton className="w-full justify-center" />
                )}

                <div className="flex items-center justify-between gap-1">
                    {/* Settings */}
                    <button
                        type="button"
                        onClick={handleOpenSettings}
                        aria-label="Settings"
                        title="Settings"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm transition-press hover:bg-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                    >
                        <Settings
                            className="h-4 w-4 text-(--text-ink)"
                            strokeWidth={2.5}
                        />
                    </button>

                    {/* Theme Toggle */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={`Toggle theme (currently ${theme})`}
                        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm transition-press hover:bg-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                    >
                        {theme === "dark" ? (
                            <Sun
                                className="h-4 w-4 text-(--pastel-butter)"
                                strokeWidth={2.5}
                            />
                        ) : (
                            <Moon
                                className="h-4 w-4 text-(--text-ink)"
                                strokeWidth={2.5}
                            />
                        )}
                    </button>

                    {/* Refresh */}
                    <button
                        type="button"
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        aria-label="Refresh"
                        title="Refresh data from database"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm transition-press hover:bg-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer disabled:opacity-50"
                    >
                        <RotateCw
                            className={`h-4 w-4 ${isRefreshing ? "animate-spin text-purple-700 dark:text-(--pastel-lilac)" : ""}`}
                            strokeWidth={2.5}
                        />
                    </button>

                    {/* Sign Out / Lock */}
                    {(!isMockMode || isAuthenticated) && (
                        <button
                            type="button"
                            onClick={() => setIsLogoutConfirmOpen(true)}
                            aria-label="Lock Budget Bubby"
                            title="Lock / Sign Out"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--bg-card) text-(--text-muted) shadow-cute-sm transition-press hover:bg-(--pastel-coral-light) hover:text-rose-800 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                        >
                            <LogOut className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            </div>

            <SignOutConfirm
                isOpen={isLogoutConfirmOpen}
                onClose={() => setIsLogoutConfirmOpen(false)}
            />
        </aside>
    );
}

export default DesktopSidebar;
