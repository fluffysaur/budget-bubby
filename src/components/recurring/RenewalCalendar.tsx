/**
 * RenewalCalendar Component
 * Visual 12-Month Renewal Calendar & Outlay Map:
 * - Jan - Dec timeline displaying total cash outlay required for each calendar month.
 * - Highlights heavy renewal months (e.g., September Manulife $3,200, October IncomeShield $1,600).
 * - Visual indicator badge and ring for current calendar month.
 * - Displays policy cards/chips in their designated renewal month.
 */

import { useMemo } from 'react';
import {
  Calendar,
  Flame,
  Shield,
  FileText,
  Repeat,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { getSingaporeDate } from '../../lib/dateUtils';
import type { RecurringPolicy, RecurringPolicyType } from '../../types/finance';

export interface RenewalCalendarProps {
  policies: RecurringPolicy[];
  currentMonth?: number; // 1 - 12
  className?: string;
}

interface MonthData {
  monthNumber: number; // 1 - 12
  monthShort: string;
  monthFull: string;
  totalOutlay: number;
  isCurrent: boolean;
  isHeavy: boolean;
  isMaxMonth: boolean;
  policies: RecurringPolicy[];
}

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MONTH_NAMES_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function RenewalCalendar({
  policies,
  currentMonth,
  className = '',
}: RenewalCalendarProps) {
  // Resolve current active month (1-12)
  const resolvedCurrentMonth = useMemo(() => {
    if (currentMonth && currentMonth >= 1 && currentMonth <= 12) {
      return currentMonth;
    }
    const sgNow = getSingaporeDate();
    return sgNow.getMonth() + 1; // 1-12
  }, [currentMonth]);

  // Compute 12-month data breakdown
  const { monthBreakdown } = useMemo(() => {
    const monthlyTotals = Array(12).fill(0);
    const monthPoliciesMap: RecurringPolicy[][] = Array.from({ length: 12 }, () => []);

    for (const policy of policies) {
      if (policy.frequency === 'monthly') {
        for (let m = 0; m < 12; m++) {
          monthlyTotals[m] += policy.amount;
          monthPoliciesMap[m].push(policy);
        }
      } else if (
        policy.payment_month &&
        policy.payment_month >= 1 &&
        policy.payment_month <= 12
      ) {
        const idx = policy.payment_month - 1;
        monthlyTotals[idx] += policy.amount;
        monthPoliciesMap[idx].push(policy);
      }
    }

    const max = Math.max(...monthlyTotals, 0);
    const total = monthlyTotals.reduce((sum, val) => sum + val, 0);
    const avg = total / 12;

    const breakdown: MonthData[] = monthlyTotals.map((outlay, idx) => {
      const monthNum = idx + 1;
      const isMax = max > 0 && outlay === max;
      // Flag as heavy if outlay is substantial (>= $500) and represents peak demand
      const isHeavy =
        outlay >= 500 &&
        ((isMax && max > Math.min(...monthlyTotals)) || (avg > 0 && outlay > avg * 1.3));

      return {
        monthNumber: monthNum,
        monthShort: MONTH_NAMES_SHORT[idx],
        monthFull: MONTH_NAMES_FULL[idx],
        totalOutlay: Math.round(outlay * 100) / 100,
        isCurrent: monthNum === resolvedCurrentMonth,
        isHeavy,
        isMaxMonth: isMax,
        policies: monthPoliciesMap[idx],
      };
    });

    return {
      monthBreakdown: breakdown,
      maxOutlay: max,
      totalAnnualOutlay: total,
      averageMonthlyOutlay: avg,
    };
  }, [policies, resolvedCurrentMonth]);

  // Type icon helper
  const renderPolicyIcon = (type: RecurringPolicyType) => {
    switch (type) {
      case 'insurance':
        return <Shield className="w-3 h-3 text-blue-500" />;
      case 'tax':
        return <FileText className="w-3 h-3 text-purple-500" />;
      case 'subscription':
        return <Repeat className="w-3 h-3 text-amber-500" />;
      default:
        return <Calendar className="w-3 h-3 text-slate-400" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Calendar Header / Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Annual Renewal Timeline &amp; Cash Outlay Map
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              12-Month distribution of annual lump sums and monthly recurring commitments
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Today / Active</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Heavy Outlay</span>
          </div>
        </div>
      </div>

      {/* 12-Month Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {monthBreakdown.map((m) => {
          return (
            <div
              key={m.monthNumber}
              className={`relative flex flex-col rounded-2xl p-3.5 transition-all border ${
                m.isCurrent
                  ? 'bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-slate-900 border-emerald-400 dark:border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                  : m.isHeavy
                  ? 'bg-gradient-to-b from-rose-50/60 to-white dark:from-rose-950/20 dark:to-slate-900 border-rose-200 dark:border-rose-900/60 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Header: Month Name + Badges */}
              <div className="flex items-start justify-between gap-1 mb-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {m.monthShort}
                  </span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {m.monthFull}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {m.isCurrent && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                      Current
                    </span>
                  )}
                  {m.isHeavy && (
                    <span
                      title="Heavy Outlay Month"
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                    >
                      <Flame className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                      Heavy
                    </span>
                  )}
                </div>
              </div>

              {/* Total Monthly Outlay */}
              <div className="mb-3">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Total Outlay</span>
                <p
                  className={`text-base font-extrabold tracking-tight ${
                    m.isHeavy
                      ? 'text-rose-600 dark:text-rose-400'
                      : m.totalOutlay > 0
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {formatSGD(m.totalOutlay)}
                </p>
              </div>

              {/* Policy Chips in this Month */}
              <div className="flex-1 flex flex-col gap-1.5 min-h-[68px]">
                {m.policies.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-slate-400 italic">
                    No renewals
                  </div>
                ) : (
                  m.policies.map((p) => (
                    <div
                      key={`${m.monthNumber}-${p.id}`}
                      className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {renderPolicyIcon(p.type)}
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                          {p.name}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white shrink-0 text-[11px]">
                        {formatSGD(p.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RenewalCalendar;
