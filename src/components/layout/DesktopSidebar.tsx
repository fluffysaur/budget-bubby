/**
 * Desktop Sidebar Navigation
 * Fixed-width sidebar for desktop viewports providing grouped navigation:
 * - Core Daily & Monthly tabs (Dashboard, Expenses, Budget, Accounts & Net Worth)
 * - Long-Term Plan tabs (Plan Overview, Goals, Loans, Recurring & Policies)
 */

import type { ComponentType } from "react";
import { LayoutDashboard, PieChart, Receipt, Landmark, Compass, Wallet, Heart } from "lucide-react";

export interface NavItem {
    id: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
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
        id: "expenses",
        label: "Expenses",
        icon: Receipt,
        description: "Daily ledger & monthly spend trends",
    },
    {
        id: "budget",
        label: "Budget",
        icon: PieChart,
        description: "Spendable caps & CPF waterfall",
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
        description: "Goals, loans & recurring commitments",
    },
];

export interface DesktopSidebarProps {
    activeTab?: string;
    onSelectTab?: (tab: string) => void;
    className?: string;
}

export function DesktopSidebar({ activeTab = "dashboard", onSelectTab, className = "" }: DesktopSidebarProps) {
    const renderNavItem = (item: NavItem) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
            <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab?.(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                        ? "bg-emerald-50 text-emerald-800 shadow-xs dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                }`}
            >
                <Icon
                    className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
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
            className={`hidden md:flex flex-col w-60 lg:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 transition-colors duration-200 ${className}`}
        >
            {/* Brand Header */}
            <div className="h-16 flex items-center px-5 border-b border-slate-200 dark:border-slate-800 gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20">
                    <Wallet className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white tracking-tight text-sm">
                        <span>Budget Bubby</span>
                        <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Yi Jia &amp; Rachel</span>
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
