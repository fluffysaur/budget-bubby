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
} from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { formatAllocationPercent } from "../../lib/financialFormulas";
import { TruncatedText } from "../ui/TruncatedText";
import type { MonthlyBudget, MonthlyBudgetCategoryDetail } from "../../types/finance";

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
            className={`rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 sm:p-5 shadow-cute space-y-5 transition-colors ${className}`}
        >
            {/* Waterfall Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-(--border-subtle) pb-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display font-black text-base sm:text-lg tracking-tight text-(--text-ink)">
                        Budget Waterfall Breakdown
                    </h2>
                    {perspectiveName && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-(--pastel-lilac-light) text-(--text-ink) border border-(--border-ink) shadow-cute-sm">
                            {perspectiveName}
                        </span>
                    )}
                </div>

                {onEditProfile && (
                    <button
                        type="button"
                        onClick={onEditProfile}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-(--text-ink) bg-(--bg-canvas) hover:bg-(--pastel-butter-light) border border-(--border-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                    >
                        <Settings className="h-3.5 w-3.5" />
                        <span>Edit Budget</span>
                    </button>
                )}
            </div>

            {/* Waterfall Steps */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative">
                {/* Gross Pay */}
                <div className="relative rounded-2xl border-2 border-(--border-ink) bg-(--bg-canvas) p-3.5 shadow-cute-sm transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                            Gross Pay
                        </span>
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-(--border-ink) bg-(--pastel-mint) text-(--text-ink)">
                            <DollarSign className="h-3.5 w-3.5" />
                        </div>
                    </div>
                    <div className="mt-1.5">
                        <span className="font-mono-num text-lg sm:text-xl font-black tracking-tight text-(--text-ink)">
                            {formatSGD(totalGross)}
                        </span>
                    </div>
                    <div className="mt-1.5 text-[11px] font-mono-num text-(--text-muted) space-y-0.5">
                        <div className="flex justify-between">
                            <span>Salary:</span>
                            <span className="font-bold text-(--text-ink)">{formatSGD(grossSalary)}</span>
                        </div>
                        {bonus > 0 && (
                            <div className="flex justify-between text-purple-700 dark:text-purple-300 font-bold">
                                <span className="flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Bonus:
                                </span>
                                <span>+{formatSGD(bonus)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* CPF (20%) */}
                <div className="relative rounded-2xl border-2 border-(--border-ink) bg-(--bg-canvas) p-3.5 shadow-cute-sm transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                            CPF (20%)
                        </span>
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-(--border-ink) bg-(--pastel-lilac-light) text-(--text-ink)">
                            <Building2 className="h-3.5 w-3.5" />
                        </div>
                    </div>
                    <div className="mt-1.5">
                        <span className="font-mono-num text-lg sm:text-xl font-black tracking-tight text-rose-600 dark:text-rose-400">
                            -{formatSGD(cpfDeduction)}
                        </span>
                    </div>
                    <p className="mt-1.5 text-[11px] font-medium text-(--text-muted)">
                        Employee CPF
                    </p>
                </div>

                {/* Deductions */}
                <div className="relative rounded-2xl border-2 border-(--border-ink) bg-(--bg-canvas) p-3.5 shadow-cute-sm transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                            Deductions
                        </span>
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-(--border-ink) bg-(--pastel-butter) text-(--text-ink)">
                            <Receipt className="h-3.5 w-3.5" />
                        </div>
                    </div>
                    <div className="mt-1.5">
                        <span className="font-mono-num text-lg sm:text-xl font-black tracking-tight text-rose-600 dark:text-rose-400">
                            -{formatSGD(fixedDeductions)}
                        </span>
                    </div>
                    <div className="mt-1.5 text-[11px] font-mono-num text-(--text-muted) space-y-0.5">
                        <div className="flex justify-between">
                            <span>Taxes:</span>
                            <span className="font-bold text-(--text-ink)">-{formatSGD(taxesDeduction)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Insurance:</span>
                            <span className="font-bold text-(--text-ink)">-{formatSGD(insuranceDeduction)}</span>
                        </div>
                    </div>
                </div>

                {/* Disposable Pool */}
                <div className="relative rounded-2xl border-2 border-(--border-ink) bg-(--pastel-mint-light) p-3.5 shadow-cute transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-(--text-ink)">
                            Disposable Pool
                        </span>
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-(--border-ink) bg-(--pastel-mint) text-(--text-ink) shadow-cute-sm">
                            <Wallet className="h-3.5 w-3.5" />
                        </div>
                    </div>
                    <div className="mt-1.5">
                        <span className="font-mono-num text-lg sm:text-xl font-black tracking-tight text-(--text-ink)">
                            {formatSGD(afterDeductions)}
                        </span>
                    </div>
                    <p className="mt-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                        Net Take-Home
                    </p>
                </div>
            </div>

            {/* Category Allocations Flow */}
            {categories.length > 0 && (
                <div className="pt-2">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-black uppercase tracking-wider text-(--text-muted)">
                            Category Allocations
                        </span>
                        <div className="h-px flex-1 bg-(--border-subtle)" />
                        <span className="text-xs font-bold text-(--text-ink)">
                            100% of Disposable Pool
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {categories.map((catDetail) => {
                            const name = catDetail.category?.name || "Category";
                            const color = catDetail.category?.color || "#dfc2ff";
                            const percentDisplay = `${formatAllocationPercent(catDetail.percentage * 100)}%`;

                            return (
                                <div
                                    key={catDetail.id || catDetail.category_id}
                                    className="rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) p-3 flex flex-col justify-between shadow-cute-sm hover:bg-(--pastel-butter-light)/40 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                        <div className="min-w-0 flex-1 text-xs font-bold text-(--text-ink)">
                                            <TruncatedText text={name} />
                                        </div>
                                        <span
                                            className="px-1.5 py-0.5 rounded-md text-[10px] font-black text-white shrink-0 border border-black/20"
                                            style={{ backgroundColor: color }}
                                        >
                                            {percentDisplay}
                                        </span>
                                    </div>
                                    <div className="text-sm font-mono-num font-black text-(--text-ink) mt-1 truncate">
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
