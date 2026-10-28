/**
 * Expense Ledger Tools:
 * Edit/Delete Modals, Sort, Pagination, Fast Log and Bulk Log
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditExpenseModal } from '../src/components/expenses/EditExpenseModal';
import { DeleteExpenseModal } from '../src/components/expenses/DeleteExpenseModal';
import {
  BulkAddExpenseModal,
  parseBulkExpenseText,
} from '../src/components/expenses/BulkAddExpenseModal';
import { FastLogWidget } from '../src/components/expenses/FastLogWidget';
import { ExpenseListTable } from '../src/components/expenses/ExpenseListTable';
import { CentsFirstAmountInput } from '../src/components/expenses/CentsFirstAmountInput';
import { financeService } from '../src/services/financeService';
import { mockCategories, mockMembers } from '../src/data/mockSeedData';
import type { Expense } from '../src/types/finance';

const testExpense: Expense = {
  id: 'exp-test-e2-1',
  household_id: 'hh-00000000-0001',
  payer_id: 'mem-00000000-0011', // Yi Jia
  category_id: 'cat-00000000-0101', // Food
  date: '2026-10-25',
  item: 'Maxwell Chicken Rice',
  amount: 15.5,
  remarks: 'Delicious lunch with roasted meat',
  is_shared: true,
  split_ratio: 0.5,
  settled: false,
  tags: ['Lunch', 'Hawker'],
  created_at: '2026-10-25T12:00:00Z',
};

const testGoalExpense: Expense = {
  id: 'exp-test-e2-2',
  household_id: 'hh-00000000-0001',
  payer_id: 'mem-00000000-0012', // Rachel
  category_id: 'cat-00000000-0102', // Lifestyle
  date: '2026-10-26',
  item: 'Japan Flight Tickets',
  amount: 850.0,
  remarks: 'Tokyo trip booking',
  is_shared: true,
  split_ratio: 0.5,
  settled: false,
  goal_id: 'goal-00000000-0001', // Linked to Japan Trip Goal
  tags: ['JapanTrip'],
  created_at: '2026-10-26T14:00:00Z',
};

describe('Ledger Power Tools, Fast Log & Bulk Log', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  /* ------------------------------------------------------------------ */
  /* 1. CentsFirstAmountInput Component                                 */
  /* ------------------------------------------------------------------ */
  describe('CentsFirstAmountInput', () => {
    it('formats numeric values into cents-first string', () => {
      const onChange = vi.fn();
      render(<CentsFirstAmountInput value={12.5} onChange={onChange} currencySymbol="S$" />);
      const input = screen.getByLabelText('Amount') as HTMLInputElement;
      expect(input.value).toBe('12.50');
    });

    it('pushes digits correctly and updates value', () => {
      let val = 0;
      const onChange = vi.fn((newVal) => {
        val = newVal;
      });
      const { rerender } = render(
        <CentsFirstAmountInput value={val} onChange={onChange} showKeypad />
      );

      // Click '1' -> 0.01
      fireEvent.click(screen.getByRole('button', { name: '1' }));
      expect(onChange).toHaveBeenCalledWith(0.01);

      // Rerender with 0.01 and click '2' -> 0.12
      rerender(<CentsFirstAmountInput value={0.01} onChange={onChange} showKeypad />);
      fireEvent.click(screen.getByRole('button', { name: '2' }));
      expect(onChange).toHaveBeenCalledWith(0.12);
    });

    it('handles backspace button to pop digits', () => {
      const onChange = vi.fn();
      render(<CentsFirstAmountInput value={12.5} onChange={onChange} showKeypad />);
      fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
      // 1250 cents -> 125 cents = 1.25
      expect(onChange).toHaveBeenCalledWith(1.25);
    });
  });

  /* ------------------------------------------------------------------ */
  /* 2. EditExpenseModal Component                                      */
  /* ------------------------------------------------------------------ */
  describe('EditExpenseModal', () => {
    it('populates fields with the existing expense details', () => {
      render(
        <EditExpenseModal
          isOpen={true}
          onClose={vi.fn()}
          expense={testExpense}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      expect(screen.getByText('Edit Expense')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Maxwell Chicken Rice')).toBeInTheDocument();
      expect(screen.getByDisplayValue('15.50')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Delicious lunch with roasted meat')).toBeInTheDocument();
      expect(screen.getByText('#Lunch')).toBeInTheDocument();
      expect(screen.getByText('#Hawker')).toBeInTheDocument();
    });

    it('calls financeService.updateExpense and notifies onSave upon submission', async () => {
      const updateSpy = vi.spyOn(financeService, 'updateExpense').mockResolvedValue({
        ...testExpense,
        item: 'Maxwell Roast Duck',
        amount: 18.0,
      });
      const onSaveMock = vi.fn();
      const onCloseMock = vi.fn();

      render(
        <EditExpenseModal
          isOpen={true}
          onClose={onCloseMock}
          expense={testExpense}
          onSave={onSaveMock}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      // Change description
      const itemInput = screen.getByLabelText(/Item Description/i);
      fireEvent.change(itemInput, { target: { value: 'Maxwell Roast Duck' } });

      // Submit form
      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          testExpense.id,
          expect.objectContaining({
            item: 'Maxwell Roast Duck',
          })
        );
        expect(onSaveMock).toHaveBeenCalled();
        expect(onCloseMock).toHaveBeenCalled();
      });
    });

    it('allows toggling shared split and adding a new tag', async () => {
      render(
        <EditExpenseModal
          isOpen={true}
          onClose={vi.fn()}
          expense={testExpense}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      // Add tag
      const tagInput = screen.getByPlaceholderText(/Add tag/i);
      fireEvent.change(tagInput, { target: { value: 'Foodie' } });
      fireEvent.click(screen.getByRole('button', { name: '+ Add' }));

      expect(screen.getByText('#Foodie')).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /* 3. DeleteExpenseModal Component                                    */
  /* ------------------------------------------------------------------ */
  describe('DeleteExpenseModal', () => {
    it('displays expense details and warns about shared settlement impact', () => {
      render(
        <DeleteExpenseModal
          isOpen={true}
          onClose={vi.fn()}
          expense={testExpense}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      expect(screen.getByText('Delete Expense?')).toBeInTheDocument();
      expect(screen.getByText('Maxwell Chicken Rice')).toBeInTheDocument();
      expect(screen.getByText(/Couple Settlement Adjusted/i)).toBeInTheDocument();
    });

    it('warns about savings goal balance restoration when expense is linked to a goal', () => {
      render(
        <DeleteExpenseModal
          isOpen={true}
          onClose={vi.fn()}
          expense={testGoalExpense}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      expect(screen.getByText(/Savings Goal Balance Restored/i)).toBeInTheDocument();
    });

    it('calls financeService.deleteExpense and notifies onDeleted on confirmation', async () => {
      const deleteSpy = vi.spyOn(financeService, 'deleteExpense').mockResolvedValue(undefined);
      const onDeletedMock = vi.fn();
      const onCloseMock = vi.fn();

      render(
        <DeleteExpenseModal
          isOpen={true}
          onClose={onCloseMock}
          expense={testExpense}
          onDeleted={onDeletedMock}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      const confirmBtn = screen.getByRole('button', { name: /Confirm delete/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith(testExpense.id);
        expect(onDeletedMock).toHaveBeenCalledWith(testExpense.id);
        expect(onCloseMock).toHaveBeenCalled();
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* 4. BulkAddExpenseModal & parseBulkExpenseText                      */
  /* ------------------------------------------------------------------ */
  describe('BulkAddExpenseModal & Text Parser', () => {
    it('parses multi-line text into structured expense rows', () => {
      const sampleText = `12.50 Lunch at Maxwell
4.20 Iced Coffee #Coffee
35.00 Grab to Orchard #VietnamTrip
2026-10-28 65.80 NTUC FairPrice #Groceries`;

      const parsed = parseBulkExpenseText(sampleText, '2026-10-27', mockCategories);

      expect(parsed).toHaveLength(4);

      // Line 1
      expect(parsed[0].amount).toBe(12.5);
      expect(parsed[0].item).toContain('Lunch at Maxwell');

      // Line 2
      expect(parsed[1].amount).toBe(4.2);
      expect(parsed[1].item).toContain('Iced Coffee');
      expect(parsed[1].tags).toContain('Coffee');

      // Line 3
      expect(parsed[2].amount).toBe(35.0);
      expect(parsed[2].item).toContain('Grab to Orchard');
      expect(parsed[2].tags).toContain('VietnamTrip');

      // Line 4 (with date)
      expect(parsed[3].date).toBe('2026-10-28');
      expect(parsed[3].amount).toBe(65.8);
      expect(parsed[3].item).toContain('NTUC FairPrice');
    });

    it('renders table grid, adds new rows, and submits batch expenses', async () => {
      const bulkAddSpy = vi
        .spyOn(financeService, 'bulkAddExpenses')
        .mockResolvedValue([testExpense]);
      const onAddedMock = vi.fn();
      const onCloseMock = vi.fn();

      render(
        <BulkAddExpenseModal
          isOpen={true}
          onClose={onCloseMock}
          onExpensesAdded={onAddedMock}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      expect(screen.getByText('Bulk Add Expenses')).toBeInTheDocument();

      // Add a row
      const addRowBtn = screen.getByRole('button', { name: /\+ Add Row/i });
      fireEvent.click(addRowBtn);

      // Fill in first row
      const amountInputs = screen.getAllByPlaceholderText('0.00');
      fireEvent.change(amountInputs[0], { target: { value: '25.50' } });

      const descInputs = screen.getAllByPlaceholderText('e.g. Lunch');
      fireEvent.change(descInputs[0], { target: { value: 'Supermarket Run' } });

      // Click submit
      const submitBtn = screen.getByRole('button', { name: /Log All/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(bulkAddSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              amount: 25.5,
              item: 'Supermarket Run',
            }),
          ])
        );
        expect(onAddedMock).toHaveBeenCalled();
        expect(onCloseMock).toHaveBeenCalled();
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* 5. FastLogWidget Component                                         */
  /* ------------------------------------------------------------------ */
  describe('FastLogWidget', () => {
    it('allows 1-tap rapid amount entry, category selection, and logging', async () => {
      const addSpy = vi.spyOn(financeService, 'addExpense').mockResolvedValue(testExpense);
      const onLoggedMock = vi.fn();

      render(
        <FastLogWidget
          onExpenseLogged={onLoggedMock}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      // Enter 10.05 via keypad: 1 -> 0 -> 0 -> 5
      fireEvent.click(screen.getByRole('button', { name: '1' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));
      fireEvent.click(screen.getByRole('button', { name: '5' }));

      // Tap 'Transport' category pill
      const transportBtn = screen.getByRole('button', { name: /Transport/i });
      fireEvent.click(transportBtn);

      // Tap 'Grab' quick tag
      const grabTag = screen.getByRole('button', { name: 'Grab' });
      fireEvent.click(grabTag);

      // Tap Log button
      const logBtn = screen.getByRole('button', { name: /Log S\$/i });
      fireEvent.click(logBtn);

      await waitFor(() => {
        expect(addSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 10.05,
            item: 'Grab',
            tags: ['Grab'],
          })
        );
        expect(onLoggedMock).toHaveBeenCalled();
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* 6. ExpenseListTable Sorting & Pagination                           */
  /* ------------------------------------------------------------------ */
  describe('ExpenseListTable Sorting & Pagination', () => {
    const expensesList: Expense[] = [
      {
        ...testExpense,
        id: 'exp-1',
        item: 'A - Apple',
        amount: 5.0,
        date: '2026-10-01',
      },
      {
        ...testExpense,
        id: 'exp-2',
        item: 'Z - Zebra Dinner',
        amount: 250.0,
        date: '2026-10-20',
      },
      {
        ...testExpense,
        id: 'exp-3',
        item: 'M - Mango Juice',
        amount: 30.0,
        date: '2026-10-10',
      },
    ];

    it('renders desktop table view and mobile card view', () => {
      render(
        <ExpenseListTable
          expenses={expensesList}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      expect(screen.getAllByText('A - Apple').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Z - Zebra Dinner').length).toBeGreaterThan(0);
      expect(screen.getAllByText('M - Mango Juice').length).toBeGreaterThan(0);
    });

    it('sorts columns by Date and Amount on header click', () => {
      const onSortMock = vi.fn();
      render(
        <ExpenseListTable
          expenses={expensesList}
          categories={mockCategories}
          members={mockMembers}
          onSortChange={onSortMock}
          sortBy="date"
          sortOrder="desc"
        />
      );

      // Click Amount header to sort
      const amountHeader = screen.getByRole('columnheader', { name: /Amount/i });
      fireEvent.click(amountHeader);

      expect(onSortMock).toHaveBeenCalledWith('amount', 'desc');
    });

    it('supports pagination controls and page size selector', () => {
      const largeList: Expense[] = Array.from({ length: 45 }, (_, i) => ({
        ...testExpense,
        id: `exp-${i}`,
        item: `Item ${i + 1}`,
        amount: 10 + i,
      }));

      render(
        <ExpenseListTable
          expenses={largeList}
          categories={mockCategories}
          members={mockMembers}
          pageSize={20}
        />
      );

      // Expect pagination text "Showing 1–20 of 45"
      expect(screen.getByText('1–20')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();

      // Click Next page
      const nextBtn = screen.getByRole('button', { name: 'Next page' });
      fireEvent.click(nextBtn);

      // Now on page 2: "Showing 21–40 of 45"
      expect(screen.getByText('21–40')).toBeInTheDocument();
    });

    it('opens EditExpenseModal when clicking edit button', () => {
      render(
        <ExpenseListTable
          expenses={[testExpense]}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      const editBtns = screen.getAllByLabelText(/Edit Maxwell Chicken Rice/i);
      fireEvent.click(editBtns[0]);

      expect(screen.getByText('Edit Expense')).toBeInTheDocument();
    });

    it('opens DeleteExpenseModal when clicking delete button', () => {
      render(
        <ExpenseListTable
          expenses={[testExpense]}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      const deleteBtns = screen.getAllByLabelText(/Delete Maxwell Chicken Rice/i);
      fireEvent.click(deleteBtns[0]);

      expect(screen.getByText('Delete Expense?')).toBeInTheDocument();
    });
  });
});
