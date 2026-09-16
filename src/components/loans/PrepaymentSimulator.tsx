/**
 * PrepaymentSimulator Component
 * Interactive mortgage & loan prepayment calculator:
 * - Slider & number input for extra monthly prepayment (e.g. +$0 to +$3,000/mo)
 * - Optional lump-sum one-time prepayment input
 * - Quick preset buttons (+$100, +$250, +$500, +$1,000, Reset)
 * - Computes:
 *   - Interest Saved (SGD)
 *   - Time Saved (months & years)
 *   - New Debt-Free Date
 *   - Side-by-side baseline vs simulated comparison
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  TrendingDown,
  Calendar,
  Clock,
  RotateCcw,
  Coins,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { formatDisplayMonth } from '../../lib/dateUtils';
import { calculateLoanAmortization } from '../../lib/financialFormulas';
import type { Loan, AmortizationResult } from '../../types/finance';

export interface PrepaymentSimulationResult {
  extraMonthly: number;
  lumpSum: number;
  baselineAmortization: AmortizationResult;
  simulatedAmortization: AmortizationResult;
  interestSaved: number;
  monthsSaved: number;
}

export interface PrepaymentSimulatorProps {
  loan: Loan;
  extraMonthly?: number;
  lumpSum?: number;
  onChangeExtraMonthly?: (value: number) => void;
  onChangeLumpSum?: (value: number) => void;
  onSimulationChange?: (result: PrepaymentSimulationResult) => void;
  className?: string;
}

const PRESETS = [100, 250, 500, 1000];

export function PrepaymentSimulator({
  loan,
  extraMonthly: controlledExtraMonthly,
  lumpSum: controlledLumpSum,
  onChangeExtraMonthly,
  onChangeLumpSum,
  onSimulationChange,
  className = '',
}: PrepaymentSimulatorProps) {
  // Internal state if uncontrolled
  const [internalExtraMonthly, setInternalExtraMonthly] = useState<number>(0);
  const [internalLumpSum, setInternalLumpSum] = useState<number>(0);

  const extraMonthly = controlledExtraMonthly !== undefined ? controlledExtraMonthly : internalExtraMonthly;
  const lumpSum = controlledLumpSum !== undefined ? controlledLumpSum : internalLumpSum;

  const handleExtraMonthlyChange = (val: number) => {
    const clamped = Math.max(0, isNaN(val) ? 0 : val);
    if (onChangeExtraMonthly) {
      onChangeExtraMonthly(clamped);
    } else {
      setInternalExtraMonthly(clamped);
    }
  };

  const handleLumpSumChange = (val: number) => {
    const clamped = Math.max(0, isNaN(val) ? 0 : val);
    if (onChangeLumpSum) {
      onChangeLumpSum(clamped);
    } else {
      setInternalLumpSum(clamped);
    }
  };

  const basePrincipal = useMemo(() => {
    const remaining = loan.principal - (loan.amount_paid || 0);
    return remaining > 0 ? remaining : loan.principal;
  }, [loan.principal, loan.amount_paid]);

  // Calculate baseline amortization
  const baseline = useMemo<AmortizationResult>(() => {
    try {
      return calculateLoanAmortization(
        basePrincipal,
        loan.interest_rate,
        loan.monthly_payment,
        loan.start_date,
        0
      );
    } catch {
      return {
        schedule: [],
        totalMonths: loan.term_months,
        totalInterest: 0,
        payoffDate: loan.start_date,
        monthlyPayment: loan.monthly_payment,
      };
    }
  }, [basePrincipal, loan.interest_rate, loan.monthly_payment, loan.start_date, loan.term_months]);

  // Calculate simulated amortization
  const simulated = useMemo<AmortizationResult>(() => {
    const effectivePrincipal = Math.max(0, basePrincipal - lumpSum);
    if (effectivePrincipal <= 0) {
      return {
        schedule: [],
        totalMonths: 0,
        totalInterest: 0,
        payoffDate: loan.start_date,
        monthlyPayment: 0,
      };
    }

    try {
      return calculateLoanAmortization(
        effectivePrincipal,
        loan.interest_rate,
        loan.monthly_payment,
        loan.start_date,
        extraMonthly
      );
    } catch {
      return baseline;
    }
  }, [basePrincipal, lumpSum, loan.interest_rate, loan.monthly_payment, loan.start_date, extraMonthly, baseline]);

  // Metrics
  const interestSaved = useMemo(() => {
    return Math.max(0, Math.round((baseline.totalInterest - simulated.totalInterest) * 100) / 100);
  }, [baseline.totalInterest, simulated.totalInterest]);

  const monthsSaved = useMemo(() => {
    return Math.max(0, baseline.totalMonths - simulated.totalMonths);
  }, [baseline.totalMonths, simulated.totalMonths]);

  // Notify parent if callback provided
  useEffect(() => {
    if (onSimulationChange) {
      onSimulationChange({
        extraMonthly,
        lumpSum,
        baselineAmortization: baseline,
        simulatedAmortization: simulated,
        interestSaved,
        monthsSaved,
      });
    }
  }, [extraMonthly, lumpSum, baseline, simulated, interestSaved, monthsSaved, onSimulationChange]);

  const timeSavedFormatted = useMemo(() => {
    if (monthsSaved <= 0) {
      return '0 months (0.0 years)';
    }
    const years = (monthsSaved / 12).toFixed(1);
    const wholeYears = Math.floor(monthsSaved / 12);
    const remMonths = monthsSaved % 12;

    const readable =
      wholeYears > 0
        ? `${wholeYears} yr${wholeYears > 1 ? 's' : ''}${remMonths > 0 ? ` ${remMonths} mo` : ''}`
        : `${monthsSaved} mos`;

    return `${monthsSaved} months (${years} years / ${readable})`;
  }, [monthsSaved]);

  const baselinePayoffFormatted = useMemo(() => {
    try {
      return formatDisplayMonth(baseline.payoffDate);
    } catch {
      return baseline.payoffDate;
    }
  }, [baseline.payoffDate]);

  const simulatedPayoffFormatted = useMemo(() => {
    try {
      return formatDisplayMonth(simulated.payoffDate);
    } catch {
      return simulated.payoffDate;
    }
  }, [simulated.payoffDate]);

  const hasPrepayment = extraMonthly > 0 || lumpSum > 0;

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm ${className}`}
    >
      {/* Title */}
      <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Prepayment Simulator
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Accelerate debt freedom by simulating extra monthly payments or one-time lump-sum capital reduction.
            </p>
          </div>
        </div>

        {hasPrepayment && (
          <button
            type="button"
            onClick={() => {
              handleExtraMonthlyChange(0);
              handleLumpSumChange(0);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Simulator Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Extra Monthly Payment Slider & Input */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label
              htmlFor="extra-monthly-slider"
              className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Extra Monthly Payment
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">+S$</span>
              <input
                id="extra-monthly-input"
                data-testid="extra-monthly-input"
                type="number"
                min="0"
                max="10000"
                step="50"
                value={extraMonthly}
                onChange={(e) => handleExtraMonthlyChange(parseFloat(e.target.value) || 0)}
                className="w-24 px-2 py-1 text-right text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-400">/mo</span>
            </div>
          </div>

          {/* Slider */}
          <input
            id="extra-monthly-slider"
            aria-label="Extra Monthly Payment"
            type="range"
            min="0"
            max="3000"
            step="50"
            value={extraMonthly}
            onChange={(e) => handleExtraMonthlyChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-hidden"
          />

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Quick Add:</span>
            {PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleExtraMonthlyChange(amount)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                  extraMonthly === amount
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                }`}
              >
                +S${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Lump-Sum Upfront Prepayment Input */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label
              htmlFor="lump-sum-input"
              className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1"
            >
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>One-Time Lump Sum Prepayment</span>
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">S$</span>
              <input
                id="lump-sum-input"
                data-testid="lump-sum-input"
                type="number"
                min="0"
                max={basePrincipal}
                step="1000"
                value={lumpSum}
                onChange={(e) => handleLumpSumChange(parseFloat(e.target.value) || 0)}
                className="w-28 px-2 py-1 text-right text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Apply year-end bonuses or cash windfalls directly to reduce principal upfront.
          </p>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[5000, 10000, 20000, 50000].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleLumpSumChange(amount)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                  lumpSum === amount
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                }`}
              >
                +S${amount >= 1000 ? `${amount / 1000}k` : amount}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Simulator Results Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Interest Saved */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200/70 dark:border-emerald-800/60 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Interest Saved
            </span>
            <div className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            data-testid="interest-saved"
            className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight"
          >
            {formatSGD(interestSaved)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            {hasPrepayment ? 'Immediate guaranteed interest savings' : 'Simulate prepayment to save on interest'}
          </div>
        </div>

        {/* Time Saved */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/70 dark:border-blue-800/60 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">
              Time Shaved Off
            </span>
            <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            data-testid="time-saved"
            className="text-2xl font-black text-blue-700 dark:text-blue-300 tracking-tight"
          >
            {monthsSaved > 0 ? `${monthsSaved} mos` : '0 mos'}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium truncate">
            {timeSavedFormatted}
          </div>
        </div>

        {/* New Debt-Free Date */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 border border-purple-200/70 dark:border-purple-800/60 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-800 dark:text-purple-300">
              New Debt-Free Date
            </span>
            <div className="p-1 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            data-testid="new-debt-free-date"
            className="text-2xl font-black text-purple-700 dark:text-purple-300 tracking-tight"
          >
            {simulatedPayoffFormatted}
          </div>
          <div className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
            Baseline: {baselinePayoffFormatted}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrepaymentSimulator;
