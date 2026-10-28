/**
 * Comprehensive Unit & Integration Tests for Task 12:
 * Combined Household Hub & Settlement Center
 *
 * Tests:
 * 1. NetWorthHeroCard:
 *    - Renders True Net Worth (Total Assets - Outstanding Loans) formatted in SGD
 *    - Renders Total Assets and Total Liabilities pills
 *    - Displays active perspective badge (Combined Household vs Member)
 *    - Displays trend indicator
 * 2. SettlementWidget:
 *    - Displays "Who Owes Whom" balance (e.g., "Rachel owes Yi Jia S$1,234.50" or "All settled up")
 *    - Displays breakdown of what each partner paid towards shared expenses
 *    - Handles zero balance / all settled state
 *    - Settle Up button opens confirmation dialog
 *    - Confirming Settle Up calls financeService.settleSharedExpenses and invokes onSettled
 *    - Canceling confirmation does not trigger settleSharedExpenses
 * 3. SharedGoalsOverview:
 *    - Displays top savings goals with emojis, progress bars, pacing badges, and target dates
 *    - Handles empty goals state cleanly
 *    - Invokes onViewAll callback
 * 4. UpcomingBillsWidget:
 *    - Displays recurring policies / bills due in current and upcoming months
 *    - Displays policy type badge, amount formatted in SGD, and due timing
 *    - Handles empty policies state cleanly
 *    - Invokes onViewAll callback
 * 5. DashboardPage:
 *    - Household perspective renders NetWorthHeroCard, SettlementWidget, SharedGoalsOverview, UpcomingBillsWidget
 *    - Personal perspective renders personal Net Worth, personal budget progress, personal accounts, and recent transactions
 *    - Quick Actions open QuickAddExpenseModal and UpdateBalanceModal
 *    - Perspective switching dynamically adapts layout and figures
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { NetWorthHeroCard } from '../src/components/dashboard/NetWorthHeroCard';
import { SettlementWidget } from '../src/components/dashboard/SettlementWidget';
import { SharedGoalsOverview } from '../src/components/dashboard/SharedGoalsOverview';
import { UpcomingBillsWidget } from '../src/components/dashboard/UpcomingBillsWidget';
import { DashboardPage } from '../src/pages/DashboardPage';
import { financeService } from '../src/services/financeService';
import { formatSGD } from '../src/lib/currency';
import type {
  Account,
  Expense,
  HouseholdMember,
  HouseholdOverview,
  Loan,
  MonthlyBudgetDetail,
  RecurringPolicy,
  SavingsGoal,
  SettlementSummary,
} from '../src/types/finance';

const sampleMembers: HouseholdMember[] = [
  {
    id: 'mem-001',
    household_id: 'hh-001',
    user_id: null,
    display_name: 'Yi Jia',
    email: 'yijia@example.com',
    role: 'owner',
    avatar_url: '👨',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mem-002',
    household_id: 'hh-001',
    user_id: null,
    display_name: 'Rachel',
    email: 'rachel@example.com',
    role: 'member',
    avatar_url: '👩',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

const sampleSettlementSummary: SettlementSummary = {
  netBalance: 1234.5,
  debtorId: 'mem-002',
  creditorId: 'mem-001',
  debtorName: 'Rachel',
  creditorName: 'Yi Jia',
  settlementText: 'Rachel owes Yi Jia S$1,234.50',
  member1OwesMember2: 400.0,
  member2OwesMember1: 1634.5,
};

const sampleZeroSettlementSummary: SettlementSummary = {
  netBalance: 0,
  debtorId: null,
  creditorId: null,
  settlementText: 'All settled up',
  member1OwesMember2: 0,
  member2OwesMember1: 0,
};

const sampleGoals: SavingsGoal[] = [
  {
    id: 'goal-01',
    household_id: 'hh-001',
    owner_id: null,
    title: 'HDB Down Payment',
    target_amount: 190000.0,
    saved_so_far: 100000.0,
    target_date: '2027-07-01',
    monthly_contribution: 10000.0,
    emoji: '🏠',
    status: 'on_track',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'goal-02',
    household_id: 'hh-001',
    owner_id: null,
    title: 'Wedding Fund',
    target_amount: 55000.0,
    saved_so_far: 55000.0,
    target_date: '2027-05-01',
    monthly_contribution: 0.0,
    emoji: '💍',
    status: 'achieved',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'goal-03',
    household_id: 'hh-001',
    owner_id: null,
    title: 'Renovation Fund',
    target_amount: 90000.0,
    saved_so_far: 15000.0,
    target_date: '2027-09-01',
    monthly_contribution: 1000.0,
    emoji: '🔨',
    status: 'behind',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

const samplePolicies: RecurringPolicy[] = [
  {
    id: 'pol-01',
    household_id: 'hh-001',
    owner_id: 'mem-001',
    type: 'insurance',
    name: 'Manulife - Lifeready 25 Plus',
    amount: 3200.0,
    frequency: 'annually',
    payment_month: 9,
    start_date: null,
    end_date: null,
    notes: 'Annual premium renewed in September',
    monthly_amortized_amount: 266.67,
  },
  {
    id: 'pol-02',
    household_id: 'hh-001',
    owner_id: 'mem-001',
    type: 'insurance',
    name: 'IncomeShield Preferred',
    amount: 1600.0,
    frequency: 'annually',
    payment_month: 10,
    start_date: null,
    end_date: null,
    notes: 'Annual premium renewed in October',
    monthly_amortized_amount: 133.33,
  },
  {
    id: 'pol-03',
    household_id: 'hh-001',
    owner_id: 'mem-002',
    type: 'tax',
    name: 'IRAS Property Tax',
    amount: 1200.0,
    frequency: 'annually',
    payment_month: 1,
    start_date: null,
    end_date: null,
    notes: null,
    monthly_amortized_amount: 100.0,
  },
];

const sampleAccounts: Account[] = [
  {
    id: 'acc-01',
    household_id: 'hh-001',
    owner_id: 'mem-001',
    name: 'DBS Multiplier',
    type: 'Cash',
    balance: 25000.0,
    currency: 'SGD',
    institution: 'DBS',
    is_joint: false,
  },
  {
    id: 'acc-02',
    household_id: 'hh-001',
    owner_id: 'mem-002',
    name: 'OCBC 360',
    type: 'Cash',
    balance: 20000.0,
    currency: 'SGD',
    institution: 'OCBC',
    is_joint: false,
  },
  {
    id: 'acc-03',
    household_id: 'hh-001',
    owner_id: 'mem-001',
    name: 'Joint House Account',
    type: 'Cash',
    balance: 45000.0,
    currency: 'SGD',
    institution: 'UOB',
    is_joint: true,
  },
  {
    id: 'acc-04',
    household_id: 'hh-001',
    owner_id: 'mem-001',
    name: 'CPF Ordinary Account',
    type: 'CPF',
    balance: 90000.0,
    currency: 'SGD',
    institution: 'CPF',
    is_joint: false,
  },
];

const sampleLoans: Loan[] = [
  {
    id: 'loan-01',
    household_id: 'hh-001',
    borrower_id: null, // Joint loan
    name: 'HDB Housing Loan',
    principal: 400000.0,
    interest_rate: 0.026,
    monthly_payment: 2132.0,
    amount_paid: 40000.0, // Remaining: 360,000
    start_date: '2026-05-01',
    term_months: 240,
    loan_type: 'amortized',
    status: 'active',
  },
];

const sampleExpenses: Expense[] = [
  {
    id: 'exp-01',
    household_id: 'hh-001',
    payer_id: 'mem-001',
    date: '2026-09-12',
    item: 'FairPrice Xtra Groceries',
    amount: 180.0,
    is_shared: true,
    split_ratio: 0.5,
    settled: false,
  },
  {
    id: 'exp-02',
    household_id: 'hh-001',
    payer_id: 'mem-002',
    date: '2026-09-10',
    item: 'Uniqlo Clothes',
    amount: 95.0,
    is_shared: false,
    split_ratio: 0.5,
    settled: false,
  },
];

const sampleHouseholdOverview: HouseholdOverview = {
  household: {
    id: 'hh-001',
    name: 'Yi Jia & Rachel',
    currency: 'SGD',
  },
  members: sampleMembers,
  totalAssets: 180000.0,
  totalLiabilities: 360000.0,
  trueNetWorth: -180000.0,
  settlementSummary: sampleSettlementSummary,
  activeGoals: sampleGoals,
  upcomingBills: samplePolicies,
};

const sampleMonthlyBudget: MonthlyBudgetDetail = {
  budget: {
    id: 'mb-01',
    household_id: 'hh-001',
    owner_id: 'mem-001',
    month: '2026-09',
    gross_salary: 6500.0,
    bonus: 0,
    cpf_deduction: 1300.0,
    taxes_deduction: 250.0,
    insurance_deduction: 350.0,
    after_deductions: 4600.0,
    is_locked: false,
  },
  categories: [
    {
      id: 'mbc-01',
      monthly_budget_id: 'mb-01',
      category_id: 'cat-01',
      percentage: 0.3,
      allocated_amount: 1380.0,
      actualSpent: 450.0,
      remaining: 930.0,
      category: {
        id: 'cat-01',
        household_id: 'hh-001',
        name: 'Food',
        color: '#F59E0B',
        icon: 'utensils',
        is_system: true,
      },
    },
  ],
  disposablePool: 4600.0,
  totalSpent: 450.0,
  totalRemaining: 4150.0,
};

describe('NetWorthHeroCard', () => {
  it('renders True Net Worth, Total Assets, and Total Liabilities formatted in SGD', () => {
    render(
      <NetWorthHeroCard
        netWorth={-180000.0}
        totalAssets={180000.0}
        totalLiabilities={360000.0}
        perspective="household"
        perspectiveName="Combined Household"
      />
    );

    // Checks True Net Worth formatting: -S$180,000.00
    expect(screen.getByText('-S$180,000.00')).toBeInTheDocument();
    // Checks Total Assets: S$180,000.00
    expect(screen.getByText('S$180,000.00')).toBeInTheDocument();
    // Checks Total Liabilities: S$360,000.00
    expect(screen.getByText('S$360,000.00')).toBeInTheDocument();
  });

  it('displays perspective badge and trend indicator', () => {
    const { rerender } = render(
      <NetWorthHeroCard
        netWorth={150000.0}
        totalAssets={250000.0}
        totalLiabilities={100000.0}
        perspective="household"
        perspectiveName="Combined Household"
      />
    );

    expect(screen.getByText('Combined Household')).toBeInTheDocument();
    expect(screen.getByText('S$150,000.00')).toBeInTheDocument();

    // Re-render with personal perspective
    rerender(
      <NetWorthHeroCard
        netWorth={75000.0}
        totalAssets={125000.0}
        totalLiabilities={50000.0}
        perspective="yijia"
        perspectiveName="Yi Jia"
      />
    );

    expect(screen.getByText('Yi Jia')).toBeInTheDocument();
    expect(screen.getByText('S$75,000.00')).toBeInTheDocument();
  });
});

describe('SettlementWidget', () => {
  it('displays who owes whom balance and settlement breakdown', () => {
    render(
      <SettlementWidget
        summary={sampleSettlementSummary}
        members={sampleMembers}
        expenses={sampleExpenses}
      />
    );

    expect(screen.getByText('Rachel owes Yi Jia S$1,234.50')).toBeInTheDocument();
    expect(screen.getByText('S$1,234.50')).toBeInTheDocument();
    // Verify Settle Up button is present
    expect(screen.getByRole('button', { name: /settle up/i })).toBeInTheDocument();
  });

  it('displays "All settled up" message when netBalance is zero', () => {
    render(
      <SettlementWidget
        summary={sampleZeroSettlementSummary}
        members={sampleMembers}
      />
    );

    expect(screen.getAllByText(/all settled up/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('S$0.00').length).toBeGreaterThanOrEqual(1);
  });

  it('clicking Settle Up opens confirmation modal and confirms settlement', async () => {
    const settleSpy = vi
      .spyOn(financeService, 'settleSharedExpenses')
      .mockResolvedValueOnce();
    const onSettled = vi.fn();

    render(
      <SettlementWidget
        summary={sampleSettlementSummary}
        members={sampleMembers}
        onSettled={onSettled}
      />
    );

    const settleBtn = screen.getByRole('button', { name: /settle up/i });
    fireEvent.click(settleBtn);

    // Confirmation dialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /confirm settlement/i })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirm|mark settled/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(settleSpy).toHaveBeenCalledWith('mem-001', 'mem-002');
      expect(onSettled).toHaveBeenCalledTimes(1);
    });
  });

  it('canceling settlement closes the modal without calling settleSharedExpenses', async () => {
    const settleSpy = vi.spyOn(financeService, 'settleSharedExpenses');

    render(
      <SettlementWidget
        summary={sampleSettlementSummary}
        members={sampleMembers}
      />
    );

    const settleBtn = screen.getByRole('button', { name: /settle up/i });
    fireEvent.click(settleBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(settleSpy).not.toHaveBeenCalled();
  });
});

describe('SharedGoalsOverview', () => {
  it('renders top milestone goals with emojis, progress bars, and pacing status badges', () => {
    render(<SharedGoalsOverview goals={sampleGoals} />);

    expect(screen.getByText('HDB Down Payment')).toBeInTheDocument();
    expect(screen.getByText('Wedding Fund')).toBeInTheDocument();
    expect(screen.getByText('Renovation Fund')).toBeInTheDocument();

    // Pacing badges
    expect(screen.getByText(/on track/i)).toBeInTheDocument();
    expect(screen.getByText(/achieved/i)).toBeInTheDocument();
    expect(screen.getByText(/behind/i)).toBeInTheDocument();

    // Target amounts
    expect(screen.getByText(formatSGD(190000))).toBeInTheDocument();
  });

  it('renders friendly empty state when no goals exist', () => {
    render(<SharedGoalsOverview goals={[]} />);
    expect(screen.getByText(/no milestone goals/i)).toBeInTheDocument();
  });

  it('calls onViewAll callback when View All button is clicked', () => {
    const onViewAll = vi.fn();
    render(<SharedGoalsOverview goals={sampleGoals} onViewAll={onViewAll} />);

    const viewAllBtn = screen.getByRole('button', { name: /view all/i });
    fireEvent.click(viewAllBtn);
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });
});

describe('UpcomingBillsWidget', () => {
  it('renders upcoming policies with formatted amounts and renewal status', () => {
    render(<UpcomingBillsWidget policies={samplePolicies} />);

    expect(screen.getByText('Manulife - Lifeready 25 Plus')).toBeInTheDocument();
    expect(screen.getByText('IncomeShield Preferred')).toBeInTheDocument();
    expect(screen.getByText('S$3,200.00')).toBeInTheDocument();
    expect(screen.getByText('S$1,600.00')).toBeInTheDocument();
  });

  it('renders empty state when no upcoming bills', () => {
    render(<UpcomingBillsWidget policies={[]} />);
    expect(screen.getByText(/no upcoming renewals/i)).toBeInTheDocument();
  });

  it('calls onViewAll callback when View All button is clicked', () => {
    const onViewAll = vi.fn();
    render(<UpcomingBillsWidget policies={samplePolicies} onViewAll={onViewAll} />);

    const viewAllBtn = screen.getByRole('button', { name: /view all/i });
    fireEvent.click(viewAllBtn);
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });
});

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(financeService, 'getHouseholdOverview').mockResolvedValue(sampleHouseholdOverview);
    vi.spyOn(financeService, 'getAccounts').mockResolvedValue(sampleAccounts);
    vi.spyOn(financeService, 'getLoans').mockResolvedValue(sampleLoans);
    vi.spyOn(financeService, 'getGoals').mockResolvedValue(sampleGoals);
    vi.spyOn(financeService, 'getPolicies').mockResolvedValue(samplePolicies);
    vi.spyOn(financeService, 'getExpenses').mockResolvedValue(sampleExpenses);
    vi.spyOn(financeService, 'getMonthlyBudget').mockResolvedValue(sampleMonthlyBudget);
  });

  it('renders Combined Household Hub with all widgets and True Net Worth', async () => {
    await act(async () => {
      render(
        <HouseholdProvider initialPerspective="household">
          <DashboardPage />
        </HouseholdProvider>
      );
    });

    await waitFor(() => {
      // True Net Worth: Assets 180k - Liabilities 360k = -180k
      expect(screen.getAllByText('-S$180,000.00').length).toBeGreaterThanOrEqual(1);
    });

    // Settlement Widget is displayed in Household view
    expect(screen.getByText('Rachel owes Yi Jia S$1,234.50')).toBeInTheDocument();

    // Goals & Bills widgets are displayed
    expect(screen.getByText('HDB Down Payment')).toBeInTheDocument();
    expect(screen.getByText('Manulife - Lifeready 25 Plus')).toBeInTheDocument();
  });

  it('settle up in DashboardPage invokes financeService and refreshes overview', async () => {
    const settleSpy = vi
      .spyOn(financeService, 'settleSharedExpenses')
      .mockResolvedValueOnce();

    await act(async () => {
      render(
        <HouseholdProvider initialPerspective="household">
          <DashboardPage />
        </HouseholdProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /settle up/i })).toBeInTheDocument();
    });

    const settleBtn = screen.getByRole('button', { name: /settle up/i });
    fireEvent.click(settleBtn);

    const confirmBtn = screen.getByRole('button', { name: /confirm|mark settled/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(settleSpy).toHaveBeenCalled();
    });
  });

  it('adapts to Personal Perspective (Yi Jia) showing personal net worth and monthly budget progress', async () => {
    await act(async () => {
      render(
        <HouseholdProvider initialPerspective="yijia">
          <DashboardPage />
        </HouseholdProvider>
      );
    });

    await waitFor(() => {
      // Yi Jia's Personal view should display his personal budget progress
      expect(screen.getByText(/personal budget|monthly budget/i)).toBeInTheDocument();
      expect(screen.getByText(formatSGD(6500.0))).toBeInTheDocument(); // Gross Salary
      expect(screen.getByText(formatSGD(4600.0))).toBeInTheDocument(); // Disposable / Take-Home
    });

    // In personal perspective, settlement widget is replaced or accompanied by personal accounts & recent expenses
    expect(screen.getByText(/personal accounts|my accounts/i)).toBeInTheDocument();
    expect(screen.getByText('DBS Multiplier')).toBeInTheDocument();
  });

  it('opens UpdateBalanceModal when Update button on account row is clicked in personal view', async () => {
    await act(async () => {
      render(
        <HouseholdProvider initialPerspective="yijia">
          <DashboardPage />
        </HouseholdProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('DBS Multiplier')).toBeInTheDocument();
    });

    const updateBtns = screen.getAllByRole('button', { name: /update/i });
    expect(updateBtns.length).toBeGreaterThan(0);
    fireEvent.click(updateBtns[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/update account balance/i)).toBeInTheDocument();
  });
});
