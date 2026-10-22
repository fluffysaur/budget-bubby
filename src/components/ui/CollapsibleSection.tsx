/**
 * CollapsibleSection Component
 * Notion-inspired progressive disclosure accordion (`▸ Title`) that hides
 * complex tables, calculators, or secondary breakdowns until expanded by the user.
 */

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface CollapsibleSectionProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  summaryRight?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  subtitle,
  badge,
  summaryRight,
  icon,
  defaultOpen = false,
  children,
  className = '',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-90 text-emerald-600 dark:text-emerald-400' : ''
            }`}
          />
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {title}
              </span>
              {badge}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {summaryRight && (
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {summaryRight}
            </div>
          )}
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {isOpen ? 'Hide' : 'Show'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 bg-slate-50/30 dark:bg-slate-900/50 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;

