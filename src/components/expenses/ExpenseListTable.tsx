/**
 * Responsive Expense Transaction Ledger
 * Displays:
 * - Date, Item Description & remarks, Category badge, Payer avatar/name, Split status, Amount
 * - Power Tools:
 *   - Sorting: Date (newest/oldest), Amount (highest/lowest), Category (A-Z), Payer
 *   - Visual sort direction indicators (chevron up/down)
 *   - Pagination: Page size selector (20, 50, 100), Page navigation (Prev/Next/numbers), "Showing 1–20 of 85"
 *   - Edit Expense Modal integration
 *   - Delete Expense Confirmation Modal integration
 * - Responsive card layout on mobile so ledger never overflows or clips
 */

import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Pencil,
  Receipt,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { formatForeignAmount } from '../../lib/currencyConverter';
import { formatDisplayDate } from '../../lib/dateUtils';
import { mockCategories, mockMembers } from '../../data/mockSeedData';
import { EditExpenseModal } from './EditExpenseModal';
import { DeleteExpenseModal } from './DeleteExpenseModal';
import type {
  Expense,
  Category,
  HouseholdMember,
  ExpenseSortField,
  SortDirection,
} from '../../types/finance';

export interface ExpenseListTableProps {
  expenses: Expense[];
  categories?: Category[];
  members?: HouseholdMember[];
  onDeleteExpense?: (id: string) => Promise<void> | void;
  onEditExpense?: (expense: Expense) => void;
  onExpenseSaved?: (expense: Expense) => void;
  isLoading?: boolean;
  sortBy?: ExpenseSortField;
  sortOrder?: SortDirection;
  onSortChange?: (field: ExpenseSortField, order: SortDirection) => void;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export function ExpenseListTable({
  expenses,
  categories = mockCategories,
  members = mockMembers,
  onDeleteExpense,
  onEditExpense,
  onExpenseSaved,
  isLoading = false,
  sortBy: propSortBy,
  sortOrder: propSortOrder,
  onSortChange,
  currentPage: propCurrentPage,
  pageSize: propPageSize,
  onPageChange,
  onPageSizeChange,
}: ExpenseListTableProps) {
  // Internal sort state (fallback if uncontrolled)
  const [internalSortBy, setInternalSortBy] = useState<ExpenseSortField | null>(propSortBy || null);
  const [internalSortOrder, setInternalSortOrder] = useState<SortDirection>(propSortOrder || 'desc');

  // Internal pagination state (fallback if uncontrolled)
  const [internalCurrentPage, setInternalCurrentPage] = useState<number>(1);
  const [internalPageSize, setInternalPageSize] = useState<number>(20);

  // Active modal targets
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const activeSortBy = propSortBy ?? internalSortBy;
  const activeSortOrder = propSortOrder ?? internalSortOrder;
  const activeCurrentPage = propCurrentPage ?? internalCurrentPage;
  const activePageSize = propPageSize ?? internalPageSize;

  const handleSort = (field: ExpenseSortField) => {
    let newOrder: SortDirection = 'desc';
    if (activeSortBy === field) {
      newOrder = activeSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      newOrder = field === 'date' || field === 'amount' ? 'desc' : 'asc';
    }

    if (onSortChange) {
      onSortChange(field, newOrder);
    } else {
      setInternalSortBy(field);
      setInternalSortOrder(newOrder);
    }
  };

  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      setInternalCurrentPage(page);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    } else {
      setInternalPageSize(newSize);
      setInternalCurrentPage(1);
    }
  };

  const getCategory = (catId?: string | null): Category | undefined => {
    if (!catId) return undefined;
    return categories.find((c) => c.id === catId);
  };

  const getMember = (memberId: string): HouseholdMember | undefined => {
    return members.find((m) => m.id === memberId);
  };

  // Sort expenses (preserves input order by default unless sort is active)
  const sortedExpenses = useMemo(() => {
    const list = [...expenses];
    if (!activeSortBy) return list;
    list.sort((a, b) => {
      let comparison = 0;
      if (activeSortBy === 'date') {
        comparison = a.date.localeCompare(b.date);
      } else if (activeSortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else if (activeSortBy === 'category') {
        const catA = categories.find((c) => c.id === a.category_id)?.name || '';
        const catB = categories.find((c) => c.id === b.category_id)?.name || '';
        comparison = catA.localeCompare(catB);
      } else if (activeSortBy === 'payer') {
        const payerA = members.find((m) => m.id === a.payer_id)?.display_name || a.payer_id;
        const payerB = members.find((m) => m.id === b.payer_id)?.display_name || b.payer_id;
        comparison = payerA.localeCompare(payerB);
      }
      return activeSortOrder === 'desc' ? -comparison : comparison;
    });
    return list;
  }, [expenses, activeSortBy, activeSortOrder, categories, members]);

  // Paginate sorted items
  const totalItems = sortedExpenses.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / activePageSize));
  const validCurrentPage = Math.min(Math.max(1, activeCurrentPage), totalPages);

  const paginatedExpenses = useMemo(() => {
    const start = (validCurrentPage - 1) * activePageSize;
    return sortedExpenses.slice(start, start + activePageSize);
  }, [sortedExpenses, validCurrentPage, activePageSize]);

  const startIndex = totalItems === 0 ? 0 : (validCurrentPage - 1) * activePageSize + 1;
  const endIndex = Math.min(totalItems, validCurrentPage * activePageSize);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 dark:text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-3" />
        <p className="text-xs font-medium">Loading transactions...</p>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 mb-3">
          <Receipt className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          No expenses found
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          There are no expenses matching your filter criteria. Try changing your filters or add a new expense.
        </p>
      </div>
    );
  }

  // Render sort header icon
  const renderSortIcon = (field: ExpenseSortField) => {
    if (activeSortBy !== field) {
      return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 opacity-60 ml-1 inline" />;
    }
    return activeSortOrder === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 ml-1 inline" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 ml-1 inline" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Mobile Sort Bar */}
      <div className="sm:hidden flex items-center justify-between gap-2 rounded-xl bg-white p-3 border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="font-semibold">Sort by:</span>
        </div>
        <select
          aria-label="Sort ledger"
          value={activeSortBy ? `${activeSortBy}-${activeSortOrder}` : ''}
          onChange={(e) => {
            if (!e.target.value) {
              if (onSortChange) {
                // If reset
              } else {
                setInternalSortBy(null);
              }
              return;
            }
            const [field, order] = e.target.value.split('-') as [ExpenseSortField, SortDirection];
            if (onSortChange) {
              onSortChange(field, order);
            } else {
              setInternalSortBy(field);
              setInternalSortOrder(order);
            }
          }}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Default order</option>
          <option value="date-desc">Date (Newest first)</option>
          <option value="date-asc">Date (Oldest first)</option>
          <option value="amount-desc">Amount (Highest first)</option>
          <option value="amount-asc">Amount (Lowest first)</option>
          <option value="category-asc">Category (A-Z)</option>
          <option value="payer-asc">Payer (A-Z)</option>
        </select>
      </div>

      {/* Main Ledger Container */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 block sm:table">
            <thead className="hidden sm:table-header-group bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 select-none">
              <tr>
                <th
                  scope="col"
                  onClick={() => handleSort('date')}
                  className="py-3.5 pl-6 pr-3 whitespace-nowrap cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center">
                    Date {renderSortIcon('date')}
                  </span>
                </th>
                <th scope="col" className="px-3 py-3.5">Item &amp; Description</th>
                <th
                  scope="col"
                  onClick={() => handleSort('category')}
                  className="px-3 py-3.5 whitespace-nowrap cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center">
                    Category {renderSortIcon('category')}
                  </span>
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort('payer')}
                  className="px-3 py-3.5 whitespace-nowrap cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center">
                    Payer {renderSortIcon('payer')}
                  </span>
                </th>
                <th scope="col" className="px-3 py-3.5 whitespace-nowrap">Split</th>
                <th
                  scope="col"
                  onClick={() => handleSort('amount')}
                  className="px-3 py-3.5 text-right whitespace-nowrap cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center justify-end">
                    Amount {renderSortIcon('amount')}
                  </span>
                </th>
                <th scope="col" className="py-3.5 pl-3 pr-6 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 block sm:table-row-group">
              {paginatedExpenses.map((expense) => {
                const category = getCategory(expense.category_id);
                const payer = getMember(expense.payer_id);
                const hasForeignCurrency =
                  expense.original_currency &&
                  expense.original_currency !== 'SGD' &&
                  expense.original_amount;

                return (
                  <tr
                    key={expense.id}
                    className="block sm:table-row p-4 sm:p-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Date */}
                    <td className="py-1 sm:py-4 pl-0 sm:pl-6 pr-0 sm:pr-3 block sm:table-cell whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                      <span>{formatDisplayDate(expense.date)}</span>
                    </td>

                    {/* Item Description & Remarks */}
                    <td className="py-1 sm:py-4 px-0 sm:px-3 block sm:table-cell max-w-xs">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{expense.item}</span>
                        {expense.tags && expense.tags.length > 0 && (
                          <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                            #{expense.tags[0]}
                          </span>
                        )}
                      </div>
                      {expense.remarks && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {expense.remarks}
                        </div>
                      )}
                    </td>

                    {/* Category Badge */}
                    <td className="py-1 sm:py-4 px-0 sm:px-3 inline-block sm:table-cell whitespace-nowrap mr-2 sm:mr-0">
                      {category ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-0.5 sm:py-1 text-[11px] font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: category.color || '#10B981' }}
                          />
                          <span>{category.name}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Uncategorized</span>
                      )}
                    </td>

                    {/* Payer Avatar / Name */}
                    <td className="py-1 sm:py-4 px-0 sm:px-3 inline-block sm:table-cell whitespace-nowrap mr-2 sm:mr-0">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                        <span>{payer?.avatar_url || '👤'}</span>
                        <span>{payer?.display_name || 'Unknown'}</span>
                      </span>
                    </td>

                    {/* Split Status Badge */}
                    <td className="py-1 sm:py-4 px-0 sm:px-3 inline-block sm:table-cell whitespace-nowrap">
                      {expense.is_shared ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 sm:px-3 py-0.5 sm:py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <ArrowRightLeft className="h-3 w-3" />
                          <span>
                            {expense.split_ratio && expense.split_ratio !== 0.5
                              ? `Split ${Math.round(expense.split_ratio * 100)}%`
                              : 'Shared 50/50'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 sm:px-3 py-0.5 sm:py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          <span>Personal</span>
                        </span>
                      )}
                    </td>

                    {/* Formatted SGD Amount */}
                    <td className="py-1 sm:py-4 px-0 sm:px-3 block sm:table-cell text-left sm:text-right font-bold text-slate-900 dark:text-white">
                      <div>{formatSGD(expense.amount)}</div>
                      {hasForeignCurrency && (
                        <div className="text-[10px] font-normal text-slate-400">
                          {formatForeignAmount(expense.original_amount!, expense.original_currency!)}
                        </div>
                      )}
                    </td>

                    {/* Edit & Delete Action Buttons */}
                    <td className="py-1.5 sm:py-4 pl-0 sm:pl-3 pr-0 sm:pr-6 block sm:table-cell text-right sm:text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (onEditExpense) onEditExpense(expense);
                            setEditingExpense(expense);
                          }}
                          aria-label={`Edit ${expense.item}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          title="Edit expense"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingExpense(expense)}
                          aria-label={`Delete ${expense.item}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination & Counter Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/60 px-4 sm:px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900 text-xs">
          {/* Counter Text */}
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            Showing <span className="font-bold text-slate-900 dark:text-white">{startIndex}–{endIndex}</span> of{' '}
            <span className="font-bold text-slate-900 dark:text-white">{totalItems}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 hidden sm:inline">Per page:</span>
              <select
                aria-label="Select page size"
                value={activePageSize}
                onChange={(e) => handlePageSizeChange(parseInt(e.target.value, 10))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Prev / Next & Page Numbers */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(validCurrentPage - 1)}
                disabled={validCurrentPage <= 1}
                aria-label="Previous page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Dynamic Page Numbers */}
              {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - validCurrentPage) <= 1
                )
                .map((p, index, array) => {
                  const prevPage = array[index - 1];
                  const hasGap = prevPage && p - prevPage > 1;

                  return (
                    <React.Fragment key={p}>
                      {hasGap && <span className="px-1 text-slate-400">…</span>}
                      <button
                        type="button"
                        onClick={() => handlePageChange(p)}
                        className={`h-8 w-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          p === validCurrentPage
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                onClick={() => handlePageChange(validCurrentPage + 1)}
                disabled={validCurrentPage >= totalPages}
                aria-label="Next page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Expense Modal */}
      {editingExpense && (
        <EditExpenseModal
          isOpen={Boolean(editingExpense)}
          onClose={() => setEditingExpense(null)}
          expense={editingExpense}
          categories={categories}
          members={members}
          onSave={(updated) => {
            onExpenseSaved?.(updated);
            setEditingExpense(null);
          }}
        />
      )}

      {/* Delete Expense Modal */}
      {deletingExpense && (
        <DeleteExpenseModal
          isOpen={Boolean(deletingExpense)}
          onClose={() => setDeletingExpense(null)}
          expense={deletingExpense}
          categories={categories}
          members={members}
          onDeleted={(deletedId) => {
            onDeleteExpense?.(deletedId);
            setDeletingExpense(null);
          }}
        />
      )}
    </div>
  );
}

export default ExpenseListTable;
