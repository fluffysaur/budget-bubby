/**
 * CategoryLimitWarningBanner Component
 * Persistent alert banner displayed on BudgetPage and DashboardPage when
 * any spendable category spending is nearing or over its monthly cap:
 * - Nearing limit (>= 80% and < 100%): Amber warning alert
 * - Over limit (>= 100%, covered by Buffer): Calm neutral slate alert
 * - Over limit (>= 100%, uncovered / total over): Calm soft-amber alert
 *
 * Listens to the window 'expenseAdded' event:
 * - If a newly logged expense pushes any category across 80%, triggers playBudgetWarningSound()
 *   and shows an immediate amber warning toast.
 * - If it pushes across 100%, shows a calm acknowledgement toast ("Logged!" when covered by
 *   Buffer, or "Honest log" when total spendable moves into next month) with no alarm sound.
 */

import React, {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
} from "react";
import {
    AlertCircle,
    AlertTriangle,
    X,
    ArrowUpRight,
    Shield,
    Sparkles,
} from "lucide-react";
import { formatSGD } from "../../lib/currency";
import {
    computeBufferAbsorption,
    isBufferCategory,
    isSpendableCategory,
} from "../../lib/financialFormulas";
import { evaluateSpendablePostLog } from "../../lib/honestLog";
import { playBudgetWarningSound } from "../../lib/soundEffects";
import { haptics } from "../../lib/haptics";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import { financeService } from "../../services/financeService";
import { getDefaultNotificationPreferences } from "../../lib/notificationDefaults";
import type {
    Expense,
    MonthlyBudgetCategoryDetail,
    NotificationPreferences,
} from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";
import { m, AnimatePresence } from "motion/react";
import { collapse, pop } from "../../lib/motion";
import { useMoneyMask } from "../../hooks/useMoneyMask";

export interface CategoryLimitWarningBannerProps {
    categories?: MonthlyBudgetCategoryDetail[];
    className?: string;
    onNavigateCategory?: (categoryId: string) => void;
    /** Show only the most urgent alert, with a "+N more" link for the rest. */
    single?: boolean;
}

interface ToastAlert {
    id: string;
    type: "warning" | "covered" | "total-over";
    title: string;
    message: string;
}

type CategoryLimitAlertType = "exceeded" | "covered" | "warning";

const DISMISSED_ALERTS_KEY = "bb_dismissed_category_limit_alerts_v1";
const DISMISSED_ALERTS_EVENT = "categoryLimitAlertsDismissed";

function readDismissedAlerts(): Record<CategoryLimitAlertType, boolean> {
    try {
        const raw = window.sessionStorage.getItem(DISMISSED_ALERTS_KEY);
        if (!raw) return { exceeded: false, covered: false, warning: false };
        const parsed = JSON.parse(raw) as Partial<
            Record<CategoryLimitAlertType, unknown>
        >;
        return {
            exceeded: Boolean(parsed.exceeded),
            covered: Boolean(parsed.covered),
            warning: Boolean(parsed.warning),
        };
    } catch {
        return { exceeded: false, covered: false, warning: false };
    }
}

function persistDismissedAlerts(
    next: Record<CategoryLimitAlertType, boolean>,
): void {
    try {
        window.sessionStorage.setItem(
            DISMISSED_ALERTS_KEY,
            JSON.stringify(next),
        );
    } catch {
        // ignore storage errors
    }
}

