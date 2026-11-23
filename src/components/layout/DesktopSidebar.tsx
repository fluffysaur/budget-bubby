/**
 * Desktop Sidebar Navigation
 * Collapsible sidebar for desktop viewports providing grouped navigation:
 * - Core tabs (Home, Spend, Accounts, Plan)
 * - Expanded (`w-60 lg:w-64`) or collapsed to an icon-only rail with tooltips
 */

import {
    useState,
    useCallback,
    type ComponentType,
    type ReactNode,
} from "react";
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
    Eye,
    EyeOff,
} from "lucide-react";
import { m } from "motion/react";
import { useOptionalHousehold } from "../../context/HouseholdContext";
import { useAuth } from "../../context/AuthContext";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { PWAInstallButton } from "../pwa/PWAInstallButton";
import { SignOutConfirm } from "../auth/SignOutConfirm";
import { BubbyIcon } from "../ui/BubbyIcon";
import { useSettings } from "../../context/SettingsContext";
import { usePrivacy } from "../../context/PrivacyContext";
import { Badge } from "../ui/Badge";
import { TooltipPopover } from "../ui/TooltipPopover";
import { formatBadgeCount } from "../../hooks/useInboxBadge";
import { feedback } from "../../lib/delight/feedback";
import {
    DURATION,
    EASE_OUT_SOFT,
    prefersReducedMotion,
} from "../../lib/motion";

/** Rail width (px) when collapsed; expanded matches `w-60 lg:w-64`. */
const RAIL_WIDTH = 72;
const EXPANDED_WIDTH = 240;
const EXPANDED_WIDTH_LG = 256;

const UTILITY_BTN =
    "flex items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm transition-press hover:bg-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer";

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

type TipProps = Record<string, unknown>;

/** Label bubble shown to the right of a rail control while collapsed. */
function RailTip({
    label,
    collapsed,
    className = "",
    children,
}: {
    label: string;
    collapsed: boolean;
    className?: string;
    children: (props: TipProps) => ReactNode;
}) {
    if (!collapsed) return <>{children({})}</>;
    return (
        <TooltipPopover
            compact
            placement="right"
            label={label}
            triggerOnClick={false}
            className={className}
            renderTrigger={(props) => children(props)}
        >
            {label}
        </TooltipPopover>
    );
}

export interface DesktopSidebarProps {
    activeTab?: string;
    onSelectTab?: (tab: string) => void;
    /** Inbox items to sort, shown on the Spend item. */
    spendBadgeCount?: number;
    /** Icon-only rail when true. */
    collapsed?: boolean;
    className?: string;
}

