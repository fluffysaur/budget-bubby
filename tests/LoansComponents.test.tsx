/**
 * Comprehensive Unit & Integration Tests for Task 9:
 * Loans & Debt Freedom Engine (Amortization & Prepayment Simulator)
 * - LoanSummaryCard
 * - PrepaymentSimulator
 * - AmortizationChart
 * - AmortizationTable
 * - LoansPage
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { LoanSummaryCard } from '../src/components/loans/LoanSummaryCard';
import { PrepaymentSimulator } from '../src/components/loans/PrepaymentSimulator';
import { AmortizationChart } from '../src/components/loans/AmortizationChart';
import { AmortizationTable } from '../src/components/loans/AmortizationTable';
import { LoansPage } from '../src/pages/LoansPage';
import { financeService } from '../src/services/financeService';
import { calculateLoanAmortization } from '../src/lib/financialFormulas';
import type { Loan } from '../src/types/finance';

// Mock ResizeObserver for jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

// Mock ResponsiveContainer for Recharts so children render inside jsdom
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 400 }}>
        {children}
      </div>
    ),
  };
});

const sampleHDBLoan: Loan = {
  id: 'loan-hdb-01',
  household_id: 'hh-01',
  borrower_id: null,
  name: 'HDB Loan',
  principal: 500000.0,
  interest_rate: 0.026,
  monthly_payment: 2665.0,
  amount_paid: 50000.0,
  start_date: '2026-09-01',
  term_months: 242,
  loan_type: 'amortized',
  status: 'active',
  created_at: '2026-09-01T00:00:00.000Z',
};

const sampleCarLoan: Loan = {
  id: 'loan-car-02',
  household_id: 'hh-01',
  borrower_id: 'mem-01',
  name: 'Car Loan',
  principal: 60000.0,
  interest_rate: 0.0278,
  monthly_payment: 850.0,
  amount_paid: 10000.0,
  start_date: '2026-01-01',
  term_months: 84,
  loan_type: 'car',
  status: 'active',
};

describe('Task 9: Loans & Debt Freedom Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('LoanSummaryCard', () => {
    it('renders loan name, principal, remaining balance, and interest rate', () => {
      render(<LoanSummaryCard loan={sampleHDBLoan} />);

      expect(screen.getByText('HDB Loan')).toBeInTheDocument();
      // Principal: S$500,000.00
      expect(screen.getByText(/S\$500,000\.00/)).toBeInTheDocument();
      // Remaining Balance: 500k - 50k = S$450,000.00
      expect(screen.getByText(/S\$450,000\.00/)).toBeInTheDocument();
      // Interest rate: 2.60%
      expect(screen.getByText(/2\.60%/)).toBeInTheDocument();
      // Monthly payment: S$2,665.00
      expect(screen.getByText(/S\$2,665\.00/)).toBeInTheDocument();
    });

    it('displays payoff progress bar showing paid vs remaining', () => {
      render(<LoanSummaryCard loan={sampleHDBLoan} />);

      // Paid: 50,000 / 500,000 = 10.0%
      expect(screen.getByText(/10\.0%/)).toBeInTheDocument();
      // Amount paid text
      expect(screen.getByText(/S\$50,000\.00/)).toBeInTheDocument();
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '10');
    });

    it('calculates total interest remaining and payoff countdown', () => {
      render(<LoanSummaryCard loan={sampleHDBLoan} />);

      // Checks for remaining interest and payoff countdown
      expect(screen.getByTestId('total-interest-remaining')).toBeInTheDocument();
      expect(screen.getByTestId('payoff-countdown')).toBeInTheDocument();
    });

    it('handles a loan with 0 amount paid cleanly', () => {
      const freshLoan = { ...sampleHDBLoan, amount_paid: 0 };
      render(<LoanSummaryCard loan={freshLoan} />);

      expect(screen.getByText(/\(0\.0%\)/)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    });
  });

  describe('PrepaymentSimulator', () => {
    it('renders baseline state with 0 extra prepayment', () => {
      render(<PrepaymentSimulator loan={sampleHDBLoan} />);

      expect(screen.getByText(/Prepayment Simulator/i)).toBeInTheDocument();
      // Extra monthly input exists
      const slider = screen.getByLabelText(/Extra Monthly Payment/i);
      expect(slider).toBeInTheDocument();
      expect((slider as HTMLInputElement).value).toBe('0');
      // Interest saved starts at S$0.00
      expect(screen.getByTestId('interest-saved')).toHaveTextContent(/S\$0\.00/);
    });

    it('calculates interest saved and time saved when extra monthly prepayment is increased', () => {
      const onSimChange = vi.fn();
      render(<PrepaymentSimulator loan={sampleHDBLoan} onSimulationChange={onSimChange} />);

      const numberInput = screen.getByTestId('extra-monthly-input');
      fireEvent.change(numberInput, { target: { value: '500' } });

      // Should show positive interest saved and time saved
      const interestSavedEl = screen.getByTestId('interest-saved');
      expect(interestSavedEl.textContent).not.toBe('S$0.00');
      expect(screen.getByTestId('time-saved')).toBeInTheDocument();
      expect(screen.getByTestId('new-debt-free-date')).toBeInTheDocument();

      expect(onSimChange).toHaveBeenCalled();
      const latestCall = onSimChange.mock.calls[onSimChange.mock.calls.length - 1][0];
      expect(latestCall.extraMonthly).toBe(500);
      expect(latestCall.interestSaved).toBeGreaterThan(0);
      expect(latestCall.monthsSaved).toBeGreaterThan(0);
    });

    it('quick preset buttons update prepayment amount', () => {
      render(<PrepaymentSimulator loan={sampleHDBLoan} />);

      const preset500 = screen.getByRole('button', { name: /\+S\$500/i });
      fireEvent.click(preset500);

      const numberInput = screen.getByTestId('extra-monthly-input') as HTMLInputElement;
      expect(numberInput.value).toBe('500');

      const resetBtn = screen.getByRole('button', { name: /reset/i });
      fireEvent.click(resetBtn);
      expect((screen.getByTestId('extra-monthly-input') as HTMLInputElement).value).toBe('0');
    });

    it('simulates lump-sum prepayment in addition to monthly prepayment', () => {
      render(<PrepaymentSimulator loan={sampleHDBLoan} />);

      const lumpSumInput = screen.getByTestId('lump-sum-input');
      fireEvent.change(lumpSumInput, { target: { value: '20000' } });

      const interestSavedEl = screen.getByTestId('interest-saved');
      expect(interestSavedEl.textContent).not.toBe('S$0.00');
    });
  });

  describe('AmortizationChart', () => {
    it('renders chart with baseline schedule data', () => {
      const baseline = calculateLoanAmortization(500000, 0.026, 2665, '2026-09-01');
      render(<AmortizationChart baselineSchedule={baseline.schedule} />);

      expect(screen.getByTestId('amortization-chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('allows toggling between balance trajectory and principal vs interest views', () => {
      const baseline = calculateLoanAmortization(500000, 0.026, 2665, '2026-09-01');
      const simulated = calculateLoanAmortization(500000, 0.026, 2665, '2026-09-01', 500);
      render(
        <AmortizationChart
          baselineSchedule={baseline.schedule}
          simulatedSchedule={simulated.schedule}
          hasPrepayment={true}
        />
      );

      // Trajectory view is active by default
      expect(screen.getByRole('button', { name: /Balance Trajectory/i })).toBeInTheDocument();
      const breakdownBtn = screen.getByRole('button', { name: /Principal vs Interest/i });
      expect(breakdownBtn).toBeInTheDocument();

      fireEvent.click(breakdownBtn);
      expect(screen.getByTestId('amortization-chart')).toBeInTheDocument();
    });
  });

  describe('AmortizationTable', () => {
    it('groups rows by annual rollups and renders collapsible accordions', () => {
      const result = calculateLoanAmortization(50000, 0.026, 2000, '2026-01-01');
      render(<AmortizationTable schedule={result.schedule} />);

      expect(screen.getByText(/Amortization Schedule/i)).toBeInTheDocument();
      // Year 1 accordion exists
      expect(screen.getByText(/Year 1/i)).toBeInTheDocument();

      // Expand all / Collapse all button
      const toggleAllBtn = screen.getByRole('button', { name: /Expand All|Collapse All/i });
      expect(toggleAllBtn).toBeInTheDocument();
    });

    it('expands accordion to reveal month-by-month details with starting balance, payment, principal, interest, ending balance', () => {
      const result = calculateLoanAmortization(50000, 0.026, 2000, '2026-01-01');
      render(<AmortizationTable schedule={result.schedule} initialExpandedYears={[1]} />);

      // Look for table column headers
      expect(screen.getByRole('columnheader', { name: /Starting Balance/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /^Principal$/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /^Interest$/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Ending Balance/i })).toBeInTheDocument();

      // Collapse Year 1
      const year1Header = screen.getByRole('button', { name: /Year 1/i });
      fireEvent.click(year1Header);

      // Expand Year 1 again
      fireEvent.click(year1Header);
      expect(screen.getByRole('columnheader', { name: /Starting Balance/i })).toBeInTheDocument();
    });

    it('expands and collapses all years with Expand/Collapse All toggle', () => {
      const result = calculateLoanAmortization(50000, 0.026, 2000, '2026-01-01');
      render(<AmortizationTable schedule={result.schedule} initialExpandedYears={[]} />);

      const toggleAllBtn = screen.getByRole('button', { name: /Expand All/i });
      fireEvent.click(toggleAllBtn);
      expect(screen.getByRole('button', { name: /Collapse All/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Collapse All/i }));
      expect(screen.getByRole('button', { name: /Expand All/i })).toBeInTheDocument();
    });
  });

  describe('LoansPage', () => {
    it('loads loans, displays active loan summary, simulator, chart, and schedule table', async () => {
      vi.spyOn(financeService, 'getLoans').mockResolvedValue([sampleHDBLoan, sampleCarLoan]);

      render(
        <HouseholdProvider>
          <LoansPage />
        </HouseholdProvider>
      );

      // Loading state disappears
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'HDB Loan' })).toBeInTheDocument();
      });

      // Default active loan is HDB Loan
      expect(screen.getByRole('tab', { name: /HDB Loan/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Car Loan/i })).toBeInTheDocument();

      // Components present
      expect(screen.getByText(/Prepayment Simulator/i)).toBeInTheDocument();
      expect(screen.getByTestId('amortization-chart')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Amortization Schedule/i })).toBeInTheDocument();
    });

    it('switching active loan tab updates the displayed loan details', async () => {
      vi.spyOn(financeService, 'getLoans').mockResolvedValue([sampleHDBLoan, sampleCarLoan]);

      render(
        <HouseholdProvider>
          <LoansPage />
        </HouseholdProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Car Loan/i })).toBeInTheDocument();
      });

      // Click on Car Loan tab
      fireEvent.click(screen.getByRole('tab', { name: /Car Loan/i }));

      // Car loan principal S$60,000.00 should now be rendered in the summary card
      await waitFor(() => {
        expect(screen.getByText(/S\$60,000\.00/)).toBeInTheDocument();
      });
    });

    it('adjusting extra prepayment on LoansPage updates the simulation metrics', async () => {
      vi.spyOn(financeService, 'getLoans').mockResolvedValue([sampleHDBLoan]);

      render(
        <HouseholdProvider>
          <LoansPage />
        </HouseholdProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('extra-monthly-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('extra-monthly-input');
      fireEvent.change(input, { target: { value: '500' } });

      const interestSaved = screen.getByTestId('interest-saved');
      expect(interestSaved.textContent).not.toBe('S$0.00');
    });

    it('handles empty loans state gracefully', async () => {
      vi.spyOn(financeService, 'getLoans').mockResolvedValue([]);

      render(
        <HouseholdProvider>
          <LoansPage />
        </HouseholdProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/No active loans found/i)).toBeInTheDocument();
      });
    });
  });
});
