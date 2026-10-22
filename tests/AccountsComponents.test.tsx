/**
 * Unit & Integration Tests for Task 8: Accounts, Balances & Net Worth Growth Center
 * - AccountCard
 * - AccountGroupList
 * - UpdateBalanceModal
 * - NetWorthChart
 * - AccountsPage
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { AccountCard } from '../src/components/accounts/AccountCard';
import { AccountGroupList } from '../src/components/accounts/AccountGroupList';
import { UpdateBalanceModal } from '../src/components/accounts/UpdateBalanceModal';
import { AddAccountModal } from '../src/components/accounts/AddAccountModal';
import { EditAccountModal } from '../src/components/accounts/EditAccountModal';
import { DeleteAccountModal } from '../src/components/accounts/DeleteAccountModal';
import { NetWorthChart, type NetWorthDataPoint } from '../src/components/accounts/NetWorthChart';
import { AccountsPage } from '../src/pages/AccountsPage';
import { financeService } from '../src/services/financeService';
import { formatSGD } from '../src/lib/currency';
import type { Account, Loan } from '../src/types/finance';

// Mock ResizeObserver for jsdom environment
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

// Mock ResponsiveContainer for Recharts so children render inside jsdom
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => (
      <div className="recharts-responsive-container" style={{ width: 800, height: 400 }}>
        {children}
      </div>
    ),
  };
});

const sampleAccounts: Account[] = [
  {
    id: 'acc-1',
    household_id: 'hh-1',
    owner_id: 'mem-1',
    name: "UOB Lady's Savings",
    type: 'Cash',
    balance: 10000.0,
    currency: 'SGD',
    institution: 'UOB',
    is_joint: false,
    notes: 'Emergency fund stash',
    updated_at: '2026-09-15T00:00:00.000Z',
  },
  {
    id: 'acc-2',
    household_id: 'hh-1',
    owner_id: 'mem-1',
    name: 'SGX CDP Equities',
    type: 'Investment',
    balance: 24000.0,
    currency: 'SGD',
    institution: 'SGX CDP',
    is_joint: false,
    updated_at: '2026-09-15T00:00:00.000Z',
  },
  {
    id: 'acc-3',
    household_id: 'hh-1',
    owner_id: 'mem-1',
    name: 'CPF Ordinary Account',
    type: 'CPF',
    balance: 50000.0,
    currency: 'SGD',
    institution: 'CPF',
    is_joint: false,
    updated_at: '2026-09-15T00:00:00.000Z',
  },
  {
    id: 'acc-4',
    household_id: 'hh-1',
    owner_id: 'mem-2',
    name: 'Joint House Savings',
    type: 'Cash',
    balance: 16000.0,
    currency: 'SGD',
    institution: 'OCBC',
    is_joint: true,
    notes: 'For condo reno',
    updated_at: '2026-09-15T00:00:00.000Z',
  },
];

const sampleLoans: Loan[] = [
  {
    id: 'loan-1',
    household_id: 'hh-1',
    borrower_id: null,
    name: 'HDB Housing Loan',
    principal: 500000.0,
    interest_rate: 0.026,
    monthly_payment: 2665.0,
    amount_paid: 50000.0,
    start_date: '2026-05-01',
    term_months: 242,
    loan_type: 'amortized',
    status: 'active',
    created_at: '2026-05-01T00:00:00.000Z',
  },
];

describe('AccountCard', () => {
  it('renders account name, institution tag, type badge, formatted balance, and updated timestamp', () => {
    const acc = sampleAccounts[0];
    render(<AccountCard account={acc} />);

    expect(screen.getByText("UOB Lady's Savings")).toBeInTheDocument();
    expect(screen.getByText('UOB')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText(formatSGD(10000.0))).toBeInTheDocument();
    expect(screen.getByText('Emergency fund stash')).toBeInTheDocument();
    // Verify "Update Balance" button exists
    expect(screen.getByRole('button', { name: /update balance/i })).toBeInTheDocument();
  });

  it('displays Joint badge when is_joint is true, and does not show when false', () => {
    const jointAcc = sampleAccounts[3]; // is_joint: true
    const nonJointAcc = sampleAccounts[0]; // is_joint: false

    const { rerender } = render(<AccountCard account={jointAcc} />);
    expect(screen.getByText('Joint')).toBeInTheDocument();

    rerender(<AccountCard account={nonJointAcc} />);
    expect(screen.queryByText('Joint')).not.toBeInTheDocument();
  });

  it('triggers onUpdateBalance callback with account when button is clicked', () => {
    const acc = sampleAccounts[0];
    const onUpdateBalance = vi.fn();
    render(<AccountCard account={acc} onUpdateBalance={onUpdateBalance} />);

    const updateBtn = screen.getByRole('button', { name: /update balance/i });
    fireEvent.click(updateBtn);

    expect(onUpdateBalance).toHaveBeenCalledTimes(1);
    expect(onUpdateBalance).toHaveBeenCalledWith(acc);
  });
});

describe('AccountGroupList', () => {
  it('groups accounts by type (Cash, Investment, CPF) with subtotals and asset share percentages', () => {
    // Total assets across sampleAccounts: 10,000 + 24,000 + 50,000 + 16,000 = 100,000 SGD
    // Cash subtotal = 10,000 + 16,000 = 26,000 (26%)
    // Investment subtotal = 24,000 (24%)
    // CPF subtotal = 50,000 (50%)
    render(<AccountGroupList accounts={sampleAccounts} />);

    // Check group section headers
    expect(screen.getByRole('heading', { level: 2, name: /cash/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /investment/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /cpf/i })).toBeInTheDocument();

    // Check formatted subtotals
    expect(screen.getByText(formatSGD(26000))).toBeInTheDocument();
    expect(screen.getAllByText(formatSGD(24000)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(formatSGD(50000)).length).toBeGreaterThanOrEqual(1);

    // Check share percentages (26.0%, 24.0%, 50.0%)
    expect(screen.getByText(/26(\.0)?%/)).toBeInTheDocument();
    expect(screen.getByText(/24(\.0)?%/)).toBeInTheDocument();
    expect(screen.getByText(/50(\.0)?%/)).toBeInTheDocument();

    // Check cards are rendered inside
    expect(screen.getByText("UOB Lady's Savings")).toBeInTheDocument();
    expect(screen.getByText('SGX CDP Equities')).toBeInTheDocument();
    expect(screen.getByText('CPF Ordinary Account')).toBeInTheDocument();
    expect(screen.getByText('Joint House Savings')).toBeInTheDocument();
  });

  it('renders friendly empty state when accounts array is empty', () => {
    render(<AccountGroupList accounts={[]} />);
    expect(screen.getByText(/no accounts found/i)).toBeInTheDocument();
  });
});

describe('UpdateBalanceModal', () => {
  it('does not render when isOpen is false or account is null', () => {
    const { rerender } = render(
      <UpdateBalanceModal isOpen={false} account={sampleAccounts[0]} onClose={vi.fn()} />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<UpdateBalanceModal isOpen={true} account={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pre-populates with current balance, date, and optional notes', () => {
    render(
      <UpdateBalanceModal
        isOpen={true}
        account={sampleAccounts[0]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/update account balance/i)).toBeInTheDocument();
    expect(screen.getByText(/UOB Lady's Savings/i)).toBeInTheDocument();

    // Input fields
    const balanceInput = screen.getByLabelText(/new balance/i) as HTMLInputElement;
    expect(balanceInput).toBeInTheDocument();
    expect(Number(balanceInput.value)).toBe(10000);

    const dateInput = screen.getByLabelText(/snapshot date/i) as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    expect(dateInput.value).toBeTruthy(); // Should have date format YYYY-MM-DD

    const notesInput = screen.getByLabelText(/notes|remarks/i) as HTMLInputElement;
    expect(notesInput).toBeInTheDocument();
    expect(notesInput.value).toBe('Emergency fund stash');
  });

  it('calls financeService.updateAccountBalance and triggers onBalanceUpdated on submit', async () => {
    const onBalanceUpdated = vi.fn();
    const onClose = vi.fn();
    const updateSpy = vi.spyOn(financeService, 'updateAccountBalance').mockResolvedValueOnce({
      ...sampleAccounts[0],
      balance: 12500.5,
      notes: 'Bonus credited',
    });

    render(
      <UpdateBalanceModal
        isOpen={true}
        account={sampleAccounts[0]}
        onClose={onClose}
        onBalanceUpdated={onBalanceUpdated}
      />
    );

    const balanceInput = screen.getByLabelText(/new balance/i);
    fireEvent.change(balanceInput, { target: { value: '12500.50' } });

    const notesInput = screen.getByLabelText(/notes|remarks/i);
    fireEvent.change(notesInput, { target: { value: 'Bonus credited' } });

    const saveBtn = screen.getByRole('button', { name: /save balance|update balance/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        sampleAccounts[0].id,
        12500.5,
        'Bonus credited',
        expect.any(String)
      );
    });

    expect(onBalanceUpdated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('NetWorthChart', () => {
  it('renders Recharts chart with progression data points', () => {
    const testData: NetWorthDataPoint[] = [
      { date: '2026-05', assets: 500000, liabilities: 450000, netWorth: 50000 },
      { date: '2026-06', assets: 510000, liabilities: 448000, netWorth: 62000 },
      { date: '2026-07', assets: 520000, liabilities: 446000, netWorth: 74000 },
      { date: '2026-08', assets: 535000, liabilities: 444000, netWorth: 91000 },
      { date: '2026-09', assets: 544200, liabilities: 450000, netWorth: 94200 },
    ];

    render(<NetWorthChart data={testData} />);

    expect(screen.getByRole('heading', { name: /net worth progression/i })).toBeInTheDocument();
    // Verify legend pills exist
    expect(screen.getAllByText(/total assets/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/liabilities/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/true net worth/i).length).toBeGreaterThan(0);
  });

  it('calculates True Net Worth using formula True Net Worth = Total Assets - Outstanding Loans when generating from accounts and loans', () => {
    // Total assets: 100,000 SGD. Outstanding loan: 500,000 - 50,000 = 450,000 SGD.
    // Net worth = 100,000 - 450,000 = -350,000 SGD.
    render(<NetWorthChart accounts={sampleAccounts} loans={sampleLoans} />);
    expect(screen.getByRole('heading', { name: /net worth progression/i })).toBeInTheDocument();
    expect(screen.getByText('-S$350,000.00')).toBeInTheDocument();
  });
});

describe('AccountsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(financeService, 'getAccounts').mockResolvedValue(sampleAccounts);
    vi.spyOn(financeService, 'getLoans').mockResolvedValue(sampleLoans);
  });

  it('renders True Net Worth, Total Assets, and Total Liabilities metric cards correctly', async () => {
    // Total Assets = 100,000 SGD
    // Total Liabilities = 500,000 - 50,000 = 450,000 SGD
    // True Net Worth = 100,000 - 450,000 = -350,000 SGD
    await act(async () => {
      render(
        <HouseholdProvider>
          <AccountsPage />
        </HouseholdProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/accounts & net worth/i)).toBeInTheDocument();
    });

    // Check Metric Cards (appears in metric card and chart legend, so getAllByText is >= 1)
    expect(screen.getAllByText(formatSGD(100000)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(formatSGD(450000)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(formatSGD(-350000)).length).toBeGreaterThanOrEqual(1);

    // Check that AccountGroupList is rendered
    expect(screen.getByText("UOB Lady's Savings")).toBeInTheDocument();
    expect(screen.getByText('SGX CDP Equities')).toBeInTheDocument();
  });

  it('allows opening UpdateBalanceModal and updates account list when balance is saved', async () => {
    await act(async () => {
      render(
        <HouseholdProvider>
          <AccountsPage />
        </HouseholdProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText("UOB Lady's Savings")).toBeInTheDocument();
    });

    const updateButtons = screen.getAllByRole('button', { name: /update balance/i });
    expect(updateButtons.length).toBeGreaterThan(0);

    // Click update on first account
    fireEvent.click(updateButtons[0]);

    // Modal dialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/update account balance/i)).toBeInTheDocument();
  });

  it('updates accounts when switching perspective', async () => {
    const yijiaAccounts = sampleAccounts.filter((a) => a.owner_id === 'mem-1');
    const getAccountsSpy = vi
      .spyOn(financeService, 'getAccounts')
      .mockImplementation(async (perspective) => {
        if (perspective === 'yijia') return yijiaAccounts;
        return sampleAccounts;
      });

    const { rerender } = render(
      <HouseholdProvider initialPerspective="household">
        <AccountsPage />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Joint House Savings')).toBeInTheDocument();
    });

    await act(async () => {
      rerender(
        <HouseholdProvider initialPerspective="yijia">
          <AccountsPage />
        </HouseholdProvider>
      );
    });

    await waitFor(() => {
      expect(getAccountsSpy).toHaveBeenCalledWith('yijia');
    });
  });

  describe('AddAccountModal', () => {
    it('renders Singapore presets and populates inputs upon clicking a preset', () => {
      render(
        <AddAccountModal
          isOpen={true}
          onClose={vi.fn()}
          members={[{ id: 'mem-1', household_id: 'hh-1', display_name: 'Yi Jia', role: 'owner' }]}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Add New Account/i)).toBeInTheDocument();
      expect(screen.getByText('DBS Multiplier')).toBeInTheDocument();
      expect(screen.getByText('OCBC 360')).toBeInTheDocument();

      // Click preset
      fireEvent.click(screen.getByText('DBS Multiplier'));
      expect((screen.getByLabelText(/account name/i) as HTMLInputElement).value).toBe('DBS Multiplier');
      expect((screen.getByLabelText(/bank \/ institution/i) as HTMLInputElement).value).toBe('DBS');
    });

    it('displays the 0-accounts welcome banner when isInitialSetup is true', () => {
      render(
        <AddAccountModal
          isOpen={true}
          onClose={vi.fn()}
          isInitialSetup={true}
          members={[{ id: 'mem-1', household_id: 'hh-1', display_name: 'Yi Jia', role: 'owner' }]}
        />
      );

      expect(screen.getByText(/No accounts found yet/i)).toBeInTheDocument();
    });

    it('submits and invokes financeService.createAccount with form data', async () => {
      const onAccountCreated = vi.fn();
      const onClose = vi.fn();
      const createSpy = vi.spyOn(financeService, 'createAccount').mockResolvedValueOnce({
        id: 'acc-new-1',
        household_id: 'hh-1',
        owner_id: 'mem-1',
        name: 'DBS Multiplier',
        institution: 'DBS',
        type: 'Cash',
        balance: 5000,
        currency: 'SGD',
        is_joint: false,
      });

      render(
        <AddAccountModal
          isOpen={true}
          onClose={onClose}
          onAccountCreated={onAccountCreated}
          members={[{ id: 'mem-1', household_id: 'hh-1', display_name: 'Yi Jia', role: 'owner' }]}
        />
      );

      fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'DBS Multiplier' } });
      fireEvent.change(screen.getByLabelText(/bank \/ institution/i), { target: { value: 'DBS' } });
      fireEvent.change(screen.getByLabelText(/starting balance/i), { target: { value: '5000' } });

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'DBS Multiplier',
            institution: 'DBS',
            balance: 5000,
            type: 'Cash',
            owner_id: 'mem-1',
          })
        );
      });

      expect(onAccountCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('EditAccountModal', () => {
    it('pre-populates existing account fields and updates via financeService.updateAccount', async () => {
      const onAccountUpdated = vi.fn();
      const onClose = vi.fn();
      const updateSpy = vi.spyOn(financeService, 'updateAccount').mockResolvedValueOnce({
        ...sampleAccounts[0],
        name: "UOB Lady's High Yield",
      });

      render(
        <EditAccountModal
          isOpen={true}
          account={sampleAccounts[0]}
          onClose={onClose}
          onAccountUpdated={onAccountUpdated}
          members={[{ id: 'mem-1', household_id: 'hh-1', display_name: 'Yi Jia', role: 'owner' }]}
        />
      );

      const nameInput = screen.getByLabelText(/account name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("UOB Lady's Savings");

      fireEvent.change(nameInput, { target: { value: "UOB Lady's High Yield" } });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          sampleAccounts[0].id,
          expect.objectContaining({
            name: "UOB Lady's High Yield",
          })
        );
      });

      expect(onAccountUpdated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('DeleteAccountModal', () => {
    it('warns about snapshot deletion and deletes account on confirmation', async () => {
      const onAccountDeleted = vi.fn();
      const onClose = vi.fn();
      const deleteSpy = vi.spyOn(financeService, 'deleteAccount').mockResolvedValueOnce();

      render(
        <DeleteAccountModal
          isOpen={true}
          account={sampleAccounts[0]}
          onClose={onClose}
          onAccountDeleted={onAccountDeleted}
        />
      );

      expect(screen.getByText(/Delete Account\?/i)).toBeInTheDocument();
      expect(screen.getByText(/permanently remove all historical balance snapshots/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /delete account/i }));

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith(sampleAccounts[0].id);
      });

      expect(onAccountDeleted).toHaveBeenCalledWith(sampleAccounts[0].id);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Multi-Account UpdateBalanceModal', () => {
    it('allows searching accounts and saving modified balances in batch without checkboxes', async () => {
      const onBalancesUpdated = vi.fn();
      const onClose = vi.fn();
      const bulkSpy = vi.spyOn(financeService, 'bulkUpdateAccountBalances').mockResolvedValueOnce(sampleAccounts);

      render(
        <UpdateBalanceModal
          isOpen={true}
          accounts={sampleAccounts}
          onClose={onClose}
          onBalancesUpdated={onBalancesUpdated}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Update Account Balances/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search accounts/i)).toBeInTheDocument();
      });

      // Filter by search
      const searchInput = screen.getByPlaceholderText(/search accounts/i);
      fireEvent.change(searchInput, { target: { value: 'Lady' } });
      expect(screen.getByText("UOB Lady's Savings")).toBeInTheDocument();

      // Edit balance directly in the input
      const balanceInputs = screen.getAllByPlaceholderText('0.00');
      fireEvent.change(balanceInputs[0], { target: { value: '15000' } });

      expect(screen.getAllByText(/1 modified/i).length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole('button', { name: /save 1 modified account/i }));

      await waitFor(() => {
        expect(bulkSpy).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              accountId: sampleAccounts[0].id,
              balance: 15000,
            }),
          ],
          expect.any(String)
        );
      });

      expect(onBalancesUpdated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
