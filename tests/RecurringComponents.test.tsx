/**
 * Comprehensive Unit & Integration Tests for Task 11:
 * Recurring items (insurance, tax, subscriptions, bills, other) & Renewal Calendar
 *
 * Tests:
 * 1. Recurring calculation engine & helpers:
 *    - Monthly amortized calculations (annually: amount / 12, monthly: amount)
 *    - 12-month calendar outlay groupings
 *    - Heaviest renewal month calculation
 *    - Upcoming renewal detection
 * 2. RecurringTable component:
 *    - Renders all columns, type badges, formatSGD amounts
 *    - Filters by search term
 *    - Filters by recurring item type and status (Active / Ended / All)
 *    - Empty state
 *    - Edit and Delete action callbacks
 * 3. RenewalCalendar component:
 *    - Renders 12 month cards with compact totals and a proportional fill
 *    - Selected month panel lists annual then monthly items
 *    - Year stepper respects start/end dates and jumps back to this year
 * 4. AddRecurringModal component:
 *    - Open/closed visibility
 *    - Required field validation (name, amount)
 *    - Frequency change toggles renewal month field
 *    - Add new recurring item submits correct payload
 *    - Edit existing recurring item pre-fills and updates payload
 * 5. Service Layer:
 *    - addRecurringItem, updateRecurringItem, deleteRecurringItem on mockFinanceService / financeService
 * 6. RecurringPage component:
 *    - 2 summary cards (Annual Outflow, Next Renewal)
 *    - Perspective filtering (household vs yijia vs rachel)
 *    - Modal opening, recurring item addition, editing, and deletion flow
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { RecurringTable } from '../src/components/recurring/RecurringTable';
import { RenewalCalendar } from '../src/components/recurring/RenewalCalendar';
import { AddRecurringModal } from '../src/components/recurring/AddRecurringModal';
import { RecurringPage } from '../src/pages/RecurringPage';
import { financeService } from '../src/services/financeService';
import { mockFinanceService } from '../src/services/mockFinanceService';
import { formatSGD } from '../src/lib/currency';
import {
  buildYearOutlay,
  findNextRenewal,
  getRecurringItemStatus,
} from '../src/lib/recurringItems';
import type { RecurringItem, CreateRecurringItemInput } from '../src/types/finance';

const sampleItems: RecurringItem[] = [
  {
    id: 'pol-01',
    household_id: 'hh-01',
    owner_id: 'mem-00000000-0011', // Yi Jia
    type: 'insurance',
    name: 'Manulife - Lifeready 25 Plus',
    amount: 3200.0,
    frequency: 'annually',
    payment_month: 9,
    start_date: '2020-09-01',
    end_date: '2044-09-18',
    notes: 'Annual premium renewed in September',
    monthly_amortized_amount: 266.67,
  },
  {
    id: 'pol-02',
    household_id: 'hh-01',
    owner_id: 'mem-00000000-0011', // Yi Jia
    type: 'insurance',
    name: 'Income Enhanced Incomeshield Preferred',
    amount: 1600.0,
    frequency: 'annually',
    payment_month: 10,
    start_date: '2021-10-01',
    end_date: null,
    notes: 'Annual hospital shield',
    monthly_amortized_amount: 133.33,
  },
  {
    id: 'pol-03',
    household_id: 'hh-01',
    owner_id: 'mem-00000000-0011', // Yi Jia
    type: 'tax',
    name: 'Income Tax (2026)',
    amount: 1100.0,
    frequency: 'annually',
    payment_month: 5,
    start_date: '2026-05-05',
    end_date: '2027-04-05',
    notes: 'IRAS GIRO schedule',
    monthly_amortized_amount: 91.67,
  },
  {
    id: 'pol-04',
    household_id: 'hh-01',
    owner_id: 'mem-00000000-0012', // Rachel
    type: 'tax',
    name: 'Income Tax (2026)',
    amount: 1800.0,
    frequency: 'annually',
    payment_month: 5,
    start_date: '2026-05-05',
    end_date: '2027-04-05',
    notes: 'IRAS GIRO schedule',
    monthly_amortized_amount: 150.0,
  },
  {
    id: 'pol-05',
    household_id: 'hh-01',
    owner_id: 'mem-00000000-0012', // Rachel
    type: 'subscription',
    name: 'Spotify Family Plan',
    amount: 19.98,
    frequency: 'monthly',
    payment_month: null,
    start_date: '2023-01-01',
    end_date: null,
    notes: 'Shared music streaming',
    monthly_amortized_amount: 19.98,
  },
];

describe('Recurring Calculations & Logic', () => {
  it('correctly amortizes annual vs monthly recurring items', () => {
    // Annual recurring item: amount / 12
    const annualAmortized = Math.round((3200 / 12) * 100) / 100;
    expect(annualAmortized).toBe(266.67);

    // Monthly recurring item: full amount
    const monthlyAmortized = Math.round(19.98 * 100) / 100;
    expect(monthlyAmortized).toBe(19.98);
  });

  it('calculates total monthly cash outlays across 12 months', () => {
    // Compute cash outlay for each month 1-12
    // Month 5 (May): 1100 + 1800 + 19.98 = 2919.98
    // Month 9 (Sep): 3200 + 19.98 = 3219.98
    // Month 10 (Oct): 1600 + 19.98 = 1619.98
    // Other months: 19.98
    const monthlyOutlays: number[] = Array(12).fill(0);
    for (const p of sampleItems) {
      if (p.frequency === 'monthly') {
        for (let m = 0; m < 12; m++) {
          monthlyOutlays[m] += p.amount;
        }
      } else if (p.payment_month && p.payment_month >= 1 && p.payment_month <= 12) {
        monthlyOutlays[p.payment_month - 1] += p.amount;
      }
    }

    expect(Math.round(monthlyOutlays[4] * 100) / 100).toBe(2919.98); // May (index 4)
    expect(Math.round(monthlyOutlays[8] * 100) / 100).toBe(3219.98); // Sep (index 8)
    expect(Math.round(monthlyOutlays[9] * 100) / 100).toBe(1619.98); // Oct (index 9)
    expect(Math.round(monthlyOutlays[0] * 100) / 100).toBe(19.98);   // Jan (index 0)

    // Heaviest month is September (month 9, index 8)
    const maxOutlay = Math.max(...monthlyOutlays);
    const heaviestMonthIndex = monthlyOutlays.indexOf(maxOutlay);
    expect(heaviestMonthIndex + 1).toBe(9);
  });
});

describe('RecurringTable Component', () => {
  it('renders all table columns, recurring item details, and badges', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <RecurringTable
        recurringItems={sampleItems}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    // Headers
    expect(screen.getByRole('columnheader', { name: /^Name$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Type/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Owner/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Frequency/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Amount$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Per Month/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Renewal/i })).toBeInTheDocument();

    // Item names
    expect(screen.getByText('Manulife - Lifeready 25 Plus')).toBeInTheDocument();
    expect(screen.getByText('Income Enhanced Incomeshield Preferred')).toBeInTheDocument();
    expect(screen.getByText('Spotify Family Plan')).toBeInTheDocument();

    // Type badges
    const badges = screen.getAllByRole('status');
    expect(badges.length).toBeGreaterThan(0);

    // Currency values
    // Amount renders twice: mobile row and desktop column
    expect(screen.getAllByText(formatSGD(3200.0)).length).toBe(2);
    expect(screen.getByText(formatSGD(266.67))).toBeInTheDocument();
  });

  it('filters recurring items by search query', () => {
    render(
      <RecurringTable
        recurringItems={sampleItems}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Manulife' } });

    expect(screen.getByText('Manulife - Lifeready 25 Plus')).toBeInTheDocument();
    expect(screen.queryByText('Spotify Family Plan')).not.toBeInTheDocument();
  });

  it('filters recurring items by type selection', () => {
    render(
      <RecurringTable
        recurringItems={sampleItems}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Type filter/i), {
      target: { value: 'subscription' },
    });

    expect(screen.getByText('Spotify Family Plan')).toBeInTheDocument();
    expect(screen.queryByText('Manulife - Lifeready 25 Plus')).not.toBeInTheDocument();
  });

  it('shows Bill and Other badges and filters by them', () => {
    const extraItems: RecurringItem[] = [
      ...sampleItems,
      {
        ...sampleItems[4],
        id: 'ri-bill',
        type: 'bill',
        name: 'SP Group Utilities',
      },
      {
        ...sampleItems[4],
        id: 'ri-other',
        type: 'other',
        name: 'Cloud Storage',
      },
    ];
    render(<RecurringTable recurringItems={extraItems} onEdit={vi.fn()} onDelete={vi.fn()} />);

    const badges = screen.getAllByRole('status').map((b) => b.textContent);
    expect(badges).toContain('Bill');
    expect(badges).toContain('Other');

    fireEvent.change(screen.getByLabelText(/Type filter/i), { target: { value: 'bill' } });
    expect(screen.getByText('SP Group Utilities')).toBeInTheDocument();
    expect(screen.queryByText('Cloud Storage')).not.toBeInTheDocument();
    expect(screen.queryByText('Spotify Family Plan')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Type filter/i), { target: { value: 'other' } });
    expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
    expect(screen.queryByText('SP Group Utilities')).not.toBeInTheDocument();
  });

  it('shows the Nothing Recurring empty state with an add action', () => {
    const onAdd = vi.fn();
    render(<RecurringTable recurringItems={[]} onAdd={onAdd} />);
    expect(screen.getByText('Nothing Recurring')).toBeInTheDocument();
    expect(screen.getByText('Add a bill or subscription to start tracking.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add Recurring/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('displays empty state when filter has no matches', () => {
    render(
      <RecurringTable
        recurringItems={sampleItems}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Item 999' } });

    expect(screen.getByText(/No Matches/i)).toBeInTheDocument();
  });

  it('filters by status: Active by default, Ended dims with a badge', () => {
    const today = new Date(2026, 10, 5); // 5 Nov 2026
    const items: RecurringItem[] = [
      sampleItems[0],
      { ...sampleItems[4], id: 'ri-ended', name: 'Old Gym', end_date: '2026-03-31' },
      { ...sampleItems[4], id: 'ri-future', name: 'New Plan', start_date: '2027-03-01' },
    ];
    render(<RecurringTable recurringItems={items} referenceDate={today} />);

    // Active (default) hides ended items, keeps not-yet-started ones
    expect(screen.queryByText('Old Gym')).not.toBeInTheDocument();
    expect(screen.getByText('New Plan')).toBeInTheDocument();
    expect(screen.getByText("Starts Mar '27")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Status filter/i), { target: { value: 'ended' } });
    expect(screen.getByText('Old Gym')).toBeInTheDocument();
    expect(screen.getByText('Ended', { selector: ':not(option)' })).toBeInTheDocument();
    expect(screen.queryByText('New Plan')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Status filter/i), { target: { value: 'all' } });
    expect(screen.getByText('Old Gym')).toBeInTheDocument();
    expect(screen.getByText('Manulife - Lifeready 25 Plus')).toBeInTheDocument();
  });

  it('shows a title with a count that follows the filters', () => {
    render(<RecurringTable title="All Recurring" recurringItems={sampleItems} />);
    expect(screen.getByRole('heading', { name: 'All Recurring' })).toBeInTheDocument();
    expect(screen.getByText('5 items')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Type filter/i), { target: { value: 'tax' } });
    expect(screen.getByText('2 of 5 items')).toBeInTheDocument();
  });

  it('triggers onEdit and onDelete callbacks', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <RecurringTable
        recurringItems={sampleItems}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);
    expect(onEdit).toHaveBeenCalledWith(sampleItems[0]);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith(sampleItems[0].id);
  });
});

describe('Recurring year helpers', () => {
  it('reports active, upcoming and ended status by month', () => {
    const item = { ...sampleItems[0], start_date: '2026-03-01', end_date: '2027-02-28' };
    expect(getRecurringItemStatus(item, '2026-02')).toBe('upcoming');
    expect(getRecurringItemStatus(item, '2026-03')).toBe('active');
    expect(getRecurringItemStatus(item, '2027-02')).toBe('active');
    expect(getRecurringItemStatus(item, '2027-03')).toBe('ended');
  });

  it('builds a year of outlay that respects start and end dates', () => {
    const months = buildYearOutlay(sampleItems, 2026);
    expect(months).toHaveLength(12);
    expect(months[8].total).toBe(3219.98); // Sep
    expect(months[8].annualItems.map((i) => i.id)).toEqual(['pol-01']);
    expect(months[8].monthlyItems.map((i) => i.id)).toEqual(['pol-05']);
    expect(months[4].total).toBe(2919.98); // May

    // Income tax items end in Apr 2027, so May 2027 only has Spotify
    const next = buildYearOutlay(sampleItems, 2027);
    expect(next[4].total).toBe(19.98);

    // Before Spotify started (2023) and Manulife (2020-09), 2019 is empty
    expect(buildYearOutlay(sampleItems, 2019).every((m) => m.total === 0)).toBe(true);
  });

  it('finds the next renewal, skipping ended and not-yet-started items', () => {
    const today = new Date(2026, 10, 5); // 5 Nov 2026
    const next = findNextRenewal(sampleItems, today);
    // Income tax (May) ends Apr 2027, so the next one is Manulife in Sep 2027
    expect(next?.item.id).toBe('pol-01');
    expect(next?.date.getFullYear()).toBe(2027);
    expect(next?.date.getMonth()).toBe(8);

    const future = { ...sampleItems[1], id: 'future', payment_month: 12, start_date: '2028-01-01' };
    expect(findNextRenewal([future], today)?.date.getFullYear()).toBe(2028);
    expect(findNextRenewal([], today)).toBeNull();
  });
});

describe('RenewalCalendar Component', () => {
  const today = new Date(2026, 8, 10); // 10 Sep 2026

  it('renders 12 month cards with compact totals', () => {
    render(<RenewalCalendar recurringItems={sampleItems} referenceDate={today} />);

    for (const month of ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']) {
      expect(screen.getByText(month)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /September 2026/i })).toHaveTextContent('S$3.2k');
    expect(screen.getByRole('button', { name: /May 2026/i })).toHaveTextContent('S$2.9k');
    expect(screen.queryByText(/Heavy/i)).not.toBeInTheDocument();
  });

  it('fills each card relative to the biggest month', () => {
    render(<RenewalCalendar recurringItems={sampleItems} referenceDate={today} />);
    const fills = screen.getAllByTestId('month-fill');
    expect(fills[8]).toHaveStyle({ height: '100%' }); // Sep is the peak
    expect(parseFloat(fills[9].style.height)).toBeCloseTo((1619.98 / 3219.98) * 100, 1);
  });

  it('selects the current month and lists annual items before monthly ones', () => {
    render(<RenewalCalendar recurringItems={sampleItems} referenceDate={today} />);
    expect(screen.getByRole('button', { name: /September 2026/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('September 2026')).toBeInTheDocument();
    expect(screen.getByText(/Manulife/i)).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Spotify Family Plan')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /October 2026/i }));
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    expect(screen.getByText(/Incomeshield/i)).toBeInTheDocument();
    expect(screen.queryByText(/Manulife/i)).not.toBeInTheDocument();
  });

  it('steps between years and jumps back to this year', () => {
    render(<RenewalCalendar recurringItems={sampleItems} referenceDate={today} />);

    fireEvent.click(screen.getByRole('button', { name: /Next year/i }));
    // Income tax ended in Apr 2027
    expect(screen.getByRole('button', { name: /May 2027/i })).toHaveTextContent('S$20');

    fireEvent.click(screen.getByRole('button', { name: /jump to 2026/i }));
    expect(screen.getByRole('button', { name: /May 2026/i })).toBeInTheDocument();

    // Empty years are allowed
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Previous year/i }));
    }
    expect(screen.getByText('September 2016')).toBeInTheDocument();
    expect(screen.getByText('Nothing due')).toBeInTheDocument();
  });
});

describe('AddRecurringModal Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <AddRecurringModal
        isOpen={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.queryByText(/Add Recurring/i)).not.toBeInTheDocument();
  });

  it('renders modal with form fields when isOpen is true', () => {
    render(
      <AddRecurringModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText(/Add Recurring/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Owner/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Frequency/i)).toBeInTheDocument();
  });

  it('validates required inputs before saving', async () => {
    const onSave = vi.fn();
    render(
      <AddRecurringModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(submitBtn);

    // Should not call onSave if name or amount is missing
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
  });

  it('submits new recurring item with calculated amortized monthly amount', async () => {
    const onSave = vi.fn();
    render(
      <AddRecurringModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Name/i), {
      target: { value: 'Great Eastern SupremeHealth' },
    });
    fireEvent.change(screen.getByLabelText(/^Amount/i), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByLabelText(/Frequency/i), {
      target: { value: 'annually' },
    });
    fireEvent.change(screen.getByLabelText(/Renewal Month/i), {
      target: { value: '11' }, // November
    });

    const submitBtn = screen.getByRole('button', { name: /^Save$/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Great Eastern SupremeHealth',
        amount: 1200,
        frequency: 'annually',
        payment_month: 11,
      })
    );
  });

  it('requires a due day for monthly items and submits it', async () => {
    const onSave = vi.fn();
    render(<AddRecurringModal isOpen={true} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: 'Phone Plan' } });
    fireEvent.change(screen.getByLabelText(/^Amount/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Frequency/i), { target: { value: 'monthly' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Due day is required/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Due Day/i), { target: { value: '32' } });
    await act(async () => {
      // Bypass native min/max validation to exercise the in-form check
      fireEvent.submit(screen.getByRole('button', { name: /^Save$/i }).closest('form')!);
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/between 1 and 31/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Due Day/i), { target: { value: '31' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    });
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 'monthly', due_day: 31, payment_month: null })
    );
  });

  it('allows annual items without a due day', async () => {
    const onSave = vi.fn();
    render(<AddRecurringModal isOpen={true} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: 'Car Insurance' } });
    fireEvent.change(screen.getByLabelText(/^Amount/i), { target: { value: '900' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    });
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 'annually', due_day: null })
    );
  });

  it('shows a category picker only for subscription, bill and other, defaulting to Lifestyle', async () => {
    const categories = [
      { id: 'cat-food', household_id: 'hh-01', name: 'Food', color: '#000', icon: 'utensils', is_system: false },
      { id: 'cat-life', household_id: 'hh-01', name: 'Lifestyle', color: '#000', icon: 'sparkles', is_system: false },
    ];
    const onSave = vi.fn();
    render(<AddRecurringModal isOpen={true} onClose={vi.fn()} onSave={onSave} categories={categories} />);

    // Insurance (default type) hides the category picker
    expect(screen.queryByLabelText(/^Category$/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: 'bill' } });
    const categorySelect = screen.getByLabelText(/^Category$/i) as HTMLSelectElement;
    expect(categorySelect.value).toBe('cat-life');

    fireEvent.change(categorySelect, { target: { value: 'cat-food' } });
    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: 'Meal Plan' } });
    fireEvent.change(screen.getByLabelText(/^Amount/i), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText(/Frequency/i), { target: { value: 'monthly' } });
    fireEvent.change(screen.getByLabelText(/Due Day/i), { target: { value: '5' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    });
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'bill', category_id: 'cat-food', due_day: 5 })
    );
  });

  it('sends no category for insurance and tax', async () => {
    const categories = [
      { id: 'cat-life', household_id: 'hh-01', name: 'Lifestyle', color: '#000', icon: 'sparkles', is_system: false },
    ];
    const onSave = vi.fn();
    render(<AddRecurringModal isOpen={true} onClose={vi.fn()} onSave={onSave} categories={categories} />);
    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: 'Shield' } });
    fireEvent.change(screen.getByLabelText(/^Amount/i), { target: { value: '600' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: 'insurance', category_id: null }));
  });

  it('pre-fills fields when editing existing recurring item', () => {
    render(
      <AddRecurringModal
        isOpen={true}
        initialItem={sampleItems[0]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText(/Edit Recurring/i)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/^Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Manulife - Lifeready 25 Plus');
    const amountInput = screen.getByLabelText(/^Amount/i) as HTMLInputElement;
    expect(amountInput.value).toBe('3200');
  });
});

describe('Finance Service Recurring Operations', () => {
  beforeEach(() => {
    mockFinanceService.resetState();
  });

  it('adds a new recurring item via service', async () => {
    const newItemInput: CreateRecurringItemInput = {
      owner_id: 'mem-00000000-0011',
      type: 'insurance',
      name: 'Prudential PruShield',
      amount: 2400.0,
      frequency: 'annually',
      payment_month: 6,
      notes: 'Mid-year renewal',
    };

    const created = await financeService.addRecurringItem(newItemInput);
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Prudential PruShield');
    expect(created.amount).toBe(2400.0);
    expect(created.monthly_amortized_amount).toBe(200.0);

    const allItems = await financeService.getRecurringItems();
    expect(allItems.some((p) => p.id === created.id)).toBe(true);
  });

  it('deletes a recurring item via service', async () => {
    const recurringItems = await financeService.getRecurringItems();
    const itemToDelete = recurringItems[0];

    await financeService.deleteRecurringItem(itemToDelete.id);

    const updatedItems = await financeService.getRecurringItems();
    expect(updatedItems.some((p) => p.id === itemToDelete.id)).toBe(false);
  });

  it('updates a recurring item via service', async () => {
    const recurringItems = await financeService.getRecurringItems();
    const itemToUpdate = recurringItems[0];

    const updated = await financeService.updateRecurringItem(itemToUpdate.id, {
      amount: 4800.0,
    });

    expect(updated.amount).toBe(4800.0);
    expect(updated.monthly_amortized_amount).toBe(400.0);
  });
});

describe('RecurringPage Component', () => {
  beforeEach(() => {
    mockFinanceService.resetState();
  });

  it('renders 2 summary cards: Annual Outflow and Next Renewal', async () => {
    render(
      <HouseholdProvider initialPerspective="household">
        <RecurringPage />
      </HouseholdProvider>
    );

    // Verify metric card labels
    await waitFor(() => {
      expect(screen.getByText(/Annual Outflow/i)).toBeInTheDocument();
      expect(screen.getByText(/Next Renewal/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Heaviest Month/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/^Calendar$/)).toBeInTheDocument();
    });
  });

  it('filters recurring items and metrics by perspective (Yi Jia vs Rachel)', async () => {
    const { rerender } = render(
      <HouseholdProvider initialPerspective="yijia">
        <RecurringPage />
      </HouseholdProvider>
    );

    await waitFor(() => {
      // In mock seed data:
      // Yi Jia has Manulife ($3,200), IncomeShield ($1,600), Tax ($1,100) -> Total $5,900
      expect(screen.getAllByText(formatSGD(5900.0)).length).toBeGreaterThan(0);
    });

    // Rachel's perspective
    rerender(
      <HouseholdProvider initialPerspective="rachel">
        <RecurringPage />
      </HouseholdProvider>
    );

    await waitFor(() => {
      // In mock seed data:
      // Rachel has Tax ($1,800) -> Total $1,800
      expect(screen.getAllByText(formatSGD(1800.0)).length).toBeGreaterThan(0);
    });
  });

  it('integrates AddRecurringModal to create a new recurring item and refresh view', async () => {
    render(
      <HouseholdProvider initialPerspective="household">
        <RecurringPage />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Recurring/i })).toBeInTheDocument();
    });

    // Click Add Recurring button
    fireEvent.click(screen.getByRole('button', { name: /Add Recurring/i }));

    // Modal appears
    expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/^Name/i), {
      target: { value: 'AIA Vitality Plus' },
    });
    fireEvent.change(screen.getByLabelText(/^Amount/i), {
      target: { value: '600' },
    });
    fireEvent.change(screen.getByLabelText(/Frequency/i), {
      target: { value: 'annually' },
    });
    fireEvent.change(screen.getByLabelText(/Renewal Month/i), {
      target: { value: '12' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    // Wait for modal to close and new recurring item to show in table
    await waitFor(() => {
      expect(screen.getAllByText('AIA Vitality Plus').length).toBeGreaterThan(0);
    });
  });
});
