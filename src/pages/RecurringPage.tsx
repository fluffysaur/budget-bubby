/**
 * RecurringPage Component
 * Recurring items (insurance, tax, subscriptions, bills, other) & renewal calendar:
 * - 4 Summary metric cards: Total Annual Outflow, Monthly Amortized Outflow, Upcoming Renewal, Heaviest Month
 * - Perspective filtering (Combined Household vs Yi Jia vs Rachel)
 * - 12-Month RenewalCalendar timeline
 * - RecurringTable with search, type filters, edit, and delete
 * - AddRecurringModal integration
 */

import { useState, useMemo } from "react";
import {
    Plus,
    DollarSign,
    TrendingDown,
    CalendarCheck,
    Flame,
    RefreshCw,
} from "lucide-react";
import { useHousehold } from "../context/HouseholdContext";
import { PageHeader, Button, StatCard, Card } from "../components/ui";
import { Alert } from "../components/ui/Alert";
import {
    useCategoriesQuery,
    useRecurringItemsQuery,
} from "../hooks/useFinanceQueries";
import { financeService } from "../services/financeService";
import { formatSGD } from "../lib/currency";
import { isDeductionType } from "../lib/recurringItems";
import {
    getSingaporeDate,
    MONTH_NAMES_FULL as MONTH_NAMES,
} from "../lib/dateUtils";
import { RecurringTable } from "../components/recurring/RecurringTable";
import { RenewalCalendar } from "../components/recurring/RenewalCalendar";
import { AddRecurringModal } from "../components/recurring/AddRecurringModal";
import type { RecurringItem, CreateRecurringItemInput } from "../types/finance";

export interface RecurringPageProps {
    className?: string;
    embedded?: boolean;
}

