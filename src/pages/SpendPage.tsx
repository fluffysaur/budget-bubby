/**
 * SpendPage Component
 * Consolidated navigation hub for Daily Spending & Monthly Budgets:
 * - Segmented sub-tabs: Expenses (Ledger, Filters & Trends) | Budget (Caps, Allocations & Waterfall)
 * - Embeds ExpensesPage and BudgetPage seamlessly
 * - Eliminates duplicate navigation between desktop and mobile viewports
 * - Synchronizes active sub-tab with URL (?tab=expenses | ?tab=budget)
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Receipt, PieChart } from "lucide-react";
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

export function SpendPage({ initialTab = "expenses", className = "" }: SpendPageProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab") as SpendSubTab | null;
    const validTab = tabParam === "expenses" || tabParam === "budget" ? tabParam : null;

    const [activeTab, setActiveTab] = useState<SpendSubTab>(validTab || initialTab);

    useEffect(() => {
        if (validTab && validTab !== activeTab) {
            setActiveTab(validTab);
        } else if (!validTab && initialTab && initialTab !== activeTab) {
            setActiveTab(initialTab);
        }
    }, [validTab, initialTab, activeTab]);

    const handleTabChange = useCallback(
        (tabId: string) => {
            const nextTab = tabId as SpendSubTab;
            setActiveTab(nextTab);
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

            {/* Embedded Sub-Tab Content */}
            <div className="pt-1">
                {activeTab === "expenses" && <ExpensesPage embedded={true} />}
                {activeTab === "budget" && <BudgetPage embedded={true} />}
            </div>
        </div>
    );
}

export default SpendPage;
