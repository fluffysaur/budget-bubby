/**
 * BudgetPage Component
 * Integrated Monthly Budget Tracking & Base Profile Management
 * Coordinates:
 * - Selected month navigation ('YYYY-MM')
 * - Active perspective (Combined Household vs Yi Jia vs Rachel)
 * - High-level financial metric cards
 * - Spendable Category spending meters (Food, Lifestyle, Transport, Buffer) with Lifestyle subscription tooltip
 * - Collapsible Wealth & Fixed Allocations (Investments, Savings, Tithing)
 * - Visual Budget Waterfall breakdown
 * - Notion-style Bonus Allocation helper (AWS/Performance bonus calculator)
 * - Base profile editor modal
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  DollarSign,
  TrendingDown,
  Wallet,
  Receipt,
  PiggyBank,
  Tag,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Button, StatCard, LoadingCard } from '../components/ui';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
import {
  useCategoriesQuery,
  useBaseProfilesQuery,
  useBaseAllocationsQuery,
  usePoliciesQuery,
} from '../hooks/useFinanceQueries';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { getCurrentMonth } from '../lib/dateUtils';
import { isValidUuid } from '../lib/uuid';
import { isSpendableCategory } from '../lib/financialFormulas';
import { mockBaseProfiles, mockBaseAllocations, mockCategories } from '../data/mockSeedData';
import { MonthPicker } from '../components/budget/MonthPicker';
import { BudgetWaterfall } from '../components/budget/BudgetWaterfall';
import { CategoryProgressList } from '../components/budget/CategoryProgressList';
import { BaseProfileEditorModal } from '../components/budget/BaseProfileEditorModal';
import { BonusAllocationCollapsible } from '../components/budget/BonusAllocationCollapsible';
import { CategoryLimitWarningBanner } from '../components/budget/CategoryLimitWarningBanner';
import { CumulativeSurplusCard } from '../components/budget/CumulativeSurplusCard';
import type {
  BaseBudgetProfile,
  MonthlyBudget,
  MonthlyBudgetCategoryDetail,
  MonthlyBudgetDetail,
} from '../types/finance';

export interface BudgetPageProps {
  className?: string;
  embedded?: boolean;
  onNavigateTab?: (tab: string) => void;
}

export function BudgetPage({ className = '', embedded = false, onNavigateTab }: BudgetPageProps) {
  const { perspective, activeMember, members, overview, isMockMode, refreshData: refreshHousehold } = useHousehold();

  // State
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());

  // Cached Metadata Queries
  const { data: categoriesData } = useCategoriesQuery();
  const { data: baseProfilesData } = useBaseProfilesQuery();
  const { data: baseAllocationsData } = useBaseAllocationsQuery();
  const { data: policiesData } = usePoliciesQuery();

  const categories = useMemo(() => {
    if (categoriesData && categoriesData.length > 0) return categoriesData;
    return isMockMode ? mockCategories : [];
  }, [categoriesData, isMockMode]);

  const baseProfiles = useMemo(() => {
    if (baseProfilesData && baseProfilesData.length > 0) return baseProfilesData;
    return isMockMode ? mockBaseProfiles : [];
  }, [baseProfilesData, isMockMode]);

  const baseAllocations = useMemo(() => {
    if (baseAllocationsData && baseAllocationsData.length > 0) return baseAllocationsData;
    return isMockMode ? mockBaseAllocations : [];
  }, [baseAllocationsData, isMockMode]);

  // Modal State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingProfileMemberId, setEditingProfileMemberId] = useState<string | null>(null);

  // Determine perspective display name
  const perspectiveDisplayName = useMemo(() => {
    if (perspective === 'household') return 'Combined Household';
    if (activeMember) return activeMember.display_name;
    const clean = perspective.toLowerCase();
    if (clean.includes('yijia')) return 'Yi Jia';
    if (clean.includes('rachel')) return 'Rachel';
    return perspective;
  }, [perspective, activeMember]);

  // Cached Monthly Budget Detail Query (Calculates combined or single-member dynamically)
  const { data: budgetDetailData, isLoading: budgetLoading } = useQuery<MonthlyBudgetDetail | null>({
    queryKey: ['finance', 'budget-detail', selectedMonth, perspective, activeMember?.id],
    queryFn: async () => {
      if (perspective === 'household' && members.length > 0) {
        // Combined household view: fetch budgets for all members and combine dynamically
        const memberBudgets = await Promise.all(
          members.map((m) => financeService.getMonthlyBudget(selectedMonth, m.id))
        );

        if (memberBudgets.length > 0) {
          const combinedGross = memberBudgets.reduce((s, b) => s + (b.budget.gross_salary || 0), 0);
          const combinedBonus = memberBudgets.reduce((s, b) => s + (b.budget.bonus || 0), 0);
          const combinedCpf = memberBudgets.reduce((s, b) => s + (b.budget.cpf_deduction || 0), 0);
          const combinedTaxes = memberBudgets.reduce((s, b) => s + (b.budget.taxes_deduction || 0), 0);
          const combinedInsurance = memberBudgets.reduce((s, b) => s + (b.budget.insurance_deduction || 0), 0);
          const combinedAfter = memberBudgets.reduce((s, b) => s + (b.budget.after_deductions || 0), 0);

          const combinedBudget: MonthlyBudget = {
            id: `mb-combined-${selectedMonth}`,
            household_id: memberBudgets[0].budget.household_id,
            owner_id: 'household',
            month: selectedMonth,
            gross_salary: combinedGross,
            bonus: combinedBonus,
            cpf_deduction: combinedCpf,
            taxes_deduction: Math.round(combinedTaxes * 100) / 100,
            insurance_deduction: Math.round(combinedInsurance * 100) / 100,
            after_deductions: Math.round(combinedAfter * 100) / 100,
            notes: 'Combined household monthly budget',
            is_locked: memberBudgets.every((b) => b.budget.is_locked),
          };

          // Merge categories across all members
          const categoryMap = new Map<string, MonthlyBudgetCategoryDetail>();

          const mergeCats = (catList: MonthlyBudgetCategoryDetail[]) => {
            for (const item of catList) {
              const existing = categoryMap.get(item.category_id);
              if (existing) {
                const allocated = Math.round((existing.allocated_amount + item.allocated_amount) * 100) / 100;
                const spent = Math.round(((existing.actualSpent || 0) + (item.actualSpent || 0)) * 100) / 100;
                const remaining = Math.round((allocated - spent) * 100) / 100;
                const pct = combinedAfter > 0 ? allocated / combinedAfter : 0;
                const subSpent = (existing.subscriptionSpent || 0) + (item.subscriptionSpent || 0);
                const subItems = [...(existing.subscriptionItems || []), ...(item.subscriptionItems || [])];

                categoryMap.set(item.category_id, {
                  ...existing,
                  allocated_amount: allocated,
                  actualSpent: spent,
                  remaining,
                  percentage: pct,
                  subscriptionSpent: subSpent,
                  subscriptionItems: subItems,
                });
              } else {
                const pct = combinedAfter > 0 ? item.allocated_amount / combinedAfter : item.percentage;
                categoryMap.set(item.category_id, {
                  ...item,
                  percentage: pct,
                });
              }
            }
          };

          for (const mb of memberBudgets) {
            mergeCats(mb.categories);
          }

          const combinedCategories = Array.from(categoryMap.values());
          const totalSpent = Math.round(
            combinedCategories.reduce((sum, c) => sum + (c.actualSpent || 0), 0) * 100
          ) / 100;
          const totalRemaining = Math.round((combinedAfter - totalSpent) * 100) / 100;

          return {
            budget: combinedBudget,
            categories: combinedCategories,
            disposablePool: combinedAfter,
            totalSpent,
            totalRemaining,
          };
        }
      }

      // Single member perspective
      const targetMemberId = activeMember ? activeMember.id : members[0]?.id;
      return financeService.getMonthlyBudget(selectedMonth, targetMemberId);
    },
  });

  const budgetDetail = budgetDetailData ?? null;
  const isLoading = budgetLoading && !budgetDetailData;

  // Handle opening editor
  const handleOpenEditor = (memberId?: string) => {
    const targetId = memberId || (activeMember ? activeMember.id : members[0]?.id);
    setEditingProfileMemberId(targetId);
    setIsEditorOpen(true);
  };

  // Find profile to edit
  const activeProfile = useMemo((): BaseBudgetProfile => {
    const targetMember = (editingProfileMemberId
      ? members.find((m) => m.id === editingProfileMemberId)
      : activeMember) || members[0];
    const targetId = targetMember?.id || '';
    const targetHouseholdId = targetMember?.household_id || overview?.household?.id || '';

    const found = baseProfiles.find((p) => p.owner_id === targetId);
    if (found) return found;

    if (isMockMode) {
      const mockFound = mockBaseProfiles.find((p) => p.owner_id === targetId) || mockBaseProfiles[0];
      if (mockFound) return mockFound;
    }

    // Default clean profile for this real member and household (no mock IDs in live mode)
    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '',
      household_id: targetHouseholdId,
      owner_id: targetId,
      gross_salary: 5000,
      cpf_employee_rate: 0.20,
      tithing_enabled: true,
      updated_at: new Date().toISOString(),
    };
  }, [baseProfiles, editingProfileMemberId, activeMember, members, overview, isMockMode]);

  const activeAllocations = useMemo(() => {
    if (!activeProfile?.id) return [];
    const existing = baseAllocations.filter((a) => a.profile_id === activeProfile.id);
    if (existing.length > 0) return existing;

    // If new profile with no allocations yet, provide standard default percentage split
    const defaultPcts: Record<string, number> = {
      food: 0.15,
      lifestyle: 0.15,
      transport: 0.05,
      investments: 0.35,
      savings: 0.15,
      tithing: 0.10,
      buffer: 0.05,
    };

    return categories.map((cat) => {
      const key = cat.name.toLowerCase();
      const pct = defaultPcts[key] ?? 0;
      return {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `alloc-${cat.id}`,
        profile_id: activeProfile.id,
        category_id: cat.id,
        target_percentage: pct,
      };
    });
  }, [baseAllocations, activeProfile, categories]);

  const handleProfileSaved = async () => {
    await refreshHousehold();
  };

  const handleCategoriesChanged = async () => {
    await refreshHousehold();
  };

  // Split categories into Spendable (Food, Lifestyle, Transport, Buffer) vs Wealth/Fixed Allocations (Investments, Savings, Tithing)
  const { spendableCats, allocationCats } = useMemo(() => {
    const all = budgetDetail?.categories || [];
    const spendable = all.filter((c) => isSpendableCategory(c.category));
    const allocations = all.filter((c) => !isSpendableCategory(c.category));
    return { spendableCats: spendable, allocationCats: allocations };
  }, [budgetDetail]);

  // Calculations for summary metrics
  const totalGross = (budgetDetail?.budget.gross_salary || 0) + (budgetDetail?.budget.bonus || 0);
  const totalDeductions =
    (budgetDetail?.budget.cpf_deduction || 0) +
    (budgetDetail?.budget.taxes_deduction || 0) +
    (budgetDetail?.budget.insurance_deduction || 0);
  const disposablePool = budgetDetail?.disposablePool || 0;
  const totalSpent = budgetDetail?.totalSpent || 0;
  const totalRemaining = budgetDetail?.totalRemaining || 0;

  const spendableAllocated = spendableCats.reduce((s, c) => s + c.allocated_amount, 0);
  const spendableSpent = spendableCats.reduce((s, c) => s + (c.actualSpent || 0), 0);
  const spendableRemaining = spendableAllocated - spendableSpent;

  return (
    <div className={`space-y-5 ${!embedded ? "pb-20 md:pb-12" : ""} ${className}`.trim()}>
      {/* Top Header Section */}
      {!embedded ? (
        <PageHeader
          title="Monthly Budget"
          actions={
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <MonthPicker selectedMonth={selectedMonth} onChangeMonth={setSelectedMonth} />

              <Button
                variant="secondary"
                leftIcon={<Settings className="h-4 w-4 stroke-[2.2] text-slate-500" />}
                onClick={() => handleOpenEditor()}
                className="w-full sm:w-auto justify-center"
              >
                Edit Budget
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <MonthPicker selectedMonth={selectedMonth} onChangeMonth={setSelectedMonth} />

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Settings className="h-3.5 w-3.5 stroke-[2.2] text-slate-500" />}
            onClick={() => handleOpenEditor()}
            className="w-full sm:w-auto justify-center"
          >
            Edit Budget
          </Button>
        </div>
      )}

      {/* Category Limit Warning Banner (Guardrails) */}
      <CategoryLimitWarningBanner categories={budgetDetail?.categories || []} />

      {/* High-Level Financial Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Gross Salary */}
        <StatCard
          title="Gross Pay"
          value={formatSGD(totalGross)}
          tooltip="Base salary plus any monthly bonus before deductions."
          icon={<DollarSign className="h-4 w-4" />}
          iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />

        {/* Card 2: Total Deductions */}
        <StatCard
          title="Deductions"
          value={<span className="text-rose-600 dark:text-rose-400">-{formatSGD(totalDeductions)}</span>}
          tooltip="Employee CPF contribution (20%) + amortized monthly Taxes & Insurance."
          icon={<TrendingDown className="h-4 w-4" />}
          iconBg="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
        />

        {/* Card 3: Disposable Pool */}
        <StatCard
          title="Disposable Pool"
          value={<span className="text-emerald-900 dark:text-emerald-100">{formatSGD(disposablePool)}</span>}
          tooltip="Net take-home pay after CPF, taxes, and insurance available for category allocations."
          icon={<Wallet className="h-4 w-4 text-white" />}
          iconBg="bg-emerald-600"
          className="border-2 border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20"
        />

        {/* Card 4: Actual Spent & Remaining */}
        <StatCard
          title="Spent"
          value={formatSGD(totalSpent)}
          subtitle={
            <span
              className={`font-bold ${
                totalRemaining < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {totalRemaining < 0 ? 'Over ' : 'Left '}
              {formatSGD(Math.abs(totalRemaining))}
            </span>
          }
          icon={<Receipt className="h-4 w-4" />}
          iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />
      </div>

      {/* Loading Indicator */}
      {isLoading ? (
        <LoadingCard message="Loading budget details..." />
      ) : (
        <>
          {/* Section: Spendable Category Spending Meters (Food, Lifestyle, Transport, Buffer) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Category Spending Meters
              </h2>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {formatSGD(spendableRemaining)} left of {formatSGD(spendableAllocated)} cap
              </span>
            </div>

            {categories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <Tag className="h-5 w-5" />
                </div>
                <h3 className="mt-2.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Categories Configured
                </h3>
                <div className="mt-3 flex items-center justify-center gap-2.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await financeService.seedDefaultCategories();
                      await handleCategoriesChanged();
                    }}
                  >
                    Restore Presets
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenEditor()}
                  >
                    + Add Category
                  </Button>
                </div>
              </div>
            ) : (
              <CategoryProgressList
                categories={spendableCats.length > 0 ? spendableCats : budgetDetail?.categories || []}
              />
            )}
          </div>

          {/* Cumulative Spending Surplus / Deficit Card */}
          <CumulativeSurplusCard
            selectedMonth={selectedMonth}
            memberId={perspective !== 'household' && activeMember ? activeMember.id : undefined}
            perspective={perspective}
          />

          {/* Collapsible: Wealth & Fixed Allocations (Savings, Investments, Tithing) */}
          {allocationCats.length > 0 && (
            <CollapsibleSection
              title="Wealth & Fixed Allocations"
              badge={`${formatSGD(allocationCats.reduce((s, c) => s + c.allocated_amount, 0))}/mo`}
              icon={<PiggyBank className="h-4 w-4" />}
              defaultOpen={false}
            >
              <CategoryProgressList categories={allocationCats} compact />
            </CollapsibleSection>
          )}

          {/* Collapsible: Budget Waterfall Breakdown */}
          <CollapsibleSection
            title="Monthly CPF & Take-Home Flow"
            badge={perspectiveDisplayName}
            icon={<DollarSign className="h-4 w-4" />}
            defaultOpen={true}
          >
            <BudgetWaterfall
              budget={budgetDetail?.budget}
              categories={budgetDetail?.categories}
              perspectiveName={perspectiveDisplayName}
              onEditProfile={() => handleOpenEditor()}
            />
          </CollapsibleSection>

          {/* Collapsible: Bonus Allocation Helper */}
          <BonusAllocationCollapsible
            initialGrossBonus={2000}
            cpfRate={0.2}
            defaultOpen={false}
          />
        </>
      )}

      {/* Unified Budget & Categories Editor Modal */}
      {activeProfile && (
        <BaseProfileEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          profile={activeProfile}
          allocations={activeAllocations}
          categories={categories}
          members={members}
          policies={policiesData || []}
          onManagePolicies={() =>
            onNavigateTab
              ? onNavigateTab('recurring')
              : typeof window !== 'undefined'
                ? window.location.assign('/plan?tab=recurring')
                : undefined
          }
          initialTaxes={budgetDetail?.budget.taxes_deduction}
          initialInsurance={budgetDetail?.budget.insurance_deduction}
          monthlyBudgetId={
            perspective !== 'household' && budgetDetail?.budget.id && isValidUuid(budgetDetail.budget.id)
              ? budgetDetail.budget.id
              : undefined
          }
          selectedMonth={selectedMonth}
          onSaveSuccess={handleProfileSaved}
          onCategoriesChanged={handleCategoriesChanged}
          onSelectMember={(memberId) => setEditingProfileMemberId(memberId)}
        />
      )}
    </div>
  );
}

export default BudgetPage;