export function RecurringPage({
    className = "",
    embedded = false,
}: RecurringPageProps) {
    const {
        perspective,
        activeMember,
        members,
        refreshData: refreshHousehold,
    } = useHousehold();

    // Cached Recurring Items Query
    const {
        data: recurringItemsData,
        isLoading: recurringItemsLoading,
        error: recurringItemsError,
    } = useRecurringItemsQuery();
    const recurringItems = useMemo(() => recurringItemsData || [], [recurringItemsData]);
    const { data: categoriesData } = useCategoriesQuery();
    const categories = useMemo(() => categoriesData || [], [categoriesData]);
    const isLoading = recurringItemsLoading && !recurringItemsData;
    const [actionError, setActionError] = useState<string | null>(null);
    const errorMessage =
        actionError ||
        (recurringItemsError ? (recurringItemsError as Error).message : null);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingItem, setEditingItem] = useState<RecurringItem | null>(
        null,
    );

    // Perspective filtering
    const inScopeItems = useMemo(() => {
        return recurringItems.filter((recurringItem) => {
            if (perspective === "household") {
                return true;
            }
            if (perspective === "yijia") {
                const yiJia = members.find((m) =>
                    m.display_name.toLowerCase().includes("yi jia"),
                );
                const yjId = yiJia?.id || "mem-00000000-0011";
                return recurringItem.owner_id === yjId || recurringItem.owner_id === "joint";
            }
            if (perspective === "rachel") {
                const rachel = members.find((m) =>
                    m.display_name.toLowerCase().includes("rachel"),
                );
                const rcId = rachel?.id || "mem-00000000-0012";
                return recurringItem.owner_id === rcId || recurringItem.owner_id === "joint";
            }
            return !recurringItem.owner_id || recurringItem.owner_id === activeMember?.id;
        });
    }, [recurringItems, perspective, activeMember, members]);

    // Metric 1: Total Annual Outflow (Insurance & Tax recurring items)
    const totalAnnualOutflow = useMemo(() => {
        return inScopeItems
            .filter((p) => isDeductionType(p.type))
            .reduce((sum, p) => {
                if (p.frequency === "monthly") {
                    return sum + p.amount * 12;
                }
                return sum + p.amount;
            }, 0);
    }, [inScopeItems]);

    // Metric 2: Monthly Amortized Outflow
    const monthlyAmortizedOutflow = useMemo(() => {
        return inScopeItems
            .filter((p) => isDeductionType(p.type))
            .reduce((sum, p) => sum + p.monthly_amortized_amount, 0);
    }, [inScopeItems]);

    // Metric 3 & 4: Monthly Outlay Map, Heaviest Month & Upcoming Renewal
    const {
        heaviestMonthName,
        heaviestMonthAmount,
        upcomingRenewalText,
        upcomingRenewalSub,
    } = useMemo(() => {
        const monthlyTotals = Array(12).fill(0);
        const sgNow = getSingaporeDate();
        const currentMonthNum = sgNow.getMonth() + 1; // 1-12

        for (const p of inScopeItems) {
            if (p.frequency === "monthly") {
                for (let m = 0; m < 12; m++) {
                    monthlyTotals[m] += p.amount;
                }
            } else if (
                p.payment_month &&
                p.payment_month >= 1 &&
                p.payment_month <= 12
            ) {
                monthlyTotals[p.payment_month - 1] += p.amount;
            }
        }

        // Heaviest Month
        const maxVal = Math.max(...monthlyTotals, 0);
        const maxIdx = monthlyTotals.indexOf(maxVal);
        const heaviestName = maxVal > 0 ? MONTH_NAMES[maxIdx] : "None";

        // Upcoming Renewal: closest annual renewal month >= currentMonthNum, or wrap around
        const annualItems = inScopeItems.filter(
            (p) => p.frequency === "annually" && p.payment_month,
        );

        let nextItem: RecurringItem | null = null;
        let minDistance = 999;

        for (const p of annualItems) {
            const pMonth = p.payment_month!;
            let distance = pMonth - currentMonthNum;
            if (distance < 0) {
                distance += 12; // Next calendar year
            }
            if (distance < minDistance) {
                minDistance = distance;
                nextItem = p;
            }
        }

        let upcomingItemName = "None upcoming";
        let upcomingItemSub = "No upcoming renewals";
        if (nextItem && nextItem.payment_month) {
            const dueMonthStr = MONTH_NAMES[nextItem.payment_month - 1];
            upcomingItemName = nextItem.name;
            upcomingItemSub = `${dueMonthStr.slice(0, 3)} • ${formatSGD(nextItem.amount)}`;
        } else if (inScopeItems.some((p) => p.frequency === "monthly")) {
            upcomingItemName = "Active Subscriptions";
            upcomingItemSub = "Billed monthly";
        }

        return {
            heaviestMonthName: heaviestName,
            heaviestMonthAmount: maxVal,
            upcomingRenewalText: upcomingItemName,
            upcomingRenewalSub: upcomingItemSub,
        };
    }, [inScopeItems]);

    // Handlers
    const handleOpenAddModal = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const handleEditItem = (recurringItem: RecurringItem) => {
        setEditingItem(recurringItem);
        setIsModalOpen(true);
    };

    const handleDeleteItem = async (itemId: string) => {
        try {
            setActionError(null);
            await financeService.deleteRecurringItem(itemId);
            await refreshHousehold();
        } catch (err: unknown) {
            console.error("Failed to delete recurring item:", err);
            setActionError(
                err instanceof Error ? err.message : "Failed to delete recurring item",
            );
        }
    };

    const handleSaveItem = async (
        payload: CreateRecurringItemInput & { id?: string },
    ) => {
        if (payload.id) {
            await financeService.updateRecurringItem(payload.id, payload);
        } else {
            await financeService.addRecurringItem(payload);
        }
        await refreshHousehold();
    };

    return (
        <div
            className={`space-y-5 ${!embedded ? "pb-20 md:pb-12" : ""} ${className}`.trim()}
        >
            {/* Page Title & Actions (Compact if embedded) */}
            {!embedded ? (
                <PageHeader
                    title="Recurring"
                    actions={
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button
                                variant="secondary"
                                onClick={() => refreshHousehold()}
                                title="Refresh"
                                leftIcon={
                                    <RefreshCw
                                        className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                                    />
                                }
                            />
                            <Button
                                variant="primary"
                                className="w-full sm:w-auto"
                                leftIcon={
                                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                                }
                                onClick={handleOpenAddModal}
                            >
                                Add Recurring
                            </Button>
                        </div>
                    }
                />
            ) : (
                <div className="flex items-center justify-end w-full">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => refreshHousehold()}
                            title="Refresh"
                            leftIcon={
                                <RefreshCw
                                    className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
                                />
                            }
                        />
                        <Button
                            variant="primary"
                            size="sm"
                            className="flex-1 sm:flex-initial whitespace-nowrap"
                            leftIcon={
                                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                            }
                            onClick={handleOpenAddModal}
                        >
                            Add Recurring
                        </Button>
                    </div>
                </div>
            )}

            {/* Error Banner */}
            {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

            {/* 4 Summary Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Metric 1: Annual Outflow */}
                <StatCard
                    title="Annual Outflow"
                    value={formatSGD(totalAnnualOutflow)}
                    subtitle={`${inScopeItems.length} items`}
                    icon={<DollarSign className="w-4 h-4" />}
                    iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                />

                {/* Metric 2: Monthly Amortized Outflow */}
                <StatCard
                    title="Monthly Amortized"
                    value={`${formatSGD(monthlyAmortizedOutflow)}/mo`}
                    subtitle="Insurance & tax"
                    icon={<TrendingDown className="w-4 h-4" />}
                    iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                />

                {/* Metric 3: Upcoming Renewal */}
                <StatCard
                    title="Next Renewal"
                    value={
                        <span
                            className="text-base sm:text-lg truncate block"
                            title={upcomingRenewalText}
                        >
                            {upcomingRenewalText}
                        </span>
                    }
                    subtitle={upcomingRenewalSub}
                    icon={<CalendarCheck className="w-4 h-4" />}
                    iconBg="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                />

                {/* Metric 4: Heaviest Month */}
                <StatCard
                    title="Heaviest Month"
                    value={
                        <span className="text-base sm:text-lg text-rose-600 dark:text-rose-400 truncate block">
                            {heaviestMonthName}
                        </span>
                    }
                    subtitle={
                        heaviestMonthAmount > 0
                            ? `${formatSGD(heaviestMonthAmount)} total`
                            : "No annual items"
                    }
                    icon={<Flame className="w-4 h-4" />}
                    iconBg="bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                />
            </div>

            {/* 12-Month Renewal Calendar */}
            <Card variant="white" padding="md">
                <RenewalCalendar recurringItems={inScopeItems} />
            </Card>

            {/* Recurring Table */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        All Recurring
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {inScopeItems.length} items
                    </span>
                </div>

                <RecurringTable
                    recurringItems={inScopeItems}
                    onEdit={handleEditItem}
                    onDelete={handleDeleteItem}
                    onAdd={handleOpenAddModal}
                />
            </div>

            {/* Add / Edit Recurring Modal */}
            <AddRecurringModal
                isOpen={isModalOpen}
                initialItem={editingItem}
                categories={categories}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveItem}
            />
        </div>
    );
}

export default RecurringPage;
