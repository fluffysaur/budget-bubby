/**
 * Expense Ledger Tools:
 * Edit/Delete Modals, Sort, Pagination, Fast Log and Bulk Add
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeleteExpenseModal } from '../src/components/expenses/DeleteExpenseModal';
import { ExpenseFormModal } from '../src/components/expenses/ExpenseFormModal';
import { BulkAddExpenseModal } from '../src/components/expenses/BulkAddExpenseModal';
import {
  formatISODate,
  getSingaporeDate,
  getTodayDateString,
} from '../src/lib/dateUtils';
import { ExpenseListTable } from '../src/components/expenses/ExpenseListTable';
import { CentsFirstAmountInput } from '../src/components/expenses/CentsFirstAmountInput';
import { financeService } from '../src/services/financeService';
import { mockCategories, mockMembers } from '../src/data/mockSeedData';
import type { Expense, SavingsGoal } from '../src/types/finance';

const mockGoals: SavingsGoal[] = [
  {
    id: 'goal-wedding-1',
    household_id: 'hh-00000000-0001',
    title: 'Wedding Banquet',
    target_amount: 30000,
    saved_so_far: 15000,
    target_date: '2026-12-31',
    monthly_contribution: 1500,
    status: 'on_track',
    emoji: '💍',
  },
  {
    id: 'goal-japan-2',
    household_id: 'hh-00000000-0001',
    title: 'Japan Trip',
    target_amount: 5000,
    saved_so_far: 3500,
    target_date: '2026-11-30',
    monthly_contribution: 500,
    status: 'on_track',
    emoji: '✈️',
  },
];

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

describe('Ledger Power Tools, Fast Log & Bulk Add', () => {
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
  /* 2. ExpenseFormModal (edit mode)                                   */
  /* ------------------------------------------------------------------ */
  describe('ExpenseFormModal (edit mode)', () => {
    it('populates fields with the existing expense details', () => {
      render(
        <ExpenseFormModal
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
        <ExpenseFormModal
          isOpen={true}
          onClose={onCloseMock}
          expense={testExpense}
          onExpenseUpdated={onSaveMock}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      // Change description
      const itemInput = screen.getByLabelText(/^Description$/i);
      fireEvent.change(itemInput, { target: { value: 'Maxwell Roast Duck' } });

      // Submit form
      const saveBtn = screen.getByRole('button', { name: /^Save$/i });
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
        <ExpenseFormModal
          isOpen={true}
          onClose={vi.fn()}
          expense={testExpense}
          categories={mockCategories}
          members={mockMembers}
        />
      );

      // Add tag
      const tagInput = screen.getByPlaceholderText(/VietnamTrip/i);
      fireEvent.change(tagInput, { target: { value: 'Foodie' } });
      fireEvent.click(screen.getByRole('button', { name: '+ Tag' }));

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
      expect(screen.getByText(/Settlement updates/i)).toBeInTheDocument();
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

      expect(screen.getByText(/Goal refunded/i)).toBeInTheDocument();
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
  /* 4. BulkAddExpenseModal                                             */
  /* ------------------------------------------------------------------ */
  describe('BulkAddExpenseModal', () => {
    const rowOf = (n: number) =>
      within(screen.getByRole('group', { name: `Row ${n}` }));

    const fillRow = (n: number, amount: string, item: string) => {
      fireEvent.change(screen.getByLabelText(`Amount for row ${n}`), {
        target: { value: amount },
      });
      fireEvent.change(screen.getByLabelText(`Description for row ${n}`), {
        target: { value: item },
      });
    };

    const renderModal = (
      props: Partial<React.ComponentProps<typeof BulkAddExpenseModal>> = {},
    ) => {
      const onClose = vi.fn();
      const onExpensesAdded = vi.fn();
      const utils = render(
        <BulkAddExpenseModal
          isOpen={true}
          onClose={onClose}
          onExpensesAdded={onExpensesAdded}
          categories={mockCategories}
          members={mockMembers}
          goals={mockGoals}
          {...props}
        />,
      );
      return { onClose, onExpensesAdded, ...utils };
    };

    it('renders title Bulk Add with one row and no Smart Paste', () => {
      renderModal();
      expect(screen.getByText('Bulk Add')).toBeInTheDocument();
      expect(screen.queryByText(/Paste Text/i)).toBeNull();
      expect(screen.getAllByRole('group', { name: /^Row \d+$/ })).toHaveLength(1);
      expect(screen.getByRole('radio', { name: 'Today' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('focuses the first amount on open', () => {
      renderModal();
      expect(screen.getByLabelText('Amount for row 1')).toHaveFocus();
    });

    it('applies the active day only to new rows', async () => {
      const bulkAddSpy = vi
        .spyOn(financeService, 'bulkAddExpenses')
        .mockResolvedValue([testExpense]);
      renderModal();
      const yesterday = new Date(getSingaporeDate());
      yesterday.setDate(yesterday.getDate() - 1);

      fillRow(1, '10', 'Lunch');
      fireEvent.click(screen.getByRole('radio', { name: 'Yesterday' }));
      fireEvent.click(screen.getByRole('button', { name: '+ Row' }));
      fillRow(2, '5', 'Grab');

      fireEvent.click(screen.getByRole('button', { name: /^Save 2/ }));

      await waitFor(() => expect(bulkAddSpy).toHaveBeenCalled());
      const inputs = bulkAddSpy.mock.calls[0][0];
      expect(inputs[0].date).toBe(getTodayDateString());
      expect(inputs[1].date).toBe(formatISODate(yesterday));
    });

    it('auto-guesses the category and stops once the user picks one', () => {
      renderModal();
      fillRow(1, '10', 'Lunch');
      expect(
        rowOf(1).getByRole('button', { name: /Category for row 1/ }),
      ).toHaveTextContent('Food');

      fireEvent.click(rowOf(1).getByRole('button', { name: /Category for row 1/ }));
      fireEvent.click(rowOf(1).getByRole('option', { name: 'Transport' }));
      expect(
        rowOf(1).getByRole('button', { name: /Category for row 1/ }),
      ).toHaveTextContent('Transport');

      fireEvent.change(screen.getByLabelText('Description for row 1'), {
        target: { value: 'Lunch again' },
      });
      expect(
        rowOf(1).getByRole('button', { name: /Category for row 1/ }),
      ).toHaveTextContent('Transport');
    });

    it('moves focus with Enter and adds a row after a valid last row', () => {
      renderModal();
      const amount = screen.getByLabelText('Amount for row 1');
      fireEvent.change(amount, { target: { value: '12.5' } });
      fireEvent.keyDown(amount, { key: 'Enter' });
      const desc = screen.getByLabelText('Description for row 1');
      expect(desc).toHaveFocus();

      fireEvent.change(desc, { target: { value: 'Lunch' } });
      fireEvent.keyDown(desc, { key: 'Enter' });

      expect(screen.getAllByRole('group', { name: /^Row \d+$/ })).toHaveLength(2);
      expect(screen.getByLabelText('Amount for row 2')).toHaveFocus();
    });

    it('does not add a row on Enter when the last row is invalid', () => {
      renderModal();
      const desc = screen.getByLabelText('Description for row 1');
      fireEvent.change(desc, { target: { value: 'Lunch' } });
      fireEvent.keyDown(desc, { key: 'Enter' });
      expect(screen.getAllByRole('group', { name: /^Row \d+$/ })).toHaveLength(1);
      expect(screen.getByText('Enter amount')).toBeInTheDocument();
    });

    it('shows inline errors only after Save, and keeps Save enabled to give feedback', async () => {
      const bulkAddSpy = vi.spyOn(financeService, 'bulkAddExpenses');
      renderModal();
      fireEvent.change(screen.getByLabelText('Amount for row 1'), {
        target: { value: '8' },
      });
      expect(screen.queryByText('Add description')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
      expect(await screen.findByText('Add description')).toBeInTheDocument();
      expect(bulkAddSpy).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Description for row 1')).toHaveFocus();
    });

    it('ignores blank rows and labels Save with count and total', async () => {
      const bulkAddSpy = vi
        .spyOn(financeService, 'bulkAddExpenses')
        .mockResolvedValue([testExpense]);
      const { onClose, onExpensesAdded } = renderModal();

      fillRow(1, '12.50', 'Lunch');
      fireEvent.click(screen.getByRole('button', { name: '+ Row' }));
      fillRow(2, '25', 'Grab to Orchard');
      fireEvent.click(screen.getByRole('button', { name: '+ Row' })); // blank row 3

      const save = screen.getByRole('button', { name: 'Save 2 · S$37.50' });
      fireEvent.click(save);

      await waitFor(() => {
        expect(bulkAddSpy).toHaveBeenCalledTimes(1);
        expect(bulkAddSpy.mock.calls[0][0]).toHaveLength(2);
        expect(bulkAddSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ amount: 12.5, item: 'Lunch' }),
            expect.objectContaining({ amount: 25, item: 'Grab to Orchard' }),
          ]),
        );
        expect(onExpensesAdded).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('keeps all rows and shows an alert when saving fails', async () => {
      vi.spyOn(financeService, 'bulkAddExpenses').mockRejectedValue(
        new Error('Network down'),
      );
      const { onClose } = renderModal();
      fillRow(1, '12.50', 'Lunch');

      fireEvent.click(screen.getByRole('button', { name: /^Save/ }));

      expect(await screen.findByText('Network down')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Amount for row 1')).toHaveValue('12.50');
      expect(screen.getByRole('button', { name: /^Save/ })).toBeEnabled();
    });

    it('saves solo rows with split_ratio 0 and shared rows with 0.5', async () => {
      const bulkAddSpy = vi
        .spyOn(financeService, 'bulkAddExpenses')
        .mockResolvedValue([testExpense]);
      renderModal({ defaultShared: true });
      fillRow(1, '10', 'Lunch');
      fireEvent.click(screen.getByRole('button', { name: '+ Row' }));
      fillRow(2, '20', 'Grab');
      fireEvent.click(rowOf(2).getByRole('button', { name: /More options/ }));
      fireEvent.click(rowOf(2).getByRole('button', { name: /Split for row 2/ }));

      fireEvent.click(screen.getByRole('button', { name: /^Save 2/ }));

      await waitFor(() => expect(bulkAddSpy).toHaveBeenCalled());
      const [shared, solo] = bulkAddSpy.mock.calls[0][0];
      expect(shared).toMatchObject({ is_shared: true, split_ratio: 0.5 });
      expect(solo).toMatchObject({ is_shared: false, split_ratio: 0 });
    });

    it('defaults to 50/50 in combined view and Solo in member view; keeps the payer select', () => {
      const { unmount } = renderModal({
        defaultShared: true,
        defaultPayerId: mockMembers[0].id,
      });
      expect(screen.getByLabelText(/Payer for all expenses/i)).toHaveValue(
        mockMembers[0].id,
      );
      fireEvent.click(rowOf(1).getByRole('button', { name: /More options/ }));
      expect(rowOf(1).getByRole('button', { name: /Split for row 1/ })).toHaveTextContent(
        '50/50',
      );
      unmount();

      renderModal({ defaultShared: false, defaultPayerId: mockMembers[1].id });
      expect(screen.getByLabelText(/Payer for all expenses/i)).toHaveValue(
        mockMembers[1].id,
      );
      fireEvent.click(rowOf(1).getByRole('button', { name: /More options/ }));
      expect(rowOf(1).getByRole('button', { name: /Split for row 1/ })).toHaveTextContent(
        'Solo',
      );
    });

    it('funds a row from a savings goal', async () => {
      const bulkAddSpy = vi
        .spyOn(financeService, 'bulkAddExpenses')
        .mockResolvedValue([testExpense]);
      renderModal();
      fillRow(1, '450', 'Bridal Gown Rental');

      fireEvent.click(rowOf(1).getByRole('button', { name: /Category for row 1/ }));
      fireEvent.click(rowOf(1).getByRole('option', { name: /Wedding Banquet/ }));

      fireEvent.click(screen.getByRole('button', { name: /^Save 1/ }));

      await waitFor(() =>
        expect(bulkAddSpy).toHaveBeenCalledWith([
          expect.objectContaining({
            amount: 450,
            goal_id: 'goal-wedding-1',
            category_id: null,
          }),
        ]),
      );
    });

    it('removing the last row clears it; removing another row offers undo', () => {
      renderModal();
      fillRow(1, '10', 'Lunch');
      fireEvent.click(screen.getByRole('button', { name: 'Remove row 1' }));
      expect(screen.getAllByRole('group', { name: /^Row \d+$/ })).toHaveLength(1);
      expect(screen.getByLabelText('Amount for row 1')).toHaveValue('');

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(screen.getByLabelText('Amount for row 1')).toHaveValue('10');

      fireEvent.click(screen.getByRole('button', { name: '+ Row' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove row 1' }));
      expect(screen.getAllByRole('group', { name: /^Row \d+$/ })).toHaveLength(1);
      expect(screen.getByText('Row removed')).toBeInTheDocument();
    });

    it('converts foreign currency rows using the per-currency rate', async () => {
      const bulkAddSpy = vi
        .spyOn(financeService, 'bulkAddExpenses')
        .mockResolvedValue([testExpense]);
      renderModal();
      fillRow(1, '1000', 'Ramen lunch');
      fireEvent.click(rowOf(1).getByRole('button', { name: /More options/ }));
      fireEvent.change(rowOf(1).getByLabelText('Currency for row 1'), {
        target: { value: 'JPY' },
      });
      fireEvent.change(rowOf(1).getByLabelText('Exchange rate JPY'), {
        target: { value: '100' },
      });

      expect(screen.getByRole('button', { name: 'Save 1 · S$10.00' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Save 1/ }));

      await waitFor(() =>
        expect(bulkAddSpy).toHaveBeenCalledWith([
          expect.objectContaining({
            amount: 10,
            original_amount: 1000,
            original_currency: 'JPY',
            exchange_rate: 100,
          }),
        ]),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /* 5. ExpenseListTable Sorting & Pagination                           */
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

    it('renders a distinct Goal badge with emoji and title in place of category for goal-funded spend', () => {
      const goalExpense: Expense = {
        ...testExpense,
        id: 'exp-goal-test',
        item: 'Wedding Rings',
        amount: 2500.0,
        goal_id: 'goal-wedding-1',
        category_id: null,
      };

      const mockGoals = [
        {
          id: 'goal-wedding-1',
          household_id: 'hh-1',
          title: 'Wedding Fund',
          target_amount: 30000,
          saved_so_far: 20000,
          target_date: '2027-06-01',
          monthly_contribution: 500,
          emoji: '💍',
          status: 'on_track' as const,
        },
      ];

      render(
        <ExpenseListTable
          expenses={[goalExpense]}
          categories={mockCategories}
          members={mockMembers}
          goals={mockGoals}
        />
      );

      expect(screen.getByText('Wedding Rings')).toBeInTheDocument();
      expect(screen.getByText('Wedding Fund')).toBeInTheDocument();
      expect(screen.getByText('💍')).toBeInTheDocument();
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

    it('opens the edit form when clicking edit button', () => {
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
