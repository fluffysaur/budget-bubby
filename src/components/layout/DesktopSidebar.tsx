/**
 * Desktop Sidebar Navigation
 * Fixed-width sidebar for desktop viewports providing grouped navigation:
 * - Core Daily & Monthly tabs (Dashboard, Expenses, Budget, Accounts & Net Worth)
 * - Long-Term Plan tabs (Goals, Recurring, Bonus, Loans)
 */

import type { ComponentType } from "react";
import { LayoutDashboard, Receipt, Landmark, Compass, Heart } from "lucide-react";
import { useOptionalHousehold } from "../../context/HouseholdContext";
import { BubbyAvatarButton } from "../bubby/BubbyAvatarButton";

export interface NavItem {
    id: string;
    label: string;
    icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
    description?: string;
    section?: "core" | "plan";
}

const NAV_ITEMS: NavItem[] = [
    {
        id: "dashboard",
        label: "Home",
        icon: LayoutDashboard,
        description: "Daily spend check & quick actions",
    },
    {
        id: "spend",
        label: "Spend",
        icon: Receipt,
        description: "Expenses ledger & monthly budget caps",
    },
    {
        id: "accounts",
        label: "Accounts",
        icon: Landmark,
        description: "Month-end balances & asset trends",
    },
    {
        id: "plan",
        label: "Plan",
        icon: Compass,
        description: "Goals & recurring commitments",
    },
];

export interface DesktopSidebarProps {
    activeTab?: string;
    onSelectTab?: (tab: string) => void;
    className?: string;
}

export function DesktopSidebar({ activeTab = "dashboard", onSelectTab, className = "" }: DesktopSidebarProps) {
    const household = useOptionalHousehold();
    const members = household?.members || [];
    const subtitleText = members.length > 0 ? members.map((m) => m.display_name).join(" & ") : "Household Finance";

    const isItemActive = (itemId: string) => {
        if (itemId === "spend") {
            return activeTab === "spend" || activeTab === "expenses" || activeTab === "budget";
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
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                    isActive
                        ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm) font-extrabold"
                        : "text-(--text-muted) hover:bg-(--bg-cream) hover:text-(--text-ink)"
                }`}
            >
                <Icon
                    strokeWidth={2.5}
                    className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-(--text-ink)" : "text-(--text-muted)"
                    }`}
                />
                <div className="flex flex-col text-left truncate">
                    <span className="truncate">{item.label}</span>
                </div>
            </button>
        );
    };

    return (
        <aside
            className={`hidden md:flex flex-col w-60 lg:w-64 bg-(--bg-card) border-r-2 border-(--border-ink) shrink-0 transition-colors duration-200 ${className}`}
        >
            {/* Brand Header */}
            <div className="h-16 flex items-center px-5 border-b-2 border-(--border-ink) gap-3 bg-(--bg-cream)">
                <BubbyAvatarButton variant="sidebar" className="-mx-1" />
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 font-black text-(--text-ink) tracking-tight text-sm font-display">
                        <span>Budget Bubby</span>
                        <Heart className="h-3.5 w-3.5 text-(--pastel-pink) fill-(--pastel-pink) stroke-(--border-ink) strokeWidth={1.5}" />
                    </div>
                    <span className="text-[11px] font-semibold text-(--text-muted) truncate max-w-[140px]">
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
        </aside>
    );
}

export default DesktopSidebar;
