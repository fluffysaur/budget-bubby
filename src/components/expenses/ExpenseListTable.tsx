/**
 * Responsive Expense Transaction Ledger
 * Displays:
 * - Date
 * - Item / Description & remarks
 * - Category badge (with color code)
 * - Payer avatar & name
 * - Shared (50/50) split status badge
 * - Amount in Singapore Dollars (S$X,XXX.XX)
 * - Delete action with confirmation callback
 * - Responsive table for desktop + cards for mobile viewports
 */

import { Trash2, Receipt, ArrowRightLeft } from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { formatDisplayDate } from '../../lib/dateUtils';
import { mockCategories, mockMembers } from '../../data/mockSeedData';
import type { Expense, Category, HouseholdMember } from '../../types/finance';

export interface ExpenseListTableProps {
  expenses: Expense[];
  categories?: Category[];
  members?: HouseholdMember[];
  onDeleteExpense?: (id: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function ExpenseListTable({
  expenses,
  categories = mockCategories,
  members = mockMembers,
  onDeleteExpense,
  isLoading = false,
}: ExpenseListTableProps) {
  const getCategory = (catId?: string | null): Category | undefined => {
    if (!catId) return undefined;
    return categories.find((c) => c.id === catId);
  };

  const getMember = (memberId: string): HouseholdMember | undefined => {
    return members.find((m) => m.id === memberId);
  };

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

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
          <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-3.5 pl-6 pr-3 whitespace-nowrap">Date</th>
              <th scope="col" className="px-3 py-3.5">Item & Description</th>
              <th scope="col" className="px-3 py-3.5 whitespace-nowrap">Category</th>
              <th scope="col" className="px-3 py-3.5 whitespace-nowrap">Payer</th>
              <th scope="col" className="px-3 py-3.5 whitespace-nowrap">Split</th>
              <th scope="col" className="px-3 py-3.5 text-right whitespace-nowrap">Amount</th>
              <th scope="col" className="py-3.5 pl-3 pr-6 text-center whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {expenses.map((expense) => {
              const category = getCategory(expense.category_id);
              const payer = getMember(expense.payer_id);

              return (
                <tr
                  key={expense.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Date */}
                  <td className="py-4 pl-6 pr-3 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                    {formatDisplayDate(expense.date)}
                  </td>

                  {/* Item Description & Remarks */}
                  <td className="px-3 py-4 max-w-xs truncate">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {expense.item}
                    </div>
                    {expense.remarks && (
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {expense.remarks}
                      </div>
                    )}
                  </td>

                  {/* Category Badge */}
                  <td className="px-3 py-4 whitespace-nowrap">
                    {category ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
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
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                      <span>{payer?.avatar_url || '👤'}</span>
                      <span>{payer?.display_name || 'Unknown'}</span>
                    </span>
                  </td>

                  {/* Split Status Badge */}
                  <td className="px-3 py-4 whitespace-nowrap">
                    {expense.is_shared ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <ArrowRightLeft className="h-3 w-3" />
                        <span>Shared 50/50</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <span>Personal</span>
                      </span>
                    )}
                  </td>

                  {/* Formatted SGD Amount */}
                  <td className="px-3 py-4 whitespace-nowrap text-right font-bold text-slate-900 dark:text-white">
                    {formatSGD(expense.amount)}
                  </td>

                  {/* Delete Action */}
                  <td className="py-4 pl-3 pr-6 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onDeleteExpense?.(expense.id)}
                      aria-label={`Delete ${expense.item}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                      title="Delete expense"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ExpenseListTable;
