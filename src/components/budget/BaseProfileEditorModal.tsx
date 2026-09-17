/**
 * BaseProfileEditorModal Component
 * Modal dialog for editing a household member's base budget profile:
 * - Gross Salary
 * - CPF Employee Rate (e.g. 20%)
 * - Fixed Monthly Deductions (Taxes & Insurance)
 * - Category Percentage Allocations (strictly validated to sum to 100%)
 */

import { useState, useEffect, useMemo, useId } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Percent,
  DollarSign,
  ShieldCheck,
  Save,
  RotateCcw,
} from 'lucide-react';
import { financeService } from '../../services/financeService';
import { mockCategories } from '../../data/mockSeedData';
import { calculateCPFAndNetPay } from '../../lib/financialFormulas';
import type {
  BaseBudgetProfile,
  BaseProfileAllocation,
  Category,
  HouseholdMember,
} from '../../types/finance';

export interface BaseProfileEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BaseBudgetProfile;
  allocations: BaseProfileAllocation[];
  categories?: Category[];
  members?: HouseholdMember[];
  initialTaxes?: number;
  initialInsurance?: number;
  monthlyBudgetId?: string;
  selectedMonth?: string;
  onSaveSuccess?: () => void;
  className?: string;
}

export function BaseProfileEditorModal({
  isOpen,
  onClose,
  profile,
  allocations,
  categories = mockCategories,
  members = [],
  initialTaxes = 0,
  initialInsurance = 0,
  monthlyBudgetId,
  selectedMonth,
  onSaveSuccess,
  className = '',
}: BaseProfileEditorModalProps) {
  const titleId = useId();

  // Form State
  const [grossSalary, setGrossSalary] = useState<string>(String(profile?.gross_salary ?? 5000));
  const [cpfRate, setCpfRate] = useState<string>(
    String(Math.round((profile?.cpf_employee_rate ?? 0.20) * 100))
  );
  const [taxes, setTaxes] = useState<string>(String(initialTaxes));
  const [insurance, setInsurance] = useState<string>(String(initialInsurance));

  // Category percentages mapped by categoryId: number (0-100)
  const [categoryPercentages, setCategoryPercentages] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize initial state when modal opens or profile/allocations change
  useEffect(() => {
    if (profile) {
      setGrossSalary(String(profile.gross_salary));
      setCpfRate(String(Math.round(profile.cpf_employee_rate * 100)));
    }
    setTaxes(String(initialTaxes));
    setInsurance(String(initialInsurance));

    // Initialize category percentages
    const pctMap: Record<string, number> = {};
    for (const cat of categories) {
      const existing = allocations.find((a) => a.category_id === cat.id);
      pctMap[cat.id] = existing ? Math.round(existing.target_percentage * 100) : 0;
    }
    setCategoryPercentages(pctMap);
    setErrorMessage(null);
  }, [profile, allocations, categories, initialTaxes, initialInsurance, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate sum of percentages
  const totalPercentage = useMemo(() => {
    return Object.values(categoryPercentages).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [categoryPercentages]);

  const isValidTotal = Math.abs(totalPercentage - 100) < 0.001;

  const handlePercentageChange = (categoryId: string, rawVal: string) => {
    const val = rawVal === '' ? 0 : parseFloat(rawVal);
    setCategoryPercentages((prev) => ({
      ...prev,
      [categoryId]: isNaN(val) ? 0 : val,
    }));
  };

  const handleReset = () => {
    if (profile) {
      setGrossSalary(String(profile.gross_salary));
      setCpfRate(String(Math.round(profile.cpf_employee_rate * 100)));
    }
    setTaxes(String(initialTaxes));
    setInsurance(String(initialInsurance));
    const pctMap: Record<string, number> = {};
    for (const cat of categories) {
      const existing = allocations.find((a) => a.category_id === cat.id);
      pctMap[cat.id] = existing ? Math.round(existing.target_percentage * 100) : 0;
    }
    setCategoryPercentages(pctMap);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidTotal) {
      setErrorMessage(`Category allocations must sum to exactly 100% (currently ${totalPercentage}%).`);
      return;
    }

    const parsedGross = parseFloat(grossSalary);
    if (isNaN(parsedGross) || parsedGross <= 0) {
      setErrorMessage('Please enter a valid positive gross salary.');
      return;
    }

    const parsedCpf = (parseFloat(cpfRate) || 0) / 100;
    const parsedTaxes = parseFloat(taxes) || 0;
    const parsedInsurance = parseFloat(insurance) || 0;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Build updated profile
      const updatedProfile: BaseBudgetProfile = {
        ...profile,
        gross_salary: parsedGross,
        cpf_employee_rate: parsedCpf,
        updated_at: new Date().toISOString(),
      };

      // Build updated allocations
      const updatedAllocations: BaseProfileAllocation[] = categories.map((cat) => {
        const existing = allocations.find((a) => a.category_id === cat.id);
        const targetPct = (categoryPercentages[cat.id] || 0) / 100;
        const fallbackId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `alloc-${profile.id}-${cat.id}`;
        return {
          id: existing ? existing.id : fallbackId,
          profile_id: profile.id,
          category_id: cat.id,
          target_percentage: targetPct,
        };
      });

      // Save via finance service
      await financeService.updateBaseProfile(updatedProfile, updatedAllocations);

      // If a current monthly budget id is present, update current month figures as well
      const cpfDeduction = calculateCPFAndNetPay(parsedGross, parsedCpf).cpfDeduction;
      if (monthlyBudgetId) {
        await financeService.updateMonthlyBudget({
          id: monthlyBudgetId,
          gross_salary: parsedGross,
          cpf_deduction: cpfDeduction,
          taxes_deduction: parsedTaxes,
          insurance_deduction: parsedInsurance,
        });
      } else if (selectedMonth) {
        try {
          const monthDetail = await financeService.getMonthlyBudget(selectedMonth, profile.owner_id);
          if (monthDetail?.budget?.id) {
            await financeService.updateMonthlyBudget({
              id: monthDetail.budget.id,
              gross_salary: parsedGross,
              cpf_deduction: cpfDeduction,
              taxes_deduction: parsedTaxes,
              insurance_deduction: parsedInsurance,
            });
          }
        } catch {
          // ignore if lookup fails
        }
      }

      onSaveSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to update base profile:', err);
      setErrorMessage(err.message || 'Failed to update base profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const profileMember = members?.find((m) => m.id === profile.owner_id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 ${className}`}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 id={titleId} className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Edit Base Profile
              </h2>
              {profileMember && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                  {profileMember.display_name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure baseline salary, deductions, and 100% allocation splits
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {errorMessage && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Income & CPF */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5" />
              Income &amp; CPF
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="gross-salary-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Gross Salary (SGD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">S$</span>
                  <input
                    id="gross-salary-input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={grossSalary}
                    onChange={(e) => setGrossSalary(e.target.value)}
                    aria-label="Gross Salary"
                    className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="cpf-rate-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  CPF Employee Rate (%)
                </label>
                <div className="relative">
                  <input
                    id="cpf-rate-input"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    required
                    value={cpfRate}
                    onChange={(e) => setCpfRate(e.target.value)}
                    aria-label="CPF Employee Rate"
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-hidden"
                  />
                  <span className="absolute right-3 top-3 text-xs font-bold text-slate-400">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Fixed Monthly Deductions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Fixed Monthly Deductions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="monthly-taxes-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Monthly Taxes (SGD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">S$</span>
                  <input
                    id="monthly-taxes-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxes}
                    onChange={(e) => setTaxes(e.target.value)}
                    aria-label="Monthly Taxes"
                    className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="monthly-insurance-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Monthly Insurance (SGD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">S$</span>
                  <input
                    id="monthly-insurance-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={insurance}
                    onChange={(e) => setInsurance(e.target.value)}
                    aria-label="Monthly Insurance"
                    className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Category Percentage Allocations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <Percent className="h-3.5 w-3.5" />
                Category Allocations (Must Sum to 100%)
              </h3>

              {/* Total Percentage Indicator */}
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
                  isValidTotal
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}
              >
                {isValidTotal ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                )}
                <span>Total: {totalPercentage}%</span>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4">
              {categories.map((cat) => {
                const currentPct = categoryPercentages[cat.id] ?? 0;
                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <label
                        htmlFor={`cat-alloc-${cat.id}`}
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate cursor-pointer"
                      >
                        {cat.name}
                      </label>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative w-24">
                        <input
                          id={`cat-alloc-${cat.id}`}
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          aria-label={`${cat.name} Allocation`}
                          value={currentPct}
                          onChange={(e) => handlePercentageChange(cat.id, e.target.value)}
                          className="w-full pr-6 pl-2.5 py-1 text-right text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 outline-hidden"
                        />
                        <span className="absolute right-2 top-2 text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValidTotal || isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BaseProfileEditorModal;
