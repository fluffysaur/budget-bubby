/**
 * UpcomingBillsWidget Component
 * Displays upcoming renewal alerts / recurring bills due in the current
 * and upcoming month (e.g. Manulife, IncomeShield, IRAS tax, subscriptions).
 */

import { useMemo } from 'react';
import {
  CalendarClock,
  ChevronRight,
  Shield,
  Receipt,
  RotateCw,
  Bell,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { getSingaporeDate } from '../../lib/dateUtils';
import type { RecurringPolicy, RecurringPolicyType } from '../../types/finance';

const MONTH_NAMES = [
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

export interface UpcomingBillsWidgetProps {
  policies?: RecurringPolicy[];
  onViewAll?: () => void;
  className?: string;
}

export function UpcomingBillsWidget({
  policies = [],
  onViewAll,
  className = '',
}: UpcomingBillsWidgetProps) {
  const sgNow = getSingaporeDate();
  const currentMonthNum = sgNow.getMonth() + 1; // 1 - 12
  const nextMonthNum = (currentMonthNum % 12) + 1;

  // Filter and sort policies by due urgency
  const sortedPolicies = useMemo(() => {
    return [...policies].sort((a, b) => {
      // Prioritize current month, then next month, then other months
      const getPriority = (p: RecurringPolicy) => {
        if (p.frequency === 'monthly') return 3;
        if (p.payment_month === currentMonthNum) return 1;
        if (p.payment_month === nextMonthNum) return 2;
        return 4;
      };
      return getPriority(a) - getPriority(b);
    });
  }, [policies, currentMonthNum, nextMonthNum]);

  const displayPolicies = sortedPolicies.slice(0, 3);

  const getTypeBadge = (type: RecurringPolicyType) => {
    switch (type) {
      case 'insurance':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            <Shield className="h-2.5 w-2.5" />
            <span>Insurance</span>
          </span>
        );
      case 'tax':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
            <Receipt className="h-2.5 w-2.5" />
            <span>Tax</span>
          </span>
        );
      case 'subscription':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
            <RotateCw className="h-2.5 w-2.5" />
            <span>Subscription</span>
          </span>
        );
    }
  };

  const getDueStatus = (p: RecurringPolicy) => {
    if (p.frequency === 'monthly') {
      return { text: 'Monthly active', urgent: false };
    }
    if (p.payment_month === currentMonthNum) {
      return { text: 'Due this month', urgent: true };
    }
    if (p.payment_month === nextMonthNum) {
      return { text: 'Due next month', urgent: false };
    }
    const monthName = p.payment_month ? MONTH_NAMES[p.payment_month - 1] : 'Annual';
    return { text: `Due in ${monthName}`, urgent: false };
  };

  return (
    <div
      role="region"
      aria-label="Upcoming Bills and Renewals"
      className={`rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs transition-colors ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Upcoming Renewals
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Insurance, tax &amp; policy alerts
            </p>
          </div>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="mt-5">
        {displayPolicies.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-xl">
              📋
            </div>
            <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              No upcoming renewals
            </p>
            <p className="mt-1 text-xs text-slate-400 max-w-xs">
              Add recurring insurance policies or annual IRAS taxes to track renewal dates.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayPolicies.map((policy) => {
              const due = getDueStatus(policy);

              return (
                <div
                  key={policy.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-2xs text-slate-600 dark:text-slate-300">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-xs">
                          {policy.name}
                        </span>
                        {getTypeBadge(policy.type)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-xs font-semibold ${
                            due.urgent
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {due.text}
                        </span>
                        <span className="text-[11px] text-slate-400 capitalize">
                          • {policy.frequency}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatSGD(policy.amount)}
                    </div>
                    {policy.frequency === 'annually' && (
                      <div className="text-[10px] text-slate-400">
                        ~{formatSGD(policy.monthly_amortized_amount)}/mo
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default UpcomingBillsWidget;
