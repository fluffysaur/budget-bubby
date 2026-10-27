/**
 * AccountsPage Component
 * Full page coordinating:
 * - Active perspective (Combined Household vs Yi Jia vs Rachel)
 * - Summary metric cards: True Net Worth, Total Assets, Total Liabilities / Loans
 * - Net Worth progression chart (NetWorthChart)
 * - Grouped account listings with Notion-style table/card view (AccountGroupList)
 * - 1-Click Month-End Check-In Bulk Update Modal (BulkBalanceUpdateModal)
 * - Quick individual balance update modal (UpdateBalanceModal)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  Loader2,
  CalendarCheck,
  Plus,
  ReceiptText,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Button, StatCard } from '../components/ui';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { AccountGroupList } from '../components/accounts/AccountGroupList';
import { UpdateBalanceModal } from '../components/accounts/UpdateBalanceModal';
import { AddAccountModal } from '../components/accounts/AddAccountModal';
import { EditAccountModal } from '../components/accounts/EditAccountModal';
import { DeleteAccountModal } from '../components/accounts/DeleteAccountModal';
import { NetWorthChart } from '../components/accounts/NetWorthChart';
import { CreditCardTrackerSection } from '../components/accounts/CreditCardTrackerSection';
import type { Account, Loan } from '../types/finance';

export interface AccountsPageProps {
  className?: string;
  defaultTab?: 'accounts' | 'credit_cards';
}

export function AccountsPage({ className = '', defaultTab = 'accounts' }: AccountsPageProps) {
  const { perspective, activeMember, members, refreshData: refreshHousehold } = useHousehold();

  const [activeTab, setActiveTab] = useState<'accounts' | 'credit_cards'>(defaultTab);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal States
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Load accounts and loans for current perspective
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [accountsData, loansData] = await Promise.all([
        financeService.getAccounts(perspective),
        financeService.getLoans(),
      ]);
      setAccounts(accountsData || []);
      setLoans(loansData || []);
    } catch (err) {
      console.error('Failed to load accounts or loans:', err);
    } finally {
      setIsLoading(false);
    }
  }, [perspective]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers for individual balance update modal
  const handleOpenUpdateModal = (account: Account) => {
    setSelectedAccount(account);
    setIsUpdateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsUpdateModalOpen(false);
    setSelectedAccount(null);
  };

  const handleBalanceUpdated = async () => {
    await loadData();
    await refreshHousehold();
  };

  // Handler for inline balance edit from AccountGroupList
  const handleInlineUpdateBalance = async (accountId: string, newBalance: number) => {
    try {
      await financeService.updateAccountBalance(accountId, newBalance);
      await loadData();
      await refreshHousehold();
    } catch (err) {
      console.error('Failed to update inline balance:', err);
    }
  };

  // Metrics Calculations
  const totalAssets = useMemo(() => {
    const sum = accounts.reduce((acc, a) => acc + a.balance, 0);
    return Math.round(sum * 100) / 100;
  }, [accounts]);

  const activeLoans = useMemo(() => {
    return loans.filter((l) => {
      if (l.status !== 'active') return false;
      if (perspective === 'household') return true;
      return !l.borrower_id || l.borrower_id === activeMember?.id;
    });
  }, [loans, perspective, activeMember]);

  const totalLiabilities = useMemo(() => {
    const sum = activeLoans.reduce((acc, l) => {
      const remaining = l.principal - l.amount_paid;
      if (perspective !== 'household' && !l.borrower_id) {
        return acc + remaining * 0.5; // 50% split for joint household loans
      }
      return acc + remaining;
    }, 0);
    return Math.round(sum * 100) / 100;
  }, [activeLoans, perspective]);

  const trueNetWorth = useMemo(() => {
    return Math.round((totalAssets - totalLiabilities) * 100) / 100;
  }, [totalAssets, totalLiabilities]);

  return (
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      {/* Page Header */}
      <PageHeader
        title="Accounts & Net Worth"
        actions={
          <div className="flex items-center gap-2 min-h-[38px]">
            {activeTab === 'accounts' && (
              <>
                <Button
                  variant="secondary"
                  aria-label="Add Account"
                  leftIcon={<Plus className="h-4 w-4 stroke-[2.5]" />}
                  onClick={() => setIsAddModalOpen(true)}
                >
                  Add Account
                </Button>
                <Button
                  variant="primary"
                  aria-label="Update Balances"
                  leftIcon={<CalendarCheck className="h-4 w-4 stroke-[2.5]" />}
                  onClick={() => {
                    setSelectedAccount(null);
                    setIsUpdateModalOpen(true);
                  }}
                >
                  Update Balances
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-2xl w-fit">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'accounts'}
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Wallet className={`h-4 w-4 ${activeTab === 'accounts' ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
          <span>Accounts &amp; Assets</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'credit_cards'}
          onClick={() => setActiveTab('credit_cards')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'credit_cards'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ReceiptText className={`h-4 w-4 ${activeTab === 'credit_cards' ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
          <span>Credit Card Tracker</span>
        </button>
      </div>

      {activeTab === 'credit_cards' ? (
        <CreditCardTrackerSection
          members={members}
          perspective={perspective}
          activeMemberId={activeMember?.id}
        />
      ) : (
        <>
          {/* High-Level Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Card 1: True Net Worth */}
            <StatCard
              title="True Net Worth"
              value={formatSGD(trueNetWorth)}
              tooltip="Calculated as Total Assets minus Outstanding Loans."
              icon={<TrendingUp className="h-4 w-4 text-white" />}
              iconBg="bg-indigo-600"
              className="border-2 border-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20"
            />

            {/* Card 2: Total Assets */}
            <StatCard
              title="Total Assets"
              value={formatSGD(totalAssets)}
              subtitle={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
              icon={<Wallet className="h-4 w-4" />}
              iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
            />

            {/* Card 3: Total Liabilities / Loans */}
            <StatCard
              title="Total Liabilities / Loans"
              value={formatSGD(totalLiabilities)}
              subtitle={`${loans.length} active loan${loans.length === 1 ? '' : 's'}`}
              icon={<CreditCard className="h-4 w-4" />}
              iconBg="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
            />
          </div>

          {/* Loading Indicator */}
          {isLoading ? (
            <div className="flex items-center justify-center p-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <span className="text-sm font-medium">Loading account balances &amp; net worth...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Net Worth Progression Area Chart */}
              <NetWorthChart accounts={accounts} loans={loans} />

              {/* Grouped Accounts Listing with Table / Card view */}
              <AccountGroupList
                accounts={accounts}
                onUpdateBalance={handleOpenUpdateModal}
                onQuickSaveBalance={handleInlineUpdateBalance}
                onEditAccount={(acc) => {
                  setAccountToEdit(acc);
                  setIsEditModalOpen(true);
                }}
                onDeleteAccount={(acc) => {
                  setAccountToDelete(acc);
                  setIsDeleteModalOpen(true);
                }}
                onAddAccount={() => setIsAddModalOpen(true)}
              />
            </>
          )}
        </>
      )}

      {/* Individual & Multi Account Balance Modal */}
      <UpdateBalanceModal
        isOpen={isUpdateModalOpen}
        account={selectedAccount}
        accounts={accounts}
        onClose={handleCloseModal}
        onBalanceUpdated={handleBalanceUpdated}
        onBalancesUpdated={handleBalanceUpdated}
        onOpenAddAccount={() => setIsAddModalOpen(true)}
      />

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        members={members}
        defaultOwnerId={activeMember?.id}
        isInitialSetup={accounts.length === 0}
        onAccountCreated={async () => {
          await loadData();
          await refreshHousehold();
        }}
      />

      {/* Edit Account Modal */}
      <EditAccountModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setAccountToEdit(null);
        }}
        account={accountToEdit}
        members={members}
        onAccountUpdated={async () => {
          await loadData();
          await refreshHousehold();
        }}
      />

      {/* Delete Account Confirmation Modal */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setAccountToDelete(null);
        }}
        account={accountToDelete}
        onAccountDeleted={async () => {
          await loadData();
          await refreshHousehold();
        }}
      />
    </div>
  );
}

export default AccountsPage;
