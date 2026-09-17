/**
 * MonthPicker Component
 * Monthly navigation component ('YYYY-MM') with:
 * - Previous / Next month step controls
 * - Formatted month display ('September 2026')
 * - Current month badge & jump to current month trigger
 */

import { ChevronLeft, ChevronRight, Calendar, RotateCcw } from 'lucide-react';
import { addMonths, formatDisplayMonth, getCurrentMonth } from '../../lib/dateUtils';

export interface MonthPickerProps {
  selectedMonth: string; // 'YYYY-MM'
  onChangeMonth: (month: string) => void;
  className?: string;
}

export function MonthPicker({
  selectedMonth,
  onChangeMonth,
  className = '',
}: MonthPickerProps) {
  const currentMonth = getCurrentMonth();
  const isCurrentMonth = selectedMonth === currentMonth;

  const handlePrevMonth = () => {
    onChangeMonth(addMonths(selectedMonth, -1));
  };

  const handleNextMonth = () => {
    onChangeMonth(addMonths(selectedMonth, 1));
  };

  const handleJumpToCurrent = () => {
    onChangeMonth(currentMonth);
  };

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs transition-colors ${className}`}
    >
      {/* Previous Month Button */}
      <button
        type="button"
        onClick={handlePrevMonth}
        aria-label="Previous month"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Month Display */}
      <div className="flex items-center gap-2 px-3 py-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          <Calendar className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            {formatDisplayMonth(selectedMonth)}
          </span>
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 font-mono">
            {selectedMonth}
          </span>
        </div>
      </div>

      {/* Next Month Button */}
      <button
        type="button"
        onClick={handleNextMonth}
        aria-label="Next month"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Current Month Badge or Jump Action */}
      {isCurrentMonth ? (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Current Month
        </span>
      ) : (
        <button
          type="button"
          onClick={handleJumpToCurrent}
          aria-label="Jump to current month"
          className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition-all cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Current Month</span>
        </button>
      )}
    </div>
  );
}

export default MonthPicker;
