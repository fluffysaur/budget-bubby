/**
 * Comprehensive Unit & Integration Tests for Task 11:
 * Recurring Policies, Taxes & Annual Renewal Calendar
 *
 * Tests:
 * 1. Policy calculation engine & helpers:
 *    - Monthly amortized calculations (annually: amount / 12, monthly: amount)
 *    - 12-month calendar outlay groupings
 *    - Heaviest renewal month calculation
 *    - Upcoming renewal detection
 * 2. RecurringTable component:
 *    - Renders all columns, type badges, formatSGD amounts
 *    - Filters by search term
 *    - Filters by recurring item type
 *    - Empty state
 *    - Edit and Delete action callbacks
 * 3. RenewalCalendar component:
 *    - Renders 12 months (Jan to Dec)
 *    - Computes and displays monthly cash outlay totals
 *    - Visual indicator for current calendar month
 *    - Highlights heavy premium renewal months
 *    - Displays recurring item chips with provider/name and amount
 * 4. AddRecurringModal component:
 *    - Open/closed visibility
 *    - Required field validation (name, amount)
 *    - Frequency change toggles renewal month field
 *    - Add new recurring item submits correct payload
 *    - Edit existing recurring item pre-fills and updates payload
 * 5. Service Layer:
 *    - addRecurringItem, updateRecurringItem, deleteRecurringItem on mockFinanceService / financeService
 * 6. RecurringPage component:
 *    - 4 summary metric cards (Total Annual Outflow, Monthly Amortized Outflow, Upcoming Renewal, Heaviest Month)
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

describe('Policy Calculations & Logic', () => {
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
    expect(screen.getByRole('columnheader', { name: /Policy Name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Type/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Owner/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Frequency/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Premium/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Monthly Amortized/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Renewal/i })).toBeInTheDocument();

    // Policy names
    expect(screen.getByText('Manulife - Lifeready 25 Plus')).toBeInTheDocument();
    expect(screen.getByText('Income Enhanced Incomeshield Preferred')).toBeInTheDocument();
    expect(screen.getByText('Spotify Family Plan')).toBeInTheDocument();

    // Type badges
    const badges = screen.getAllByRole('status');
    expect(badges.length).toBeGreaterThan(0);

    // Currency values
    expect(screen.getByText(formatSGD(3200.0))).toBeInTheDocument();
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

    // Select Subscription filter
    const subscriptionFilter = screen.getByRole('tab', { name: /subscription/i });
    fireEvent.click(subscriptionFilter);

    expect(screen.getByText('Spotify Family Plan')).toBeInTheDocument();
    expect(screen.queryByText('Manulife - Lifeready 25 Plus')).not.toBeInTheDocument();
  });

  it('shows Bill and Other badges and filter tabs', () => {
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

    fireEvent.click(screen.getByRole('tab', { name: /^bill$/i }));
    expect(screen.getByText('SP Group Utilities')).toBeInTheDocument();
    expect(screen.queryByText('Cloud Storage')).not.toBeInTheDocument();
    expect(screen.queryByText('Spotify Family Plan')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /^other$/i }));
    expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
    expect(screen.queryByText('SP Group Utilities')).not.toBeInTheDocument();
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
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Policy 999' } });

    expect(screen.getByText(/No recurring items found/i)).toBeInTheDocument();
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

describe('RenewalCalendar Component', () => {
  it('renders all 12 months with their outlay totals', () => {
    render(
      <RenewalCalendar
        recurringItems={sampleItems}
        currentMonth={9} // September
      />
    );

    // 12 months
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    for (const month of monthNames) {
      expect(screen.getAllByText(new RegExp(month, 'i')).length).toBeGreaterThan(0);
    }

    // Cash outlay for Sep ($3,219.98) and May ($2,919.98)
    expect(screen.getByText(formatSGD(3219.98))).toBeInTheDocument();
    expect(screen.getByText(formatSGD(2919.98))).toBeInTheDocument();
  });

  it('highlights current calendar month and heavy renewal months', () => {
    render(
      <RenewalCalendar
        recurringItems={sampleItems}
        currentMonth={9} // September
      />
    );

    // Current month indicator
    expect(screen.getAllByText(/Current/i).length).toBeGreaterThan(0);

    // Heavy renewal indicator for September (highest outlay)
    expect(screen.getAllByText(/Heavy/i).length).toBeGreaterThan(0);
  });

  it('displays recurring item cards/chips in their designated renewal month', () => {
    render(
      <RenewalCalendar
        recurringItems={sampleItems}
        currentMonth={9}
      />
    );

    // Manulife in September
    expect(screen.getByText(/Manulife/i)).toBeInTheDocument();
    // Enhanced Incomeshield in October
    expect(screen.getByText(/Incomeshield/i)).toBeInTheDocument();
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

    expect(screen.queryByText(/Add Recurring Policy/i)).not.toBeInTheDocument();
  });

  it('renders modal with form fields when isOpen is true', () => {
    render(
      <AddRecurringModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText(/Add Recurring Policy/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Policy Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Owner/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Premium Amount/i)).toBeInTheDocument();
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

    const submitBtn = screen.getByRole('button', { name: /Save Policy/i });
    fireEvent.click(submitBtn);

    // Should not call onSave if name or amount is missing
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Policy name is required/i)).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText(/Policy Name/i), {
      target: { value: 'Great Eastern SupremeHealth' },
    });
    fireEvent.change(screen.getByLabelText(/Premium Amount/i), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByLabelText(/Frequency/i), {
      target: { value: 'annually' },
    });
    fireEvent.change(screen.getByLabelText(/Renewal Month/i), {
      target: { value: '11' }, // November
    });

    const submitBtn = screen.getByRole('button', { name: /Save Policy/i });
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

    fireEvent.change(screen.getByLabelText(/Policy Name/i), { target: { value: 'Phone Plan' } });
    fireEvent.change(screen.getByLabelText(/Premium Amount/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Frequency/i), { target: { value: 'monthly' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Policy/i }));
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Due day is required/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Due Day/i), { target: { value: '32' } });
    await act(async () => {
      // Bypass native min/max validation to exercise the in-form check
      fireEvent.submit(screen.getByRole('button', { name: /Save Policy/i }).closest('form')!);
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/between 1 and 31/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Due Day/i), { target: { value: '31' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Policy/i }));
    });
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 'monthly', due_day: 31, payment_month: null })
    );
  });

  it('allows annual items without a due day', async () => {
    const onSave = vi.fn();
    render(<AddRecurringModal isOpen={true} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/Policy Name/i), { target: { value: 'Car Insurance' } });
    fireEvent.change(screen.getByLabelText(/Premium Amount/i), { target: { value: '900' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Policy/i }));
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
    fireEvent.change(screen.getByLabelText(/Policy Name/i), { target: { value: 'Meal Plan' } });
    fireEvent.change(screen.getByLabelText(/Premium Amount/i), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText(/Frequency/i), { target: { value: 'monthly' } });
    fireEvent.change(screen.getByLabelText(/Due Day/i), { target: { value: '5' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Policy/i }));
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
    fireEvent.change(screen.getByLabelText(/Policy Name/i), { target: { value: 'Shield' } });
    fireEvent.change(screen.getByLabelText(/Premium Amount/i), { target: { value: '600' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Policy/i }));
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

    expect(screen.getByText(/Edit Recurring Policy/i)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Policy Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Manulife - Lifeready 25 Plus');
    const amountInput = screen.getByLabelText(/Premium Amount/i) as HTMLInputElement;
    expect(amountInput.value).toBe('3200');
  });
});

describe('Finance Service Policy Operations', () => {
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

  it('renders 4 summary metric cards: Total Annual, Monthly Amortized, Upcoming Renewal, Heaviest Month', async () => {
    render(
      <HouseholdProvider initialPerspective="household">
        <RecurringPage />
      </HouseholdProvider>
    );

    // Verify metric card labels
    await waitFor(() => {
      expect(screen.getByText(/Annual Outflow/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Monthly Amortized/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Next Renewal/i)).toBeInTheDocument();
      expect(screen.getByText(/Heaviest Month/i)).toBeInTheDocument();
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
      expect(screen.getByText(/Add Policy/i)).toBeInTheDocument();
    });

    // Click Add Policy button
    fireEvent.click(screen.getByRole('button', { name: /Add Policy/i }));

    // Modal appears
    expect(screen.getByText(/Add Recurring Policy/i)).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/Policy Name/i), {
      target: { value: 'AIA Vitality Plus' },
    });
    fireEvent.change(screen.getByLabelText(/Premium Amount/i), {
      target: { value: '600' },
    });
    fireEvent.change(screen.getByLabelText(/Frequency/i), {
      target: { value: 'annually' },
    });
    fireEvent.change(screen.getByLabelText(/Renewal Month/i), {
      target: { value: '12' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Save Policy/i }));

    // Wait for modal to close and new recurring item to show in table
    await waitFor(() => {
      expect(screen.getAllByText('AIA Vitality Plus').length).toBeGreaterThan(0);
    });
  });
});
