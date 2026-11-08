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

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
    AlertCircle,
    AlertTriangle,
    X,
    ShieldAlert,
    ArrowUpRight,
} from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { isSpendableCategory } from "../../lib/financialFormulas";
import {
    playBudgetWarningSound,
    playBudgetExceededSound,
} from "../../lib/soundEffects";
import { haptics } from "../../lib/haptics";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import { financeService } from "../../services/financeService";
import { getDefaultNotificationPreferences } from "../../data/mockSeedData";
import type {
    Expense,
    MonthlyBudgetCategoryDetail,
    NotificationPreferences,
} from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";
import { m, AnimatePresence } from "motion/react";
import { collapse, pop } from "../../lib/motion";

export interface CategoryLimitWarningBannerProps {
    categories?: MonthlyBudgetCategoryDetail[];
    className?: string;
    onNavigateCategory?: (categoryId: string) => void;
    /** Show only the most urgent alert, with a "+N more" link for the rest. */
    single?: boolean;
}

interface ToastAlert {
    id: string;
    type: "warning" | "exceeded";
    title: string;
    message: string;
}

export function CategoryLimitWarningBanner({
    categories = [],
    className = "",
    onNavigateCategory,
    single = false,
}: CategoryLimitWarningBannerProps) {
    const { me, members } = useLoggedInMember();
    const activeMemberId = me?.id || members?.[0]?.id || "mem-00000000-0011";

    const [toast, setToast] = useState<ToastAlert | null>(null);
    const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
        getDefaultNotificationPreferences(activeMemberId),
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
            const data =
                await financeService.getNotificationPreferences(activeMemberId);
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
        window.addEventListener("notificationPreferencesUpdated", handleUpdate);
        return () =>
            window.removeEventListener(
                "notificationPreferencesUpdated",
                handleUpdate,
            );
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
                (c) =>
                    c.category_id === expense.category_id ||
                    c.category?.id === expense.category_id,
            );

            if (
                !targetCat ||
                !isSpendableCategory(
                    targetCat.category || targetCat.category_id,
                )
            ) {
                return;
            }

            const allocated = targetCat.allocated_amount || 0;
            if (allocated <= 0) return;

            const prevSpent = targetCat.actualSpent || 0;
            const addedAmount = Number(expense.amount) || 0;
            const newSpent = prevSpent + addedAmount;

            const prevPct = (prevSpent / allocated) * 100;
            const newPct = (newSpent / allocated) * 100;
            const catName = targetCat.category?.name || "Category";
            const warningThreshold = currentPrefs.budget_warning_pct || 80;

            if (newPct >= 100 && prevPct < 100) {
                try {
                    playBudgetExceededSound();
                    haptics.alert();
                } catch (err) {
                    console.debug(
                        "Error triggering exceeded sound/haptic:",
                        err,
                    );
                }
                if (currentPrefs.budget_limit_alerts) {
                    const overAmount = Math.max(0, newSpent - allocated);
                    setToast({
                        id: String(Date.now()),
                        type: "exceeded",
                        title: `${catName} Over`,
                        message: `${formatSGD(overAmount)} over cap`,
                    });
                }
            } else if (
                newPct >= warningThreshold &&
                prevPct < warningThreshold
            ) {
                try {
                    playBudgetWarningSound();
                    haptics.warning();
                } catch (err) {
                    console.debug(
                        "Error triggering warning sound/haptic:",
                        err,
                    );
                }
                if (currentPrefs.budget_limit_alerts) {
                    const leftAmount = Math.max(0, allocated - newSpent);
                    setToast({
                        id: String(Date.now()),
                        type: "warning",
                        title: `${catName} at ${Math.round(newPct)}%`,
                        message: `${formatSGD(leftAmount)} left`,
                    });
                }
            }
        };

        window.addEventListener("expenseAdded", handleExpenseAdded);
        return () =>
            window.removeEventListener("expenseAdded", handleExpenseAdded);
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
            const name = c.category?.name || "Category";

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

    // In single mode, keep only the most urgent alert: worst overspend, else closest to cap
    const { shownExceeded, shownWarning, hiddenCount } = useMemo(() => {
        if (!single) {
            return {
                shownExceeded: exceededAlerts,
                shownWarning: warningAlerts,
                hiddenCount: 0,
            };
        }
        const total = exceededAlerts.length + warningAlerts.length;
        if (exceededAlerts.length > 0) {
            const worst = [...exceededAlerts]
                .sort((a, b) => b.over - a.over)
                .slice(0, 1);
            return {
                shownExceeded: worst,
                shownWarning: [],
                hiddenCount: total - 1,
            };
        }
        const closest = [...warningAlerts]
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 1);
        return {
            shownExceeded: [],
            shownWarning: closest,
            hiddenCount: total - closest.length,
        };
    }, [single, exceededAlerts, warningAlerts]);

    return (
        <>
            {/* Immediate Toast Notification (Floating) */}
            <AnimatePresence>
                {toast && (
                    <m.div
                        key="limit-toast"
                        role="alert"
                        aria-live="assertive"
                        {...pop}
                        className="fixed top-[calc(1.25rem+env(safe-area-inset-top))] left-4 right-4 sm:left-auto sm:right-5 z-50 max-w-sm sm:max-w-md sm:w-full pointer-events-auto"
                    >
                        <div
                            className={`p-4 rounded-2xl border-2 border-(--border-ink) shadow-cute-lg flex items-start gap-3 backdrop-blur-md ${
                                toast.type === "exceeded"
                                    ? "bg-(--accent-coral-subtle) text-(--accent-coral-ink) dark:bg-rose-950/40 dark:text-rose-300"
                                    : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                            }`}
                        >
                            <div
                                className={`p-2 rounded-xl border border-(--border-ink) shadow-cute-sm shrink-0 ${
                                    toast.type === "exceeded"
                                        ? "bg-(--accent-coral) text-white"
                                        : "bg-(--pastel-butter) text-(--text-ink)"
                                }`}
                            >
                                {toast.type === "exceeded" ? (
                                    <ShieldAlert
                                        className="h-5 w-5"
                                        strokeWidth={2.5}
                                    />
                                ) : (
                                    <AlertTriangle
                                        className="h-5 w-5"
                                        strokeWidth={2.5}
                                    />
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
                                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-(--text-faint) hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>

            {/* Persistent Warning Banner (In-Flow) */}
            <AnimatePresence>
                {hasAnyAlerts && (
                    <m.div
                        key="category-limit-banner"
                        {...collapse}
                        className={`space-y-2.5 ${className}`}
                    >
                        <div
                            data-testid="category-limit-warning-banner"
                            role="region"
                            aria-label="Category Budget Guardrails"
                            className="space-y-2.5"
                        >
                            {/* Exceeded Cap Alert (Rose) */}
                            {shownExceeded.length > 0 && (
                                <div
                                    data-testid="category-limit-exceeded-banner"
                                    className="p-4 rounded-2xl border-2 border-(--border-ink) bg-(--accent-coral-subtle) dark:bg-rose-950/40 text-(--accent-coral-ink) dark:text-rose-300 shadow-cute-sm transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="p-1.5 rounded-xl bg-(--accent-coral) text-white border border-(--border-ink) shrink-0 mt-0.5">
                                            <AlertCircle
                                                className="h-4 w-4"
                                                strokeWidth={2.5}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="text-xs font-black uppercase tracking-wider text-(--accent-coral-ink) dark:text-rose-300 font-display">
                                                    Over Cap (
                                                    {exceededAlerts.length})
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                {shownExceeded.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center justify-between gap-2 text-xs font-bold text-(--accent-coral-ink) dark:text-rose-300 flex-wrap"
                                                    >
                                                        <span>
                                                            {item.name} has
                                                            exceeded cap by{" "}
                                                            <CurrencyText
                                                                amount={
                                                                    item.over
                                                                }
                                                            />
                                                            !
                                                        </span>
                                                        <span className="text-[11px] font-mono-num opacity-90">
                                                            <CurrencyText
                                                                amount={
                                                                    item.spent
                                                                }
                                                            />{" "}
                                                            of{" "}
                                                            <CurrencyText
                                                                amount={
                                                                    item.allocated
                                                                }
                                                            />{" "}
                                                            ({item.percentage}%)
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Nearing Cap Warning (Amber) */}
                            {shownWarning.length > 0 && (
                                <div
                                    data-testid="category-limit-nearing-banner"
                                    className="p-4 rounded-2xl border-2 border-(--border-ink) bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 shadow-cute-sm transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="p-1.5 rounded-xl bg-(--pastel-butter) text-(--text-ink) border border-(--border-ink) shrink-0 mt-0.5">
                                            <AlertTriangle
                                                className="h-4 w-4"
                                                strokeWidth={2.5}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-200 font-display">
                                                    Near Limit (
                                                    {warningAlerts.length})
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                {shownWarning.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center justify-between gap-2 text-xs font-bold text-amber-800 dark:text-amber-200 flex-wrap"
                                                    >
                                                        <span>
                                                            {item.name} is at{" "}
                                                            {item.percentage}% (
                                                            <CurrencyText
                                                                amount={
                                                                    item.spent
                                                                }
                                                            />{" "}
                                                            of{" "}
                                                            <CurrencyText
                                                                amount={
                                                                    item.allocated
                                                                }
                                                            />
                                                            ) —{" "}
                                                            <CurrencyText
                                                                amount={
                                                                    item.left
                                                                }
                                                            />{" "}
                                                            left
                                                        </span>
                                                        {onNavigateCategory && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    onNavigateCategory(
                                                                        item.id,
                                                                    )
                                                                }
                                                                className="inline-flex items-center gap-1 text-[11px] font-black text-amber-800 dark:text-amber-200 hover:underline cursor-pointer"
                                                            >
                                                                <span>
                                                                    View
                                                                </span>
                                                                <ArrowUpRight
                                                                    className="h-3 w-3"
                                                                    strokeWidth={
                                                                        2.5
                                                                    }
                                                                />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {hiddenCount > 0 && (
                                <button
                                    type="button"
                                    data-testid="category-limit-more"
                                    onClick={() => onNavigateCategory?.("")}
                                    className="inline-flex items-center gap-1 px-1 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                                >
                                    <span>+{hiddenCount} more</span>
                                    <ArrowUpRight
                                        className="h-3 w-3"
                                        strokeWidth={2.5}
                                    />
                                </button>
                            )}
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default CategoryLimitWarningBanner;
