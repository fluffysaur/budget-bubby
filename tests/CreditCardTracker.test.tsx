/**
 * Credit Card Tracker: Statements, Due Dates & Card Management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditCardTrackerSection, getRelativeDueLabel } from '../src/components/accounts/CreditCardTrackerSection';
import { AddEditCreditCardModal } from '../src/components/accounts/AddEditCreditCardModal';
import { financeService } from '../src/services/financeService';
import { mockFinanceService } from '../src/services/mockFinanceService';
import { formatSGD } from '../src/lib/currency';
import type { HouseholdMember } from '../src/types/finance';

const testMembers: HouseholdMember[] = [
  {
    id: 'mem-00000000-0011',
    household_id: 'hh-00000000-0001',
    display_name: 'Yi Jia',
    role: 'owner',
  },
  {
    id: 'mem-00000000-0012',
    household_id: 'hh-00000000-0001',
    display_name: 'Rachel',
    role: 'member',
  },
];

describe('Credit Card Statements & Due Date Tracker', () => {
  beforeEach(() => {
    mockFinanceService.resetData();
  });

  describe('getRelativeDueLabel Helper', () => {
    it('returns Paid label when statement is paid', () => {
      const result = getRelativeDueLabel('2026-11-05', true, '2026-10-25T10:00:00.000Z');
      expect(result.label).toContain('Paid on');
      expect(result.isOverdue).toBe(false);
    });

    it('returns Due in X days when due date is in the future', () => {
      // Future date relative to today
      const futureDate = '2099-12-31';
      const result = getRelativeDueLabel(futureDate, false);
      expect(result.label).toMatch(/Due in \d+ days/i);
      expect(result.isOverdue).toBe(false);
    });

    it('returns Overdue by X days when due date is in the past', () => {
      const pastDate = '2020-01-01';
      const result = getRelativeDueLabel(pastDate, false);
      expect(result.label).toMatch(/Overdue by \d+ days/i);
      expect(result.isOverdue).toBe(true);
    });
  });

  describe('CreditCardTrackerSection Component', () => {
    it('renders configured cards and monthly summary statistics for 2026-10', async () => {
      render(
        <CreditCardTrackerSection
          members={testMembers}
          perspective="household"
        />
      );

      // Wait for cards to load
      await waitFor(() => {
        expect(screen.getByText('DBS Altitude Visa')).toBeInTheDocument();
        expect(screen.getByText('UOB One Card')).toBeInTheDocument();
        expect(screen.getByText('OCBC 365 Dining & Groceries')).toBeInTheDocument();
      });

      // Card last 4 and bank details
      expect(screen.getByText(/4128/)).toBeInTheDocument();
      expect(screen.getByText(/8832/)).toBeInTheDocument();

      // Summary cards
      expect(screen.getByText('Total CC Bill Due this Month')).toBeInTheDocument();
      expect(screen.getByText('Total Paid')).toBeInTheDocument();
      expect(screen.getByText('Total Unpaid')).toBeInTheDocument();

      // In mock seed data for 2026-10:
      // DBS: 842.50 (unpaid)
      // UOB: 620.00 (paid)
      // OCBC: 350.20 (unpaid)
      // Total due = 842.50 + 620.00 + 350.20 = 1812.70
      // Total paid = 620.00
      // Total unpaid = 842.50 + 350.20 = 1192.70
      expect(screen.getByText(formatSGD(1812.70))).toBeInTheDocument();
      expect(screen.getAllByText(formatSGD(620.00)).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(formatSGD(1192.70))).toBeInTheDocument();
    });

    it('toggles statement 1-tap paid / unpaid status with timestamp', async () => {
      render(
        <CreditCardTrackerSection
          members={testMembers}
          perspective="household"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('DBS Altitude Visa')).toBeInTheDocument();
      });

      // DBS Altitude Visa is initially unpaid: find Mark as Paid button
      const dbsMarkPaidBtn = screen.getByRole('button', { name: /Mark DBS Altitude Visa statement as Paid/i });
      expect(dbsMarkPaidBtn).toBeInTheDocument();

      // Tap Mark as Paid
      fireEvent.click(dbsMarkPaidBtn);

      // Verify it toggles to Paid
      await waitFor(() => {
        const dbsUnpaidBtn = screen.getByRole('button', { name: /Mark DBS Altitude Visa statement as Unpaid/i });
        expect(dbsUnpaidBtn).toBeInTheDocument();
      });

      // Check updated Total Paid summary: 620.00 + 842.50 = 1462.50
      await waitFor(() => {
        expect(screen.getByText(formatSGD(1462.50))).toBeInTheDocument();
      });
    });

    it('allows logging a new statement balance for a card without one in the month', async () => {
      // Change month to 2026-12 (which has no statements in mock seed)
      render(
        <CreditCardTrackerSection
          members={testMembers}
          perspective="household"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('DBS Altitude Visa')).toBeInTheDocument();
      });

      // Navigate to next month
      const nextMonthBtn = screen.getByRole('button', { name: 'Next Month' });
      fireEvent.click(nextMonthBtn);

      await waitFor(() => {
        expect(screen.getByText(/November 2026/i)).toBeInTheDocument();
      });

      // Click "Log Statement" for DBS Altitude Visa
      const logStmtBtns = screen.getAllByRole('button', { name: /Log statement for/i });
      expect(logStmtBtns.length).toBeGreaterThan(0);
      fireEvent.click(logStmtBtns[0]);

      // Fill in amount
      const amountInput = screen.getByLabelText(/Statement Balance/i);
      fireEvent.change(amountInput, { target: { value: '450.75' } });

      // Save Statement
      const saveBtn = screen.getByRole('button', { name: 'Save Statement' });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getAllByText(formatSGD(450.75)).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('AddEditCreditCardModal Component', () => {
    it('creates a new credit card and saves to financeService', async () => {
      const onCardSaved = vi.fn();
      const onClose = vi.fn();

      render(
        <AddEditCreditCardModal
          isOpen={true}
          onClose={onClose}
          members={testMembers}
          onCardSaved={onCardSaved}
        />
      );

      fireEvent.change(screen.getByLabelText(/Card Name \*/i), {
        target: { value: 'HSBC Revolution' },
      });
      fireEvent.change(screen.getByLabelText(/Last 4 Digits/i), {
        target: { value: '5566' },
      });
      fireEvent.change(screen.getByLabelText(/Credit Limit/i), {
        target: { value: '8000' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Add Credit Card' }));

      await waitFor(() => {
        expect(onCardSaved).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });

      const cards = await financeService.getCreditCards();
      const hsbc = cards.find((c) => c.name === 'HSBC Revolution');
      expect(hsbc).toBeDefined();
      expect(hsbc?.last4).toBe('5566');
      expect(hsbc?.credit_limit).toBe(8000);
    });
  });
});

