/**
 * PlanPage Component
 * Consolidated 5th navigation hub for Long-Term Financial Planning:
 * - Segmented sub-tabs: Goals | Recurring | Bonus | Loans
 * - Embeds GoalsPage, RecurringPage, the Bonus calculator, and a Loans placeholder
 * - Eliminates scattered sidebar links while preserving route compatibility
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Target,
  CreditCard,
  CalendarClock,
  Sparkles,
} from "lucide-react";
import { PageHeader, SegmentedTabs } from "../components/ui";
import { GoalsPage } from "./GoalsPage";
import { RecurringPage } from "./RecurringPage";
import { BonusAllocationCollapsible } from "../components/budget/BonusAllocationCollapsible";
import { LoansPlaceholder } from "../components/loans/LoansPlaceholder";

export type PlanSubTab = "goals" | "loans" | "recurring" | "bonus";

export interface PlanPageProps {
  initialTab?: PlanSubTab;
  onNavigateTab?: (tab: string) => void;
  className?: string;
}

const SUB_TABS: { id: PlanSubTab; label: string; icon: typeof Target }[] = [
  { id: "goals", label: "Goals", icon: Target },
  { id: "recurring", label: "Recurring", icon: CalendarClock },
  { id: "bonus", label: "Bonus", icon: Sparkles },
  { id: "loans", label: "Loans", icon: CreditCard },
];

export function PlanPage({ initialTab = "goals", className = "" }: PlanPageProps) {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as PlanSubTab | null;
  const goalIdParam = searchParams.get("goalId");
  const validTab = tabParam && SUB_TABS.some((t) => t.id === tabParam) ? tabParam : null;

  const [activeTab, setActiveTab] = useState<PlanSubTab>(
    goalIdParam ? "goals" : validTab || initialTab
  );

  useEffect(() => {
    if (goalIdParam) {
      setActiveTab("goals");
    } else if (validTab) {
      setActiveTab(validTab);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [goalIdParam, validTab, initialTab]);

  return (
    <div className={`space-y-5 pb-20 md:pb-12 ${className}`}>
      {/* Page Header */}
      <PageHeader title="Plan" />

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
        onChange={(id) => setActiveTab(id as PlanSubTab)}
      />

      {/* Embedded Sub-Tab Content */}
      <div className="pt-1">
        {activeTab === 'goals' && <GoalsPage embedded={true} />}
        {activeTab === 'recurring' && <RecurringPage embedded={true} />}
        {activeTab === 'bonus' && (
          <div className="space-y-4">
            <BonusAllocationCollapsible defaultOpen={true} />
          </div>
        )}
        {activeTab === 'loans' && <LoansPlaceholder />}
      </div>
    </div>
  );
}

export default PlanPage;
