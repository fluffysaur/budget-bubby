/**
 * Tests for Expense Time Tracking & Intraday Chronological Sorting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ExpenseListTable } from '../src/components/expenses/ExpenseListTable';
import { QuickAddExpenseModal } from '../src/components/expenses/QuickAddExpenseModal';
import { EditExpenseModal } from '../src/components/expenses/EditExpenseModal';
import { FastLogWidget } from '../src/components/expenses/FastLogWidget';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { financeService } from '../src/services/financeService';
import { mockCategories, mockMembers } from '../src/data/mockSeedData';
import type { Expense } from '../src/types/finance';

describe('Expense Time Feature & Intraday Sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleExpenses: Expense[] = [
    {
      id: 'exp-morning',
      household_id: 'hh-1',
      payer_id: mockMembers[0].id,
      category_id: mockCategories[0].id,
      date: '2026-10-29',
      time: '08:30',
      item: 'Morning Kopi & Toast',
      amount: 4.5,
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
    },
    {
      id: 'exp-lunch',
      household_id: 'hh-1',
      payer_id: mockMembers[0].id,
      category_id: mockCategories[0].id,
      date: '2026-10-29',
      time: '12:30',
      item: 'Hawker Chicken Rice',
      amount: 7.0,
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
    },
    {
      id: 'exp-dinner',
      household_id: 'hh-1',
      payer_id: mockMembers[0].id,
      category_id: mockCategories[0].id,
      date: '2026-10-29',
      time: '19:45',
      item: 'Japanese Ramen Dinner',
      amount: 22.0,
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
    },
  ];

  it('renders 12-hour formatted time in ExpenseListTable rows', () => {
    render(
      <ExpenseListTable
        expenses={sampleExpenses}
        categories={mockCategories}
        members={mockMembers}
      />
    );

    // Formatted 12h times
    expect(screen.getByText('8:30 AM')).toBeInTheDocument();
    expect(screen.getByText('12:30 PM')).toBeInTheDocument();
    expect(screen.getByText('7:45 PM')).toBeInTheDocument();
  });

  it('falls back to extracting time from created_at when time column is missing', () => {
    const legacyExpense: Expense = {
      id: 'exp-legacy',
      household_id: 'hh-1',
      payer_id: mockMembers[0].id,
      category_id: mockCategories[0].id,
      date: '2026-10-29',
      item: 'Legacy Bubble Tea',
      amount: 6.0,
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
      // 06:15 UTC is 14:15 in Singapore (UTC+8)
      created_at: '2026-10-29T06:15:00.000Z',
    };

    render(
      <ExpenseListTable
        expenses={[legacyExpense]}
        categories={mockCategories}
        members={mockMembers}
      />
    );

    expect(screen.getByText('2:15 PM')).toBeInTheDocument();
  });

  it('sorts same-day transactions chronologically by time', () => {
    // Pass in unordered same-day expenses
    const unorderedExpenses = [sampleExpenses[1], sampleExpenses[2], sampleExpenses[0]];

    const { container } = render(
      <ExpenseListTable
        expenses={unorderedExpenses}
        categories={mockCategories}
        members={mockMembers}
        sortBy="date"
        sortOrder="desc"
      />
    );

    // In descending order, dinner (19:45) should appear first, then lunch (12:30), then morning (08:30)
    const itemRows = container.querySelectorAll('tbody tr');
    expect(itemRows.length).toBe(3);
    expect(itemRows[0].textContent).toContain('Japanese Ramen Dinner');
    expect(itemRows[1].textContent).toContain('Hawker Chicken Rice');
    expect(itemRows[2].textContent).toContain('Morning Kopi & Toast');
  });

  it('pre-fills time in QuickAddExpenseModal and allows manual editing with Now button', async () => {
    const addExpenseSpy = vi.spyOn(financeService, 'addExpense').mockResolvedValue({
      id: 'exp-new-1',
      household_id: 'hh-1',
      payer_id: mockMembers[0].id,
      date: '2026-10-29',
      time: '15:45',
      item: 'Iced Latte',
      amount: 6.5,
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
    });

    render(
      <HouseholdProvider>
        <QuickAddExpenseModal
          isOpen={true}
          onClose={vi.fn()}
          categories={mockCategories}
          members={mockMembers}
        />
      </HouseholdProvider>
    );

    const timeInput = screen.getByLabelText(/expense time/i) as HTMLInputElement;
    expect(timeInput).toBeInTheDocument();
    expect(timeInput.value).toMatch(/^\d{2}:\d{2}$/);

    // Change time to 15:45
    fireEvent.change(timeInput, { target: { value: '15:45' } });
    expect(timeInput.value).toBe('15:45');

    // Fill item and amount
    const itemInput = screen.getByPlaceholderText(/fairprice groceries/i);
    fireEvent.change(itemInput, { target: { value: 'Iced Latte' } });

    const amountInput = screen.getByLabelText(/amount in sgd/i);
    // Type 6.50 via keypad simulation
    fireEvent.keyDown(amountInput, { key: '6' });
    fireEvent.keyDown(amountInput, { key: '5' });
    fireEvent.keyDown(amountInput, { key: '0' });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /add expense/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(addExpenseSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        item: 'Iced Latte',
        time: '15:45',
      })
    );
  });

  it('populates and saves updated time in EditExpenseModal', async () => {
    const updateExpenseSpy = vi.spyOn(financeService, 'updateExpense').mockResolvedValue({
      ...sampleExpenses[0],
      time: '09:15',
    });

    const onSave = vi.fn();

    render(
      <EditExpenseModal
        isOpen={true}
        onClose={vi.fn()}
        expense={sampleExpenses[0]}
        categories={mockCategories}
        members={mockMembers}
        onSave={onSave}
      />
    );

    const timeInput = screen.getByLabelText(/expense time/i) as HTMLInputElement;
    expect(timeInput.value).toBe('08:30');

    // Edit to 09:15
    fireEvent.change(timeInput, { target: { value: '09:15' } });

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(updateExpenseSpy).toHaveBeenCalledWith(
      'exp-morning',
      expect.objectContaining({
        time: '09:15',
      })
    );
  });

  it('auto-stamps current time in FastLogWidget', async () => {
    const addExpenseSpy = vi.spyOn(financeService, 'addExpense').mockResolvedValue({
      id: 'exp-fast-1',
      household_id: 'hh-1',
      payer_id: mockMembers[0].id,
      date: '2026-10-29',
      time: '14:20',
      item: 'Lunch',
      amount: 12.0,
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
    });

    render(
      <FastLogWidget
        categories={mockCategories}
        members={mockMembers}
      />
    );

    // Preset chips: +10 and +2 for $12.00
    const chip10 = screen.getByRole('button', { name: '+10' });
    const chip2 = screen.getByRole('button', { name: '+2' });

    fireEvent.click(chip10);
    fireEvent.click(chip2);

    // Select tag "Lunch"
    const lunchTag = screen.getByRole('button', { name: 'Lunch' });
    fireEvent.click(lunchTag);

    // Click Log button
    const logBtn = screen.getByRole('button', { name: /log s\$12\.00/i });
    await act(async () => {
      fireEvent.click(logBtn);
    });

    expect(addExpenseSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        item: 'Lunch',
        amount: 12,
        time: expect.stringMatching(/^\d{2}:\d{2}$/),
      })
    );
  });
});
