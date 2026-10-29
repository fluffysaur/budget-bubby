/**
 * Comprehensive Unit & Integration Tests for Task 10:
 * Savings Goals & Milestone Tracker
 * - GoalCard
 * - AddEditGoalModal
 * - GoalsPage
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { GoalCard } from '../src/components/goals/GoalCard';
import { AddEditGoalModal } from '../src/components/goals/AddEditGoalModal';
import { GoalsPage } from '../src/pages/GoalsPage';
import { financeService } from '../src/services/financeService';
import { formatSGD } from '../src/lib/currency';
import type { SavingsGoal } from '../src/types/finance';

const sampleAchievedGoal: SavingsGoal = {
  id: 'goal-wedding-01',
  household_id: 'hh-01',
  owner_id: null,
  title: 'Wedding Fund',
  target_amount: 55000.0,
  saved_so_far: 55000.0,
  target_date: '2027-05-01',
  monthly_contribution: 0.0,
  emoji: '💍',
  status: 'achieved',
  created_at: '2026-01-01T00:00:00.000Z',
};

const sampleOnTrackGoal: SavingsGoal = {
  id: 'goal-hdb-02',
  household_id: 'hh-01',
  owner_id: null,
  title: 'HDB Down Payment',
  target_amount: 190000.0,
  saved_so_far: 100000.0,
  target_date: '2027-07-01',
  monthly_contribution: 10000.0,
  emoji: '🏠',
  status: 'on_track',
  created_at: '2026-01-01T00:00:00.000Z',
};

const sampleBehindGoal: SavingsGoal = {
  id: 'goal-reno-03',
  household_id: 'hh-01',
  owner_id: null,
  title: 'Renovation Fund',
  target_amount: 90000.0,
  saved_so_far: 10000.0,
  target_date: '2027-09-01',
  monthly_contribution: 1000.0, // Behind: needed is ~6,666/mo
  emoji: '🔨',
  status: 'behind',
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('GoalCard Component', () => {
  it('renders emoji, title, target amount, total saved, and balance', () => {
    render(<GoalCard goal={sampleOnTrackGoal} />);

    // Emoji & Title
    expect(screen.getByText('🏠')).toBeInTheDocument();
    expect(screen.getByText('HDB Down Payment')).toBeInTheDocument();

    // Target amount
    expect(screen.getByText(formatSGD(190000.0))).toBeInTheDocument();
    // Total Saved & Balance (when goal spend is 0, balance = total saved)
    const matchingAmounts = screen.getAllByText(formatSGD(100000.0));
    expect(matchingAmounts).toHaveLength(2);
  });

  it('calculates balance as total saved minus goal spend without deducting milestone progress', () => {
    const mockExpense = {
      id: 'exp-goal-1',
      household_id: 'hh-1',
      payer_id: 'user-1',
      category_id: null,
      date: '2026-10-15',
      item: 'Renovation deposit',
      amount: 15000.0,
      is_shared: true,
      split_ratio: 0.5,
      settled: false,
      goal_id: sampleOnTrackGoal.id,
    };

    render(<GoalCard goal={sampleOnTrackGoal} linkedExpenses={[mockExpense]} />);

    // Target amount: 190,000
    expect(screen.getByText(formatSGD(190000.0))).toBeInTheDocument();
    // Total saved remains 100,000
    expect(screen.getByText(formatSGD(100000.0))).toBeInTheDocument();
    // Goal spend: 15,000 (appears in highlight card and linked expenses list)
    expect(screen.getAllByText(formatSGD(15000.0)).length).toBeGreaterThan(0);
    // Balance: 100,000 - 15,000 = 85,000
    expect(screen.getByText(formatSGD(85000.0))).toBeInTheDocument();
    // Milestone progress remains 100,000 / 190,000 = 53%
    expect(screen.getByText('53%')).toBeInTheDocument();
  });

  it('renders accessible progress bar with calculated percentage', () => {
    render(<GoalCard goal={sampleOnTrackGoal} />);

    // 100,000 / 190,000 = 52.6% -> 53%
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '53');
    expect(screen.getByText('53%')).toBeInTheDocument();
  });

  it('renders 100% progress for achieved goal', () => {
    render(<GoalCard goal={sampleAchievedGoal} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders status badges correctly: Achieved, On Track, Behind', () => {
    const { rerender } = render(<GoalCard goal={sampleAchievedGoal} />);
    expect(screen.getByText(/Achieved/i)).toBeInTheDocument();

    rerender(<GoalCard goal={sampleOnTrackGoal} />);
    expect(screen.getByText(/On Track/i)).toBeInTheDocument();

    rerender(<GoalCard goal={sampleBehindGoal} />);
    expect(screen.getByText(/Behind/i)).toBeInTheDocument();
  });

  it('displays monthly contribution and required monthly pace', () => {
    render(<GoalCard goal={sampleOnTrackGoal} />);

    // Monthly contribution formatted
    expect(screen.getAllByText(/S\$10,000\.00\/mo/).length).toBeGreaterThanOrEqual(1);
  });

  it('displays target date and remaining months countdown', () => {
    render(<GoalCard goal={sampleOnTrackGoal} />);

    // Target date rendered
    expect(screen.getByText(/2027/)).toBeInTheDocument();
    // Countdown text
    expect(screen.getByText(/months left/i)).toBeInTheDocument();
  });

  it('fires onEdit and onQuickDeposit callbacks when action buttons are clicked', () => {
    const onEditMock = vi.fn();
    const onQuickDepositMock = vi.fn();

    render(
      <GoalCard
        goal={sampleOnTrackGoal}
        onEdit={onEditMock}
        onQuickDeposit={onQuickDepositMock}
      />
    );

    const editBtn = screen.getByRole('button', { name: /edit hdb down payment/i });
    fireEvent.click(editBtn);
    expect(onEditMock).toHaveBeenCalledTimes(1);
    expect(onEditMock).toHaveBeenCalledWith(sampleOnTrackGoal);

    const depositBtn = screen.getByRole('button', { name: /deposit/i });
    fireEvent.click(depositBtn);
    expect(onQuickDepositMock).toHaveBeenCalledTimes(1);
    expect(onQuickDepositMock).toHaveBeenCalledWith(sampleOnTrackGoal);
  });
});

describe('AddEditGoalModal Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <AddEditGoalModal
        isOpen={false}
        onClose={() => {}}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders in create mode with empty form and emoji selector presets', () => {
    render(
      <AddEditGoalModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /New Savings Goal/i })).toBeInTheDocument();

    // Presets available
    expect(screen.getByRole('button', { name: /Wedding/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Honeymoon/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HDB Down Payment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Renovation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Baby Fund/i })).toBeInTheDocument();
  });

  it('validates required fields before submitting', async () => {
    render(
      <AddEditGoalModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Create Goal/i });
    fireEvent.click(submitBtn);

    // Shows validation error
    await waitFor(() => {
      expect(screen.getByText(/Please enter a goal title/i)).toBeInTheDocument();
    });
  });

  it('submits new goal with valid data via financeService.addGoal', async () => {
    const addGoalSpy = vi.spyOn(financeService, 'addGoal').mockResolvedValueOnce({
      ...sampleOnTrackGoal,
      id: 'new-goal-123',
    });
    const onCloseMock = vi.fn();
    const onGoalSavedMock = vi.fn();

    render(
      <AddEditGoalModal
        isOpen={true}
        onClose={onCloseMock}
        onGoalSaved={onGoalSavedMock}
      />
    );

    // Select emoji preset
    fireEvent.click(screen.getByRole('button', { name: /Baby Fund/i }));

    // Fill form
    fireEvent.change(screen.getByLabelText(/Goal Title/i), { target: { value: 'Baby Fund' } });
    fireEvent.change(screen.getByLabelText(/Target Amount/i), { target: { value: '30000' } });
    fireEvent.change(screen.getByLabelText(/Saved So Far/i), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText(/Target Date/i), { target: { value: '2028-12-31' } });
    fireEvent.change(screen.getByLabelText(/Monthly Contribution/i), { target: { value: '1000' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Create Goal/i }));

    await waitFor(() => {
      expect(addGoalSpy).toHaveBeenCalledTimes(1);
      expect(addGoalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Baby Fund',
          target_amount: 30000,
          saved_so_far: 5000,
          monthly_contribution: 1000,
        })
      );
      expect(onGoalSavedMock).toHaveBeenCalledTimes(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    addGoalSpy.mockRestore();
  });

  it('renders in edit mode and updates goal via financeService.updateGoal', async () => {
    const updateGoalSpy = vi.spyOn(financeService, 'updateGoal').mockResolvedValueOnce({
      ...sampleOnTrackGoal,
      target_amount: 200000,
    });
    const onCloseMock = vi.fn();
    const onGoalSavedMock = vi.fn();

    render(
      <AddEditGoalModal
        isOpen={true}
        goal={sampleOnTrackGoal}
        onClose={onCloseMock}
        onGoalSaved={onGoalSavedMock}
      />
    );

    expect(screen.getByRole('heading', { name: /Edit Savings Goal/i })).toBeInTheDocument();

    // Verify prefilled values
    const titleInput = screen.getByLabelText(/Goal Title/i) as HTMLInputElement;
    expect(titleInput.value).toBe('HDB Down Payment');

    // Update target amount
    fireEvent.change(screen.getByLabelText(/Target Amount/i), { target: { value: '200000' } });

    // Submit update
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateGoalSpy).toHaveBeenCalledWith(
        sampleOnTrackGoal.id,
        expect.objectContaining({
          target_amount: 200000,
        })
      );
      expect(onGoalSavedMock).toHaveBeenCalledTimes(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    updateGoalSpy.mockRestore();
  });

  it('closes on escape key or cancel button', () => {
    const onCloseMock = vi.fn();
    render(
      <AddEditGoalModal
        isOpen={true}
        onClose={onCloseMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(2);
  });
});

describe('GoalsPage Integration', () => {
  const mockGoals: SavingsGoal[] = [
    sampleAchievedGoal,
    sampleOnTrackGoal,
    sampleBehindGoal,
  ];

  beforeEach(() => {
    vi.spyOn(financeService, 'getGoals').mockResolvedValue(mockGoals);
  });

  it('loads goals and renders 4 summary metric cards', async () => {
    render(
      <MemoryRouter>
        <HouseholdProvider>
          <GoalsPage />
        </HouseholdProvider>
      </MemoryRouter>
    );

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('HDB Down Payment')).toBeInTheDocument();
    });

    // Metric 1: Total Target = 55,000 + 190,000 + 90,000 = 335,000
    expect(screen.getByText(formatSGD(335000))).toBeInTheDocument();

    // Metric 2: Total Saved = 55,000 + 100,000 + 10,000 = 165,000
    expect(screen.getByText(formatSGD(165000))).toBeInTheDocument();

    // Metric 3: Overall Progress = 165,000 / 335,000 = 49.25% -> 49%
    expect(screen.getByText(/49%/)).toBeInTheDocument();

    // Metric 4: Total Monthly Contributions = 0 + 10,000 + 1,000 = 11,000
    expect(screen.getByText(/S\$11,000\.00\/mo/)).toBeInTheDocument();
  });

  it('filters goals using All Goals, In Progress, and Achieved tabs', async () => {
    render(
      <MemoryRouter>
        <HouseholdProvider>
          <GoalsPage />
        </HouseholdProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('HDB Down Payment')).toBeInTheDocument();
    });

    // All 3 goals visible
    expect(screen.getByText('Wedding Fund')).toBeInTheDocument();
    expect(screen.getByText('HDB Down Payment')).toBeInTheDocument();
    expect(screen.getByText('Renovation Fund')).toBeInTheDocument();

    // Click "In Progress" tab
    const inProgressTab = screen.getByRole('tab', { name: /In Progress/i });
    fireEvent.click(inProgressTab);

    // Wedding (achieved) should be hidden; HDB and Reno visible
    expect(screen.queryByText('Wedding Fund')).not.toBeInTheDocument();
    expect(screen.getByText('HDB Down Payment')).toBeInTheDocument();
    expect(screen.getByText('Renovation Fund')).toBeInTheDocument();

    // Click "Achieved" tab
    const achievedTab = screen.getByRole('tab', { name: /Achieved/i });
    fireEvent.click(achievedTab);

    // Wedding visible; HDB and Reno hidden
    expect(screen.getByText('Wedding Fund')).toBeInTheDocument();
    expect(screen.queryByText('HDB Down Payment')).not.toBeInTheDocument();
    expect(screen.queryByText('Renovation Fund')).not.toBeInTheDocument();
  });

  it('opens AddEditGoalModal when "+ New Goal" button is clicked and refreshes upon creation', async () => {
    const addSpy = vi.spyOn(financeService, 'addGoal').mockResolvedValueOnce({
      id: 'new-honeymoon',
      household_id: 'hh-01',
      owner_id: null,
      title: 'Japan Trip',
      target_amount: 8000,
      saved_so_far: 2000,
      target_date: '2027-11-01',
      monthly_contribution: 500,
      emoji: '✈️',
      status: 'on_track',
    });

    const getGoalsSpy = vi.spyOn(financeService, 'getGoals');

    render(
      <MemoryRouter>
        <HouseholdProvider>
          <GoalsPage />
        </HouseholdProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('HDB Down Payment')).toBeInTheDocument();
    });

    // Click "+ New Goal"
    fireEvent.click(screen.getByRole('button', { name: /\+ New Goal/i }));

    // Modal opens
    expect(screen.getByRole('heading', { name: /New Savings Goal/i })).toBeInTheDocument();

    // Fill and submit
    fireEvent.change(screen.getByLabelText(/Goal Title/i), { target: { value: 'Japan Trip' } });
    fireEvent.change(screen.getByLabelText(/Target Amount/i), { target: { value: '8000' } });
    fireEvent.change(screen.getByLabelText(/Target Date/i), { target: { value: '2027-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Goal/i }));

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalled();
      // Should have re-fetched goals
      expect(getGoalsSpy).toHaveBeenCalledTimes(2);
    });

    addSpy.mockRestore();
  });

  it('handles quick deposit action to increment saved_so_far', async () => {
    const updateSpy = vi.spyOn(financeService, 'updateGoal').mockResolvedValueOnce({
      ...sampleOnTrackGoal,
      saved_so_far: 105000,
    });
    const getGoalsSpy = vi.spyOn(financeService, 'getGoals');

    render(
      <MemoryRouter>
        <HouseholdProvider>
          <GoalsPage />
        </HouseholdProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('HDB Down Payment')).toBeInTheDocument();
    });

    // Find the quick deposit button for HDB Down Payment
    const depositBtn = screen.getByRole('button', { name: /deposit to hdb down payment/i });
    fireEvent.click(depositBtn);

    // Quick Deposit dialog opens
    expect(screen.getByRole('heading', { name: /Quick Deposit/i })).toBeInTheDocument();

    // Enter deposit amount
    const amountInput = screen.getByLabelText(/Deposit Amount/i);
    fireEvent.change(amountInput, { target: { value: '5000' } });

    // Confirm deposit
    fireEvent.click(screen.getByRole('button', { name: /Confirm Deposit/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        sampleOnTrackGoal.id,
        expect.objectContaining({
          saved_so_far: 105000,
        })
      );
      expect(getGoalsSpy).toHaveBeenCalledTimes(2);
    });

    updateSpy.mockRestore();
  });

  it('renders empty state when no goals exist', async () => {
    vi.spyOn(financeService, 'getGoals').mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <HouseholdProvider>
          <GoalsPage />
        </HouseholdProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No savings goals found/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Create your first goal/i })).toBeInTheDocument();
  });
});
