/**
 * CategoryLimitWarningBanner Component
 * Persistent alert banner displayed on BudgetPage and DashboardPage when
 * any spendable category spending is nearing or exceeding its monthly cap:
 * - Nearing limit (>= 80% and < 100%): Amber warning alert
 * - Over limit (>= 100%): Rose exceeded alert
 *
 * Listens to the window 'expenseAdded' event:
 * - If a newly logged expense pushes any category across 80%, triggers playBudgetWarningSound()
 *   and shows an immediate alert toast notification.
 * - If it pushes across 100%, triggers playBudgetExceededSound() and shows an immediate alert toast.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertCircle, AlertTriangle, X, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { isSpendableCategory } from '../../lib/financialFormulas';
import { playBudgetWarningSound, playBudgetExceededSound } from '../../lib/soundEffects';
import { useOptionalHousehold } from '../../context/HouseholdContext';
import { financeService } from '../../services/financeService';
import { getDefaultNotificationPreferences } from '../../data/mockSeedData';
import type { Expense, MonthlyBudgetCategoryDetail, NotificationPreferences } from '../../types/finance';

export interface CategoryLimitWarningBannerProps {
  categories?: MonthlyBudgetCategoryDetail[];
  className?: string;
  onNavigateCategory?: (categoryId: string) => void;
}

interface ToastAlert {
  id: string;
  type: 'warning' | 'exceeded';
  title: string;
  message: string;
}

export function CategoryLimitWarningBanner({
  categories = [],
  className = '',
  onNavigateCategory,
}: CategoryLimitWarningBannerProps) {
    const household = useOptionalHousehold();
    const activeMember = household?.activeMember;
    const members = household?.members;
    const activeMemberId = activeMember?.id || members?.[0]?.id || 'mem-00000000-0011';

    const [toast, setToast] = useState<ToastAlert | null>(null);
    const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
        getDefaultNotificationPreferences(activeMemberId)
    );
    const categoriesRef = useRef(categories);
    const prefsRef = useRef(prefs);

    useEffect(() => {
        categoriesRef.current = categories;
    }, [categories]);

    useEffect(() => {
        prefsRef.current = prefs;
    }, [prefs]);

    const loadPreferences = useCallback(async () => {
        try {
            const data = await financeService.getNotificationPreferences(activeMemberId);
            setPrefs(data);
        } catch {
            // ignore
        }
    }, [activeMemberId]);

    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    useEffect(() => {
        const handleUpdate = () => loadPreferences();
        window.addEventListener('notificationPreferencesUpdated', handleUpdate);
        return () => window.removeEventListener('notificationPreferencesUpdated', handleUpdate);
    }, [loadPreferences]);

  // Listen to window 'expenseAdded' event to detect boundary crossing
  useEffect(() => {
    const handleExpenseAdded = (e: Event) => {
      const customEvent = e as CustomEvent<Expense>;
      const expense = customEvent.detail;
      if (!expense) return;

      const currentCats = categoriesRef.current;
      const currentPrefs = prefsRef.current;
      const targetCat = currentCats.find(
        (c) => c.category_id === expense.category_id || c.category?.id === expense.category_id
      );

      if (!targetCat || !isSpendableCategory(targetCat.category || targetCat.category_id)) {
        return;
      }

      const allocated = targetCat.allocated_amount || 0;
      if (allocated <= 0) return;

      const prevSpent = targetCat.actualSpent || 0;
      const addedAmount = Number(expense.amount) || 0;
      const newSpent = prevSpent + addedAmount;

      const prevPct = (prevSpent / allocated) * 100;
      const newPct = (newSpent / allocated) * 100;
      const catName = targetCat.category?.name || 'Category';
      const warningThreshold = currentPrefs.budget_warning_pct || 80;

      if (newPct >= 100 && prevPct < 100) {
        try {
          playBudgetExceededSound();
        } catch (err) {
          console.debug('Error triggering exceeded sound:', err);
        }
        if (currentPrefs.budget_limit_alerts) {
          const overAmount = Math.max(0, newSpent - allocated);
          setToast({
            id: String(Date.now()),
            type: 'exceeded',
            title: 'Budget Cap Exceeded!',
            message: `${catName} has exceeded cap by ${formatSGD(overAmount)}!`,
          });
        }
      } else if (newPct >= warningThreshold && prevPct < warningThreshold) {
        try {
          playBudgetWarningSound();
        } catch (err) {
          console.debug('Error triggering warning sound:', err);
        }
        if (currentPrefs.budget_limit_alerts) {
          const leftAmount = Math.max(0, allocated - newSpent);
          setToast({
            id: String(Date.now()),
            type: 'warning',
            title: 'Budget Limit Warning',
            message: `${catName} is at ${Math.round(newPct)}% (${formatSGD(newSpent)} of ${formatSGD(allocated)}) — ${formatSGD(leftAmount)} left`,
          });
        }
      }
    };

    window.addEventListener('expenseAdded', handleExpenseAdded);
    return () => window.removeEventListener('expenseAdded', handleExpenseAdded);
  }, []);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Derived persistent banner alerts
  const { exceededAlerts, warningAlerts } = useMemo(() => {
    const exceeded: Array<{
      id: string;
      name: string;
      spent: number;
      allocated: number;
      over: number;
      percentage: number;
      color?: string;
    }> = [];

    const warning: Array<{
      id: string;
      name: string;
      spent: number;
      allocated: number;
      left: number;
      percentage: number;
      color?: string;
    }> = [];

    for (const c of categories) {
      if (!isSpendableCategory(c.category || c.category_id)) continue;
      const allocated = c.allocated_amount || 0;
      if (allocated <= 0) continue;

      const spent = c.actualSpent || 0;
      const percentage = (spent / allocated) * 100;
      const name = c.category?.name || 'Category';

      const warningThreshold = prefs.budget_warning_pct || 80;

      if (percentage >= 100) {
        exceeded.push({
          id: c.category_id,
          name,
          spent,
          allocated,
          over: spent - allocated,
          percentage: Math.round(percentage),
          color: c.category?.color,
        });
      } else if (percentage >= warningThreshold) {
        warning.push({
          id: c.category_id,
          name,
          spent,
          allocated,
          left: allocated - spent,
          percentage: Math.round(percentage),
          color: c.category?.color,
        });
      }
    }

    return { exceededAlerts: exceeded, warningAlerts: warning };
  }, [categories, prefs.budget_warning_pct]);

  const hasAnyAlerts = exceededAlerts.length > 0 || warningAlerts.length > 0;

  return (
    <>
      {/* Immediate Toast Notification (Floating) */}
      {toast && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-5 right-5 z-50 max-w-sm sm:max-w-md w-full animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
        >
          <div
            className={`p-4 rounded-2xl border-2 border-(--border-ink) shadow-(--shadow-cute-lg) flex items-start gap-3 backdrop-blur-md ${
              toast.type === 'exceeded'
                ? 'bg-[#fff1ee] text-[#9a1b1b] dark:bg-[#3b1c19] dark:text-[#fca5a5]'
                : 'bg-[#fffbeb] text-[#92400e] dark:bg-[#382f18] dark:text-[#fde68a]'
            }`}
          >
            <div
              className={`p-2 rounded-xl border border-(--border-ink) shadow-(--shadow-cute-sm) shrink-0 ${
                toast.type === 'exceeded'
                  ? 'bg-[#f76b57] text-white'
                  : 'bg-[#ffe999] text-[#1a1a1a]'
              }`}
            >
              {toast.type === 'exceeded' ? (
                <ShieldAlert className="h-5 w-5 stroke-[2.5]" />
              ) : (
                <AlertTriangle className="h-5 w-5 stroke-[2.5]" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs font-black uppercase tracking-wider mb-0.5 font-display">
                {toast.title}
              </h4>
              <p className="text-xs font-bold leading-relaxed">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Persistent Warning Banner (In-Flow) */}
      {hasAnyAlerts && (
        <div
          data-testid="category-limit-warning-banner"
          role="region"
          aria-label="Category Budget Guardrails"
          className={`space-y-2.5 ${className}`}
        >
          {/* Exceeded Cap Alert (Rose) */}
          {exceededAlerts.length > 0 && (
            <div
              data-testid="category-limit-exceeded-banner"
              className="p-4 rounded-2xl border-2 border-(--border-ink) bg-[#fff1ee] dark:bg-[#3b1c19] text-[#9a1b1b] dark:text-[#fca5a5] shadow-(--shadow-cute-sm) transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-xl bg-[#f76b57] text-white border border-(--border-ink) shrink-0 mt-0.5">
                  <AlertCircle className="h-4 w-4 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-black uppercase tracking-wider text-[#9a1b1b] dark:text-[#fca5a5] font-display">
                      Budget Cap Exceeded ({exceededAlerts.length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {exceededAlerts.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 text-xs font-bold text-[#9a1b1b] dark:text-[#fca5a5] flex-wrap"
                      >
                        <span>
                          {item.name} has exceeded cap by {formatSGD(item.over)}!
                        </span>
                        <span className="text-[11px] font-mono-num opacity-90">
                          {formatSGD(item.spent)} of {formatSGD(item.allocated)} ({item.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nearing Cap Warning (Amber) */}
          {warningAlerts.length > 0 && (
            <div
              data-testid="category-limit-nearing-banner"
              className="p-4 rounded-2xl border-2 border-(--border-ink) bg-[#fffbeb] dark:bg-[#382f18] text-[#92400e] dark:text-[#fde68a] shadow-(--shadow-cute-sm) transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-xl bg-[#ffe999] text-[#1a1a1a] border border-(--border-ink) shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-black uppercase tracking-wider text-[#92400e] dark:text-[#fde68a] font-display">
                      Nearing Limit Warning ({warningAlerts.length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {warningAlerts.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 text-xs font-bold text-[#92400e] dark:text-[#fde68a] flex-wrap"
                      >
                        <span>
                          {item.name} is at {item.percentage}% ({formatSGD(item.spent)} of {formatSGD(item.allocated)}) — {formatSGD(item.left)} left
                        </span>
                        {onNavigateCategory && (
                          <button
                            type="button"
                            onClick={() => onNavigateCategory(item.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-[#92400e] dark:text-[#fde68a] hover:underline cursor-pointer"
                          >
                            <span>View</span>
                            <ArrowUpRight className="h-3 w-3 stroke-[2.5]" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default CategoryLimitWarningBanner;
