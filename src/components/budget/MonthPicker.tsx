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
      className={`inline-flex flex-wrap items-center gap-2 p-1.5 bg-(--bg-card) border-[1.5px] border-(--border-ink) rounded-2xl shadow-cute-sm transition-colors ${className}`}
    >
      {/* Previous Month Button */}
      <button
        type="button"
        onClick={handlePrevMonth}
        aria-label="Previous month"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Month Display */}
      <div className="flex items-center gap-2 px-3 py-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--border-ink) bg-(--pastel-lilac-light) text-(--text-ink)">
          <Calendar className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-black text-sm tracking-tight text-(--text-ink)">
            {formatDisplayMonth(selectedMonth)}
          </span>
          <span className="text-[10px] font-mono-num font-semibold text-(--text-muted)">
            {selectedMonth}
          </span>
        </div>
      </div>

      {/* Next Month Button */}
      <button
        type="button"
        onClick={handleNextMonth}
        aria-label="Next month"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Current Month Badge or Jump Action */}
      {isCurrentMonth ? (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[11px] font-bold border border-(--border-ink) bg-(--pastel-mint) text-(--text-ink) shadow-cute-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-700 animate-pulse" />
          Current Month
        </span>
      ) : (
        <button
          type="button"
          onClick={handleJumpToCurrent}
          aria-label="Jump to current month"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold border border-(--border-ink) bg-(--pastel-butter-light) text-(--text-ink) hover:bg-(--pastel-butter) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Current Month</span>
        </button>
      )}
    </div>
  );
}

export default MonthPicker;
