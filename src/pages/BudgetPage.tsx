/**
 * BudgetPage Component
 * Integrated Monthly Budget Tracking & Base Profile Management
 * Coordinates:
 * - Selected month navigation ('YYYY-MM')
 * - Active perspective (Combined Household vs Yi Jia vs Rachel)
 * - High-level financial metric cards
 * - Visual budget waterfall flow
 * - Category progress meters with over-budget alerts
 * - Base profile editor modal
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings,
  DollarSign,
  TrendingDown,
  Wallet,
  Receipt,
  User,
  Users,
  Loader2,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Button, Badge } from '../components/ui';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { getCurrentMonth } from '../lib/dateUtils';
import { mockBaseProfiles, mockBaseAllocations, mockCategories } from '../data/mockSeedData';
import { MonthPicker } from '../components/budget/MonthPicker';
import { BudgetWaterfall } from '../components/budget/BudgetWaterfall';
import { CategoryProgressList } from '../components/budget/CategoryProgressList';
import { BaseProfileEditorModal } from '../components/budget/BaseProfileEditorModal';
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
  const { perspective, activeMember, members, refreshData: refreshHousehold } = useHousehold();

  // State
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [budgetDetail, setBudgetDetail] = useState<MonthlyBudgetDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [baseProfiles, setBaseProfiles] = useState<BaseBudgetProfile[]>(mockBaseProfiles);
  const [baseAllocations, setBaseAllocations] = useState<BaseProfileAllocation[]>(mockBaseAllocations);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  // Load Categories & Base Profiles once
  useEffect(() => {
    async function loadMeta() {
      try {
        const [cats, profs, allocs] = await Promise.all([
          financeService.getCategories(),
          financeService.getBaseProfiles(),
          financeService.getBaseAllocations(),
        ]);
        if (cats && cats.length > 0) setCategories(cats);
        if (profs && profs.length > 0) setBaseProfiles(profs);
        if (allocs && allocs.length > 0) setBaseAllocations(allocs);
      } catch (err) {
        console.error('Failed to load budget metadata:', err);
      }
    }
    loadMeta();
  }, []);

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

                categoryMap.set(item.category_id, {
                  ...existing,
                  allocated_amount: allocated,
                  actualSpent: spent,
                  remaining,
                  percentage: pct,
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
  const activeProfile = useMemo(() => {
    const targetId = editingProfileMemberId || (activeMember ? activeMember.id : members[0]?.id);
    return (
      baseProfiles.find((p) => p.owner_id === targetId) ||
      baseProfiles[0] ||
      mockBaseProfiles[0]
    );
  }, [baseProfiles, editingProfileMemberId, activeMember, members]);

  const activeAllocations = useMemo(() => {
    return baseAllocations.filter((a) => a.profile_id === activeProfile?.id);
  }, [baseAllocations, activeProfile]);

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

  // Calculations for summary metrics
  const totalGross = (budgetDetail?.budget.gross_salary || 0) + (budgetDetail?.budget.bonus || 0);
  const totalDeductions =
    (budgetDetail?.budget.cpf_deduction || 0) +
    (budgetDetail?.budget.taxes_deduction || 0) +
    (budgetDetail?.budget.insurance_deduction || 0);
  const disposablePool = budgetDetail?.disposablePool || 0;
  const totalSpent = budgetDetail?.totalSpent || 0;
  const totalRemaining = budgetDetail?.totalRemaining || 0;

  return (
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      {/* Top Header Section */}
      <PageHeader
        title="Monthly Budget"
        badge={
          <Badge
            variant={perspective === 'household' ? 'emerald' : 'blue'}
            icon={perspective === 'household' ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
          >
            {perspectiveDisplayName}
          </Badge>
        }
        subtitle="Monthly allocations, CPF deduction waterfall, and category meters"
        actions={
          <div className="flex items-center flex-wrap gap-3">
            <MonthPicker selectedMonth={selectedMonth} onChangeMonth={setSelectedMonth} />

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
                    <span>Edit {m.display_name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Button
                variant="secondary"
                leftIcon={<Settings className="h-4 w-4 stroke-[2.2] text-slate-500" />}
                onClick={() => handleOpenEditor()}
              >
                Edit Base Profile
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
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
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
            <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
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
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
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
          {/* Section: Budget Waterfall Breakdown */}
          <BudgetWaterfall
            budget={budgetDetail?.budget}
            categories={budgetDetail?.categories}
            perspectiveName={perspectiveDisplayName}
            onEditProfile={() => handleOpenEditor()}
          />

          {/* Section: Category Progress Meters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Category Spending Meters
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track actual monthly spending against your target budget limits
                </p>
              </div>
            </div>

            <CategoryProgressList categories={budgetDetail?.categories || []} />
          </div>
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
            perspective !== 'household' ? budgetDetail?.budget.id : undefined
          }
          selectedMonth={selectedMonth}
          onSaveSuccess={handleProfileSaved}
        />
      )}
    </div>
  );
}

export default BudgetPage;
