/**
 * Expense Filter Bar
 * Allows filtering expense ledger by:
 * - Search keyword (merchant / item description / remarks)
 * - Category dropdown
 * - Payer dropdown (Yi Jia / Rachel)
 * - Shared / Personal split status
 * - Month picker ('YYYY-MM')
 * - Reset filter action
 */

import type { ChangeEvent } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import type { Category, HouseholdMember, ExpenseFilter } from '../../types/finance';
import { mockCategories, mockMembers } from '../../data/mockSeedData';
import { Select } from '../ui/Select';

export interface ExpenseFilterBarProps {
  filter: ExpenseFilter;
  onFilterChange: (newFilter: ExpenseFilter) => void;
  categories?: Category[];
  members?: HouseholdMember[];
  onReset?: () => void;
  className?: string;
}

export function ExpenseFilterBar({
  filter,
  onFilterChange,
  categories = mockCategories,
  members = mockMembers,
  onReset,
  className = '',
}: ExpenseFilterBarProps) {
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filter,
      search: e.target.value,
    });
  };

  const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterChange({
      ...filter,
      categoryId: value ? value : undefined,
    });
  };

  const handlePayerChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterChange({
      ...filter,
      payerId: value ? value : undefined,
    });
  };

  const handleSharedChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    let isShared: boolean | undefined = undefined;
    if (val === 'shared') isShared = true;
    if (val === 'personal') isShared = false;

    onFilterChange({
      ...filter,
      isShared,
    });
  };

  const handleMonthChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onFilterChange({
      ...filter,
      month: value ? value : undefined,
    });
  };

  const handleResetClick = () => {
    if (onReset) {
      onReset();
    } else {
      onFilterChange({
        search: '',
        categoryId: undefined,
        payerId: undefined,
        isShared: undefined,
        month: undefined,
      });
    }
  };

  const hasActiveFilters = Boolean(
    filter.search ||
    filter.categoryId ||
    filter.payerId ||
    filter.isShared !== undefined ||
    filter.tag
  );

  return (
    <div
      className={`w-full min-w-0 overflow-hidden rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) p-4 shadow-cute-sm transition-colors ${className}`}
    >
      <div className="space-y-3">
        {/* Top Row: Search Input & Reset Button */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--text-muted)" />
            <input
              id="filter-search"
              type="text"
              placeholder="Search merchant, item, note..."
              value={filter.search || ''}
              onChange={handleSearchChange}
              className="w-full rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-canvas) pl-9 pr-3 py-2 text-xs font-medium text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
            />
          </div>

          <button
            type="button"
            onClick={handleResetClick}
            title="Reset Filters"
            className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-3.5 text-xs font-bold transition-all shrink-0 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
              hasActiveFilters
                ? 'border-(--border-ink) bg-(--pastel-coral-light) text-(--text-ink) shadow-cute-sm'
                : 'border-(--border-ink) bg-(--bg-canvas) text-(--text-muted) hover:bg-(--pastel-butter-light)'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Bottom Row: 4 Filter Selectors in Balanced Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Category Select */}
          <div className="min-w-0">
            <Select
              id="filter-category"
              label="Category"
              labelClassName="text-[11px] mb-1 tracking-wider"
              value={filter.categoryId || ''}
              onChange={handleCategoryChange}
              sizeVariant="sm"
              className="bg-(--bg-canvas)"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Payer Select */}
          <div className="min-w-0">
            <Select
              id="filter-payer"
              label="Payer"
              labelClassName="text-[11px] mb-1 tracking-wider"
              value={filter.payerId || ''}
              onChange={handlePayerChange}
              sizeVariant="sm"
              className="bg-(--bg-canvas)"
            >
              <option value="">All Payers</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.display_name}
                </option>
              ))}
            </Select>
          </div>

          {/* Shared Split Select */}
          <div className="min-w-0">
            <Select
              id="filter-shared"
              label="Type / Split"
              labelClassName="text-[11px] mb-1 tracking-wider"
              value={
                filter.isShared === undefined
                  ? 'all'
                  : filter.isShared
                  ? 'shared'
                  : 'personal'
              }
              onChange={handleSharedChange}
              sizeVariant="sm"
              className="bg-(--bg-canvas)"
            >
              <option value="all">All Expenses</option>
              <option value="shared">Shared (50/50)</option>
              <option value="personal">Personal Only</option>
            </Select>
          </div>

          {/* Month Selector */}
          <div className="min-w-0">
            <label
              htmlFor="filter-month"
              className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
            >
              Month
            </label>
            <input
              id="filter-month"
              type="month"
              value={filter.month || ''}
              onChange={handleMonthChange}
              className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 pr-3.5 py-2 text-xs font-mono-num font-semibold text-(--text-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac) cursor-pointer"
            />
          </div>
        </div>
      </div>

      {filter.tag && (
        <div className="mt-3 pt-3 border-t border-(--border-subtle) flex items-center gap-2">
          <span className="text-[11px] font-bold text-(--text-muted)">Filtered Tag:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-(--pastel-lilac-light) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-cute-sm">
            <span>#{filter.tag}</span>
            <button
              type="button"
              aria-label="Remove tag filter"
              onClick={() => onFilterChange({ ...filter, tag: undefined })}
              className="text-(--text-ink) hover:text-rose-600 text-sm font-bold cursor-pointer leading-none"
            >
              ×
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

export default ExpenseFilterBar;
