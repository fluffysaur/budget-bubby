/**
 * NetWorthHeroCard Component
 * Hero metric card displaying True Net Worth (Total Assets - Outstanding Loans),
 * Total Assets, Total Liabilities pills, active perspective badge, and trend indicator.
 */

import { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Users,
  User,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import type { Perspective } from '../../types/finance';

export interface NetWorthHeroCardProps {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  perspective?: Perspective;
  perspectiveName?: string;
  className?: string;
  onUpdateBalance?: () => void;
}

export function NetWorthHeroCard({
  netWorth,
  totalAssets,
  totalLiabilities,
  perspective = 'household',
  perspectiveName,
  className = '',
  onUpdateBalance,
}: NetWorthHeroCardProps) {
  const isHousehold = perspective === 'household';

  const displayName = useMemo(() => {
    if (perspectiveName) return perspectiveName;
    if (isHousehold) return 'Combined Household';
    const clean = perspective.toLowerCase();
    if (clean.includes('yijia')) return 'Yi Jia';
    if (clean.includes('rachel')) return 'Rachel';
    return perspective;
  }, [perspectiveName, isHousehold, perspective]);

  const isPositive = netWorth >= 0;

  // Asset coverage percentage
  const coverageRatio = useMemo(() => {
    if (totalLiabilities <= 0) return 100;
    return Math.round((totalAssets / totalLiabilities) * 100);
  }, [totalAssets, totalLiabilities]);

  return (
    <div
      role="region"
      aria-label="True Net Worth Summary"
      className={`relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-950 p-6 sm:p-8 shadow-xs transition-colors ${className}`}
    >
      {/* Background ambient glow */}
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl opacity-20 ${
          isPositive ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      />

      {/* Top row: Perspective Badge & Trend Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Perspective Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-slate-200">
          {isHousehold ? (
            <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          )}
          <span>{displayName}</span>
        </div>

        {/* Trend Indicator Pill */}
        <div
          data-testid="trend-indicator"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            isPositive
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/70'
          }`}
        >
          {isPositive ? (
            <>
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Positive Net Worth</span>
            </>
          ) : (
            <>
              <TrendingDown className="h-3.5 w-3.5" />
              <span>Mortgage / Debt Payoff Phase</span>
            </>
          )}
        </div>
      </div>

      {/* Hero Net Worth Amount */}
      <div className="mt-5">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          True Net Worth
        </span>
        <div className="mt-1 flex items-baseline gap-3">
          <h2
            className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight ${
              isPositive
                ? 'text-slate-900 dark:text-white'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatSGD(netWorth)}
          </h2>
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
          Total Assets minus Total Outstanding Loans &amp; Liabilities
        </p>
      </div>

      {/* Sub-Metrics Pills: Assets and Liabilities */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 border-t border-slate-200/80 dark:border-slate-800">
        {/* Total Assets Pill */}
        <div className="flex items-center justify-between rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 p-3.5 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Assets
              </span>
              <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {formatSGD(totalAssets)}
              </div>
            </div>
          </div>
          {onUpdateBalance && (
            <button
              type="button"
              onClick={onUpdateBalance}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline cursor-pointer"
            >
              Update
            </button>
          )}
        </div>

        {/* Total Liabilities Pill */}
        <div className="flex items-center justify-between rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 p-3.5 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Liabilities
              </span>
              <div className="text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400">
                {formatSGD(totalLiabilities)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              {totalLiabilities > 0 ? `${coverageRatio}% Covered` : 'Debt Free'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NetWorthHeroCard;
