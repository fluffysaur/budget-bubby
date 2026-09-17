/**
 * AccountGroupList Component
 * Groups accounts by type:
 * - Cash Accounts
 * - Investment Portfolio
 * - CPF (OA, SA, MA)
 * - Other Assets
 * Displays group subtotals and asset share percentages.
 */

import { useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  Landmark,
  Layers,
  PiggyBank,
} from 'lucide-react';
import type { Account, AccountType } from '../../types/finance';
import { formatSGD } from '../../lib/currency';
import { AccountCard } from './AccountCard';

export interface AccountGroupListProps {
  accounts: Account[];
  onUpdateBalance?: (account: Account) => void;
  className?: string;
}

interface GroupConfig {
  type: AccountType;
  title: string;
  description: string;
  icon: typeof Wallet;
  headerColor: string;
}

const GROUP_CONFIGS: GroupConfig[] = [
  {
    type: 'Cash',
    title: 'Cash & Liquid Savings',
    description: 'Everyday checking, high-yield savings, and liquid emergency reserves',
    icon: Wallet,
    headerColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    type: 'Investment',
    title: 'Investment Portfolio',
    description: 'Equities, ETFs, brokerages (SGX CDP, IBKR, Webull, Moomoo)',
    icon: TrendingUp,
    headerColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    type: 'CPF',
    title: 'CPF Accounts (OA / SA / MA)',
    description: 'Ordinary Account, Special Account, and MediSave balances',
    icon: Landmark,
    headerColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    type: 'Other',
    title: 'Other Assets',
    description: 'Miscellaneous stores of value, precious metals, and alternative assets',
    icon: Layers,
    headerColor: 'text-amber-600 dark:text-amber-400',
  },
];

export function AccountGroupList({
  accounts,
  onUpdateBalance,
  className = '',
}: AccountGroupListProps) {
  // Total assets across all visible accounts
  const totalAssets = useMemo(() => {
    return Math.round(accounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100;
  }, [accounts]);

  // Group accounts by type
  const groupedData = useMemo(() => {
    return GROUP_CONFIGS.map((config) => {
      const groupAccounts = accounts.filter((a) => a.type === config.type);
      const subtotal = Math.round(
        groupAccounts.reduce((sum, a) => sum + a.balance, 0) * 100
      ) / 100;
      const sharePercentage = totalAssets > 0 ? (subtotal / totalAssets) * 100 : 0;

      return {
        ...config,
        accounts: groupAccounts,
        subtotal,
        sharePercentage,
      };
    }).filter((g) => g.accounts.length > 0);
  }, [accounts, totalAssets]);

  // Empty state if no accounts
  if (accounts.length === 0) {
    return (
      <div className={`rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900 ${className}`}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mb-3">
          <PiggyBank className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
          No accounts found
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          No financial accounts match the current perspective filter.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {groupedData.map((group) => {
        const Icon = group.icon;
        return (
          <section key={group.type} className="space-y-4">
            {/* Group Header & Subtotals */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800 gap-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800 ${group.headerColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      {group.title}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {group.accounts.length} account{group.accounts.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                    {group.description}
                  </p>
                </div>
              </div>

              {/* Subtotal and Asset Share Percentage */}
              <div className="flex items-baseline gap-2 sm:text-right">
                <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {formatSGD(group.subtotal)}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {group.sharePercentage.toFixed(1)}% of assets
                </span>
              </div>
            </div>

            {/* Grid of Account Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onUpdateBalance={onUpdateBalance}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default AccountGroupList;
