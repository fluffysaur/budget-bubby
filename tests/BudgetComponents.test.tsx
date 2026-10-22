/**
 * Unit & Component Tests for Task 7:
 * - MonthPicker
 * - BudgetWaterfall
 * - CategoryProgressList
 * - BaseProfileEditorModal
 * - BudgetPage
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { MonthPicker } from '../src/components/budget/MonthPicker';
import { BudgetWaterfall } from '../src/components/budget/BudgetWaterfall';
import { CategoryProgressList } from '../src/components/budget/CategoryProgressList';
import { BaseProfileEditorModal } from '../src/components/budget/BaseProfileEditorModal';
import { BudgetPage } from '../src/pages/BudgetPage';
import { financeService } from '../src/services/financeService';
import { mockCategories, mockBaseProfiles, mockBaseAllocations } from '../src/data/mockSeedData';
import { getCurrentMonth } from '../src/lib/dateUtils';
import * as supabaseClientModule from '../src/services/supabaseClient';
import type { MonthlyBudget, MonthlyBudgetCategoryDetail } from '../src/types/finance';

const sampleBudget: MonthlyBudget = {
  id: 'mb-test-01',
  household_id: 'hh-00000000-0001',
  owner_id: 'mem-00000000-0011',
  month: '2026-09',
  gross_salary: 6000.0,
  bonus: 0.0,
  cpf_deduction: 1200.0,
  taxes_deduction: 91.67,
  insurance_deduction: 400.0,
  after_deductions: 4308.33,
  notes: 'September test budget',
  is_locked: false,
};

const sampleCategories: MonthlyBudgetCategoryDetail[] = [
  {
    id: 'mbc-test-01',
    monthly_budget_id: 'mb-test-01',
    category_id: 'cat-00000000-0101',
    percentage: 0.15,
    allocated_amount: 646.25,
    actualSpent: 300.0, // 46.4% -> <= 80% (Green)
    remaining: 346.25,
    category: mockCategories.find((c) => c.id === 'cat-00000000-0101'),
  },
  {
    id: 'mbc-test-02',
    monthly_budget_id: 'mb-test-01',
    category_id: 'cat-00000000-0102',
    percentage: 0.15,
    allocated_amount: 646.25,
    actualSpent: 580.0, // 89.7% -> 81-100% (Amber)
    remaining: 66.25,
    category: mockCategories.find((c) => c.id === 'cat-00000000-0102'),
  },
  {
    id: 'mbc-test-03',
    monthly_budget_id: 'mb-test-01',
    category_id: 'cat-00000000-0103',
    percentage: 0.05,
    allocated_amount: 215.42,
    actualSpent: 260.0, // 120.7% -> > 100% (Red, Over-budget)
    remaining: -44.58,
    category: mockCategories.find((c) => c.id === 'cat-00000000-0103'),
  },
];

describe('MonthPicker', () => {
  it('renders selected month in human-readable format', () => {
    const onChange = vi.fn();
    render(<MonthPicker selectedMonth="2026-09" onChangeMonth={onChange} />);

    expect(screen.getByText(/september 2026/i)).toBeInTheDocument();
  });

  it('calls onChangeMonth with previous month when clicking previous button', () => {
    const onChange = vi.fn();
    render(<MonthPicker selectedMonth="2026-09" onChangeMonth={onChange} />);

    const prevButton = screen.getByRole('button', { name: /previous month/i });
    fireEvent.click(prevButton);

    expect(onChange).toHaveBeenCalledWith('2026-08');
  });

  it('calls onChangeMonth with next month when clicking next button', () => {
    const onChange = vi.fn();
    render(<MonthPicker selectedMonth="2026-09" onChangeMonth={onChange} />);

    const nextButton = screen.getByRole('button', { name: /next month/i });
    fireEvent.click(nextButton);

    expect(onChange).toHaveBeenCalledWith('2026-10');
  });

  it('shows jump to current month button when not on current month and triggers jump', () => {
    const onChange = vi.fn();
    render(<MonthPicker selectedMonth="2024-01" onChangeMonth={onChange} />);

    const jumpButton = screen.getByRole('button', { name: /current|today/i });
    expect(jumpButton).toBeInTheDocument();

    fireEvent.click(jumpButton);
    expect(onChange).toHaveBeenCalledWith(getCurrentMonth());
  });
});

describe('BudgetWaterfall', () => {
  it('renders gross salary, CPF deduction (20%), fixed deductions, and disposable pool in SGD', () => {
    render(<BudgetWaterfall budget={sampleBudget} categories={sampleCategories} />);

    // Gross Salary S$6,000.00
    expect(screen.getAllByText('S$6,000.00').length).toBeGreaterThanOrEqual(1);

    // CPF Deduction S$1,200.00
    expect(screen.getByText(/1,200\.00/)).toBeInTheDocument();

    // Fixed Deductions (Taxes S$91.67, Insurance S$400.00)
    expect(screen.getAllByText(/91\.67/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/400\.00/).length).toBeGreaterThanOrEqual(1);

    // After Deductions Disposable Pool S$4,308.33
    expect(screen.getByText('S$4,308.33')).toBeInTheDocument();
  });

  it('renders bonus when present and updates total gross pay', () => {
    const budgetWithBonus: MonthlyBudget = {
      ...sampleBudget,
      bonus: 1500.0,
      after_deductions: 5808.33,
    };

    render(<BudgetWaterfall budget={budgetWithBonus} categories={sampleCategories} />);

    expect(screen.getByText(/1,500\.00/)).toBeInTheDocument();
    expect(screen.getByText('S$5,808.33')).toBeInTheDocument();
  });

  it('renders category allocations breakdown matching the disposable pool', () => {
    render(<BudgetWaterfall budget={sampleBudget} categories={sampleCategories} />);

    expect(screen.getByText(/food/i)).toBeInTheDocument();
    expect(screen.getByText(/lifestyle/i)).toBeInTheDocument();
    expect(screen.getByText(/transport/i)).toBeInTheDocument();
    expect(screen.getAllByText(/S\$646\.25/).length).toBeGreaterThanOrEqual(1);
  });

  it('triggers onEditProfile callback when edit button is clicked', () => {
    const onEdit = vi.fn();
    render(
      <BudgetWaterfall
        budget={sampleBudget}
        categories={sampleCategories}
        onEditProfile={onEdit}
      />
    );

    const editBtn = screen.getByRole('button', { name: /edit base profile|edit profile|edit budget/i });
    fireEvent.click(editBtn);

    expect(onEdit).toHaveBeenCalled();
  });
});

describe('CategoryProgressList', () => {
  it('renders category meters with allocated, actual spent, and remaining amounts', () => {
    render(<CategoryProgressList categories={sampleCategories} />);

    // Food category check
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('S$300.00')).toBeInTheDocument();
    expect(screen.getAllByText('S$646.25').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('S$346.25')).toBeInTheDocument();
  });

  it('applies green status for spend <= 80%', () => {
    render(<CategoryProgressList categories={[sampleCategories[0]]} />);

    // Food is 46.4% spent (<=80%)
    const badge = screen.getByText(/on track|good|46%/i);
    expect(badge).toBeInTheDocument();
  });

  it('applies amber status for spend between 81% and 100%', () => {
    render(<CategoryProgressList categories={[sampleCategories[1]]} />);

    // Lifestyle is 89.7% spent (81-100%)
    const badge = screen.getByText(/near limit|warning|90%/i);
    expect(badge).toBeInTheDocument();
  });

  it('applies red status and shows over-budget warning when spend > 100%', () => {
    render(<CategoryProgressList categories={[sampleCategories[2]]} />);

    // Transport is 120.7% spent (>100%)
    expect(screen.getAllByText(/over budget/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/121%/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/over by/i)).toBeInTheDocument();
  });

  it('renders empty state message when no categories are provided', () => {
    render(<CategoryProgressList categories={[]} />);
    expect(screen.getByText(/no budget categories found/i)).toBeInTheDocument();
  });
});

describe('BaseProfileEditorModal', () => {
  const profile = mockBaseProfiles[0];
  const allocations = mockBaseAllocations.filter((a) => a.profile_id === profile.id);

  it('does not render when isOpen is false', () => {
    render(
      <BaseProfileEditorModal
        isOpen={false}
        onClose={vi.fn()}
        profile={profile}
        allocations={allocations}
        categories={mockCategories}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders inputs for gross salary, CPF rate, and category percentage allocations', () => {
    render(
      <BaseProfileEditorModal
        isOpen={true}
        onClose={vi.fn()}
        profile={profile}
        allocations={allocations}
        categories={mockCategories}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/gross salary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cpf.*rate/i)).toBeInTheDocument();
    expect(screen.getByText(/total:\s*100%/i)).toBeInTheDocument();
  });

  it('validates that category percentages must sum to 100%', async () => {
    render(
      <BaseProfileEditorModal
        isOpen={true}
        onClose={vi.fn()}
        profile={profile}
        allocations={allocations}
        categories={mockCategories}
      />
    );

    // Find the food percentage input and change it from 15% to 50% so sum becomes 135%
    const foodInput = screen.getByLabelText(/food/i);
    fireEvent.change(foodInput, { target: { value: '50' } });

    // Should indicate invalid total percentage (e.g. 135%)
    expect(screen.getByText(/135%/)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /save profile|save budget|save changes/i });
    // Should be disabled or error indicated
    expect(saveBtn).toBeDisabled();
  });

  it('updates base profile and allocations when form is valid and submitted', async () => {
    const onClose = vi.fn();
    const onSaveSuccess = vi.fn();
    const updateSpy = vi.spyOn(financeService, 'updateBaseProfile').mockResolvedValueOnce();

    render(
      <BaseProfileEditorModal
        isOpen={true}
        onClose={onClose}
        onSaveSuccess={onSaveSuccess}
        profile={profile}
        allocations={allocations}
        categories={mockCategories}
      />
    );

    const salaryInput = screen.getByLabelText(/gross salary/i);
    fireEvent.change(salaryInput, { target: { value: '6500' } });

    const saveBtn = screen.getByRole('button', { name: /save profile|save budget|save changes/i });
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          gross_salary: 6500,
        }),
        expect.any(Array)
      );
      expect(onSaveSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe('BudgetPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders budget page with month navigation, waterfall, and category meters', async () => {
    await act(async () => {
      render(
        <HouseholdProvider initialPerspective="yijia">
          <BudgetPage />
        </HouseholdProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/budget tracker|monthly budget/i)).toBeInTheDocument();
      expect(screen.getAllByText(/gross pay|gross salary/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/disposable pool|after deductions/i).length).toBeGreaterThan(0);
    });
  });

  it('adapts when perspective changes between members and household', async () => {
    const { rerender } = render(
      <HouseholdProvider initialPerspective="yijia">
        <BudgetPage />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/yi jia/i).length).toBeGreaterThan(0);
    });

    rerender(
      <HouseholdProvider initialPerspective="household">
        <BudgetPage />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/household|combined/i).length).toBeGreaterThan(0);
    });
  });

  it('opens BaseProfileEditorModal when clicking edit profile button', async () => {
    await act(async () => {
      render(
        <HouseholdProvider initialPerspective="yijia">
          <BudgetPage />
        </HouseholdProvider>
      );
    });

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /edit base profile|edit profile|edit budget/i }).length
      ).toBeGreaterThan(0);
    });

    const editBtn = screen.getAllByRole('button', { name: /edit base profile|edit profile|edit budget/i })[0];
    fireEvent.click(editBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not send "hh-00000000-0001" to updateBaseProfile when saving a new member profile', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true);
    const updateSpy = vi.spyOn(financeService, 'updateBaseProfile').mockResolvedValueOnce();
    vi.spyOn(financeService, 'getBaseProfiles').mockResolvedValue([]);
    vi.spyOn(financeService, 'getBaseAllocations').mockResolvedValue([]);
    vi.spyOn(financeService, 'getCategories').mockResolvedValue(mockCategories);
    vi.spyOn(financeService, 'getMonthlyBudget').mockResolvedValue({
      budget: sampleBudget,
      categories: sampleCategories,
      disposablePool: 4308.33,
      totalSpent: 1000,
      totalRemaining: 3308.33,
    });
    vi.spyOn(financeService, 'getHouseholdOverview').mockResolvedValue({
      household: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Yi Jia & Rachel',
        currency: 'SGD',
      },
      members: [
        {
          id: '00000000-0000-0000-0000-000000000011',
          household_id: '00000000-0000-0000-0000-000000000001',
          display_name: 'Yi Jia',
          role: 'owner',
          avatar_url: '👨',
        },
      ],
      totalAssets: 10000,
      totalLiabilities: 0,
      trueNetWorth: 10000,
      settlementSummary: {
        netBalance: 0,
        settlementText: 'All settled up',
        debtorName: '',
        creditorName: '',
        debtorId: '',
        creditorId: '',
        member1OwesMember2: 0,
        member2OwesMember1: 0,
      },
      activeGoals: [],
      upcomingBills: [],
    });

    await act(async () => {
      render(
        <HouseholdProvider initialPerspective="yijia">
          <BudgetPage />
        </HouseholdProvider>
      );
    });

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /edit base profile|edit profile|edit budget/i }).length
      ).toBeGreaterThan(0);
    });

    const editBtn = screen.getAllByRole('button', { name: /edit base profile|edit profile|edit budget/i })[0];
    fireEvent.click(editBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /save profile|save budget|save changes/i });
    expect(saveBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });

    const [savedProfile] = updateSpy.mock.calls[0];
    expect(savedProfile.household_id).not.toBe('hh-00000000-0001');
  });
});
