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

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings,
  DollarSign,
  TrendingDown,
  Wallet,
  Receipt,
  Loader2,
  PiggyBank,
  Tag,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Button } from '../components/ui';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
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
import { ManageCategoriesModal } from '../components/categories/ManageCategoriesModal';
import { BonusAllocationCollapsible } from '../components/budget/BonusAllocationCollapsible';
import type {
  BaseBudgetProfile,
  BaseProfileAllocation,
  Category,
  MonthlyBudget,
  MonthlyBudgetCategoryDetail,
  MonthlyBudgetDetail,
} from '../types/finance';

export interface BudgetPageProps {
  className?: string;
}

export function BudgetPage({ className = '' }: BudgetPageProps) {
  const { perspective, activeMember, members, overview, isMockMode, refreshData: refreshHousehold } = useHousehold();

  // State
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [budgetDetail, setBudgetDetail] = useState<MonthlyBudgetDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>(() => isMockMode ? mockCategories : []);
  const [baseProfiles, setBaseProfiles] = useState<BaseBudgetProfile[]>(() => isMockMode ? mockBaseProfiles : []);
  const [baseAllocations, setBaseAllocations] = useState<BaseProfileAllocation[]>(() => isMockMode ? mockBaseAllocations : []);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState<boolean>(false);
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

  // Load Categories & Base Profiles once
  useEffect(() => {
    async function loadMeta() {
      try {
        const [cats, profs, allocs] = await Promise.all([
          financeService.getCategories(),
          financeService.getBaseProfiles(),
          financeService.getBaseAllocations(),
        ]);
        if (cats && cats.length > 0) {
          setCategories(cats);
        } else if (isMockMode) {
          setCategories(mockCategories);
        }
        if (profs) setBaseProfiles(profs);
        if (allocs) setBaseAllocations(allocs);
      } catch (err) {
        console.error('Failed to load budget metadata:', err);
      }
    }
    loadMeta();
  }, [isMockMode]);

  // Fetch Monthly Budget Detail based on selected month & active perspective
  const loadBudget = useCallback(async () => {
    try {
      setIsLoading(true);

      if (perspective === 'household') {
        // Combined household view: fetch budgets for both members and combine
        const m1 = members[0];
        const m2 = members[1];

        if (m1 && m2) {
          const [b1, b2] = await Promise.all([
            financeService.getMonthlyBudget(selectedMonth, m1.id),
            financeService.getMonthlyBudget(selectedMonth, m2.id),
          ]);

          const combinedGross = (b1.budget.gross_salary || 0) + (b2.budget.gross_salary || 0);
          const combinedBonus = (b1.budget.bonus || 0) + (b2.budget.bonus || 0);
          const combinedCpf = (b1.budget.cpf_deduction || 0) + (b2.budget.cpf_deduction || 0);
          const combinedTaxes = (b1.budget.taxes_deduction || 0) + (b2.budget.taxes_deduction || 0);
          const combinedInsurance = (b1.budget.insurance_deduction || 0) + (b2.budget.insurance_deduction || 0);
          const combinedAfter = (b1.budget.after_deductions || 0) + (b2.budget.after_deductions || 0);

          const combinedBudget: MonthlyBudget = {
            id: `mb-combined-${selectedMonth}`,
            household_id: b1.budget.household_id,
            owner_id: 'household',
            month: selectedMonth,
            gross_salary: combinedGross,
            bonus: combinedBonus,
            cpf_deduction: combinedCpf,
            taxes_deduction: Math.round(combinedTaxes * 100) / 100,
            insurance_deduction: Math.round(combinedInsurance * 100) / 100,
            after_deductions: Math.round(combinedAfter * 100) / 100,
            notes: 'Combined household monthly budget',
            is_locked: b1.budget.is_locked && b2.budget.is_locked,
          };

          // Merge categories from both members
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

          mergeCats(b1.categories);
          mergeCats(b2.categories);

          const combinedCategories = Array.from(categoryMap.values());
          const totalSpent = Math.round(
            combinedCategories.reduce((sum, c) => sum + (c.actualSpent || 0), 0) * 100
          ) / 100;
          const totalRemaining = Math.round((combinedAfter - totalSpent) * 100) / 100;

          setBudgetDetail({
            budget: combinedBudget,
            categories: combinedCategories,
            disposablePool: combinedAfter,
            totalSpent,
            totalRemaining,
          });
          return;
        }
      }

      // Single member perspective
      const targetMemberId = activeMember ? activeMember.id : members[0]?.id;
      const detail = await financeService.getMonthlyBudget(selectedMonth, targetMemberId);
      setBudgetDetail(detail);
    } catch (err) {
      console.error('Failed to load monthly budget:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, perspective, activeMember, members]);

  useEffect(() => {
    loadBudget();
  }, [loadBudget]);

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
    try {
      const [profs, allocs] = await Promise.all([
        financeService.getBaseProfiles(),
        financeService.getBaseAllocations(),
      ]);
      setBaseProfiles(profs);
      setBaseAllocations(allocs);
    } catch (err) {
      console.error('Failed to reload base profiles after edit:', err);
    }
    await loadBudget();
    await refreshHousehold();
  };

  const handleCategoriesChanged = async () => {
    try {
      const [cats, profs, allocs] = await Promise.all([
        financeService.getCategories(),
        financeService.getBaseProfiles(),
        financeService.getBaseAllocations(),
      ]);
      setCategories(cats || []);
      if (profs) setBaseProfiles(profs);
      if (allocs) setBaseAllocations(allocs);
    } catch (err) {
      console.error('Failed to reload metadata after category changes:', err);
    }
    await loadBudget();
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
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      {/* Top Header Section */}
      <PageHeader
        title="Monthly Budget"
        subtitle="Monthly allocations, CPF deduction waterfall, and category meters"
        actions={
          <div className="flex items-center flex-wrap gap-3">
            <MonthPicker selectedMonth={selectedMonth} onChangeMonth={setSelectedMonth} />

            <Button
              variant="outline"
              leftIcon={<Tag className="h-4 w-4 stroke-[2.2] text-slate-500" />}
              onClick={() => setIsManageCategoriesOpen(true)}
            >
              Manage Categories
            </Button>

            {perspective === 'household' && members.length > 1 ? (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleOpenEditor(m.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-2xs transition-all cursor-pointer"
                  >
                    <Settings className="h-3 w-3 text-slate-400" />
                    <span>Edit {m.display_name}&apos;s Budget</span>
                  </button>
                ))}
              </div>
            ) : (
              <Button
                variant="secondary"
                leftIcon={<Settings className="h-4 w-4 stroke-[2.2] text-slate-500" />}
                onClick={() => handleOpenEditor()}
              >
                Edit Budget
              </Button>
            )}
          </div>
        }
      />

      {/* High-Level Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Salary */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Gross Pay
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {formatSGD(totalGross)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            Base salary + bonus
          </p>
        </div>

        {/* Card 2: Total Deductions */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Deductions
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
              -{formatSGD(totalDeductions)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            CPF + Taxes + Insurance
          </p>
        </div>

        {/* Card 3: Disposable Pool */}
        <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20 p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Disposable Pool
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold tracking-tight text-emerald-900 dark:text-emerald-100">
              {formatSGD(disposablePool)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
            After-deductions take-home
          </p>
        </div>

        {/* Card 4: Actual Spent & Remaining */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Spent / Remaining
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {formatSGD(totalSpent)}
            </span>
            <span
              className={`text-xs font-bold ${
                totalRemaining < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {totalRemaining < 0 ? 'Over ' : 'Left '}
              {formatSGD(Math.abs(totalRemaining))}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            Across {budgetDetail?.categories.length || 0} active categories
          </p>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="text-sm font-medium">Loading budget details...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Section: Spendable Category Spending Meters (Food, Lifestyle, Transport, Buffer) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Category Spending Meters
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Daily spendable categories ({formatSGD(spendableRemaining)} remaining of {formatSGD(spendableAllocated)} cap)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsManageCategoriesOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <span>Manage Categories</span>
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <Tag className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Categories Configured
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Your budget has no categories configured yet. You can restore the recommended preset categories or create custom categories.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await financeService.seedDefaultCategories();
                      await handleCategoriesChanged();
                    }}
                  >
                    Restore Presets
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setIsManageCategoriesOpen(true)}
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

          {/* Collapsible: Wealth & Fixed Allocations (Savings, Investments, Tithing) */}
          {allocationCats.length > 0 && (
            <CollapsibleSection
              title="Wealth & Fixed Allocations"
              subtitle="Investments, Long-Term Savings & Tithing safely ring-fenced from daily spending"
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
            subtitle="From gross salary down to disposable category allocations"
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

      {/* Base Profile Editor Modal */}
      {activeProfile && (
        <BaseProfileEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          profile={activeProfile}
          allocations={activeAllocations}
          categories={categories}
          members={members}
          initialTaxes={budgetDetail?.budget.taxes_deduction}
          initialInsurance={budgetDetail?.budget.insurance_deduction}
          monthlyBudgetId={
            perspective !== 'household' && budgetDetail?.budget.id && isValidUuid(budgetDetail.budget.id)
              ? budgetDetail.budget.id
              : undefined
          }
          selectedMonth={selectedMonth}
          onSaveSuccess={handleProfileSaved}
          onManageCategories={() => setIsManageCategoriesOpen(true)}
        />
      )}

      {/* Manage Categories Modal */}
      <ManageCategoriesModal
        isOpen={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        onCategoriesChanged={handleCategoriesChanged}
      />
    </div>
  );
}

export default BudgetPage;
