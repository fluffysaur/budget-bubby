/**
 * AccountCard Component
 * Displays individual account details:
 * - Compact vertical padding
 * - Consistent text-2xl font-extrabold balance
 * - Quick "Update Balance" action button
 */

import {
  Wallet,
  TrendingUp,
  Landmark,
  Layers,
  Users,
  Pencil,
  Clock,
  Trash2,
  Settings,
} from 'lucide-react';
import type { Account, AccountType } from '../../types/finance';
import { formatSGD } from '../../lib/currency';
import { formatDisplayDate } from '../../lib/dateUtils';

export interface AccountCardProps {
  account: Account;
  onUpdateBalance?: (account: Account) => void;
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  className?: string;
}

function getTypeBadgeStyles(type: AccountType) {
  switch (type) {
    case 'Cash':
      return {
        badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60',
        icon: Wallet,
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
      };
    case 'Investment':
      return {
        badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60',
        icon: TrendingUp,
        iconBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
      };
    case 'CPF':
      return {
        badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/60',
        icon: Landmark,
        iconBg: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
      };
    case 'Other':
    default:
      return {
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60',
        icon: Layers,
        iconBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
      };
  }
}

export function AccountCard({
  account,
  onUpdateBalance,
  onEditAccount,
  onDeleteAccount,
  className = '',
}: AccountCardProps) {
  const typeStyle = getTypeBadgeStyles(account.type);
  const TypeIcon = typeStyle.icon;

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all ${className}`}
    >
      <div>
        {/* Header: Institution & Type Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${typeStyle.iconBg}`}>
              <TypeIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                {account.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {account.institution && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                    {account.institution}
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-semibold border ${typeStyle.badge}`}
                >
                  {account.type}
                </span>
                {account.is_joint && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                    <Users className="h-2.5 w-2.5" />
                    <span>Joint</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Edit & Delete Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            {onEditAccount && (
              <button
                type="button"
                onClick={() => onEditAccount(account)}
                aria-label={`Edit ${account.name}`}
                title="Edit account details"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            )}
            {onDeleteAccount && (
              <button
                type="button"
                onClick={() => onDeleteAccount(account)}
                aria-label={`Delete ${account.name}`}
                title="Delete account"
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Balance Display */}
        <div className="mt-2.5">
          <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {formatSGD(account.balance)}
          </span>
          {account.currency && account.currency !== 'SGD' && (
            <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
              {account.currency}
            </span>
          )}
        </div>

        {/* Optional Notes */}
        {account.notes && (
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {account.notes}
          </p>
        )}
      </div>

      {/* Footer: Last Updated & Update Balance Action */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 truncate">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {account.updated_at
              ? `Updated ${formatDisplayDate(account.updated_at)}`
              : 'Up to date'}
          </span>
        </div>

        <button
          type="button"
          aria-label="Update Balance"
          onClick={() => onUpdateBalance?.(account)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Pencil className="h-3 w-3 stroke-[2.2]" />
          <span>Update Balance</span>
        </button>
      </div>
    </div>
  );
}

export default AccountCard;
