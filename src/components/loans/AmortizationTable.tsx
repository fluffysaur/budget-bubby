/**
 * AmortizationTable Component
 * Month-by-month amortization schedule organized with annual rollup accordions:
 * - Year header displays Annual Payment, Principal Paid, Interest Paid, and Year-End Balance
 * - Expand/collapse individual years or all years at once
 * - Detailed table per year showing:
 *   - Month / Payment Date
 *   - Starting Balance
 *   - Payment Amount
 *   - Principal Portion
 *   - Interest Portion
 *   - Ending / Remaining Balance
 */

import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Table,
  Layers,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { formatDisplayMonth } from '../../lib/dateUtils';
import type { AmortizationScheduleRow } from '../../types/finance';

export interface AmortizationTableProps {
  schedule: AmortizationScheduleRow[];
  initialExpandedYears?: number[];
  className?: string;
}

interface YearGroup {
  yearNumber: number;
  calendarYears: string;
  rows: (AmortizationScheduleRow & { startingBalance: number })[];
  totalPayments: number;
  totalPrincipal: number;
  totalInterest: number;
  startingBalance: number;
  endingBalance: number;
}

export function AmortizationTable({
  schedule,
  initialExpandedYears = [1],
  className = '',
}: AmortizationTableProps) {
  // Group rows into 12-month annual buckets
  const yearGroups = useMemo<YearGroup[]>(() => {
    if (!schedule || schedule.length === 0) return [];

    const groups: Map<number, YearGroup> = new Map();

    schedule.forEach((row) => {
      const yearNumber = Math.floor((row.month - 1) / 12) + 1;
      const startingBalance = Math.round((row.remainingBalance + row.principalPayment) * 100) / 100;
      const enhancedRow = { ...row, startingBalance };

      if (!groups.has(yearNumber)) {
        const calYear = row.paymentDate.slice(0, 4);
        groups.set(yearNumber, {
          yearNumber,
          calendarYears: calYear,
          rows: [enhancedRow],
          totalPayments: row.payment,
          totalPrincipal: row.principalPayment,
          totalInterest: row.interestPayment,
          startingBalance,
          endingBalance: row.remainingBalance,
        });
      } else {
        const group = groups.get(yearNumber)!;
        group.rows.push(enhancedRow);
        group.totalPayments = Math.round((group.totalPayments + row.payment) * 100) / 100;
        group.totalPrincipal = Math.round((group.totalPrincipal + row.principalPayment) * 100) / 100;
        group.totalInterest = Math.round((group.totalInterest + row.interestPayment) * 100) / 100;
        group.endingBalance = row.remainingBalance;

        // Check if calendar year spanned
        const calYear = row.paymentDate.slice(0, 4);
        if (!group.calendarYears.includes(calYear)) {
          group.calendarYears = `${group.calendarYears}-${calYear}`;
        }
      }
    });

    return Array.from(groups.values());
  }, [schedule]);

  // Expanded year state
  const [expandedYears, setExpandedYears] = useState<Set<number>>(
    new Set(initialExpandedYears)
  );

  const toggleYear = (yearNum: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(yearNum)) {
        next.delete(yearNum);
      } else {
        next.add(yearNum);
      }
      return next;
    });
  };

  const isAllExpanded = useMemo(() => {
    return yearGroups.length > 0 && expandedYears.size === yearGroups.length;
  }, [yearGroups.length, expandedYears.size]);

  const toggleAll = () => {
    if (isAllExpanded) {
      setExpandedYears(new Set());
    } else {
      setExpandedYears(new Set(yearGroups.map((g) => g.yearNumber)));
    }
  };

  if (!schedule || schedule.length === 0) {
    return (
      <div className={`p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 ${className}`}>
        <Table className="w-8 h-8 mx-auto text-slate-400 mb-2" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          No amortization schedule available
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Amortization Schedule
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {yearGroups.length} annual rollup{yearGroups.length !== 1 ? 's' : ''} ({schedule.length} total monthly payments).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors self-start sm:self-auto"
        >
          <ChevronsUpDown className="w-3.5 h-3.5" />
          <span>{isAllExpanded ? 'Collapse All' : 'Expand All'}</span>
        </button>
      </div>

      {/* Accordions */}
      <div className="space-y-3">
        {yearGroups.map((group) => {
          const isExpanded = expandedYears.has(group.yearNumber);

          return (
            <div
              key={group.yearNumber}
              className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all"
            >
              {/* Year Accordion Trigger */}
              <button
                type="button"
                onClick={() => toggleYear(group.yearNumber)}
                aria-expanded={isExpanded}
                className="w-full px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-md text-slate-500">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      Year {group.yearNumber}
                    </span>
                    <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      ({group.calendarYears} • {group.rows.length} mo{group.rows.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>

                {/* Annual Rollup Summary Metrics */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pl-7 md:pl-0">
                  <span className="text-slate-600 dark:text-slate-400">
                    Paid:{' '}
                    <strong className="text-slate-900 dark:text-slate-200">
                      {formatSGD(group.totalPayments)}
                    </strong>
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    Principal:{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {formatSGD(group.totalPrincipal)}
                    </strong>
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    Interest:{' '}
                    <strong className="text-amber-600 dark:text-amber-400">
                      {formatSGD(group.totalInterest)}
                    </strong>
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    Ending Bal:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {formatSGD(group.endingBalance)}
                    </strong>
                  </span>
                </div>
              </button>

              {/* Collapsible Month-by-Month Table */}
              {isExpanded && (
                <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/60 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <th className="px-4 py-2.5">Month</th>
                        <th className="px-4 py-2.5 text-right">Starting Balance</th>
                        <th className="px-4 py-2.5 text-right">Payment</th>
                        <th className="px-4 py-2.5 text-right">Principal</th>
                        <th className="px-4 py-2.5 text-right">Interest</th>
                        <th className="px-4 py-2.5 text-right">Ending Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {group.rows.map((row) => {
                        let monthLabel = `M${row.month}`;
                        try {
                          monthLabel = formatDisplayMonth(row.paymentDate);
                        } catch {
                          monthLabel = row.paymentDate;
                        }

                        return (
                          <tr
                            key={row.month}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-4 py-2 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              <span className="font-bold text-slate-900 dark:text-white mr-1.5">
                                #{row.month}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                ({monthLabel})
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {formatSGD(row.startingBalance)}
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {formatSGD(row.payment)}
                            </td>
                            <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {formatSGD(row.principalPayment)}
                            </td>
                            <td className="px-4 py-2 text-right text-amber-600 dark:text-amber-400 whitespace-nowrap">
                              {formatSGD(row.interestPayment)}
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {formatSGD(row.remainingBalance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AmortizationTable;
