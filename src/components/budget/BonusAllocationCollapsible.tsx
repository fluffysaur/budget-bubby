/**
 * BonusAllocationCollapsible Component
 * Notion-inspired collapsible helper that calculates how a Gross Bonus
 * is split after 20% Employee CPF into:
 * - Tithing (10%)
 * - Goals (40%)
 * - Savings (10%)
 * - Investments (20%)
 * - Lifestyle (20%)
 */

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { calculateBonusAllocation } from '../../lib/financialFormulas';
import { CollapsibleSection } from '../ui/CollapsibleSection';

export interface BonusAllocationCollapsibleProps {
  initialGrossBonus?: number;
  cpfRate?: number;
  defaultOpen?: boolean;
  className?: string;
}

export function BonusAllocationCollapsible({
  initialGrossBonus = 2000,
  cpfRate = 0.2,
  defaultOpen = false,
  className = '',
}: BonusAllocationCollapsibleProps) {
  const [grossInput, setGrossInput] = useState<string>(String(initialGrossBonus));
  const numericGross = Math.max(0, parseFloat(grossInput) || 0);
  const result = calculateBonusAllocation(numericGross, cpfRate);

  return (
    <CollapsibleSection
      title="Bonus Allocation Calculator"
      subtitle="Split AWS / performance bonuses after 20% CPF into Tithing, Goals, Savings, Investments & Lifestyle"
      badge={`Net ${formatSGD(result.afterCpf)}`}
      icon={<Sparkles className="h-4 w-4" />}
      defaultOpen={defaultOpen}
      className={className}
    >
      <div className="space-y-4">
        {/* Top Row: Gross Bonus Input -> CPF -> After CPF */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
            <label
              htmlFor="bonus-gross-input"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              Gross Bonus (S$)
            </label>
            <input
              id="bonus-gross-input"
              type="number"
              step="100"
              min="0"
              value={grossInput}
              onChange={(e) => setGrossInput(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-base font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex flex-col justify-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Employee CPF ({Math.round(cpfRate * 100)}%)
            </span>
            <span className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
              -{formatSGD(result.cpfDeduction)}
            </span>
          </div>

          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 flex flex-col justify-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              After CPF Take-Home Bonus
            </span>
            <span className="mt-1 text-lg font-extrabold text-emerald-900 dark:text-emerald-100">
              {formatSGD(result.afterCpf)}
            </span>
          </div>
        </div>

        {/* 5 Allocation Buckets */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {result.allocations.map((bucket) => (
            <div
              key={bucket.name}
              className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {bucket.name}
                </span>
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: bucket.color }}
                >
                  {Math.round(bucket.percentage * 100)}%
                </span>
              </div>
              <span className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                {formatSGD(bucket.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

export default BonusAllocationCollapsible;