export function DesktopSidebar({
    activeTab = "dashboard",
    onSelectTab,
    spendBadgeCount = 0,
    collapsed = false,
    className = "",
}: DesktopSidebarProps) {
    const household = useOptionalHousehold();
    const isLg = useMediaQuery("(min-width: 1024px)");
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

    const { openSettings: handleOpenSettings } = useSettings();
    const { isPrivacyMode, togglePrivacy } = usePrivacy();

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
        const showBadge = item.id === "spend" && spendBadgeCount > 0;
        return (
            <RailTip
                key={item.id}
                label={item.label}
                collapsed={collapsed}
                className="w-full justify-center"
            >
                {(tipProps) => (
                    <button
                        {...tipProps}
                        type="button"
                        aria-label={
                            collapsed
                                ? showBadge
                                    ? `${item.label}, ${spendBadgeCount} to sort`
                                    : item.label
                                : undefined
                        }
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => {
                            if (!isActive) {
                                feedback.routine("tab");
                            }
                            onSelectTab?.(item.id);
                        }}
                        className={`relative flex items-center rounded-xl text-sm font-bold transition-press cursor-pointer ${
                            collapsed
                                ? "h-11 w-11 justify-center"
                                : "w-full gap-3 px-3.5 py-2.5"
                        } ${
                            isActive
                                ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-extrabold"
                                : "text-(--text-muted) hover:bg-(--bg-cream) hover:text-(--text-ink)"
                        }`}
                    >
                        <Icon
                            strokeWidth={2.5}
                            className={`h-4 w-4 shrink-0 ${
                                isActive
                                    ? "text-(--text-ink)"
                                    : "text-(--text-muted)"
                            }`}
                        />
                        {!collapsed && (
                            <div className="flex min-w-0 flex-1 flex-col text-left truncate">
                                <span className="truncate">{item.label}</span>
                            </div>
                        )}
                        {showBadge && (
                            <Badge
                                variant="coral"
                                size="sm"
                                className={
                                    collapsed
                                        ? "absolute top-0 -right-2 min-w-4 px-1 text-[10px] leading-none"
                                        : "shrink-0"
                                }
                            >
                                <span aria-label={`${spendBadgeCount} to sort`}>
                                    {formatBadgeCount(spendBadgeCount)}
                                </span>
                            </Badge>
                        )}
                    </button>
                )}
            </RailTip>
        );
    };

    const expandedWidth = isLg ? EXPANDED_WIDTH_LG : EXPANDED_WIDTH;
    const btnSize = collapsed ? "h-11 w-11" : "h-9 w-9";
    const privacyLabel = isPrivacyMode ? "Show amounts" : "Hide amounts";
    const themeTitle = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;

    return (
        <m.aside
            initial={false}
            animate={{ width: collapsed ? RAIL_WIDTH : expandedWidth }}
            transition={{
                duration: prefersReducedMotion() ? 0 : DURATION.base,
                ease: EASE_OUT_SOFT,
            }}
            id="desktop-sidebar"
            data-collapsed={collapsed}
            className={`hidden md:flex flex-col bg-(--bg-card) border-r-2 border-(--border-ink) shrink-0 overflow-x-hidden transition-colors duration-200 ${className}`}
        >
            {/* Brand Header */}
            <div
                className={`h-16 shrink-0 flex items-center border-b-2 border-(--border-ink) bg-(--bg-cream) ${
                    collapsed ? "justify-center px-0" : "px-5 gap-3"
                }`}
            >
                <div className="flex h-9 w-9 items-end justify-center rounded-xl bg-(--accent-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm overflow-hidden shrink-0 pt-0.5">
                    <BubbyIcon className="h-8 w-8" />
                </div>
                {!collapsed && (
                    <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-1.5 font-black text-(--text-ink) tracking-tight text-sm font-display whitespace-nowrap">
                            <span>Budget Bubby</span>
                            <Heart className="h-3.5 w-3.5 text-(--pastel-pink) fill-(--pastel-pink) stroke-(--border-ink)" />
                        </div>
                        <span className="text-xs font-semibold text-(--text-muted) truncate max-w-35">
                            {subtitleText}
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation Links */}
            <nav
                className={`flex-1 overflow-y-auto py-4 space-y-1.5 ${
                    collapsed ? "flex flex-col items-center px-0" : "px-3"
                }`}
                aria-label="Sidebar"
            >
                {NAV_ITEMS.map(renderNavItem)}
            </nav>

            {/* Desktop Utilities Footer */}
            <div
                className={`shrink-0 border-t-2 border-(--border-ink) bg-(--bg-card) p-3 ${
                    collapsed ? "flex flex-col items-center gap-2" : "space-y-2"
                }`}
            >
                {canInstall && !isInstalled && (
                    <PWAInstallButton
                        collapsed={collapsed}
                        className={collapsed ? "" : "w-full justify-center"}
                    />
                )}

                <div
                    className={
                        collapsed
                            ? "flex flex-col items-center gap-2"
                            : "flex items-center justify-between gap-1"
                    }
                >
                    {/* Settings */}
                    <RailTip label="Settings" collapsed={collapsed}>
                        {(tipProps) => (
                            <button
                                {...tipProps}
                                type="button"
                                onClick={handleOpenSettings}
                                aria-label="Settings"
                                title={collapsed ? undefined : "Settings"}
                                className={`${UTILITY_BTN} ${btnSize}`}
                            >
                                <Settings
                                    className="h-4 w-4 text-(--text-ink)"
                                    strokeWidth={2.5}
                                />
                            </button>
                        )}
                    </RailTip>

                    {/* Privacy Toggle */}
                    <RailTip label={privacyLabel} collapsed={collapsed}>
                        {(tipProps) => (
                            <button
                                {...tipProps}
                                type="button"
                                onClick={togglePrivacy}
                                aria-label={privacyLabel}
                                aria-pressed={isPrivacyMode}
                                title={
                                    collapsed
                                        ? undefined
                                        : `${isPrivacyMode ? "Show" : "Hide"} amounts (H)`
                                }
                                className={`${UTILITY_BTN} ${btnSize}`}
                            >
                                {isPrivacyMode ? (
                                    <EyeOff
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                ) : (
                                    <Eye
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                )}
                            </button>
                        )}
                    </RailTip>

                    {/* Theme Toggle */}
                    <RailTip label={themeTitle} collapsed={collapsed}>
                        {(tipProps) => (
                            <button
                                {...tipProps}
                                type="button"
                                onClick={toggleTheme}
                                aria-label={`Toggle theme (currently ${theme})`}
                                title={collapsed ? undefined : themeTitle}
                                className={`${UTILITY_BTN} ${btnSize}`}
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
                        )}
                    </RailTip>

                    {/* Refresh */}
                    <RailTip label="Refresh data" collapsed={collapsed}>
                        {(tipProps) => (
                            <button
                                {...tipProps}
                                type="button"
                                onClick={handleManualRefresh}
                                disabled={isRefreshing}
                                aria-label="Refresh"
                                title={
                                    collapsed
                                        ? undefined
                                        : "Refresh data from database"
                                }
                                className={`${UTILITY_BTN} ${btnSize} disabled:opacity-50`}
                            >
                                <RotateCw
                                    className={`h-4 w-4 ${isRefreshing ? "animate-spin text-purple-700 dark:text-(--pastel-lilac)" : ""}`}
                                    strokeWidth={2.5}
                                />
                            </button>
                        )}
                    </RailTip>

                    {/* Sign Out / Lock */}
                    {(!isMockMode || isAuthenticated) && (
                        <RailTip label="Lock / Sign Out" collapsed={collapsed}>
                            {(tipProps) => (
                                <button
                                    {...tipProps}
                                    type="button"
                                    onClick={() => setIsLogoutConfirmOpen(true)}
                                    aria-label="Lock Budget Bubby"
                                    title={
                                        collapsed
                                            ? undefined
                                            : "Lock / Sign Out"
                                    }
                                    className={`${UTILITY_BTN} ${btnSize} text-(--text-muted) hover:bg-(--pastel-coral-light) hover:text-rose-800`}
                                >
                                    <LogOut
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                </button>
                            )}
                        </RailTip>
                    )}
                </div>
            </div>

            <SignOutConfirm
                isOpen={isLogoutConfirmOpen}
                onClose={() => setIsLogoutConfirmOpen(false)}
            />
        </m.aside>
    );
}

export default DesktopSidebar;
