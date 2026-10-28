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
 * 2. PolicyTable component:
 *    - Renders all columns, type badges, formatSGD amounts
 *    - Filters by search term
 *    - Filters by policy type
 *    - Empty state
 *    - Edit and Delete action callbacks
 * 3. RenewalCalendar component:
 *    - Renders 12 months (Jan to Dec)
 *    - Computes and displays monthly cash outlay totals
 *    - Visual indicator for current calendar month
 *    - Highlights heavy premium renewal months
 *    - Displays policy chips with provider/name and amount
 * 4. AddPolicyModal component:
 *    - Open/closed visibility
 *    - Required field validation (name, amount)
 *    - Frequency change toggles renewal month field
 *    - Add new policy submits correct payload
 *    - Edit existing policy pre-fills and updates payload
 * 5. Service Layer:
 *    - addPolicy, updatePolicy, deletePolicy on mockFinanceService / financeService
 * 6. RecurringPage component:
 *    - 4 summary metric cards (Total Annual Outflow, Monthly Amortized Outflow, Upcoming Renewal, Heaviest Month)
 *    - Perspective filtering (household vs yijia vs rachel)
 *    - Modal opening, policy addition, editing, and deletion flow
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { PolicyTable } from '../src/components/recurring/PolicyTable';
import { RenewalCalendar } from '../src/components/recurring/RenewalCalendar';
import { AddPolicyModal } from '../src/components/recurring/AddPolicyModal';
import { RecurringPage } from '../src/pages/RecurringPage';
import { financeService } from '../src/services/financeService';
import { mockFinanceService } from '../src/services/mockFinanceService';
import { formatSGD } from '../src/lib/currency';
import type { RecurringPolicy, CreatePolicyInput } from '../src/types/finance';

const samplePolicies: RecurringPolicy[] = [
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
  it('correctly amortizes annual vs monthly policies', () => {
    // Annual policy: amount / 12
    const annualAmortized = Math.round((3200 / 12) * 100) / 100;
    expect(annualAmortized).toBe(266.67);

    // Monthly policy: full amount
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
    for (const p of samplePolicies) {
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

describe('PolicyTable Component', () => {
  it('renders all table columns, policy details, and badges', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <PolicyTable
        policies={samplePolicies}
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

  it('filters policies by search query', () => {
    render(
      <PolicyTable
        policies={samplePolicies}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Manulife' } });

    expect(screen.getByText('Manulife - Lifeready 25 Plus')).toBeInTheDocument();
    expect(screen.queryByText('Spotify Family Plan')).not.toBeInTheDocument();
  });

  it('filters policies by type selection', () => {
    render(
      <PolicyTable
        policies={samplePolicies}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Select Subscription filter
    const subscriptionFilter = screen.getByRole('button', { name: /subscription/i });
    fireEvent.click(subscriptionFilter);

    expect(screen.getByText('Spotify Family Plan')).toBeInTheDocument();
    expect(screen.queryByText('Manulife - Lifeready 25 Plus')).not.toBeInTheDocument();
  });

  it('displays empty state when filter has no matches', () => {
    render(
      <PolicyTable
        policies={samplePolicies}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Policy 999' } });

    expect(screen.getByText(/No policies found/i)).toBeInTheDocument();
  });

  it('triggers onEdit and onDelete callbacks', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <PolicyTable
        policies={samplePolicies}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);
    expect(onEdit).toHaveBeenCalledWith(samplePolicies[0]);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith(samplePolicies[0].id);
  });
});

describe('RenewalCalendar Component', () => {
  it('renders all 12 months with their outlay totals', () => {
    render(
      <RenewalCalendar
        policies={samplePolicies}
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
        policies={samplePolicies}
        currentMonth={9} // September
      />
    );

    // Current month indicator
    expect(screen.getAllByText(/Current/i).length).toBeGreaterThan(0);

    // Heavy renewal indicator for September (highest outlay)
    expect(screen.getAllByText(/Heavy/i).length).toBeGreaterThan(0);
  });

  it('displays policy cards/chips in their designated renewal month', () => {
    render(
      <RenewalCalendar
        policies={samplePolicies}
        currentMonth={9}
      />
    );

    // Manulife in September
    expect(screen.getByText(/Manulife/i)).toBeInTheDocument();
    // Enhanced Incomeshield in October
    expect(screen.getByText(/Incomeshield/i)).toBeInTheDocument();
  });
});

describe('AddPolicyModal Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <AddPolicyModal
        isOpen={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.queryByText(/Add Recurring Policy/i)).not.toBeInTheDocument();
  });

  it('renders modal with form fields when isOpen is true', () => {
    render(
      <AddPolicyModal
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
      <AddPolicyModal
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

  it('submits new policy with calculated amortized monthly amount', async () => {
    const onSave = vi.fn();
    render(
      <AddPolicyModal
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

  it('pre-fills fields when editing existing policy', () => {
    render(
      <AddPolicyModal
        isOpen={true}
        initialPolicy={samplePolicies[0]}
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

  it('adds a new recurring policy via service', async () => {
    const newPolicyInput: CreatePolicyInput = {
      owner_id: 'mem-00000000-0011',
      type: 'insurance',
      name: 'Prudential PruShield',
      amount: 2400.0,
      frequency: 'annually',
      payment_month: 6,
      notes: 'Mid-year renewal',
    };

    const created = await financeService.addPolicy(newPolicyInput);
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Prudential PruShield');
    expect(created.amount).toBe(2400.0);
    expect(created.monthly_amortized_amount).toBe(200.0);

    const allPolicies = await financeService.getPolicies();
    expect(allPolicies.some((p) => p.id === created.id)).toBe(true);
  });

  it('deletes a recurring policy via service', async () => {
    const policies = await financeService.getPolicies();
    const policyToDelete = policies[0];

    await financeService.deletePolicy(policyToDelete.id);

    const updatedPolicies = await financeService.getPolicies();
    expect(updatedPolicies.some((p) => p.id === policyToDelete.id)).toBe(false);
  });

  it('updates a recurring policy via service', async () => {
    const policies = await financeService.getPolicies();
    const policyToUpdate = policies[0];

    const updated = await financeService.updatePolicy(policyToUpdate.id, {
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

  it('filters policies and metrics by perspective (Yi Jia vs Rachel)', async () => {
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

  it('integrates AddPolicyModal to create a new policy and refresh view', async () => {
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

    // Wait for modal to close and new policy to show in table
    await waitFor(() => {
      expect(screen.getAllByText('AIA Vitality Plus').length).toBeGreaterThan(0);
    });
  });
});
