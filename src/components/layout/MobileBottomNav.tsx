/**
 * Mobile Bottom Navigation Bar
 * Fixed 4-tab navigation bar for mobile viewports with centered Quick Add floating action button (FAB):
 * 1. Home (Dashboard)
 * 2. Spend (Expenses & Budget)
 * +  Quick Add Expense (FAB)
 * 3. Balances (Accounts & Net Worth)
 * 4. Plan (Goals, Loans & Policies)
 */

import { LayoutDashboard, Plus, Receipt, Landmark, Compass } from "lucide-react";

export interface MobileBottomNavProps {
    activeTab?: string;
    onSelectTab?: (tab: string) => void;
    onQuickAdd?: () => void;
    className?: string;
}

export function MobileBottomNav({
    activeTab = "dashboard",
    onSelectTab,
    onQuickAdd,
    className = "",
}: MobileBottomNavProps) {
    const isSpendActive = activeTab === "spend" || activeTab === "expenses" || activeTab === "budget";
    const isPlanActive = ["plan", "goals", "loans", "recurring"].includes(activeTab);

    return (
        <nav
            aria-label="Mobile Navigation"
            className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-(--bg-card)/95 backdrop-blur-lg border-t-[1.5px] border-(--border-ink) transition-colors duration-200 pb-[env(safe-area-inset-bottom,0px)] ${className}`}
        >
            <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-2 relative">
                {/* Tab 1: Home / Dashboard */}
                <button
                    type="button"
                    onClick={() => onSelectTab?.("dashboard")}
                    aria-label="Dashboard"
                    className={`flex flex-col items-center justify-end h-full pb-1.5 transition-colors cursor-pointer ${
                        activeTab === "dashboard"
                            ? "text-(--text-ink) font-black"
                            : "text-(--text-muted) hover:text-(--text-ink)"
                    }`}
                >
                    <div
                        className={`p-1 mb-1 rounded-xl transition-all ${
                            activeTab === "dashboard"
                                ? "bg-[#dfc2ff] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)"
                                : ""
                        }`}
                    >
                        <LayoutDashboard className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <span className="text-[10px] font-bold leading-tight">Home</span>
                </button>

                {/* Tab 2: Spend & Budget */}
                <button
                    type="button"
                    onClick={() => onSelectTab?.("spend")}
                    aria-label="Spend"
                    className={`flex flex-col items-center justify-end h-full pb-1.5 transition-colors cursor-pointer ${
                        isSpendActive
                            ? "text-(--text-ink) font-black"
                            : "text-(--text-muted) hover:text-(--text-ink)"
                    }`}
                >
                    <div
                        className={`p-1 mb-1 rounded-xl transition-all ${
                            isSpendActive
                                ? "bg-[#ffe999] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)"
                                : ""
                        }`}
                    >
                        <Receipt className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <span className="text-[10px] font-bold leading-tight">Spend</span>
                </button>

                {/* Center Floating Quick Add Action (FAB) */}
                <div
                    onClick={onQuickAdd}
                    className="flex flex-col items-center justify-end h-full pb-1.5 relative cursor-pointer group"
                >
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onQuickAdd?.();
                        }}
                        aria-label="Quick Add"
                        className="absolute bottom-5.5 flex items-center justify-center w-12 h-12 rounded-2xl bg-[#dfc2ff] text-[#1a1a1a] border-2 border-(--border-ink) shadow-(--shadow-cute) group-hover:scale-105 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer focus:outline-none"
                    >
                        <Plus className="h-6 w-6 stroke-3" />
                    </button>
                    <span className="text-[10px] font-bold leading-tight text-(--text-muted) group-hover:text-(--text-ink) transition-colors">
                        Quick Add
                    </span>
                </div>

                {/* Tab 3: Balances & Net Worth */}
                <button
                    type="button"
                    onClick={() => onSelectTab?.("accounts")}
                    aria-label="Accounts"
                    className={`flex flex-col items-center justify-end h-full pb-1.5 transition-colors cursor-pointer ${
                        activeTab === "accounts"
                            ? "text-(--text-ink) font-black"
                            : "text-(--text-muted) hover:text-(--text-ink)"
                    }`}
                >
                    <div
                        className={`p-1 mb-1 rounded-xl transition-all ${
                            activeTab === "accounts"
                                ? "bg-[#fcbffa] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)"
                                : ""
                        }`}
                    >
                        <Landmark className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <span className="text-[10px] font-bold leading-tight">Balances</span>
                </button>

                {/* Tab 4: Plan (Goals, Loans, Recurring) */}
                <button
                    type="button"
                    onClick={() => onSelectTab?.("plan")}
                    aria-label="Plan"
                    className={`flex flex-col items-center justify-end h-full pb-1.5 transition-colors cursor-pointer ${
                        isPlanActive
                            ? "text-(--text-ink) font-black"
                            : "text-(--text-muted) hover:text-(--text-ink)"
                    }`}
                >
                    <div
                        className={`p-1 mb-1 rounded-xl transition-all ${
                            isPlanActive
                                ? "bg-[#bbf7d0] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)"
                                : ""
                        }`}
                    >
                        <Compass className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <span className="text-[10px] font-bold leading-tight">Plan</span>
                </button>
            </div>
        </nav>
    );
}

export default MobileBottomNav;
