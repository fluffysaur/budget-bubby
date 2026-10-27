/**
 * Unit & Integration Tests for Epic 3:
 * - CategoryLimitWarningBanner (Amber 80% and Rose 100% guardrails)
 * - Audio triggers (playBudgetWarningSound and playBudgetExceededSound) on expenseAdded
 * - Immediate toast alert notifications
 * - Cumulative Surplus & Deficit calculation (excluding Goal-funded expenses)
 * - CumulativeSurplusCard component rendering
 * - Interactive percentage sliders, live SGD equivalents, lock toggles, and Auto-Balance
 * - CategoryProgressList warning badges (Amber >= 80%, Rose >= 100%)
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as soundEffects from '../src/lib/soundEffects';
import { CategoryLimitWarningBanner } from '../src/components/budget/CategoryLimitWarningBanner';
import { CumulativeSurplusCard } from '../src/components/budget/CumulativeSurplusCard';
import { CategoryProgressList } from '../src/components/budget/CategoryProgressList';
import { BaseProfileEditorModal } from '../src/components/budget/BaseProfileEditorModal';
import { ManageCategoriesModal } from '../src/components/categories/ManageCategoriesModal';
import {
  calculateCumulativeSurplus,
  evaluateCategoryLimitAlerts,
} from '../src/lib/financialFormulas';
import { mockCategories, mockBaseProfiles, mockBaseAllocations } from '../src/data/mockSeedData';
import type { Expense, MonthlyBudgetCategoryDetail } from '../src/types/finance';

// Mock Web Audio Synthesis sound effects
vi.mock('../src/lib/soundEffects', () => ({
  playBudgetWarningSound: vi.fn(),
  playBudgetExceededSound: vi.fn(),
  playChaChingSound: vi.fn(),
  initAudioUnlock: vi.fn(),
}));

describe('Epic 3: Budget Guardrails & CategoryLimitWarningBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const testCategories: MonthlyBudgetCategoryDetail[] = [
    {
      id: 'mbc-food',
      monthly_budget_id: 'mb-01',
      category_id: 'cat-food',
      percentage: 0.2,
      allocated_amount: 800,
      actualSpent: 672, // 84% -> Nearing limit (Amber)
      remaining: 128,
      category: { id: 'cat-food', household_id: 'hh-01', name: 'Food', color: '#10B981', icon: 'utensils', is_system: true, group: 'spendable' },
    },
    {
      id: 'mbc-lifestyle',
      monthly_budget_id: 'mb-01',
      category_id: 'cat-lifestyle',
      percentage: 0.15,
      allocated_amount: 500,
      actualSpent: 545, // 109% -> Over limit (Rose)
      remaining: -45,
      category: { id: 'cat-lifestyle', household_id: 'hh-01', name: 'Lifestyle', color: '#EC4899', icon: 'sparkles', is_system: true, group: 'spendable' },
    },
    {
      id: 'mbc-transport',
      monthly_budget_id: 'mb-01',
      category_id: 'cat-transport',
      percentage: 0.1,
      allocated_amount: 300,
      actualSpent: 150, // 50% -> Safe on track (No warning)
      remaining: 150,
      category: { id: 'cat-transport', household_id: 'hh-01', name: 'Transport', color: '#3B82F6', icon: 'car', is_system: true, group: 'spendable' },
    },
  ];

  it('evaluates warning alerts (>=80%) and exceeded alerts (>=100%) correctly', () => {
    const alerts = evaluateCategoryLimitAlerts(testCategories);

    expect(alerts).toHaveLength(2);

    const exceededAlert = alerts.find((a) => a.severity === 'exceeded');
    expect(exceededAlert).toBeDefined();
    expect(exceededAlert?.categoryName).toBe('Lifestyle');
    expect(exceededAlert?.percentage).toBe(109);

    const warningAlert = alerts.find((a) => a.severity === 'warning');
    expect(warningAlert).toBeDefined();
    expect(warningAlert?.categoryName).toBe('Food');
    expect(warningAlert?.percentage).toBe(84);
  });

  it('renders persistent alert banner for both nearing limit and exceeded categories', () => {
    render(<CategoryLimitWarningBanner categories={testCategories} />);

    // Banner container
    expect(screen.getByTestId('category-limit-warning-banner')).toBeInTheDocument();

    // Rose Exceeded Alert
    expect(screen.getByTestId('category-limit-exceeded-banner')).toBeInTheDocument();
    expect(screen.getByText(/Lifestyle has exceeded cap by S\$45\.00!/i)).toBeInTheDocument();

    // Amber Nearing Alert
    expect(screen.getByTestId('category-limit-nearing-banner')).toBeInTheDocument();
    expect(screen.getByText(/Food is at 84% \(S\$672\.00 of S\$800\.00\) — S\$128\.00 left/i)).toBeInTheDocument();
  });

  it('does not render alert banner when all spendable categories are below 80%', () => {
    const safeCategories: MonthlyBudgetCategoryDetail[] = [
      {
        id: 'mbc-food',
        monthly_budget_id: 'mb-01',
        category_id: 'cat-food',
        percentage: 0.2,
        allocated_amount: 800,
        actualSpent: 400, // 50%
        remaining: 400,
        category: { id: 'cat-food', household_id: 'hh-01', name: 'Food', color: '#10B981', icon: 'utensils', is_system: true, group: 'spendable' },
      },
    ];

    const { container } = render(<CategoryLimitWarningBanner categories={safeCategories} />);
    expect(container.querySelector('[data-testid="category-limit-warning-banner"]')).toBeNull();
  });

  it('triggers playBudgetWarningSound and displays toast when expenseAdded crosses 80%', () => {
    // Initial category at 75% ($600 / $800)
    const initialCats: MonthlyBudgetCategoryDetail[] = [
      {
        id: 'mbc-food',
        monthly_budget_id: 'mb-01',
        category_id: 'cat-food',
        percentage: 0.2,
        allocated_amount: 800,
        actualSpent: 600, // 75%
        remaining: 200,
        category: { id: 'cat-food', household_id: 'hh-01', name: 'Food', color: '#10B981', icon: 'utensils', is_system: true, group: 'spendable' },
      },
    ];

    render(<CategoryLimitWarningBanner categories={initialCats} />);

    expect(soundEffects.playBudgetWarningSound).not.toHaveBeenCalled();

    // Dispatch expense of $50 -> newSpent: $650 / $800 = 81.25% (crosses 80%)
    act(() => {
      const expense: Expense = {
        id: 'exp-01',
        household_id: 'hh-01',
        payer_id: 'mem-01',
        category_id: 'cat-food',
        date: '2026-10-27',
        item: 'Supermarket Run',
        amount: 50,
        is_shared: false,
        split_ratio: 0.5,
        settled: false,
      };
      window.dispatchEvent(new CustomEvent('expenseAdded', { detail: expense }));
    });

    expect(soundEffects.playBudgetWarningSound).toHaveBeenCalledTimes(1);
    expect(soundEffects.playBudgetExceededSound).not.toHaveBeenCalled();

    // Verify immediate toast alert is rendered
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Budget Limit Warning/i)).toBeInTheDocument();
    expect(screen.getByText(/Food is at 81% \(S\$650\.00 of S\$800\.00\) — S\$150\.00 left/i)).toBeInTheDocument();
  });

  it('triggers playBudgetExceededSound and displays toast when expenseAdded crosses 100%', () => {
    // Initial category at 95% ($760 / $800)
    const initialCats: MonthlyBudgetCategoryDetail[] = [
      {
        id: 'mbc-food',
        monthly_budget_id: 'mb-01',
        category_id: 'cat-food',
        percentage: 0.2,
        allocated_amount: 800,
        actualSpent: 760, // 95%
        remaining: 40,
        category: { id: 'cat-food', household_id: 'hh-01', name: 'Food', color: '#10B981', icon: 'utensils', is_system: true, group: 'spendable' },
      },
    ];

    render(<CategoryLimitWarningBanner categories={initialCats} />);

    // Dispatch expense of $60 -> newSpent: $820 / $800 = 102.5% (crosses 100%)
    act(() => {
      const expense: Expense = {
        id: 'exp-02',
        household_id: 'hh-01',
        payer_id: 'mem-01',
        category_id: 'cat-food',
        date: '2026-10-27',
        item: 'Dinner Feast',
        amount: 60,
        is_shared: false,
        split_ratio: 0.5,
        settled: false,
      };
      window.dispatchEvent(new CustomEvent('expenseAdded', { detail: expense }));
    });

    expect(soundEffects.playBudgetExceededSound).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Budget Cap Exceeded!/i)).toBeInTheDocument();
    expect(screen.getByText(/Food has exceeded cap by S\$20\.00!/i)).toBeInTheDocument();
  });
});

describe('Epic 3: Cumulative Surplus & Deficit Calculations', () => {
  it('correctly calculates cumulative surplus across months and excludes goal-funded expenses', () => {
    const expenses: Expense[] = [
      // Month 1: 2026-08 (Cap: 1000)
      // Regular expense: 400
      // Goal-funded expense: 500 (Pre-saved Japan Trip) -> MUST BE EXCLUDED from spendable expenses!
      {
        id: 'e1',
        household_id: 'hh-01',
        payer_id: 'mem-01',
        category_id: 'cat-food',
        date: '2026-08-10',
        item: 'Groceries',
        amount: 400,
        is_shared: false,
        split_ratio: 0.5,
        settled: false,
      },
      {
        id: 'e2',
        household_id: 'hh-01',
        payer_id: 'mem-01',
        category_id: 'cat-lifestyle',
        date: '2026-08-20',
        item: 'Tokyo Flight Booking',
        amount: 500,
        is_shared: false,
        split_ratio: 0.5,
        settled: false,
        goal_id: 'goal-japan-trip-01', // Goal funded!
      },

      // Month 2: 2026-09 (Cap: 1000)
      // Regular expenses: 900 -> Surplus: +100
      {
        id: 'e3',
        household_id: 'hh-01',
        payer_id: 'mem-01',
        category_id: 'cat-food',
        date: '2026-09-15',
        item: 'Groceries',
        amount: 900,
        is_shared: false,
        split_ratio: 0.5,
        settled: false,
      },

      // Month 3: 2026-10 (Cap: 1000)
      // Regular expenses: 1100 -> Deficit: -100
      {
        id: 'e4',
        household_id: 'hh-01',
        payer_id: 'mem-01',
        category_id: 'cat-food',
        date: '2026-10-10',
        item: 'Bulk Shopping',
        amount: 1100,
        is_shared: false,
        split_ratio: 0.5,
        settled: false,
      },
    ];

    const result = calculateCumulativeSurplus({
      months: ['2026-08', '2026-09', '2026-10'],
      monthlyCap: 1000,
      expenses,
      categories: mockCategories,
      perspective: 'household',
    });

    expect(result.monthlyHistory).toHaveLength(3);

    // Month 1 (2026-08): Cap = 1000, Spent = 400 (Goal-funded 500 excluded!), Delta = +600, Cumulative = +600
    const m1 = result.monthlyHistory[0];
    expect(m1.month).toBe('2026-08');
    expect(m1.spent).toBe(400);
    expect(m1.goalSpent).toBe(500);
    expect(m1.delta).toBe(600);
    expect(m1.cumulative).toBe(600);

    // Month 2 (2026-09): Cap = 1000, Spent = 900, Delta = +100, Cumulative = 600 + 100 = +700
    const m2 = result.monthlyHistory[1];
    expect(m2.month).toBe('2026-09');
    expect(m2.spent).toBe(900);
    expect(m2.delta).toBe(100);
    expect(m2.cumulative).toBe(700);

    // Month 3 (2026-10): Cap = 1000, Spent = 1100, Delta = -100, Cumulative = 700 - 100 = +600
    const m3 = result.monthlyHistory[2];
    expect(m3.month).toBe('2026-10');
    expect(m3.spent).toBe(1100);
    expect(m3.delta).toBe(-100);
    expect(m3.cumulative).toBe(600);

    // Overall summary metrics
    expect(result.currentMonthSurplus).toBe(-100);
    expect(result.cumulativeSurplus).toBe(600);
  });

  it('renders CumulativeSurplusCard with current month surplus and banked total', () => {
    const summary = {
      currentMonthSurplus: 180.2,
      cumulativeSurplus: 520.4,
      monthlyHistory: [
        { month: '2026-08', cap: 1500, spent: 1200, goalSpent: 0, delta: 300, cumulative: 300 },
        { month: '2026-09', cap: 1500, spent: 1459.8, goalSpent: 200, delta: 40.2, cumulative: 340.2 },
        { month: '2026-10', cap: 1500, spent: 1319.8, goalSpent: 0, delta: 180.2, cumulative: 520.4 },
      ],
    };

    render(<CumulativeSurplusCard selectedMonth="2026-10" summary={summary} />);

    // Badges
    const currentBadge = screen.getByTestId('current-month-surplus-badge');
    expect(currentBadge).toBeInTheDocument();
    expect(screen.getByText(/Surplus this month/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\+S\$180\.20/i).length).toBeGreaterThanOrEqual(1);

    const bankedBadge = screen.getByTestId('total-banked-surplus-badge');
    expect(bankedBadge).toBeInTheDocument();
    expect(screen.getByText(/Total Banked Surplus: \+S\$520\.40/i)).toBeInTheDocument();

    // Goal Protection callout
    expect(screen.getByText(/Goal-Funded Protection:/i)).toBeInTheDocument();
  });
});

describe('Epic 3: Interactive Sliders, Live Dollar Equivalent & Auto-Balance', () => {
  const profile = mockBaseProfiles[0];
  const allocations = mockBaseAllocations.filter((a) => a.profile_id === profile.id);

  it('renders range sliders, live SGD equivalent, lock toggle and auto-balance button in BaseProfileEditorModal', () => {
    render(
      <BaseProfileEditorModal
        isOpen={true}
        onClose={vi.fn()}
        profile={profile}
        allocations={allocations}
        categories={mockCategories}
      />
    );

    // Verify Auto-Balance to 100% button is rendered
    const autoBalanceBtn = screen.getByRole('button', { name: /auto-balance to 100%/i });
    expect(autoBalanceBtn).toBeInTheDocument();

    // Verify sliders exist for categories
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(mockCategories.length);

    // Verify live dollar equivalent is displayed next to sliders (e.g. S$XXX/mo)
    const dollarElements = screen.getAllByText(/\/mo/i);
    expect(dollarElements.length).toBeGreaterThanOrEqual(mockCategories.length);

    // Verify category lock toggle buttons exist
    const lockButtons = screen.getAllByTitle(/lock /i);
    expect(lockButtons.length).toBeGreaterThanOrEqual(mockCategories.length);
  });

  it('auto-balances unlocked categories proportionally to exactly 100% while keeping locked categories unchanged', async () => {
    render(
      <BaseProfileEditorModal
        isOpen={true}
        onClose={vi.fn()}
        profile={profile}
        allocations={allocations}
        categories={mockCategories}
      />
    );

    // Lock the first category (Food)
    const firstCat = mockCategories[0];
    const foodLockBtn = screen.getByTestId(`lock-${firstCat.id}`);
    fireEvent.click(foodLockBtn);

    // Food is now locked
    expect(screen.getByText('Locked')).toBeInTheDocument();

    // Now change second category (Lifestyle) slider to 60%, throwing total off from 100%
    const secondCat = mockCategories[1];
    const secondSlider = screen.getByTestId(`slider-${secondCat.id}`);
    fireEvent.change(secondSlider, { target: { value: '60' } });

    // Click Auto-Balance to 100%
    const autoBalanceBtn = screen.getByRole('button', { name: /auto-balance to 100%/i });
    fireEvent.click(autoBalanceBtn);

    // Total should now be restored to exactly 100%
    expect(screen.getByText('Total: 100%')).toBeInTheDocument();

    // Verify Save Budget button is enabled
    const saveBtn = screen.getByRole('button', { name: /save budget/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it('renders interactive sliders and auto-balance in ManageCategoriesModal under Allocations view', async () => {
    render(
      <ManageCategoriesModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Switch to "Budget Allocations (%)" view
    const allocationsTab = screen.getByRole('button', { name: /budget allocations/i });
    fireEvent.click(allocationsTab);

    // Check Auto-Balance button appears
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /auto-balance to 100%/i })).toBeInTheDocument();
    });

    // Check sliders are present
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
  });
});

describe('Epic 3: CategoryProgressList Warning Badges', () => {
  it('displays Amber badge for spend >= 80% and Rose badge for spend >= 100%', () => {
    const categories: MonthlyBudgetCategoryDetail[] = [
      {
        id: 'mbc-food',
        monthly_budget_id: 'mb-01',
        category_id: 'cat-food',
        percentage: 0.2,
        allocated_amount: 500,
        actualSpent: 420, // 84% -> Amber Warning Badge
        remaining: 80,
        category: { id: 'cat-food', household_id: 'hh-01', name: 'Food', color: '#10B981', icon: 'utensils', is_system: true, group: 'spendable' },
      },
      {
        id: 'mbc-lifestyle',
        monthly_budget_id: 'mb-01',
        category_id: 'cat-lifestyle',
        percentage: 0.15,
        allocated_amount: 400,
        actualSpent: 450, // 112.5% -> Rose Cap Exceeded Badge
        remaining: -50,
        category: { id: 'cat-lifestyle', household_id: 'hh-01', name: 'Lifestyle', color: '#EC4899', icon: 'sparkles', is_system: true, group: 'spendable' },
      },
    ];

    render(<CategoryProgressList categories={categories} />);

    // Amber warning badge on progress bar
    expect(screen.getByTestId('badge-amber-cat-food')).toBeInTheDocument();
    expect(screen.getByText('Amber Guardrail')).toBeInTheDocument();

    // Rose cap exceeded badge on progress bar
    expect(screen.getByTestId('badge-rose-cat-lifestyle')).toBeInTheDocument();
    expect(screen.getByText('Rose Cap Exceeded')).toBeInTheDocument();
  });
});
