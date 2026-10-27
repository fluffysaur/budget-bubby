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
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { TooltipPopover } from '../ui/TooltipPopover';
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
  const displayName = perspectiveName || (isHousehold ? 'Combined Household' : perspective);

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
      className={`relative overflow-hidden rounded-2xl border-[1.5px] border-(--border-ink) bg-linear-to-br from-[#fbf7f1] via-white to-[#f5ecff] dark:from-[#262220] dark:via-[#2b2724] dark:to-[#342445] p-5 sm:p-6 shadow-(--shadow-cute) transition-colors ${className}`}
    >
      {/* Top row: Status & Trend Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {displayName ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-(--border-ink) bg-(--bg-card) px-3 py-1 text-xs font-bold text-(--text-ink) shadow-(--shadow-cute-sm)">
            {displayName}
          </span>
        ) : (
          <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
            Household Balance Sheet
          </span>
        )}

        {/* Trend Indicator Pill */}
        <div
          data-testid="trend-indicator"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) ${
            isPositive
              ? 'bg-[#bbf7d0] text-[#14532d]'
              : 'bg-[#fff1ee] text-[#9a1b1b]'
          }`}
        >
          {isPositive ? (
            <>
              <TrendingUp className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Positive Net Worth</span>
            </>
          ) : (
            <>
              <TrendingDown className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Debt Payoff Phase</span>
            </>
          )}
        </div>
      </div>

      {/* Hero Net Worth Amount */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-(--text-muted)">
            True Net Worth
          </span>
          <TooltipPopover
            title="True Net Worth Formula"
            ariaLabel="True Net Worth Formula"
            align="left"
          >
            Total Assets (Cash, Investments &amp; CPF) minus Total Outstanding Loans &amp; Liabilities.
          </TooltipPopover>
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <h2
            className={`text-3xl sm:text-4xl font-black tracking-tight font-mono-num ${
              isPositive
                ? 'text-(--text-ink)'
                : 'text-[#9a1b1b] dark:text-rose-400'
            }`}
          >
            {formatSGD(netWorth)}
          </h2>
        </div>
      </div>

      {/* Sub-Metrics Pills: Assets and Liabilities */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t-[1.5px] border-(--border-ink)/20">
        {/* Total Assets Pill */}
        <div className="flex items-center justify-between rounded-2xl bg-[#f0fdf4] dark:bg-[#13351d] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-[#1e462b] border-[1.5px] border-(--border-ink) text-[#14532d] dark:text-[#86efac] shadow-(--shadow-cute-sm)">
              <Wallet className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#166534] dark:text-[#86efac]">
                Total Assets
              </span>
              <div className="text-base sm:text-lg font-black text-[#14532d] dark:text-white font-mono-num">
                {formatSGD(totalAssets)}
              </div>
            </div>
          </div>
          {onUpdateBalance && (
            <button
              type="button"
              onClick={onUpdateBalance}
              className="text-xs font-bold text-[#15803d] dark:text-[#86efac] underline underline-offset-2 hover:opacity-80 cursor-pointer"
            >
              Update
            </button>
          )}
        </div>

        {/* Total Liabilities Pill */}
        <div className="flex items-center justify-between rounded-2xl bg-[#fff1ee] dark:bg-[#3d1c1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-[#4a2220] border-[1.5px] border-(--border-ink) text-[#9a1b1b] dark:text-[#fca5a5] shadow-(--shadow-cute-sm)">
              <CreditCard className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#991b1b] dark:text-[#fca5a5]">
                Total Liabilities
              </span>
              <div className="text-base sm:text-lg font-black text-[#9a1b1b] dark:text-rose-400 font-mono-num">
                {formatSGD(totalLiabilities)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-[#991b1b] dark:text-[#fca5a5]">
              {totalLiabilities > 0 ? `${coverageRatio}% Covered` : 'Debt Free'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NetWorthHeroCard;
