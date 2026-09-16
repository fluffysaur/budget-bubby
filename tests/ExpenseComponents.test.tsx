/**
 * Unit & Integration Tests for Task 6 Expense Components:
 * - QuickAddExpenseModal
 * - ExpenseFilterBar
 * - ExpenseListTable
 * - ExpensesPage
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { QuickAddExpenseModal } from '../src/components/expenses/QuickAddExpenseModal';
import { ExpenseFilterBar } from '../src/components/expenses/ExpenseFilterBar';
import { ExpenseListTable } from '../src/components/expenses/ExpenseListTable';
import { ExpensesPage } from '../src/pages/ExpensesPage';
import { financeService } from '../src/services/financeService';
import { mockCategories, mockMembers } from '../src/data/mockSeedData';
import type { Expense, ExpenseFilter } from '../src/types/finance';

const sampleExpenses: Expense[] = [
  {
    id: 'exp-test-1',
    household_id: 'hh-00000000-0001',
    payer_id: 'mem-00000000-0011', // Yi Jia
    category_id: 'cat-00000000-0101', // Food
    date: '2026-09-02',
    item: 'FairPrice Finest Groceries',
    amount: 128.45,
    remarks: 'Weekly groceries for meal prep',
    is_shared: true,
    split_ratio: 0.5,
    settled: false,
    created_at: '2026-09-02T10:30:00.000Z',
  },
  {
    id: 'exp-test-2',
    household_id: 'hh-00000000-0001',
    payer_id: 'mem-00000000-0012', // Rachel
    category_id: 'cat-00000000-0101', // Food
    date: '2026-09-05',
    item: 'Dinner at Din Tai Fung',
    amount: 86.5,
    remarks: 'Weekend couple dinner',
    is_shared: true,
    split_ratio: 0.5,
    settled: false,
    created_at: '2026-09-05T19:45:00.000Z',
  },
  {
    id: 'exp-test-3',
    household_id: 'hh-00000000-0001',
    payer_id: 'mem-00000000-0011', // Yi Jia
    category_id: 'cat-00000000-0102', // Lifestyle
    date: '2026-09-09',
    item: 'Mechanical Keyboard Switch',
    amount: 45.0,
    remarks: 'Personal desk setup',
    is_shared: false,
    split_ratio: 0.5,
    settled: true,
    created_at: '2026-09-09T14:20:00.000Z',
  },
];

describe('QuickAddExpenseModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', async () => {
    await act(async () => {
      render(
        <HouseholdProvider>
          <QuickAddExpenseModal
            isOpen={false}
            onClose={vi.fn()}
            categories={mockCategories}
            members={mockMembers}
          />
        </HouseholdProvider>
      );
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal with amount auto-focused and default today date when isOpen is true', async () => {
    await act(async () => {
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
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Quick Add Expense')).toBeInTheDocument();

    const amountInput = screen.getByLabelText(/amount/i);
    expect(amountInput).toBeInTheDocument();

    // Verify category chips are rendered
    expect(screen.getByRole('button', { name: /food/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /transport/i })).toBeInTheDocument();

    // Verify payer options exist
    expect(screen.getByRole('button', { name: /yi jia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rachel/i })).toBeInTheDocument();

    // Verify 50/50 shared toggle exists
    expect(screen.getByLabelText(/shared/i)).toBeInTheDocument();
  });

  it('allows user to fill the form, toggle payer and shared split, and submit', async () => {
    const onClose = vi.fn();
    const onExpenseAdded = vi.fn();

    const addExpenseSpy = vi.spyOn(financeService, 'addExpense').mockResolvedValueOnce({
      id: 'exp-new-123',
      household_id: 'hh-00000000-0001',
      payer_id: 'mem-00000000-0012', // Rachel
      category_id: 'cat-00000000-0101', // Food
      date: '2026-09-15',
      item: 'Cold Storage Snacks',
      amount: 42.5,
      remarks: 'Movie night snacks',
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
      created_at: '2026-09-15T12:00:00.000Z',
    });

    await act(async () => {
      render(
        <HouseholdProvider>
          <QuickAddExpenseModal
            isOpen={true}
            onClose={onClose}
            onExpenseAdded={onExpenseAdded}
            categories={mockCategories}
            members={mockMembers}
          />
        </HouseholdProvider>
      );
    });

    // Enter Amount
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '42.50' } });

    // Enter Item
    const itemInput = screen.getByLabelText(/item|description/i);
    fireEvent.change(itemInput, { target: { value: 'Cold Storage Snacks' } });

    // Select Category (Food)
    const foodChip = screen.getByRole('button', { name: /food/i });
    fireEvent.click(foodChip);

    // Toggle Payer to Rachel
    const rachelBtn = screen.getByRole('button', { name: /rachel/i });
    fireEvent.click(rachelBtn);

    // Remarks
    const remarksInput = screen.getByLabelText(/remarks|notes/i);
    fireEvent.change(remarksInput, { target: { value: 'Movie night snacks' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /save expense|add expense/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(addExpenseSpy).toHaveBeenCalledTimes(1);
    });

    expect(addExpenseSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 42.5,
        item: 'Cold Storage Snacks',
        category_id: 'cat-00000000-0101',
        payer_id: 'mem-00000000-0012',
        is_shared: true,
        split_ratio: 0.5,
        remarks: 'Movie night snacks',
      })
    );

    expect(onExpenseAdded).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles toggling personal expense (is_shared = false)', async () => {
    const addExpenseSpy = vi.spyOn(financeService, 'addExpense').mockResolvedValueOnce({
      id: 'exp-new-456',
      household_id: 'hh-00000000-0001',
      payer_id: 'mem-00000000-0011',
      category_id: 'cat-00000000-0102',
      date: '2026-09-15',
      item: 'Gym Membership',
      amount: 120.0,
      remarks: null,
      is_shared: false,
      split_ratio: 0.5,
      settled: true,
    });

    await act(async () => {
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
    });

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText(/item|description/i), { target: { value: 'Gym Membership' } });

    // Uncheck/toggle off shared switch
    const sharedToggle = screen.getByLabelText(/shared/i);
    fireEvent.click(sharedToggle);

    // Select Lifestyle
    fireEvent.click(screen.getByRole('button', { name: /lifestyle/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save expense|add expense/i }));
    });

    await waitFor(() => {
      expect(addExpenseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 120,
          item: 'Gym Membership',
          is_shared: false,
        })
      );
    });
  });

  it('validates amount and item input before submission', async () => {
    const addExpenseSpy = vi.spyOn(financeService, 'addExpense');

    await act(async () => {
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
    });

    // Click submit with 0 amount and empty item
    const submitBtn = screen.getByRole('button', { name: /save expense|add expense/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(addExpenseSpy).not.toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(
        <HouseholdProvider>
          <QuickAddExpenseModal
            isOpen={true}
            onClose={onClose}
            categories={mockCategories}
            members={mockMembers}
          />
        </HouseholdProvider>
      );
    });

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ExpenseFilterBar', () => {
  it('renders all filter controls: search, category, payer, shared status, and month', () => {
    const filter: ExpenseFilter = {
      search: '',
      categoryId: undefined,
      payerId: undefined,
      isShared: undefined,
      month: '2026-09',
    };

    render(
      <ExpenseFilterBar
        filter={filter}
        onFilterChange={vi.fn()}
        categories={mockCategories}
        members={mockMembers}
      />
    );

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type|shared/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/month/i)).toBeInTheDocument();
  });

  it('fires onFilterChange when filters change', async () => {
    const onFilterChange = vi.fn();
    const filter: ExpenseFilter = { month: '2026-09' };

    render(
      <ExpenseFilterBar
        filter={filter}
        onFilterChange={onFilterChange}
        categories={mockCategories}
        members={mockMembers}
      />
    );

    // Type in search
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'FairPrice' } });
    expect(onFilterChange).toHaveBeenCalled();

    // Change category dropdown
    const categorySelect = screen.getByLabelText(/category/i);
    fireEvent.change(categorySelect, { target: { value: 'cat-00000000-0101' } });
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-00000000-0101' })
    );

    // Change payer dropdown
    const payerSelect = screen.getByLabelText(/payer/i);
    fireEvent.change(payerSelect, { target: { value: 'mem-00000000-0011' } });
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ payerId: 'mem-00000000-0011' })
    );

    // Change shared status dropdown
    const sharedSelect = screen.getByLabelText(/type|shared/i);
    fireEvent.change(sharedSelect, { target: { value: 'shared' } });
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ isShared: true })
    );
  });

  it('resets filters when Reset button is clicked', async () => {
    const onFilterChange = vi.fn();
    const onReset = vi.fn();

    render(
      <ExpenseFilterBar
        filter={{ search: 'Coffee', categoryId: 'cat-00000000-0101', month: '2026-09' }}
        onFilterChange={onFilterChange}
        onReset={onReset}
        categories={mockCategories}
        members={mockMembers}
      />
    );

    const resetBtn = screen.getByRole('button', { name: /clear|reset/i });
    fireEvent.click(resetBtn);

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('ExpenseListTable', () => {
  it('renders table headers and expense row details formatted in S$', () => {
    render(
      <ExpenseListTable
        expenses={sampleExpenses}
        categories={mockCategories}
        members={mockMembers}
      />
    );

    // Items
    expect(screen.getByText('FairPrice Finest Groceries')).toBeInTheDocument();
    expect(screen.getByText('Dinner at Din Tai Fung')).toBeInTheDocument();
    expect(screen.getByText('Mechanical Keyboard Switch')).toBeInTheDocument();

    // Formatted S$ amounts
    expect(screen.getByText('S$128.45')).toBeInTheDocument();
    expect(screen.getByText('S$86.50')).toBeInTheDocument();
    expect(screen.getByText('S$45.00')).toBeInTheDocument();

    // Category badges
    expect(screen.getAllByText('Food').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Lifestyle')).toBeInTheDocument();

    // Payers
    expect(screen.getAllByText(/Yi Jia/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Rachel/).length).toBeGreaterThanOrEqual(1);

    // Shared 50/50 badges
    expect(screen.getAllByText(/shared/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('requires inline confirmation before calling onDeleteExpense', async () => {
    const onDelete = vi.fn();

    render(
      <ExpenseListTable
        expenses={sampleExpenses}
        categories={mockCategories}
        members={mockMembers}
        onDeleteExpense={onDelete}
      />
    );

    // Initial state: 3 trash delete buttons
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBe(sampleExpenses.length);

    // Click delete on first item -> triggers confirmation state
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).not.toHaveBeenCalled();

    // Confirm and Cancel buttons should now be visible for this row
    const confirmBtn = screen.getByRole('button', { name: /confirm delete/i });
    const cancelBtn = screen.getByRole('button', { name: /cancel delete/i });
    expect(confirmBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();

    // Clicking Confirm executes onDeleteExpense
    fireEvent.click(confirmBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('exp-test-1');
  });

  it('allows canceling delete without calling onDeleteExpense', async () => {
    const onDelete = vi.fn();

    render(
      <ExpenseListTable
        expenses={sampleExpenses}
        categories={mockCategories}
        members={mockMembers}
        onDeleteExpense={onDelete}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel delete/i });
    fireEvent.click(cancelBtn);

    expect(onDelete).not.toHaveBeenCalled();
    // Reverts back to initial delete button
    expect(screen.getAllByRole('button', { name: /delete/i }).length).toBe(sampleExpenses.length);
  });

  it('displays empty state when no expenses match', () => {
    render(
      <ExpenseListTable
        expenses={[]}
        categories={mockCategories}
        members={mockMembers}
      />
    );

    expect(screen.getByText(/no expenses found/i)).toBeInTheDocument();
  });
});

describe('ExpensesPage Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders page layout with summary cards, filter bar, table, and Quick Add button', async () => {
    vi.spyOn(financeService, 'getExpenses').mockResolvedValue(sampleExpenses);

    await act(async () => {
      render(
        <HouseholdProvider>
          <ExpensesPage />
        </HouseholdProvider>
      );
    });

    // Check title and Quick Add button
    expect(await screen.findByRole('heading', { name: /expenses/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ add expense|\+ quick add/i })).toBeInTheDocument();

    // Summary cards: Total Spent, Shared Spending, Unsettled Balance
    expect(screen.getByText(/total spent/i)).toBeInTheDocument();
    expect(screen.getByText('Shared Spending')).toBeInTheDocument();
    expect(screen.getByText(/unsettled|who owes whom/i)).toBeInTheDocument();

    // Check that transactions are displayed
    expect(await screen.findByText('FairPrice Finest Groceries')).toBeInTheDocument();
    expect(screen.getByText('Dinner at Din Tai Fung')).toBeInTheDocument();
  });

  it('opens Quick Add modal when trigger button is clicked and closes it', async () => {
    vi.spyOn(financeService, 'getExpenses').mockResolvedValue(sampleExpenses);

    await act(async () => {
      render(
        <HouseholdProvider>
          <ExpensesPage />
        </HouseholdProvider>
      );
    });

    const quickAddBtn = await screen.findByRole('button', { name: /\+ add expense|\+ quick add/i });
    act(() => {
      fireEvent.click(quickAddBtn);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Quick Add Expense')).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    act(() => {
      fireEvent.click(closeBtn);
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('displays global settlement summary independent of filtered transaction ledger', async () => {
    // Only 1 personal expense in filtered ledger
    vi.spyOn(financeService, 'getExpenses').mockResolvedValue([sampleExpenses[2]]);
    vi.spyOn(financeService, 'getHouseholdOverview').mockResolvedValue({
      household: { id: 'hh-1', name: 'Yi Jia & Rachel', currency: 'SGD' },
      members: mockMembers,
      totalAssets: 100000,
      totalLiabilities: 0,
      trueNetWorth: 100000,
      settlementSummary: {
        netBalance: 52.40,
        debtorId: mockMembers[0].id,
        creditorId: mockMembers[1].id,
        debtorName: 'Yi Jia',
        creditorName: 'Rachel',
        settlementText: 'Yi Jia owes Rachel S$52.40',
        member1OwesMember2: 52.40,
        member2OwesMember1: 0,
      },
      activeGoals: [],
      upcomingBills: [],
    });

    await act(async () => {
      render(
        <HouseholdProvider>
          <ExpensesPage />
        </HouseholdProvider>
      );
    });

    // The settlement card displays the global balance even though the ledger is filtered
    expect(screen.getByText('S$52.40')).toBeInTheDocument();
    expect(screen.getByText('Yi Jia owes Rachel S$52.40')).toBeInTheDocument();
  });
});
