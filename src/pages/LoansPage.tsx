/**
 * LoansPage Component
 * Integrated Loans & Debt Freedom Engine:
 * - Fetches loans from financeService.getLoans()
 * - Loan selector tabs (defaulting to HDB Loan)
 * - LoanSummaryCard
 * - PrepaymentSimulator
 * - AmortizationChart
 * - AmortizationTable
 * - Supports household & individual perspective view
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CreditCard,
  Loader2,
  User,
  Users,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { financeService } from '../services/financeService';
import { calculateLoanAmortization } from '../lib/financialFormulas';
import { LoanSummaryCard } from '../components/loans/LoanSummaryCard';
import { PrepaymentSimulator } from '../components/loans/PrepaymentSimulator';
import { AmortizationChart } from '../components/loans/AmortizationChart';
import { AmortizationTable } from '../components/loans/AmortizationTable';
import type { Loan, AmortizationResult } from '../types/finance';

export interface LoansPageProps {
  className?: string;
}

export function LoansPage({ className = '' }: LoansPageProps) {
  const { perspective, activeMember } = useHousehold();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Prepayment simulation state
  const [extraMonthly, setExtraMonthly] = useState<number>(0);
  const [lumpSum, setLumpSum] = useState<number>(0);
  const [scheduleView, setScheduleView] = useState<'simulated' | 'baseline'>('simulated');

  // Load loans
  const loadLoans = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await financeService.getLoans();
      setLoans(data || []);

      if (data && data.length > 0) {
        // Default to HDB loan or the first loan
        const hdb = data.find((l) => l.name.toLowerCase().includes('hdb'));
        setSelectedLoanId(hdb ? hdb.id : data[0].id);
      } else {
        setSelectedLoanId(null);
      }
    } catch (err) {
      console.error('Failed to load loans:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  // Filter loans according to perspective if relevant
  const displayedLoans = useMemo(() => {
    return loans.filter((l) => {
      if (perspective === 'household') return true;
      // Joint loans or loans assigned to active member
      return !l.borrower_id || l.borrower_id === activeMember?.id;
    });
  }, [loans, perspective, activeMember]);

  // Selected loan object
  const activeLoan = useMemo(() => {
    if (!selectedLoanId) {
      return displayedLoans[0] || null;
    }
    return displayedLoans.find((l) => l.id === selectedLoanId) || displayedLoans[0] || null;
  }, [displayedLoans, selectedLoanId]);

  // Reset simulator when active loan changes
  const handleSelectLoan = (loanId: string) => {
    setSelectedLoanId(loanId);
    setExtraMonthly(0);
    setLumpSum(0);
  };

  // Base Principal for amortization
  const basePrincipal = useMemo(() => {
    if (!activeLoan) return 0;
    const remaining = activeLoan.principal - (activeLoan.amount_paid || 0);
    return remaining > 0 ? remaining : activeLoan.principal;
  }, [activeLoan]);

  // Baseline Amortization
  const baselineAmortization = useMemo<AmortizationResult>(() => {
    if (!activeLoan || basePrincipal <= 0) {
      return {
        schedule: [],
        totalMonths: 0,
        totalInterest: 0,
        payoffDate: activeLoan?.start_date || '',
        monthlyPayment: activeLoan?.monthly_payment || 0,
      };
    }

    try {
      return calculateLoanAmortization(
        basePrincipal,
        activeLoan.interest_rate,
        activeLoan.monthly_payment,
        activeLoan.start_date,
        0
      );
    } catch {
      return {
        schedule: [],
        totalMonths: activeLoan.term_months,
        totalInterest: 0,
        payoffDate: activeLoan.start_date,
        monthlyPayment: activeLoan.monthly_payment,
      };
    }
  }, [activeLoan, basePrincipal]);

  // Simulated Amortization
  const simulatedAmortization = useMemo<AmortizationResult>(() => {
    if (!activeLoan) return baselineAmortization;
    const effectivePrincipal = Math.max(0, basePrincipal - lumpSum);
    if (effectivePrincipal <= 0) {
      return {
        schedule: [],
        totalMonths: 0,
        totalInterest: 0,
        payoffDate: activeLoan.start_date,
        monthlyPayment: 0,
      };
    }

    try {
      return calculateLoanAmortization(
        effectivePrincipal,
        activeLoan.interest_rate,
        activeLoan.monthly_payment,
        activeLoan.start_date,
        extraMonthly
      );
    } catch {
      return baselineAmortization;
    }
  }, [activeLoan, basePrincipal, lumpSum, extraMonthly, baselineAmortization]);

  const hasPrepayment = extraMonthly > 0 || lumpSum > 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading loan amortization details...
        </p>
      </div>
    );
  }

  if (!activeLoan || displayedLoans.length === 0) {
    return (
      <div className={`p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 ${className}`}>
        <CreditCard className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          No active loans found
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          There are currently no active mortgage or debt obligations registered for this perspective.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Loans &amp; Debt Freedom
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              {perspective === 'household' ? (
                <Users className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
              <span>
                {perspective === 'household'
                  ? 'Combined Household'
                  : activeMember?.display_name || perspective}
              </span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track mortgage amortization schedules, simulate early prepayment strategies, and plan your path to zero debt.
          </p>
        </div>

        {/* Loan Selector Tabs */}
        {displayedLoans.length > 1 && (
          <div
            role="tablist"
            className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto self-start sm:self-auto"
          >
            {displayedLoans.map((loan) => {
              const isActive = (activeLoan?.id || selectedLoanId) === loan.id;
              return (
                <button
                  key={loan.id}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => handleSelectLoan(loan.id)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {loan.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 1. Loan Overview Card */}
      <LoanSummaryCard
        loan={activeLoan}
        baselineAmortization={baselineAmortization}
      />

      {/* 2. Interactive Prepayment Simulator */}
      <PrepaymentSimulator
        loan={activeLoan}
        extraMonthly={extraMonthly}
        lumpSum={lumpSum}
        onChangeExtraMonthly={setExtraMonthly}
        onChangeLumpSum={setLumpSum}
      />

      {/* 3. Amortization Trajectory Chart */}
      <AmortizationChart
        baselineSchedule={baselineAmortization.schedule}
        simulatedSchedule={simulatedAmortization.schedule}
        hasPrepayment={hasPrepayment}
      />

      {/* 4. Detailed Schedule Table with View Mode Switcher */}
      <div className="space-y-3">
        {hasPrepayment && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Showing Schedule:
            </span>
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setScheduleView('simulated')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  scheduleView === 'simulated'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Accelerated (+Prepayment)
              </button>
              <button
                type="button"
                onClick={() => setScheduleView('baseline')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  scheduleView === 'baseline'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Baseline Standard
              </button>
            </div>
          </div>
        )}

        <AmortizationTable
          schedule={
            scheduleView === 'simulated' && hasPrepayment
              ? simulatedAmortization.schedule
              : baselineAmortization.schedule
          }
          initialExpandedYears={[1]}
        />
      </div>
    </div>
  );
}

export default LoansPage;
