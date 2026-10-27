/**
 * Epic 4 Integration Tests
 * Spend Tags, Big-Ticket Goals Sinking Fund & Credit Card Statements Tracker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CreditCardTrackerSection, getRelativeDueLabel } from '../src/components/accounts/CreditCardTrackerSection';
import { AddEditCreditCardModal } from '../src/components/accounts/AddEditCreditCardModal';
import { SpendTagsOverviewCard } from '../src/components/expenses/SpendTagsOverviewCard';
import { GoalCard } from '../src/components/goals/GoalCard';
import { SpendFromGoalModal } from '../src/components/goals/SpendFromGoalModal';
import { financeService } from '../src/services/financeService';
import { mockFinanceService } from '../src/services/mockFinanceService';
import { formatSGD } from '../src/lib/currency';
import type { Expense, SavingsGoal, HouseholdMember } from '../src/types/finance';

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

describe('Epic 4: Credit Card Statements & Due Date Tracker', () => {
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

describe('Epic 4: Spend Tags Overview Card', () => {
  const sampleExpenses: Expense[] = [
    {
      id: 'e1',
      household_id: 'hh-1',
      payer_id: 'mem-1',
      category_id: 'cat-food',
      date: '2026-10-01',
      item: 'Pho & Banh Mi',
      amount: 45.0,
      is_shared: true,
      split_ratio: 0.5,
      settled: true,
      tags: ['Vietnam Trip'],
    },
    {
      id: 'e2',
      household_id: 'hh-1',
      payer_id: 'mem-1',
      category_id: 'cat-transport',
      date: '2026-10-02',
      item: 'Grab from Da Nang Airport',
      amount: 25.0,
      is_shared: true,
      split_ratio: 0.5,
      settled: true,
      tags: ['Vietnam Trip'],
    },
    {
      id: 'e3',
      household_id: 'hh-1',
      payer_id: 'mem-2',
      category_id: 'cat-lifestyle',
      date: '2026-10-05',
      item: 'Kitchen Island Carpentry',
      amount: 1500.0,
      is_shared: true,
      split_ratio: 0.5,
      settled: true,
      tags: ['Home Reno'],
    },
    {
      id: 'e4',
      household_id: 'hh-1',
      payer_id: 'mem-1',
      category_id: 'cat-lifestyle',
      date: '2026-10-08',
      item: 'Wedding Bands Downpayment',
      amount: 2000.0,
      is_shared: true,
      split_ratio: 0.5,
      settled: true,
      tags: ['Wedding'],
      goal_id: 'goal-wedding',
    },
  ];

  it('aggregates total spend and transaction counts by tag across categories', () => {
    render(<SpendTagsOverviewCard expenses={sampleExpenses} />);

    // Header
    expect(screen.getByText('Spend Tags Overview')).toBeInTheDocument();
    expect(screen.getByText('3 tags')).toBeInTheDocument();

    // Vietnam Trip: 45.0 + 25.0 = 70.0 (2 txs)
    const vietnamCard = screen.getByTestId('tag-card-Vietnam Trip');
    expect(within(vietnamCard).getByText('Vietnam Trip')).toBeInTheDocument();
    expect(within(vietnamCard).getAllByText(formatSGD(70.0)).length).toBeGreaterThan(0);
    expect(within(vietnamCard).getByText('2 txs')).toBeInTheDocument();

    // Home Reno: 1500.0 (1 tx)
    const renoCard = screen.getByTestId('tag-card-Home Reno');
    expect(within(renoCard).getByText('Home Reno')).toBeInTheDocument();
    expect(within(renoCard).getAllByText(formatSGD(1500.0)).length).toBeGreaterThan(0);

    // Wedding: 2000.0 (1 tx)
    const weddingCard = screen.getByTestId('tag-card-Wedding');
    expect(within(weddingCard).getByText('Wedding')).toBeInTheDocument();
    expect(within(weddingCard).getAllByText(formatSGD(2000.0)).length).toBeGreaterThan(0);
  });

  it('triggers onSelectTag when a tag filter button is clicked', () => {
    const onSelectTag = vi.fn();
    render(<SpendTagsOverviewCard expenses={sampleExpenses} onSelectTag={onSelectTag} />);

    const filterVietnamBtn = screen.getByRole('button', { name: 'Filter by Vietnam Trip' });
    fireEvent.click(filterVietnamBtn);

    expect(onSelectTag).toHaveBeenCalledWith('Vietnam Trip');
  });

  it('displays active filter state and clear button when activeTag is supplied', () => {
    const onClearTag = vi.fn();
    render(
      <SpendTagsOverviewCard
        expenses={sampleExpenses}
        activeTag="Vietnam Trip"
        onClearTag={onClearTag}
      />
    );

    expect(screen.getByText('Filtering by #Vietnam Trip')).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: 'Clear tag filter' });
    fireEvent.click(clearBtn);

    expect(onClearTag).toHaveBeenCalled();
  });
});

describe('Epic 4: Big-Ticket Goals Sinking Fund & Drawdown', () => {
  beforeEach(() => {
    mockFinanceService.resetData();
  });

  const weddingGoal: SavingsGoal = {
    id: 'goal-00000000-0501',
    household_id: 'hh-00000000-0001',
    title: 'Wedding',
    target_amount: 55000.0,
    saved_so_far: 50000.0,
    target_date: '2027-05-01',
    monthly_contribution: 0,
    emoji: '💍',
    status: 'achieved',
  };

  const weddingLinkedExpenses: Expense[] = [
    {
      id: 'exp-w1',
      household_id: 'hh-00000000-0001',
      payer_id: 'mem-00000000-0011',
      category_id: 'cat-00000000-0102',
      date: '2026-10-15',
      item: 'Grand Ballroom Deposit',
      amount: 5000.0,
      is_shared: true,
      split_ratio: 0.5,
      settled: true,
      goal_id: 'goal-00000000-0501',
      tags: ['Wedding'],
    },
  ];

  it('GoalCard displays Target Amount, Total Saved, Goal-Funded Spend, and Remaining Balance', () => {
    render(
      <GoalCard
        goal={weddingGoal}
        linkedExpenses={weddingLinkedExpenses}
      />
    );

    // 4 Sinking Fund Metric labels
    expect(screen.getByText('Target Amount')).toBeInTheDocument();
    expect(screen.getByText('Total Saved')).toBeInTheDocument();
    expect(screen.getByText('Goal-Funded Spend')).toBeInTheDocument();
    expect(screen.getByText('Remaining Balance')).toBeInTheDocument();

    // Target Amount: 55,000
    expect(screen.getByText(formatSGD(55000.0))).toBeInTheDocument();
    // Goal-Funded Spend: 5,000 appears in metric card and in linked expenses
    expect(screen.getAllByText(formatSGD(5000.0)).length).toBeGreaterThanOrEqual(1);
    // Saved so far / Remaining balance: 50,000
    expect(screen.getByText(formatSGD(50000.0))).toBeInTheDocument();

    // Linked goal expenses list
    expect(screen.getByText('Linked Goal Expenses (1)')).toBeInTheDocument();
    expect(screen.getByText('Grand Ballroom Deposit')).toBeInTheDocument();

    // "+ Spend from Goal" button
    expect(screen.getByRole('button', { name: /\+ Spend from Wedding/i })).toBeInTheDocument();
  });

  it('draws down from goal balance when spending from goal via SpendFromGoalModal', async () => {
    const onSpendSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <SpendFromGoalModal
        isOpen={true}
        onClose={onClose}
        goal={weddingGoal}
        members={testMembers}
        onSpendSaved={onSpendSaved}
      />
    );

    expect(screen.getByText(/Spend from Wedding/i)).toBeInTheDocument();
    expect(screen.getByText('#Wedding')).toBeInTheDocument();

    // Fill in amount: $2,500
    const amountInput = screen.getByLabelText(/Amount to Spend/i);
    fireEvent.change(amountInput, { target: { value: '2500' } });

    // Fill in description
    const itemInput = screen.getByLabelText(/Item \/ Description/i);
    fireEvent.change(itemInput, { target: { value: 'Wedding Photographer Deposit' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Log & Deduct from Goal/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSpendSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    // Verify in mockFinanceService that goal balance was drawn down:
    // Originally 50000.0 in seed data - 2500 = 47500.0
    const goals = await financeService.getGoals();
    const updatedWedding = goals.find((g) => g.id === 'goal-00000000-0501');
    expect(updatedWedding).toBeDefined();
    expect(updatedWedding?.saved_so_far).toBe(47500.0);
  });

  it('excludes goal-funded spend from blowing up normal monthly spendable category caps', async () => {
    // Add an expense without goal_id (Food: 50)
    await financeService.addExpense({
      payer_id: testMembers[0].id,
      category_id: 'cat-00000000-0101', // Food
      date: '2026-10-10',
      item: 'Normal Lunch',
      amount: 50.0,
      is_shared: false,
    });

    // Add a goal-funded big-ticket expense (Food/Catering: 3000)
    await financeService.addExpense({
      payer_id: testMembers[0].id,
      category_id: 'cat-00000000-0101', // Food
      date: '2026-10-12',
      item: 'Wedding Banquet Catering',
      amount: 3000.0,
      is_shared: false,
      goal_id: 'goal-00000000-0501', // Linked to Wedding
      tags: ['Wedding'],
    });

    // Fetch monthly budget detail for 2026-10
    const budgetDetail = await financeService.getMonthlyBudget('2026-10', testMembers[0].id);
    const foodCategory = budgetDetail.categories.find(
      (c) => c.category_id === 'cat-00000000-0101'
    );

    expect(foodCategory).toBeDefined();
    // The actualSpent for Food must NOT include the $3,000 goal-funded spend
    // It should only include the normal food spend ($50 + any prior non-goal seed food for Oct)
    expect(foodCategory?.actualSpent).toBeLessThan(1000);
  });
});
