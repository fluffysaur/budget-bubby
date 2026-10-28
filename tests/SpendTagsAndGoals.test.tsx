/**
 * Spend Tags & Sinking Fund Goals Drawdown
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

describe('Spend Tags Overview Card', () => {
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

describe('Big-Ticket Goals Sinking Fund & Drawdown', () => {
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
    expect(screen.getByText('Goal Spend')).toBeInTheDocument();
    expect(screen.getByText('Balance')).toBeInTheDocument();

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

    // Verify that goal saved_so_far represents total saved and does not deduct milestone progress:
    const goals = await financeService.getGoals();
    const updatedWedding = goals.find((g) => g.id === 'goal-00000000-0501');
    expect(updatedWedding).toBeDefined();
    expect(updatedWedding?.saved_so_far).toBe(50000.0);
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

