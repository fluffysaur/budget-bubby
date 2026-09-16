/**
 * BudgetWaterfall Component
 * Visual financial waterfall breakdown for Singapore couple finances:
 * 1. Gross Salary (+ Bonus)
 * 2. Employee CPF Deduction (20%)
 * 3. Fixed Deductions (Taxes & Insurance)
 * 4. After Deductions Disposable Pool (Take-Home Pay)
 * 5. Category Allocations (Food, Lifestyle, Investments, Savings, Tithing, Transport, Buffer)
 */

import {
  DollarSign,
  Building2,
  Receipt,
  Wallet,
  Settings,
  Sparkles,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import type { MonthlyBudget, MonthlyBudgetCategoryDetail } from '../../types/finance';

export interface BudgetWaterfallProps {
  budget?: MonthlyBudget | null;
  categories?: MonthlyBudgetCategoryDetail[];
  perspectiveName?: string;
  onEditProfile?: () => void;
  className?: string;
}

export function BudgetWaterfall({
  budget,
  categories = [],
  perspectiveName,
  onEditProfile,
  className = '',
}: BudgetWaterfallProps) {
  if (!budget) {
    return (
      <div className={`p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${className}`}>
        <p className="text-sm text-slate-500 dark:text-slate-400">No budget data available for this period.</p>
      </div>
    );
  }

  const grossSalary = budget.gross_salary || 0;
  const bonus = budget.bonus || 0;
  const totalGross = grossSalary + bonus;
  const cpfDeduction = budget.cpf_deduction || 0;
  const taxesDeduction = budget.taxes_deduction || 0;
  const insuranceDeduction = budget.insurance_deduction || 0;
  const fixedDeductions = taxesDeduction + insuranceDeduction;
  const afterDeductions = budget.after_deductions || (totalGross - cpfDeduction - fixedDeductions);

  return (
    <div
      className={`rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-xs space-y-6 transition-colors ${className}`}
    >
      {/* Waterfall Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Budget Waterfall Breakdown
            </h2>
            {perspectiveName && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                {perspectiveName}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            From gross salary down to disposable category allocations
          </p>
        </div>

        {onEditProfile && (
          <button
            type="button"
            onClick={onEditProfile}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Edit Base Profile</span>
          </button>
        )}
      </div>

      {/* Waterfall Steps */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
        {/* Step 1: Gross Salary */}
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Step 1: Gross Pay
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatSGD(totalGross)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Salary:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{formatSGD(grossSalary)}</span>
            </div>
            {bonus > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Bonus:
                </span>
                <span>+{formatSGD(bonus)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Employee CPF Deduction (20%) */}
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Step 2: Employee CPF
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              -{formatSGD(cpfDeduction)}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Mandatory 20% ordinary employee deduction
          </p>
        </div>

        {/* Step 3: Fixed Deductions */}
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Step 3: Fixed Deductions
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              -{formatSGD(fixedDeductions)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Taxes:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">-{formatSGD(taxesDeduction)}</span>
            </div>
            <div className="flex justify-between">
              <span>Insurance:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">-{formatSGD(insuranceDeduction)}</span>
            </div>
          </div>
        </div>

        {/* Step 4: After Deductions Disposable Pool */}
        <div className="relative rounded-2xl border-2 border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Step 4: Disposable Pool
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-emerald-900 dark:text-emerald-100">
              {formatSGD(afterDeductions)}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            Net Take-Home available for category allocation
          </p>
        </div>
      </div>

      {/* Step 5: Category Allocations Flow */}
      {categories.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Step 5: Category Allocations
            </span>
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              100% of Disposable Pool
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
            {categories.map((catDetail) => {
              const name = catDetail.category?.name || 'Category';
              const color = catDetail.category?.color || '#10B981';
              const percentDisplay = `${Math.round(catDetail.percentage * 100)}%`;

              return (
                <div
                  key={catDetail.id || catDetail.category_id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 flex flex-col justify-between transition-hover hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                      {name}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {percentDisplay}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {formatSGD(catDetail.allocated_amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetWaterfall;
