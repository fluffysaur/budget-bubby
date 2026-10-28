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

import { useState, useMemo, useEffect } from 'react';
import {
  CreditCard,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, LoadingCard, EmptyStateCard } from '../components/ui';
import { useLoansQuery } from '../hooks/useFinanceQueries';
import { calculateLoanAmortization } from '../lib/financialFormulas';
import { LoanSummaryCard } from '../components/loans/LoanSummaryCard';
import { PrepaymentSimulator } from '../components/loans/PrepaymentSimulator';
import { AmortizationChart } from '../components/loans/AmortizationChart';
import { AmortizationTable } from '../components/loans/AmortizationTable';
import type { AmortizationResult } from '../types/finance';

export interface LoansPageProps {
  className?: string;
  embedded?: boolean;
}

export function LoansPage({ className = '', embedded = false }: LoansPageProps) {
  const { perspective, activeMember } = useHousehold();

  // Cached Loans Query
  const { data: loansData, isLoading: loansLoading } = useLoansQuery();
  const loans = useMemo(() => loansData || [], [loansData]);
  const isLoading = loansLoading && !loansData;

  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  // Prepayment simulation state
  const [extraMonthly, setExtraMonthly] = useState<number>(0);
  const [lumpSum, setLumpSum] = useState<number>(0);
  const [scheduleView, setScheduleView] = useState<'simulated' | 'baseline'>('simulated');

  // Initialize selected loan once loans arrive
  useEffect(() => {
    if (loans.length > 0 && !selectedLoanId) {
      const hdb = loans.find((l) => l.name.toLowerCase().includes('hdb'));
      setSelectedLoanId(hdb ? hdb.id : loans[0].id);
    }
  }, [loans, selectedLoanId]);

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

  useEffect(() => {
    setExtraMonthly(0);
    setLumpSum(0);
  }, [activeLoan?.id]);

  // Base Principal for amortization (remaining balance)
  const basePrincipal = useMemo(() => {
    if (!activeLoan) return 0;
    return Math.max(0, activeLoan.principal - (activeLoan.amount_paid || 0));
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
      <LoadingCard
        message="Loading loan amortization details..."
        className={`my-8 ${className}`}
      />
    );
  }

  if (!activeLoan || displayedLoans.length === 0) {
    return (
      <EmptyStateCard
        icon={<CreditCard className="w-6 h-6" />}
        title="No active loans found"
        description="There are currently no active mortgage or debt obligations registered for this perspective."
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      {/* Page Header (Hidden if embedded in Plan Hub) */}
      {!embedded && (
        <PageHeader
          title="Loans & Debt Freedom"
          actions={
            displayedLoans.length > 1 ? (
              <div
                role="tablist"
                className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto self-start sm:self-auto"
              >
                {displayedLoans.map((loan) => {
                  const isActive = (activeLoan?.id || selectedLoanId) === loan.id;
                  return (
                    <button
                      key={loan.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleSelectLoan(loan.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
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
            ) : undefined
          }
        />
      )}

      {/* Embedded loan selector */}
      {embedded && displayedLoans.length > 1 && (
        <div
          role="tablist"
          className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto self-start"
        >
          {displayedLoans.map((loan) => {
            const isActive = (activeLoan?.id || selectedLoanId) === loan.id;
            return (
              <button
                key={loan.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelectLoan(loan.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
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