export const CategoryLimitWarningBanner = React.memo(
    function CategoryLimitWarningBanner({
        categories = [],
        className = "",
        onNavigateCategory,
        single = false,
    }: CategoryLimitWarningBannerProps) {
        const mask = useMoneyMask();
        const { me } = useLoggedInMember();
        const activeMemberId = me?.id ?? "";

        const [toast, setToast] = useState<ToastAlert | null>(null);
        const [dismissedTypes, setDismissedTypes] = useState<
            Record<CategoryLimitAlertType, boolean>
        >(() => readDismissedAlerts());
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
            if (!activeMemberId) return;
            try {
                const data =
                    await financeService.getNotificationPreferences(
                        activeMemberId,
                    );
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
            window.addEventListener(
                "notificationPreferencesUpdated",
                handleUpdate,
            );
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
                    if (currentPrefs.budget_limit_alerts) {
                        const overAmount = Math.max(0, newSpent - allocated);
                        const evalResult = evaluateSpendablePostLog(
                            currentCats,
                            expense,
                        );
                        const isBuffer = isBufferCategory(
                            targetCat.category || targetCat.category_id,
                        );

                        if (
                            !isBuffer &&
                            evalResult.projectedCategoryStatus === "covered"
                        ) {
                            setToast({
                                id: String(Date.now()),
                                type: "covered",
                                title: "Logged!",
                                message: `${catName} is ${formatSGD(overAmount)} over — covered by Buffer`,
                            });
                        } else if (evalResult.isTotalOver) {
                            setToast({
                                id: String(Date.now()),
                                type: "total-over",
                                title: "Honest log",
                                message: `${formatSGD(evalResult.totalOverAmount)} over cap`,
                            });
                        } else {
                            setToast({
                                id: String(Date.now()),
                                type: "covered",
                                title: "Logged!",
                                message: `${catName} is ${formatSGD(overAmount)} over cap`,
                            });
                        }
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
        const { exceededAlerts, coveredAlerts, warningAlerts } = useMemo(() => {
            const absorption = computeBufferAbsorption(categories);
            const exceeded: Array<{
                id: string;
                name: string;
                spent: number;
                allocated: number;
                over: number;
                percentage: number;
                color?: string;
            }> = [];

            const covered: Array<{
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
                const spent = c.actualSpent || 0;
                if (allocated <= 0) continue;

                const percentage = (spent / allocated) * 100;
                const name = c.category?.name || "Category";
                const catId = c.category_id || c.category?.id || "";
                const isBuffer = isBufferCategory(c.category || c.category_id);

                const warningThreshold = prefs.budget_warning_pct || 80;

                if (percentage >= 100) {
                    const entry = {
                        id: c.category_id,
                        name,
                        spent,
                        allocated,
                        over: spent - allocated,
                        percentage: Math.round(percentage),
                        color: c.category?.color,
                    };
                    if (
                        !isBuffer &&
                        absorption.categoryBreakdown[catId]?.status ===
                            "covered"
                    ) {
                        covered.push(entry);
                    } else {
                        exceeded.push(entry);
                    }
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

            return {
                exceededAlerts: exceeded,
                coveredAlerts: covered,
                warningAlerts: warning,
            };
        }, [categories, prefs.budget_warning_pct]);

        useEffect(() => {
            const handleSyncDismissed = () => {
                setDismissedTypes(readDismissedAlerts());
            };
            window.addEventListener(
                DISMISSED_ALERTS_EVENT,
                handleSyncDismissed,
            );
            return () =>
                window.removeEventListener(
                    DISMISSED_ALERTS_EVENT,
                    handleSyncDismissed,
                );
        }, []);

        const handleDismissAlert = useCallback(
            (type: CategoryLimitAlertType) => {
                setDismissedTypes((prev) => {
                    if (prev[type]) return prev;
                    const next = { ...prev, [type]: true };
                    persistDismissedAlerts(next);
                    window.dispatchEvent(
                        new CustomEvent(DISMISSED_ALERTS_EVENT),
                    );
                    return next;
                });
            },
            [],
        );

        const visibleExceededAlerts = useMemo(
            () => (dismissedTypes.exceeded ? [] : exceededAlerts),
            [dismissedTypes.exceeded, exceededAlerts],
        );

        const visibleCoveredAlerts = useMemo(
            () => (dismissedTypes.covered ? [] : coveredAlerts),
            [dismissedTypes.covered, coveredAlerts],
        );

        const visibleWarningAlerts = useMemo(
            () => (dismissedTypes.warning ? [] : warningAlerts),
            [dismissedTypes.warning, warningAlerts],
        );

        const hasAnyAlerts =
            visibleExceededAlerts.length > 0 ||
            visibleCoveredAlerts.length > 0 ||
            visibleWarningAlerts.length > 0;

        // In single mode, keep only the most urgent alert: uncovered/total over, then Buffer-covered, else closest to cap
        const { shownExceeded, shownCovered, shownWarning, hiddenCount } =
            useMemo(() => {
                if (!single) {
                    return {
                        shownExceeded: visibleExceededAlerts,
                        shownCovered: visibleCoveredAlerts,
                        shownWarning: visibleWarningAlerts,
                        hiddenCount: 0,
                    };
                }
                const total =
                    visibleExceededAlerts.length +
                    visibleCoveredAlerts.length +
                    visibleWarningAlerts.length;
                if (visibleExceededAlerts.length > 0) {
                    const worst = [...visibleExceededAlerts]
                        .sort((a, b) => b.over - a.over)
                        .slice(0, 1);
                    return {
                        shownExceeded: worst,
                        shownCovered: [],
                        shownWarning: [],
                        hiddenCount: total - 1,
                    };
                }
                if (visibleCoveredAlerts.length > 0) {
                    const worstCovered = [...visibleCoveredAlerts]
                        .sort((a, b) => b.over - a.over)
                        .slice(0, 1);
                    return {
                        shownExceeded: [],
                        shownCovered: worstCovered,
                        shownWarning: [],
                        hiddenCount: total - 1,
                    };
                }
                const closest = [...visibleWarningAlerts]
                    .sort((a, b) => b.percentage - a.percentage)
                    .slice(0, 1);
                return {
                    shownExceeded: [],
                    shownCovered: [],
                    shownWarning: closest,
                    hiddenCount: total - closest.length,
                };
            }, [
                single,
                visibleExceededAlerts,
                visibleCoveredAlerts,
                visibleWarningAlerts,
            ]);

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
                                    toast.type === "covered"
                                        ? "bg-(--bg-cream) text-(--text-ink) dark:bg-(--bg-elevated) dark:text-(--text-ink)"
                                        : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                                }`}
                            >
                                <div
                                    className={`p-2 rounded-xl border border-(--border-ink) shadow-cute-sm shrink-0 ${
                                        toast.type === "covered"
                                            ? "bg-(--pastel-mint-light) text-emerald-900 dark:text-(--accent-mint-ink)"
                                            : "bg-(--pastel-butter) text-(--text-on-pastel)"
                                    }`}
                                >
                                    {toast.type === "covered" ? (
                                        <Shield
                                            className="h-5 w-5"
                                            strokeWidth={2.5}
                                        />
                                    ) : toast.type === "total-over" ? (
                                        <Sparkles
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
                                        {mask(toast.message)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setToast(null)}
                                    aria-label="Dismiss notification"
                                    className="relative p-1 rounded-lg after:absolute after:-inset-2.5 after:content-[''] hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-(--text-faint) hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
                                {/* Over Cap Alert (Coral tone for distinctness from Near) */}
                                {shownExceeded.length > 0 && (
                                    <div
                                        data-testid="category-limit-exceeded-banner"
                                        className="p-4 rounded-2xl border-2 border-(--border-ink) bg-(--accent-coral-subtle) dark:bg-rose-950/40 text-(--accent-coral-ink) dark:text-rose-300 shadow-cute-sm transition-colors"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-1.5 rounded-xl bg-(--accent-coral) text-(--text-on-accent) border border-(--border-ink) shrink-0 mt-0.5">
                                                <AlertCircle
                                                    className="h-4 w-4"
                                                    strokeWidth={2.5}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="text-xs font-black uppercase tracking-wider text-(--accent-coral-ink) dark:text-rose-300 font-display">
                                                        Over Cap (
                                                        {
                                                            visibleExceededAlerts.length
                                                        }
                                                        )
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    {shownExceeded.map(
                                                        (item) => (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-center justify-between gap-2 text-xs font-bold text-(--accent-coral-ink) dark:text-rose-300 flex-wrap"
                                                            >
                                                                <span>
                                                                    {item.name}{" "}
                                                                    is{" "}
                                                                    <CurrencyText
                                                                        amount={
                                                                            item.over
                                                                        }
                                                                    />{" "}
                                                                    over
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
                                                                    (
                                                                    {
                                                                        item.percentage
                                                                    }
                                                                    %)
                                                                </span>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDismissAlert(
                                                        "exceeded",
                                                    )
                                                }
                                                aria-label="Dismiss Over Cap alert"
                                                className="shrink-0 -mr-2 -mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-inherit opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                            >
                                                <X
                                                    className="h-4 w-4"
                                                    strokeWidth={2.5}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Covered by Buffer Alert (Neutral Slate) */}
                                {shownCovered.length > 0 && (
                                    <div
                                        data-testid="category-limit-covered-banner"
                                        className="p-4 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) dark:bg-(--bg-elevated) text-(--text-ink) shadow-cute-sm transition-colors"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-1.5 rounded-xl bg-(--pastel-mint-light) text-emerald-900 dark:text-(--accent-mint-ink) border border-(--border-ink) shrink-0 mt-0.5">
                                                <Shield
                                                    className="h-4 w-4"
                                                    strokeWidth={2.5}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="text-xs font-black uppercase tracking-wider text-(--text-ink) font-display">
                                                        Covered by Buffer (
                                                        {
                                                            visibleCoveredAlerts.length
                                                        }
                                                        )
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    {shownCovered.map(
                                                        (item) => (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-center justify-between gap-2 text-xs font-bold text-(--text-ink) flex-wrap"
                                                            >
                                                                <span>
                                                                    {item.name}{" "}
                                                                    is{" "}
                                                                    <CurrencyText
                                                                        amount={
                                                                            item.over
                                                                        }
                                                                    />{" "}
                                                                    over —
                                                                    covered by
                                                                    Buffer
                                                                </span>
                                                                <span className="text-[11px] font-mono-num opacity-80">
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
                                                                    (
                                                                    {
                                                                        item.percentage
                                                                    }
                                                                    %)
                                                                </span>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDismissAlert(
                                                        "covered",
                                                    )
                                                }
                                                aria-label="Dismiss Covered by Buffer alert"
                                                className="shrink-0 -mr-2 -mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-inherit opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                            >
                                                <X
                                                    className="h-4 w-4"
                                                    strokeWidth={2.5}
                                                />
                                            </button>
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
                                            <div className="p-1.5 rounded-xl bg-(--pastel-butter) text-(--text-on-pastel) border border-(--border-ink) shrink-0 mt-0.5">
                                                <AlertTriangle
                                                    className="h-4 w-4"
                                                    strokeWidth={2.5}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-200 font-display">
                                                        Near Limit (
                                                        {
                                                            visibleWarningAlerts.length
                                                        }
                                                        )
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    {shownWarning.map(
                                                        (item) => (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-center justify-between gap-2 text-xs font-bold text-amber-800 dark:text-amber-200 flex-wrap"
                                                            >
                                                                <span>
                                                                    {item.name}{" "}
                                                                    is at{" "}
                                                                    {
                                                                        item.percentage
                                                                    }
                                                                    % (
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
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDismissAlert(
                                                        "warning",
                                                    )
                                                }
                                                aria-label="Dismiss Near Limit alert"
                                                className="shrink-0 -mr-2 -mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-inherit opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                            >
                                                <X
                                                    className="h-4 w-4"
                                                    strokeWidth={2.5}
                                                />
                                            </button>
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
    },
);
CategoryLimitWarningBanner.displayName = "CategoryLimitWarningBanner";

export default CategoryLimitWarningBanner;
