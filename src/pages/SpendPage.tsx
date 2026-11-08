/**
 * SpendPage Component
 * Consolidated navigation hub for Daily Spending & Monthly Budgets:
 * - Segmented sub-tabs: Expenses (Ledger, Filters & Trends) | Budget (Caps, Allocations & Waterfall)
 * - Embeds ExpensesPage and BudgetPage seamlessly
 * - Eliminates duplicate navigation between desktop and mobile viewports
 * - Synchronizes active sub-tab with URL (?tab=expenses | ?tab=budget)
 */

import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Receipt, PieChart } from "lucide-react";
import { m } from "motion/react";
import { fadeRise } from "../lib/motion";
import { PageHeader, SegmentedTabs } from "../components/ui";
import { ExpensesPage } from "./ExpensesPage";
import { BudgetPage } from "./BudgetPage";

export type SpendSubTab = "expenses" | "budget";

export interface SpendPageProps {
    initialTab?: SpendSubTab;
    onNavigateTab?: (tab: string) => void;
    className?: string;
}

const SUB_TABS: { id: SpendSubTab; label: string; icon: typeof Receipt }[] = [
    { id: "expenses", label: "Expenses", icon: Receipt },
    { id: "budget", label: "Budget", icon: PieChart },
];

export function SpendPage({
    initialTab = "expenses",
    onNavigateTab,
    className = "",
}: SpendPageProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab") as SpendSubTab | null;
    const validTab =
        tabParam === "expenses" || tabParam === "budget" ? tabParam : null;

    // Derived directly from URL searchParams to eliminate state-sync ping-pong
    const activeTab: SpendSubTab = validTab ?? initialTab;

    const handleTabChange = useCallback(
        (tabId: string) => {
            const nextTab = tabId as SpendSubTab;
            setSearchParams({ tab: nextTab }, { replace: true });
        },
        [setSearchParams],
    );

    return (
        <div className={`space-y-5 pb-20 md:pb-12 ${className}`}>
            {/* Page Header */}
            <PageHeader title="Spend" />

            {/* Segmented Sub-Tab Bar */}
            <SegmentedTabs
                tabs={SUB_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return {
                        id: tab.id,
                        label: tab.label,
                        icon: <Icon className="h-4 w-4" />,
                    };
                })}
                activeTab={activeTab}
                accent="butter"
                onChange={handleTabChange}
            />

            {/* Embedded Sub-Tab Content with fadeRise animation */}
            <m.div key={activeTab} {...fadeRise} className="pt-1">
                {activeTab === "expenses" && <ExpensesPage embedded={true} />}
                {activeTab === "budget" && (
                    <BudgetPage embedded={true} onNavigateTab={onNavigateTab} />
                )}
            </m.div>
        </div>
    );
}

export default SpendPage;
