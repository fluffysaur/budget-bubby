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
import { TruncatedText } from '../ui/TruncatedText';
import { LoadingCard } from '../ui/LoadingCard';
import { EmptyStateCard } from '../ui/EmptyStateCard';
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
      <LoadingCard message="Loading transactions..." />
    );
  }

  if (expenses.length === 0) {
    return (
      <EmptyStateCard
        icon={<Receipt className="h-6 w-6" />}
        title="No expenses found"
        description="There are no expenses matching your filter criteria. Try changing your filters or add a new expense."
      />
    );
  }

  // Render sort header icon
  const renderSortIcon = (field: ExpenseSortField) => {
    if (activeSortBy !== field) {
      return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 opacity-60 ml-1 inline" />;
    }
    return activeSortOrder === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 text-(--text-ink) ml-1 inline" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-(--text-ink) ml-1 inline" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Mobile Sort Bar */}
      <div className="sm:hidden flex items-center justify-between gap-2 rounded-xl bg-(--bg-card) p-3 border-2 border-(--border-ink) shadow-(--shadow-cute-sm) text-xs">
        <div className="flex items-center gap-1.5 text-(--text-muted)">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="font-bold">Sort by:</span>
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
          className="rounded-lg border-2 border-(--border-ink) bg-(--bg-canvas) px-2.5 py-1 text-xs font-bold text-(--text-ink) cursor-pointer"
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
      <div className="overflow-hidden rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute) transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-(--text-ink) block sm:table">
            <thead className="hidden sm:table-header-group bg-(--bg-canvas) border-b-2 border-(--border-ink) text-[11px] uppercase tracking-wider font-extrabold text-(--text-muted) select-none">
              <tr>
                <th
                  scope="col"
                  onClick={() => handleSort('date')}
                  className="py-3.5 pl-6 pr-3 whitespace-nowrap cursor-pointer hover:text-(--text-ink) transition-colors"
                >
                  <span className="inline-flex items-center">
                    Date {renderSortIcon('date')}
                  </span>
                </th>
                <th scope="col" className="px-3 py-3.5">Item &amp; Description</th>
                <th
                  scope="col"
                  onClick={() => handleSort('category')}
                  className="px-3 py-3.5 whitespace-nowrap cursor-pointer hover:text-(--text-ink) transition-colors"
                >
                  <span className="inline-flex items-center">
                    Category {renderSortIcon('category')}
                  </span>
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort('payer')}
                  className="px-3 py-3.5 whitespace-nowrap cursor-pointer hover:text-(--text-ink) transition-colors"
                >
                  <span className="inline-flex items-center">
                    Payer {renderSortIcon('payer')}
                  </span>
                </th>
                <th scope="col" className="px-3 py-3.5 whitespace-nowrap">Split</th>
                <th
                  scope="col"
                  onClick={() => handleSort('amount')}
                  className="px-3 py-3.5 text-right whitespace-nowrap cursor-pointer hover:text-(--text-ink) transition-colors"
                >
                  <span className="inline-flex items-center justify-end">
                    Amount {renderSortIcon('amount')}
                  </span>
                </th>
                <th scope="col" className="py-3.5 pl-3 pr-6 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border-subtle) block sm:table-row-group">
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
                    className="block sm:table-row p-4 sm:p-0 hover:bg-(--pastel-butter-light)/40 transition-colors"
                  >
                    {/* Date */}
                    <td className="py-1 sm:py-4 pl-0 sm:pl-6 pr-0 sm:pr-3 block sm:table-cell whitespace-nowrap font-mono-num font-semibold text-(--text-ink)">
                      <span>{formatDisplayDate(expense.date)}</span>
                    </td>

                    {/* Item Description & Remarks */}
                    <td className="py-1 sm:py-4 px-0 sm:px-3 block sm:table-cell max-w-xs">
                      <div className="font-bold text-(--text-ink) flex items-center gap-1.5 min-w-0">
                        <TruncatedText text={expense.item} />
                        {expense.tags && expense.tags.length > 0 && (
                          <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-(--pastel-lilac-light) px-1.5 py-0.2 rounded border border-(--border-ink) shrink-0">
                            #{expense.tags[0]}
                          </span>
                        )}
                      </div>
                      {expense.remarks && (
                        <div className="text-[11px] text-(--text-muted) truncate mt-0.5">
                          {expense.remarks}
                        </div>
                      )}
                    </td>

                    {/* Category Badge */}
                    <td className="py-1 sm:py-4 px-0 sm:px-3 inline-block sm:table-cell whitespace-nowrap mr-2 sm:mr-0">
                      {category ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-0.5 sm:py-1 text-[11px] font-bold bg-(--bg-canvas) text-(--text-ink) border border-(--border-ink)">
                          <span
                            className="h-2 w-2 rounded-full shrink-0 border border-black/20"
                            style={{ backgroundColor: category.color || '#dfc2ff' }}
                          />
                          <span>{category.name}</span>
                        </span>
                      ) : (
                        <span className="text-(--text-muted) text-[11px]">Uncategorized</span>
                      )}
                    </td>

                    {/* Payer Avatar / Name */}
                    <td className="py-1 sm:py-4 px-0 sm:px-3 inline-block sm:table-cell whitespace-nowrap mr-2 sm:mr-0">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--text-ink)">
                        <span>{payer?.avatar_url || '👤'}</span>
                        <span>{payer?.display_name || 'Unknown'}</span>
                      </span>
                    </td>

                    {/* Split Status Badge */}
                    <td className="py-1 sm:py-4 px-0 sm:px-3 inline-block sm:table-cell whitespace-nowrap">
                      {expense.is_shared ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-(--pastel-lilac-light) border border-(--border-ink) px-2.5 sm:px-3 py-0.5 sm:py-0.8 text-[11px] font-bold text-(--text-ink)">
                          <ArrowRightLeft className="h-3 w-3" />
                          <span>
                            {expense.split_ratio && expense.split_ratio !== 0.5
                              ? `Split ${Math.round(expense.split_ratio * 100)}%`
                              : 'Shared 50/50'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-(--bg-canvas) border border-(--border-subtle) px-2 sm:px-3 py-0.5 sm:py-0.8 text-[11px] font-medium text-(--text-muted)">
                          <span>Personal</span>
                        </span>
                      )}
                    </td>

                    {/* Formatted SGD Amount */}
                    <td className="py-1 sm:py-4 px-0 sm:px-3 block sm:table-cell text-left sm:text-right">
                      <div className="font-mono-num font-black text-sm text-(--text-ink)">{formatSGD(expense.amount)}</div>
                      {hasForeignCurrency && (
                        <div className="font-mono-num text-[10px] font-semibold text-(--text-muted)">
                          {formatForeignAmount(expense.original_amount!, expense.original_currency!)}
                        </div>
                      )}
                    </td>

                    {/* Edit & Delete Action Buttons */}
                    <td className="py-1.5 sm:py-4 pl-0 sm:pl-3 pr-0 sm:pr-6 block sm:table-cell text-right sm:text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (onEditExpense) onEditExpense(expense);
                            setEditingExpense(expense);
                          }}
                          aria-label={`Edit ${expense.item}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border-ink) bg-(--bg-card) text-(--text-ink) hover:bg-(--pastel-butter) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                          title="Edit expense"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingExpense(expense)}
                          aria-label={`Delete ${expense.item}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border-ink) bg-(--bg-card) text-(--text-ink) hover:bg-(--pastel-coral-light) hover:text-red-600 shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-[1.5px] border-(--border-ink) bg-(--bg-canvas) px-4 sm:px-6 py-3.5 text-xs">
          {/* Counter Text */}
          <div className="text-(--text-muted) font-medium">
            Showing <span className="font-mono-num font-black text-(--text-ink)">{startIndex}–{endIndex}</span> of{' '}
            <span className="font-mono-num font-black text-(--text-ink)">{totalItems}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-(--text-muted) font-medium hidden sm:inline">Per page:</span>
              <select
                aria-label="Select page size"
                value={activePageSize}
                onChange={(e) => handlePageSizeChange(parseInt(e.target.value, 10))}
                className="rounded-lg border-[1.5px] border-(--border-ink) bg-(--bg-card) px-2 py-1 text-xs font-bold text-(--text-ink) shadow-cute-sm cursor-pointer"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Prev / Next & Page Numbers */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePageChange(validCurrentPage - 1)}
                disabled={validCurrentPage <= 1}
                aria-label="Previous page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-(--border-ink) bg-(--bg-card) text-(--text-ink) hover:bg-(--pastel-butter-light) disabled:opacity-40 disabled:cursor-not-allowed shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
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
                      {hasGap && <span className="px-1 text-(--text-muted)">…</span>}
                      <button
                        type="button"
                        onClick={() => handlePageChange(p)}
                        className={`h-8 w-8 rounded-lg text-xs font-mono-num font-bold transition-all cursor-pointer ${
                          p === validCurrentPage
                            ? 'bg-(--pastel-lilac) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-cute-sm font-black'
                            : 'border-[1.5px] border-(--border-ink) bg-(--bg-card) text-(--text-ink) hover:bg-(--pastel-butter-light) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5'
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-(--border-ink) bg-(--bg-card) text-(--text-ink) hover:bg-(--pastel-butter-light) disabled:opacity-40 disabled:cursor-not-allowed shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
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
