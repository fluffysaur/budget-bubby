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
    filter.isShared !== undefined
  );

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors ${className}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search Input */}
        <div className="lg:col-span-1">
          <label
            htmlFor="filter-search"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
          >
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="filter-search"
              type="text"
              placeholder="Search merchant, item, note..."
              value={filter.search || ''}
              onChange={handleSearchChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:bg-slate-800"
            />
          </div>
        </div>

        {/* Category Select */}
        <div>
          <label
            htmlFor="filter-category"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
          >
            Category
          </label>
          <select
            id="filter-category"
            value={filter.categoryId || ''}
            onChange={handleCategoryChange}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:border-emerald-400 dark:focus:bg-slate-800"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Payer Select */}
        <div>
          <label
            htmlFor="filter-payer"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
          >
            Payer
          </label>
          <select
            id="filter-payer"
            value={filter.payerId || ''}
            onChange={handlePayerChange}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:border-emerald-400 dark:focus:bg-slate-800"
          >
            <option value="">All Payers</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </select>
        </div>

        {/* Shared Split Select */}
        <div>
          <label
            htmlFor="filter-shared"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
          >
            Type / Split
          </label>
          <select
            id="filter-shared"
            value={
              filter.isShared === undefined
                ? 'all'
                : filter.isShared
                ? 'shared'
                : 'personal'
            }
            onChange={handleSharedChange}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:border-emerald-400 dark:focus:bg-slate-800"
          >
            <option value="all">All Expenses</option>
            <option value="shared">Shared (50/50)</option>
            <option value="personal">Personal Only</option>
          </select>
        </div>

        {/* Month Selector & Clear Button */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label
              htmlFor="filter-month"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              Month
            </label>
            <input
              id="filter-month"
              type="month"
              value={filter.month || ''}
              onChange={handleMonthChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:border-emerald-400 dark:focus:bg-slate-800"
            />
          </div>

          <button
            type="button"
            onClick={handleResetClick}
            title="Reset Filters"
            className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all shrink-0 ${
              hasActiveFilters
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExpenseFilterBar;
