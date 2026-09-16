/**
 * AccountsPage Component
 * Full page coordinating:
 * - Active perspective (Combined Household vs Yi Jia vs Rachel)
 * - Summary metric cards: True Net Worth, Total Assets, Total Liabilities / Loans
 * - Net Worth progression chart (NetWorthChart)
 * - Grouped account listings (AccountGroupList)
 * - Quick balance update modal (UpdateBalanceModal)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  User,
  Users,
  Loader2,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { AccountGroupList } from '../components/accounts/AccountGroupList';
import { UpdateBalanceModal } from '../components/accounts/UpdateBalanceModal';
import { NetWorthChart } from '../components/accounts/NetWorthChart';
import type { Account, Loan } from '../types/finance';

export interface AccountsPageProps {
  className?: string;
}

export function AccountsPage({ className = '' }: AccountsPageProps) {
  const { perspective, activeMember, refreshData: refreshHousehold } = useHousehold();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Perspective display label
  const perspectiveDisplayName = useMemo(() => {
    if (perspective === 'household') return 'Combined Household';
    if (activeMember) return activeMember.display_name;
    const clean = perspective.toLowerCase();
    if (clean.includes('yijia')) return 'Yi Jia';
    if (clean.includes('rachel')) return 'Rachel';
    return perspective;
  }, [perspective, activeMember]);

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

  // Handlers for balance update modal
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

  // Metrics Calculations
  const totalAssets = useMemo(() => {
    const sum = accounts.reduce((acc, a) => acc + a.balance, 0);
    return Math.round(sum * 100) / 100;
  }, [accounts]);

  const activeLoans = useMemo(() => {
    return loans.filter((l) => l.status === 'active');
  }, [loans]);

  const totalLiabilities = useMemo(() => {
    const sum = activeLoans.reduce((acc, l) => acc + (l.principal - l.amount_paid), 0);
    return Math.round(sum * 100) / 100;
  }, [activeLoans]);

  const trueNetWorth = useMemo(() => {
    return Math.round((totalAssets - totalLiabilities) * 100) / 100;
  }, [totalAssets, totalLiabilities]);

  return (
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Accounts &amp; Net Worth
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              {perspective === 'household' ? (
                <Users className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
              <span>{perspectiveDisplayName}</span>
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Cash, CPF, and investment portfolio growth center
          </p>
        </div>
      </div>

      {/* High-Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: True Net Worth */}
        <div className="rounded-2xl border-2 border-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
              True Net Worth
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                trueNetWorth < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-indigo-900 dark:text-indigo-100'
              }`}
            >
              {formatSGD(trueNetWorth)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
            Total Assets - Outstanding Loans
          </p>
        </div>

        {/* Card 2: Total Assets */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Assets
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatSGD(totalAssets)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            {accounts.length} account{accounts.length === 1 ? '' : 's'} in view
          </p>
        </div>

        {/* Card 3: Total Liabilities / Loans */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Liabilities / Loans
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {formatSGD(totalLiabilities)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            {activeLoans.length} active loan{activeLoans.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="text-sm font-medium">Loading account balances &amp; net worth...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Net Worth Progression Area Chart */}
          <NetWorthChart accounts={accounts} loans={loans} />

          {/* Grouped Accounts Listing */}
          <AccountGroupList
            accounts={accounts}
            onUpdateBalance={handleOpenUpdateModal}
          />
        </>
      )}

      {/* Update Balance Fast Modal */}
      <UpdateBalanceModal
        isOpen={isUpdateModalOpen}
        account={selectedAccount}
        onClose={handleCloseModal}
        onBalanceUpdated={handleBalanceUpdated}
      />
    </div>
  );
}

export default AccountsPage;
