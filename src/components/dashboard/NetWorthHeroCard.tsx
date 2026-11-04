/**
 * NetWorthHeroCard Component
 * Hero metric card showing Net Worth (total of all account balances)
 * with the active perspective badge.
 */

import { formatSGD } from '../../lib/currency';
import { TooltipPopover } from '../ui/TooltipPopover';
import type { Perspective } from '../../types/finance';

export interface NetWorthHeroCardProps {
  netWorth: number;
  perspective?: Perspective;
  perspectiveName?: string;
  className?: string;
  onUpdateBalance?: () => void;
}

export function NetWorthHeroCard({
  netWorth,
  perspective = 'household',
  perspectiveName,
  className = '',
}: NetWorthHeroCardProps) {
  const isHousehold = perspective === 'household';
  const displayName = perspectiveName || (isHousehold ? 'Combined Household' : perspective);

  const isPositive = netWorth >= 0;

  return (
    <div
      role="region"
      aria-label="Net Worth Summary"
      className={`relative overflow-hidden rounded-2xl border-2 border-(--border-ink) bg-linear-to-br from-[#fbf7f1] via-white to-[#f5ecff] dark:from-[#262220] dark:via-[#2b2724] dark:to-[#342445] p-5 sm:p-6 shadow-(--shadow-cute) transition-colors ${className}`}
    >
      {/* Top row: perspective badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {displayName ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-(--border-ink) bg-(--bg-card) px-3 py-1 text-xs font-bold text-(--text-ink) shadow-(--shadow-cute-sm)">
            {displayName}
          </span>
        ) : (
          <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
            Household Balance Sheet
          </span>
        )}
      </div>

      {/* Hero Net Worth Amount */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-(--text-muted)">
            Net Worth
          </span>
          <TooltipPopover
            title="Net Worth Formula"
            ariaLabel="Net Worth Formula"
            align="left"
          >
            Total of all account balances (Cash, Investments &amp; CPF).
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
    </div>
  );
}

export default NetWorthHeroCard;
