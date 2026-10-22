/**
 * AccountGroupList Component
 * Groups accounts by type:
 * - Cash Accounts
 * - Investment Portfolio
 * - CPF (OA, SA, MA)
 * - Other Assets
 * Supports:
 * - All vs Non-CPF (Liquid) filter toggle
 * - Compact Notion-inspired row view (default) or Card view
 * - Inline quick balance editing + modal Update Balance trigger
 */

import { useState, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  Landmark,
  Layers,
  PiggyBank,
  Pencil,
  Check,
  X,
  LayoutGrid,
  List,
  Trash2,
  Settings,
  Plus,
} from 'lucide-react';
import type { Account, AccountType } from '../../types/finance';
import { formatSGD } from '../../lib/currency';
import { AccountCard } from './AccountCard';

export interface AccountGroupListProps {
  accounts: Account[];
  onUpdateBalance?: (account: Account) => void;
  onQuickSaveBalance?: (accountId: string, newBalance: number) => Promise<void>;
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  onAddAccount?: () => void;
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
  onQuickSaveBalance,
  onEditAccount,
  onDeleteAccount,
  onAddAccount,
  className = '',
}: AccountGroupListProps) {
  const [scopeFilter, setScopeFilter] = useState<'all' | 'non-cpf'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState<string>('');
  const [isSavingInline, setIsSavingInline] = useState<boolean>(false);

  const filteredAccounts = useMemo(() => {
    if (scopeFilter === 'non-cpf') {
      return accounts.filter((a) => a.type !== 'CPF');
    }
    return accounts;
  }, [accounts, scopeFilter]);

  // Total assets across all visible accounts
  const totalAssets = useMemo(() => {
    return Math.round(filteredAccounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100;
  }, [filteredAccounts]);

  const nonCpfTotal = useMemo(() => {
    return (
      Math.round(
        accounts
          .filter((a) => a.type !== 'CPF')
          .reduce((sum, a) => sum + a.balance, 0) * 100
      ) / 100
    );
  }, [accounts]);

  // Group accounts by type
  const groupedData = useMemo(() => {
    return GROUP_CONFIGS.map((config) => {
      const groupAccounts = filteredAccounts.filter((a) => a.type === config.type);
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
  }, [filteredAccounts, totalAssets]);

  const handleStartInlineEdit = (account: Account) => {
    setInlineEditingId(account.id);
    setInlineValue(String(account.balance));
  };

  const handleCommitInlineEdit = async (account: Account) => {
    const parsed = parseFloat(inlineValue);
    if (isNaN(parsed) || parsed < 0) {
      setInlineEditingId(null);
      return;
    }
    if (onQuickSaveBalance && Math.abs(parsed - account.balance) >= 0.01) {
      try {
        setIsSavingInline(true);
        await onQuickSaveBalance(account.id, parsed);
      } finally {
        setIsSavingInline(false);
      }
    }
    setInlineEditingId(null);
  };

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
    <div className={`space-y-5 ${className}`}>
      {/* Filter & View Mode Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScopeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              scopeFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            All Accounts ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('non-cpf')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              scopeFilter === 'non-cpf'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            Non-CPF Liquid ({formatSGD(nonCpfTotal)})
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            aria-label="Compact Table View"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compact</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            aria-label="Cards View"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
        </div>
      </div>

      {/* Grouped Account Sections */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 mb-3">
            <Landmark className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            No Accounts Added Yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5 leading-relaxed">
            Track your Singapore bank accounts, investments, and CPF balances in one centralized dashboard.
          </p>
          {onAddAccount && (
            <button
              type="button"
              onClick={onAddAccount}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Add Your First Account</span>
            </button>
          )}
        </div>
      ) : (
        groupedData.map((group) => {
        const Icon = group.icon;
        return (
          <section key={group.type} className="space-y-3">
            {/* Group Header & Subtotals */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800 gap-2">
              <div className="flex items-center gap-2.5">
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

            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onUpdateBalance={onUpdateBalance}
                    onEditAccount={onEditAccount}
                    onDeleteAccount={onDeleteAccount}
                  />
                ))}
              </div>
            ) : (
              /* Notion-Style Compact Table List */
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden shadow-2xs">
                {group.accounts.map((account) => {
                  const isEditing = inlineEditingId === account.id;
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {account.name}
                          </span>
                          {account.institution && (
                            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              {account.institution}
                            </span>
                          )}
                          {account.is_joint && (
                            <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
                              Joint
                            </span>
                          )}
                        </div>
                        {account.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {account.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={inlineValue}
                              onChange={(e) => setInlineValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitInlineEdit(account);
                                if (e.key === 'Escape') setInlineEditingId(null);
                              }}
                              autoFocus
                              className="w-28 rounded-lg border border-emerald-500 bg-white dark:bg-slate-800 px-2 py-1 text-right text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={isSavingInline}
                              onClick={() => handleCommitInlineEdit(account)}
                              aria-label="Save inline balance"
                              className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineEditingId(null)}
                              aria-label="Cancel inline edit"
                              className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onQuickSaveBalance
                                  ? handleStartInlineEdit(account)
                                  : onUpdateBalance?.(account)
                              }
                              title="Click to edit balance"
                              className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                            >
                              {formatSGD(account.balance)}
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateBalance?.(account)}
                              aria-label="Update Balance"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" />
                              <span className="hidden sm:inline">Update Balance</span>
                            </button>
                            {onEditAccount && (
                              <button
                                type="button"
                                onClick={() => onEditAccount(account)}
                                aria-label={`Edit ${account.name}`}
                                title="Edit account details"
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer transition-colors"
                              >
                                <Settings className="h-3 w-3" />
                              </button>
                            )}
                            {onDeleteAccount && (
                              <button
                                type="button"
                                onClick={() => onDeleteAccount(account)}
                                aria-label={`Delete ${account.name}`}
                                title="Delete account"
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 dark:text-slate-400 dark:hover:text-rose-400 cursor-pointer transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      }))}
    </div>
  );
}

export default AccountGroupList;
