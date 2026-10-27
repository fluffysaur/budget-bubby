/**
 * LoanSummaryCard Component
 * Overview card displaying:
 * - Loan name, status, and type badge
 * - Principal & Remaining Balance
 * - Interest Rate & Monthly Payment
 * - Total Interest Remaining & Payoff Countdown
 * - Visual payoff progress bar (Paid vs Remaining)
 */

import { useMemo } from 'react';
import {
  Landmark,
  Percent,
  Calendar,
  Clock,
  TrendingDown,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { formatDisplayDate, formatDisplayMonth } from '../../lib/dateUtils';
import { calculateLoanAmortization } from '../../lib/financialFormulas';
import type { Loan, AmortizationResult } from '../../types/finance';

export interface LoanSummaryCardProps {
  loan: Loan;
  baselineAmortization?: AmortizationResult;
  className?: string;
}

export function LoanSummaryCard({
  loan,
  baselineAmortization,
  className = '',
}: LoanSummaryCardProps) {
  const remainingBalance = Math.max(0, loan.principal - (loan.amount_paid || 0));
  const amountPaid = Math.max(0, loan.amount_paid || 0);

  const percentPaid = useMemo(() => {
    if (loan.principal <= 0) return 0;
    const pct = (amountPaid / loan.principal) * 100;
    return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
  }, [amountPaid, loan.principal]);

  const percentRemaining = Math.max(0, Math.round((100 - percentPaid) * 10) / 10);

  // Calculate amortization metrics for remaining balance if not supplied
  const amortization = useMemo<AmortizationResult>(() => {
    if (baselineAmortization) {
      return baselineAmortization;
    }

    if (remainingBalance <= 0) {
      return {
        schedule: [],
        totalMonths: 0,
        totalInterest: 0,
        payoffDate: loan.start_date,
        monthlyPayment: loan.monthly_payment,
      };
    }

    try {
      return calculateLoanAmortization(
        remainingBalance,
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
  }, [baselineAmortization, remainingBalance, loan.interest_rate, loan.monthly_payment, loan.start_date, loan.term_months]);

  const countdownText = useMemo(() => {
    const totalMonths = amortization.totalMonths;
    if (totalMonths <= 0) return 'Fully Paid Off';
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} yr${years > 1 ? 's' : ''}`);
    if (months > 0 || years === 0) parts.push(`${months} mo${months !== 1 ? 's' : ''}`);
    return `${parts.join(' ')} (${totalMonths} mos)`;
  }, [amortization.totalMonths]);

  const formattedPayoffDate = useMemo(() => {
    if (!amortization.payoffDate) return '-';
    try {
      return formatDisplayMonth(amortization.payoffDate);
    } catch {
      return amortization.payoffDate;
    }
  }, [amortization.payoffDate]);

  return (
    <div
      className={`bg-(--bg-card) rounded-2xl border-[1.5px] border-(--border-ink) p-6 shadow-cute transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-(--border-subtle)">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl border border-(--border-ink) bg-(--pastel-lilac-light) text-(--text-ink) shadow-cute-sm">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-black text-xl text-(--text-ink)">
                {loan.name}
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-(--pastel-mint) text-(--text-ink) border border-(--border-ink) shadow-cute-sm">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {loan.status === 'active' ? 'Active' : 'Paid Off'}
              </span>
            </div>
            <p className="text-xs font-mono-num font-medium text-(--text-muted) mt-0.5">
              {loan.loan_type ? `${loan.loan_type.toUpperCase()} • ` : ''}
              Started {formatDisplayDate(loan.start_date)}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-xs font-bold text-(--text-muted) uppercase tracking-wider block">
            Remaining Balance
          </span>
          <span className="font-mono-num text-2xl font-black text-(--text-ink) tracking-tight">
            {formatSGD(remainingBalance)}
          </span>
        </div>
      </div>

      {/* Progress Bar Section */}
      <div className="py-5 border-b border-(--border-subtle)">
        <div className="flex items-center justify-between text-xs font-bold mb-2">
          <span className="text-(--text-muted)">
            Principal Paid:{' '}
            <span className="font-mono-num text-emerald-700 dark:text-emerald-400 font-black">
              {formatSGD(amountPaid)}
            </span>{' '}
            ({percentPaid.toFixed(1)}%)
          </span>
          <span className="text-(--text-muted) font-mono-num">
            Remaining: {percentRemaining.toFixed(1)}%
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={Math.round(percentPaid)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-3 bg-(--bg-canvas) border border-(--border-ink) rounded-full overflow-hidden p-0.5"
        >
          <div
            className="h-full bg-(--pastel-mint) rounded-full transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(100, percentPaid))}%` }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
        {/* Principal */}
        <div className="p-3.5 rounded-xl bg-(--bg-canvas) border border-(--border-ink) shadow-cute-sm">
          <div className="flex items-center gap-1.5 text-xs font-bold text-(--text-muted) mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Original Principal</span>
          </div>
          <div className="font-mono-num text-base font-black text-(--text-ink) truncate">
            {formatSGD(loan.principal)}
          </div>
        </div>

        {/* Interest Rate & Monthly Payment */}
        <div className="p-3.5 rounded-xl bg-(--bg-canvas) border border-(--border-ink) shadow-cute-sm">
          <div className="flex items-center gap-1.5 text-xs font-bold text-(--text-muted) mb-1">
            <Percent className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Interest Rate &amp; Payment</span>
          </div>
          <div className="font-mono-num text-base font-black text-(--text-ink) truncate">
            {(loan.interest_rate * 100).toFixed(2)}%
          </div>
          <div className="font-mono-num text-xs font-bold text-(--text-muted) mt-0.5">
            {formatSGD(loan.monthly_payment)}/mo
          </div>
        </div>

        {/* Total Interest Remaining */}
        <div
          data-testid="total-interest-remaining"
          className="p-3.5 rounded-xl bg-(--bg-canvas) border border-(--border-ink) shadow-cute-sm"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-(--text-muted) mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Total Interest Remaining</span>
          </div>
          <div className="font-mono-num text-base font-black text-amber-700 dark:text-amber-400 truncate">
            {formatSGD(amortization.totalInterest)}
          </div>
          <div className="text-[11px] font-medium text-(--text-muted) mt-0.5">
            Cost of remaining borrowing
          </div>
        </div>

        {/* Payoff Countdown */}
        <div
          data-testid="payoff-countdown"
          className="p-3.5 rounded-xl bg-(--bg-canvas) border border-(--border-ink) shadow-cute-sm"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-(--text-muted) mb-1">
            <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Payoff Countdown</span>
          </div>
          <div className="font-mono-num text-base font-black text-teal-700 dark:text-teal-400 truncate">
            {countdownText}
          </div>
          <div className="flex items-center gap-1 font-mono-num text-[11px] text-(--text-muted) mt-0.5">
            <Calendar className="w-3 h-3" />
            <span>Debt-Free: {formattedPayoffDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoanSummaryCard;
