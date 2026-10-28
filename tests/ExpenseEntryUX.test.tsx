/**
 * Expense Entry UX: Cents-First Input, Currency Conversion, Audio & Mobile Overflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CentsFirstAmountInput } from '../src/components/expenses/CentsFirstAmountInput';
import { QuickAddExpenseModal } from '../src/components/expenses/QuickAddExpenseModal';
import { ExpenseSuccessCelebration } from '../src/components/expenses/ExpenseSuccessCelebration';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { financeService } from '../src/services/financeService';
import * as soundEffects from '../src/lib/soundEffects';
import { mockCategories, mockMembers } from '../src/data/mockSeedData';
import { getTodayDateString, getSingaporeDate, formatISODate } from '../src/lib/dateUtils';
import type { SavingsGoal } from '../src/types/finance';

describe('CentsFirstAmountInput Component', () => {
  it('shifts digits right-to-left ATM/Cashier style (0.00 -> 0.01 -> 0.12 -> 1.25 -> 12.50)', () => {
    const onChange = vi.fn();
    render(<CentsFirstAmountInput onChange={onChange} currencySymbol="S$" currencyCode="SGD" />);

    const input = screen.getByLabelText(/amount in sgd/i) as HTMLInputElement;
    expect(input.value).toBe('0.00');

    // Type '1'
    fireEvent.keyDown(input, { key: '1' });
    expect(input.value).toBe('0.01');
    expect(onChange).toHaveBeenLastCalledWith(0.01);

    // Type '2'
    fireEvent.keyDown(input, { key: '2' });
    expect(input.value).toBe('0.12');
    expect(onChange).toHaveBeenLastCalledWith(0.12);

    // Type '5'
    fireEvent.keyDown(input, { key: '5' });
    expect(input.value).toBe('1.25');
    expect(onChange).toHaveBeenLastCalledWith(1.25);

    // Type '0'
    fireEvent.keyDown(input, { key: '0' });
    expect(input.value).toBe('12.50');
    expect(onChange).toHaveBeenLastCalledWith(12.5);
  });

  it('shifts right on Backspace (12.50 -> 1.25)', () => {
    const onChange = vi.fn();
    render(<CentsFirstAmountInput value={12.5} onChange={onChange} currencySymbol="S$" currencyCode="SGD" />);

    const input = screen.getByLabelText(/amount in sgd/i) as HTMLInputElement;
    expect(input.value).toBe('12.50');

    // Hit Backspace
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(input.value).toBe('1.25');
    expect(onChange).toHaveBeenLastCalledWith(1.25);
  });

  it('resets to 0.00 on Escape key and on clicking Clear button', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CentsFirstAmountInput value={12.5} onChange={onChange} currencySymbol="S$" currencyCode="SGD" />
    );

    const input = screen.getByLabelText(/amount in sgd/i) as HTMLInputElement;

    // Test Escape key
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('0.00');
    expect(onChange).toHaveBeenLastCalledWith(0);

    // Test Clear button click
    rerender(<CentsFirstAmountInput value={25.0} onChange={onChange} currencySymbol="S$" currencyCode="SGD" />);
    const clearBtn = screen.getByRole('button', { name: /clear amount/i });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(input.value).toBe('0.00');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('displays the active currency symbol and uses inputMode="numeric"', () => {
    render(<CentsFirstAmountInput onChange={vi.fn()} currencySymbol="₫" currencyCode="VND" />);

    expect(screen.getByText('₫')).toBeInTheDocument();
    const input = screen.getByLabelText(/amount in vnd/i) as HTMLInputElement;
    expect(input.getAttribute('inputMode')).toBe('numeric');
  });

  it('handles zero-decimal currencies like VND and JPY correctly', () => {
    const onChange = vi.fn();
    render(<CentsFirstAmountInput onChange={onChange} currencySymbol="₫" currencyCode="VND" />);

    const input = screen.getByLabelText(/amount in vnd/i) as HTMLInputElement;
    expect(input.value).toBe('0');

    // Type '5' -> '5', '0' -> '50', '0' -> '500'
    fireEvent.keyDown(input, { key: '5' });
    expect(input.value).toBe('5');
    expect(onChange).toHaveBeenLastCalledWith(5);

    fireEvent.keyDown(input, { key: '0' });
    expect(input.value).toBe('50');
    expect(onChange).toHaveBeenLastCalledWith(50);

    fireEvent.keyDown(input, { key: '0' });
    expect(input.value).toBe('500');
    expect(onChange).toHaveBeenLastCalledWith(500);
  });
});

describe('QuickAddExpenseModal Currency Conversion & UX', () => {
  const sampleGoals: SavingsGoal[] = [
    {
      id: 'goal-vietnam-trip',
      household_id: 'hh-00000000-0001',
      title: 'Vietnam Trip',
      target_amount: 2000,
      saved_so_far: 1450,
      target_date: '2026-12-31',
      monthly_contribution: 200,
      emoji: '✈️',
      status: 'on_track',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('converts foreign currency (e.g. VND) to SGD live and submits original_amount, original_currency, and exchange_rate', async () => {
    const addExpenseSpy = vi.spyOn(financeService, 'addExpense').mockResolvedValueOnce({
      id: 'exp-fx-1',
      household_id: 'hh-00000000-0001',
      payer_id: 'mem-00000000-0011',
      category_id: 'cat-00000000-0101',
      date: '2026-09-15',
      item: 'Pho Bo in Hanoi',
      amount: 13.23, // 250000 / 18900
      remarks: null,
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
      original_amount: 250000,
      original_currency: 'VND',
      exchange_rate: 18900,
    });

    const onClose = vi.fn();
    const onExpenseAdded = vi.fn();

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

    // Select Currency: VND
    const currencySelect = screen.getByLabelText(/select currency/i);
    fireEvent.change(currencySelect, { target: { value: 'VND' } });

    // Enter foreign amount 250,000 VND
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '250000' } });

    // Check live preview text: ≈ S$13.23
    expect(screen.getByText(/converted:/i)).toBeInTheDocument();
    expect(screen.getByText(/≈ S\$13\.23/)).toBeInTheDocument();

    // Check exchange rate input is present
    const rateInput = screen.getByLabelText(/exchange rate/i) as HTMLInputElement;
    expect(rateInput).toBeInTheDocument();
    expect(rateInput.value).toBe('18900');

    // Fill Item
    const itemInput = screen.getByLabelText(/item|description/i);
    fireEvent.change(itemInput, { target: { value: 'Pho Bo in Hanoi' } });

    // Submit Form
    const submitBtn = screen.getByRole('button', { name: /add expense/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(addExpenseSpy).toHaveBeenCalledTimes(1);
    });

    expect(addExpenseSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        original_amount: 250000,
        original_currency: 'VND',
        exchange_rate: 18900,
        amount: 13.23,
        item: 'Pho Bo in Hanoi',
      })
    );
  });

  it('allows overriding the exchange rate and updates live SGD calculation accordingly', async () => {
    const addExpenseSpy = vi.spyOn(financeService, 'addExpense').mockResolvedValueOnce({
      id: 'exp-fx-2',
      household_id: 'hh-00000000-0001',
      payer_id: 'mem-00000000-0011',
      category_id: 'cat-00000000-0101',
      date: '2026-09-15',
      item: 'Coffee in Tokyo',
      amount: 10.0,
      remarks: null,
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
      original_amount: 1000,
      original_currency: 'JPY',
      exchange_rate: 100,
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

    // Select JPY
    fireEvent.change(screen.getByLabelText(/select currency/i), { target: { value: 'JPY' } });

    // Enter 1000 JPY
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '1000' } });

    // Custom rate: 1 SGD = 100 JPY (so 1000 JPY = S$10.00)
    const rateInput = screen.getByLabelText(/exchange rate/i);
    fireEvent.change(rateInput, { target: { value: '100' } });

    // Check preview updated to S$10.00
    expect(screen.getByText(/≈ S\$10\.00/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/item|description/i), { target: { value: 'Coffee in Tokyo' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
    });

    await waitFor(() => {
      expect(addExpenseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          original_currency: 'JPY',
          original_amount: 1000,
          exchange_rate: 100,
          amount: 10,
        })
      );
    });
  });

  it('supports the 2-button segmented toggle: Personal vs Shared (50/50)', async () => {
    const addExpenseSpy = vi.spyOn(financeService, 'addExpense').mockResolvedValueOnce({
      id: 'exp-split-1',
      household_id: 'hh-00000000-0001',
      payer_id: 'mem-00000000-0011',
      category_id: 'cat-00000000-0101',
      date: '2026-09-15',
      item: 'Solo Snack',
      amount: 15.0,
      remarks: null,
      is_shared: false,
      split_ratio: 0.0,
      settled: false,
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

    const personalBtn = screen.getByRole('button', { name: /personal/i });
    const sharedBtn = screen.getByRole('button', { name: /shared \(50\/50\)/i });

    expect(personalBtn).toBeInTheDocument();
    expect(sharedBtn).toBeInTheDocument();

    // Click Personal
    fireEvent.click(personalBtn);
    expect(personalBtn.getAttribute('aria-pressed')).toBe('true');
    expect(sharedBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '15.00' } });
    fireEvent.change(screen.getByLabelText(/item|description/i), { target: { value: 'Solo Snack' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
    });

    await waitFor(() => {
      expect(addExpenseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          is_shared: false,
          split_ratio: 0.0,
        })
      );
    });
  });

  it('supports 1-tap date chips (Today, Yesterday, 2d ago)', async () => {
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

    const todayChip = screen.getByRole('button', { name: /^today$/i });
    const yesterdayChip = screen.getByRole('button', { name: /^yesterday$/i });
    const twoDaysAgoChip = screen.getByRole('button', { name: /^2d ago$/i });

    expect(todayChip).toBeInTheDocument();
    expect(yesterdayChip).toBeInTheDocument();
    expect(twoDaysAgoChip).toBeInTheDocument();

    const dateInput = screen.getByLabelText(/custom date/i) as HTMLInputElement;

    // Click Yesterday
    fireEvent.click(yesterdayChip);
    const dYest = getSingaporeDate();
    dYest.setDate(dYest.getDate() - 1);
    expect(dateInput.value).toBe(formatISODate(dYest));

    // Click 2d ago
    fireEvent.click(twoDaysAgoChip);
    const d2 = getSingaporeDate();
    d2.setDate(d2.getDate() - 2);
    expect(dateInput.value).toBe(formatISODate(d2));

    // Click Today
    fireEvent.click(todayChip);
    expect(dateInput.value).toBe(getTodayDateString());
  });

  it('auto-selects Transport category when typing Grab or MRT if category was not manually changed', async () => {
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

    const itemInput = screen.getByLabelText(/item|description/i);
    fireEvent.change(itemInput, { target: { value: 'Grab ride to CBD' } });

    // Category button for Transport should now be pressed
    const transportChip = screen.getByRole('button', { name: /transport/i });
    expect(transportChip.getAttribute('aria-pressed')).toBe('true');
  });

  it('supports tag picker (#VietnamTrip) and optional goal linking', async () => {
    const addExpenseSpy = vi.spyOn(financeService, 'addExpense').mockResolvedValueOnce({
      id: 'exp-tag-goal-1',
      household_id: 'hh-00000000-0001',
      payer_id: 'mem-00000000-0011',
      category_id: 'cat-00000000-0101',
      date: '2026-09-15',
      item: 'Banh Mi',
      amount: 4.5,
      remarks: 'Tasty street food',
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
      tags: ['#VietnamTrip'],
      goal_id: 'goal-vietnam-trip',
    });

    await act(async () => {
      render(
        <HouseholdProvider>
          <QuickAddExpenseModal
            isOpen={true}
            onClose={vi.fn()}
            categories={mockCategories}
            members={mockMembers}
            goals={sampleGoals}
          />
        </HouseholdProvider>
      );
    });

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '4.50' } });
    fireEvent.change(screen.getByLabelText(/item|description/i), { target: { value: 'Banh Mi' } });
    fireEvent.change(screen.getByLabelText(/remarks|notes/i), { target: { value: 'Tasty street food' } });

    // Add Tag
    const tagInput = screen.getByPlaceholderText(/vietnamtrip/i);
    fireEvent.change(tagInput, { target: { value: 'VietnamTrip' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ tag/i }));
    expect(screen.getByText('#VietnamTrip')).toBeInTheDocument();

    // Toggle Goal Spend and select goal
    const goalSpendSwitch = screen.getByRole('switch', { name: /fund from savings goal/i });
    fireEvent.click(goalSpendSwitch);
    const goalChip = screen.getByRole('button', { name: /vietnam trip/i });
    fireEvent.click(goalChip);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
    });

    await waitFor(() => {
      expect(addExpenseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['#VietnamTrip'],
          goal_id: 'goal-vietnam-trip',
          remarks: 'Tasty street food',
        })
      );
    });
  });

  it('declutters description by removing suggested quick tags, supports more options accordion and 3 recent tags', async () => {
    // Seed localStorage with recent tags
    window.localStorage.setItem(
      'budget_bubby_recent_tags_global_v2',
      JSON.stringify(['Dinner', 'Hawker', 'FairPrice', 'OldTag'])
    );

    await act(async () => {
      render(
        <HouseholdProvider>
          <QuickAddExpenseModal
            isOpen={true}
            onClose={vi.fn()}
            categories={mockCategories}
            members={mockMembers}
            goals={sampleGoals}
          />
        </HouseholdProvider>
      );
    });

    // 1. Suggested tag row above description is removed
    expect(screen.queryByText(/tap tag or type/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /quick tags/i })).not.toBeInTheDocument();

    // 2. Expand accordion
    const moreOptionsToggle = screen.getByRole('button', { name: /more options/i });
    expect(moreOptionsToggle).toBeInTheDocument();
    fireEvent.click(moreOptionsToggle);

    // 3. Up to 3 recent tags are displayed
    expect(screen.getByRole('button', { name: /add tag dinner/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add tag hawker/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add tag fairprice/i })).toBeInTheDocument();
    // 4th tag should NOT be shown since limit is 3
    expect(screen.queryByRole('button', { name: /add tag oldtag/i })).not.toBeInTheDocument();

    // 4. Click a recent tag -> attaches it to tags list
    fireEvent.click(screen.getByRole('button', { name: /add tag dinner/i }));
    expect(screen.getByText('#Dinner')).toBeInTheDocument();
  });

  it('renders dedicated "Fund from Savings Goal" toggle row and shows "+ More" button when > 4 goals', async () => {
    const manyGoals = [
      ...sampleGoals,
      {
        id: 'goal-3',
        household_id: 'hh-1',
        title: 'Emergency Fund',
        target_amount: 20000,
        saved_so_far: 15000,
        target_date: '2027-12-01',
        monthly_contribution: 500,
        emoji: '🛡️',
        status: 'on_track' as const,
      },
      {
        id: 'goal-4',
        household_id: 'hh-1',
        title: 'New Car',
        target_amount: 40000,
        saved_so_far: 10000,
        target_date: '2028-01-01',
        monthly_contribution: 800,
        emoji: '🚗',
        status: 'on_track' as const,
      },
      {
        id: 'goal-5',
        household_id: 'hh-1',
        title: 'Baby Fund',
        target_amount: 30000,
        saved_so_far: 5000,
        target_date: '2028-06-01',
        monthly_contribution: 600,
        emoji: '👶',
        status: 'on_track' as const,
      },
      {
        id: 'goal-6',
        household_id: 'hh-1',
        title: 'Tech Upgrade',
        target_amount: 5000,
        saved_so_far: 2000,
        target_date: '2027-03-01',
        monthly_contribution: 300,
        emoji: '💻',
        status: 'on_track' as const,
      },
    ];

    await act(async () => {
      render(
        <HouseholdProvider>
          <QuickAddExpenseModal
            isOpen={true}
            onClose={vi.fn()}
            categories={mockCategories}
            members={mockMembers}
            goals={manyGoals}
          />
        </HouseholdProvider>
      );
    });

    // 1. Initial state: Category is visible, toggle row is present
    expect(screen.getByText('Fund from Savings Goal')).toBeInTheDocument();
    expect(screen.getByText('Excludes from monthly budget caps')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();

    // 2. Toggle ON
    const switchEl = screen.getByRole('switch', { name: /fund from savings goal/i });
    expect(switchEl).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(switchEl);
    expect(switchEl).toHaveAttribute('aria-checked', 'true');

    // 3. Header swaps to "Goal" and shows "+ More (1)" button (5 goals total - 4 visible)
    expect(screen.getByText('Goal')).toBeInTheDocument();
    const moreBtn = screen.getByRole('button', { name: /\+ more \(1\)/i });
    expect(moreBtn).toBeInTheDocument();

    // 4. Click "+ More" -> expands to all 6 goals, button becomes "Show less"
    fireEvent.click(moreBtn);
    expect(screen.getByRole('button', { name: /tech upgrade/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
  });

  it('dispatches window expenseAdded event upon successful expense submission', async () => {
    const mockExpense = {
      id: 'exp-event-sub-1',
      household_id: 'hh-00000000-0001',
      payer_id: 'mem-00000000-0011',
      category_id: 'cat-00000000-0101',
      date: '2026-09-15',
      item: 'Kaya Toast Set',
      amount: 5.8,
      remarks: null,
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
    };
    vi.spyOn(financeService, 'addExpense').mockResolvedValueOnce(mockExpense);

    const eventListener = vi.fn();
    window.addEventListener('expenseAdded', eventListener);

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

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '5.80' } });
    fireEvent.change(screen.getByLabelText(/item|description/i), {
      target: { value: 'Kaya Toast Set' },
    });

    const submitBtn = screen.getByRole('button', { name: /add expense/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(eventListener).toHaveBeenCalledTimes(1);
    });
    expect((eventListener.mock.calls[0][0] as CustomEvent).detail).toEqual(mockExpense);

    window.removeEventListener('expenseAdded', eventListener);
  });
});

describe('ExpenseSuccessCelebration Toast & Audio', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders celebratory toast with formatted S$ amount and plays cha-ching audio', () => {
    const playSpy = vi.spyOn(soundEffects, 'playChaChingSound').mockImplementation(() => {});

    render(
      <ExpenseSuccessCelebration
        expense={{
          id: 'exp-cel-1',
          household_id: 'hh-00000000-0001',
          payer_id: 'mem-00000000-0011',
          date: '2026-09-15',
          item: 'FairPrice Groceries',
          amount: 68.4,
          is_shared: true,
          split_ratio: 0.5,
          settled: false,
        }}
      />
    );

    expect(screen.getByText('Cha-ching!')).toBeInTheDocument();
    expect(screen.getByText('S$68.40')).toBeInTheDocument();
    expect(screen.getByText('FairPrice Groceries')).toBeInTheDocument();
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Verify mobile overflow constraint
    const toast = screen.getByRole('status');
    expect(toast.className).toContain('max-w-[calc(100vw-2rem)]');
  });

  it('triggers celebration toast from window expenseAdded event and dismisses on click', () => {
    const playSpy = vi.spyOn(soundEffects, 'playChaChingSound').mockImplementation(() => {});

    render(<ExpenseSuccessCelebration />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('expenseAdded', {
          detail: {
            id: 'exp-event-1',
            item: 'Bubble Tea',
            amount: 6.5,
          },
        })
      );
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Bubble Tea')).toBeInTheDocument();
    expect(screen.getByText('S$6.50')).toBeInTheDocument();
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Clicking toast dismisses it immediately
    fireEvent.click(screen.getByRole('status'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
