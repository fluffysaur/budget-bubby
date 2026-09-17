/**
 * AccountCard Component
 * Displays individual account details:
 * - Account name
 * - Institution tag
 * - Account type badge (Cash, Investment, CPF, Other)
 * - Formatted balance in SGD (S$)
 * - Joint ownership badge
 * - Last updated timestamp
 * - Optional notes / remarks
 * - Fast "Update Balance" action button
 */

import {
  Wallet,
  TrendingUp,
  Landmark,
  Layers,
  Users,
  Pencil,
  Clock,
} from 'lucide-react';
import type { Account, AccountType } from '../../types/finance';
import { formatSGD } from '../../lib/currency';
import { formatDisplayDate } from '../../lib/dateUtils';

export interface AccountCardProps {
  account: Account;
  onUpdateBalance?: (account: Account) => void;
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

export function AccountCard({ account, onUpdateBalance, className = '' }: AccountCardProps) {
  const typeStyle = getTypeBadgeStyles(account.type);
  const TypeIcon = typeStyle.icon;

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-md transition-all ${className}`}
    >
      <div>
        {/* Header: Institution & Type Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeStyle.iconBg}`}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white tracking-tight">
                {account.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {account.institution && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                    {account.institution}
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${typeStyle.badge}`}
                >
                  {account.type}
                </span>
                {account.is_joint && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                    <Users className="h-3 w-3" />
                    <span>Joint</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Balance Display */}
        <div className="mt-4">
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {formatSGD(account.balance)}
          </span>
          {account.currency && account.currency !== 'SGD' && (
            <span className="ml-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
              {account.currency}
            </span>
          )}
        </div>

        {/* Optional Notes */}
        {account.notes && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {account.notes}
          </p>
        )}
      </div>

      {/* Footer: Last Updated & Update Balance Action */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {account.updated_at
              ? `Updated ${formatDisplayDate(account.updated_at)}`
              : 'Balance up to date'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onUpdateBalance?.(account)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 active:scale-95 transition-all cursor-pointer"
        >
          <Pencil className="h-3 w-3 stroke-[2.2]" />
          <span>Update Balance</span>
        </button>
      </div>
    </div>
  );
}

export default AccountCard;
