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
        badge: 'bg-(--pastel-mint-light) text-(--text-ink) border-(--border-ink)',
        icon: Wallet,
        iconBg: 'bg-(--pastel-mint) text-(--text-ink) border border-(--border-ink)',
      };
    case 'Investment':
      return {
        badge: 'bg-(--pastel-butter-light) text-(--text-ink) border-(--border-ink)',
        icon: TrendingUp,
        iconBg: 'bg-(--pastel-butter) text-(--text-ink) border border-(--border-ink)',
      };
    case 'CPF':
      return {
        badge: 'bg-(--pastel-lilac-light) text-(--text-ink) border-(--border-ink)',
        icon: Landmark,
        iconBg: 'bg-(--pastel-lilac) text-(--text-ink) border border-(--border-ink)',
      };
    case 'Other':
    default:
      return {
        badge: 'bg-(--bg-canvas) text-(--text-ink) border-(--border-ink)',
        icon: Layers,
        iconBg: 'bg-(--bg-cream) text-(--text-ink) border border-(--border-ink)',
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
      className={`flex flex-col justify-between rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) p-3.5 sm:p-4 shadow-cute-sm hover:shadow-cute transition-all ${className}`}
    >
      <div>
        {/* Header: Institution & Type Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-cute-sm ${typeStyle.iconBg}`}>
              <TypeIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display font-black text-sm text-(--text-ink) tracking-tight">
                {account.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {account.institution && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-(--bg-canvas) text-(--text-ink) border border-(--border-ink)">
                    {account.institution}
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold border ${typeStyle.badge}`}
                >
                  {account.type}
                </span>
                {account.is_joint && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-(--pastel-pink-light) text-(--text-ink) border border-(--border-ink)">
                    <Users className="h-2.5 w-2.5" />
                    <span>Joint</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Edit & Delete Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {onEditAccount && (
              <button
                type="button"
                onClick={() => onEditAccount(account)}
                aria-label={`Edit ${account.name}`}
                title="Edit account details"
                className="p-1 rounded-lg border border-(--border-ink) bg-(--bg-card) text-(--text-ink) hover:bg-(--pastel-butter-light) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
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
                className="p-1 rounded-lg border border-(--border-ink) bg-(--bg-card) text-(--text-ink) hover:bg-(--pastel-coral-light) hover:text-rose-600 shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Balance Display */}
        <div className="mt-2.5">
          <span className="font-mono-num text-xl sm:text-2xl font-black tracking-tight text-(--text-ink)">
            {formatSGD(account.balance)}
          </span>
          {account.currency && account.currency !== 'SGD' && (
            <span className="ml-1.5 text-xs text-(--text-muted) font-mono-num font-bold">
              {account.currency}
            </span>
          )}
        </div>

        {/* Optional Notes */}
        {account.notes && (
          <p className="mt-1 text-[11px] text-(--text-muted) line-clamp-1">
            {account.notes}
          </p>
        )}
      </div>

      {/* Footer: Last Updated & Update Balance Action */}
      <div className="mt-3 pt-2.5 border-t border-(--border-subtle) flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px] font-mono-num text-(--text-muted) truncate">
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-(--text-ink) bg-(--pastel-lilac-light) border border-(--border-ink) shadow-cute-sm hover:bg-(--pastel-lilac) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
        >
          <Pencil className="h-3 w-3 stroke-[2.2]" />
          <span>Update Balance</span>
        </button>
      </div>
    </div>
  );
}

export default AccountCard;
