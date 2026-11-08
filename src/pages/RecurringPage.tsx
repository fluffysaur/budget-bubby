/**
 * RecurringPage Component
 * Recurring items (insurance, tax, subscriptions, bills, other) & renewal calendar:
 * - 2 summary cards (as of today): Annual Outflow (with per-month figure) and Next Renewal
 * - Perspective filtering (Combined Household vs Yi Jia vs Rachel)
 * - RenewalCalendar with year stepper and month detail
 * - RecurringTable with search, type filters, edit, and delete
 * - AddRecurringModal integration
 */

import { useState, useMemo } from "react";
import { Plus, DollarSign, CalendarCheck, RefreshCw } from "lucide-react";
import { useHousehold } from "../context/HouseholdContext";
import {
    PageHeader,
    Button,
    StatCard,
    Card,
    RecurringContentSkeleton,
    TruncatedText,
} from "../components/ui";
import { Alert } from "../components/ui/Alert";
import {
    useCategoriesQuery,
    useRecurringItemsQuery,
    useInvalidateFinance,
    useAddRecurringItemMutation,
    useUpdateRecurringItemMutation,
    useDeleteRecurringItemMutation,
} from "../hooks/useFinanceQueries";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { formatSGD } from "../lib/currency";
import {
    findNextRenewal,
    getRecurringItemStatus,
    getRecurringMonthlyShare,
    isDeductionType,
    isJointRecurringItem,
    isRecurringItemOwnedBy,
} from "../lib/recurringItems";
import {
    formatMonth,
    getSingaporeDate,
    MONTH_NAMES_SHORT,
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
    const { perspective, activeMember } = useHousehold();
    const { invalidateRecurring } = useInvalidateFinance();
    const { isPending: isDeletingRecurring, runWithLock: runDeleteLock } =
        useSubmitLock();
    const addRecurringMutation = useAddRecurringItemMutation();
    const updateRecurringMutation = useUpdateRecurringItemMutation();
    const deleteRecurringMutation = useDeleteRecurringItemMutation();

    // Cached Recurring Items Query
    const {
        data: recurringItemsData,
        isLoading: recurringItemsLoading,
        error: recurringItemsError,
    } = useRecurringItemsQuery();
    const recurringItems = useMemo(
        () => recurringItemsData || [],
        [recurringItemsData],
    );
    const { data: categoriesData } = useCategoriesQuery();
    const categories = useMemo(() => categoriesData || [], [categoriesData]);
    const isLoading = recurringItemsLoading && !recurringItemsData;
    const [actionError, setActionError] = useState<string | null>(null);
    const errorMessage =
        actionError ||
        (recurringItemsError ? (recurringItemsError as Error).message : null);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingItem, setEditingItem] = useState<RecurringItem | null>(null);

    // Perspective filtering: resolve member ID via activeMember from HouseholdContext
    // rather than hard-coded member names or fallback IDs.
    const ownerScopeId =
        perspective === "household" ? "household" : activeMember?.id;

    const inScopeItems = useMemo(() => {
        return recurringItems.filter((recurringItem) => {
            if (perspective === "household") {
                return true;
            }
            if (!activeMember) {
                return false;
            }
            return isRecurringItemOwnedBy(recurringItem, activeMember.id);
        });
    }, [recurringItems, perspective, activeMember]);

    // Summary cards describe today, independent of the calendar's year
    const { totalAnnualOutflow, monthlyAmortizedOutflow, nextRenewal } =
        useMemo(() => {
            const today = getSingaporeDate();
            const thisMonth = formatMonth(today);
            const activeDeductions = inScopeItems.filter(
                (p) =>
                    isDeductionType(p.type) &&
                    getRecurringItemStatus(p, thisMonth) === "active",
            );
            return {
                totalAnnualOutflow: activeDeductions.reduce((sum, p) => {
                    const annualAmt =
                        p.frequency === "monthly" ? p.amount * 12 : p.amount;
                    const shareFactor =
                        ownerScopeId &&
                        ownerScopeId !== "household" &&
                        isJointRecurringItem(p)
                            ? 0.5
                            : 1;
                    return sum + annualAmt * shareFactor;
                }, 0),
                monthlyAmortizedOutflow: activeDeductions.reduce(
                    (sum, p) => sum + getRecurringMonthlyShare(p, ownerScopeId),
                    0,
                ),
                nextRenewal: findNextRenewal(inScopeItems, today),
            };
        }, [inScopeItems, ownerScopeId]);

    const nextRenewalSub = (() => {
        if (!nextRenewal) return "None";
        const { date, item } = nextRenewal;
        const yearSuffix =
            date.getFullYear() !== getSingaporeDate().getFullYear()
                ? ` '${String(date.getFullYear()).slice(2)}`
                : "";
        return `${MONTH_NAMES_SHORT[date.getMonth()]}${yearSuffix} • ${formatSGD(item.amount)}`;
    })();

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
        await runDeleteLock(async () => {
            try {
                setActionError(null);
                await deleteRecurringMutation.mutateAsync(itemId);
            } catch (err: unknown) {
                console.error("Failed to delete recurring item:", err);
                setActionError(
                    err instanceof Error
                        ? err.message
                        : "Failed to delete recurring item",
                );
            }
        });
    };

    const handleSaveItem = async (
        payload: CreateRecurringItemInput & { id?: string },
    ) => {
        if (payload.id) {
            await updateRecurringMutation.mutateAsync({
                ...payload,
                id: payload.id,
            });
        } else {
            await addRecurringMutation.mutateAsync(payload);
        }
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
                                onClick={() => invalidateRecurring()}
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
                                    <Plus
                                        className="w-4 h-4"
                                        strokeWidth={2.5}
                                    />
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
                            onClick={() => invalidateRecurring()}
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
                                <Plus
                                    className="w-3.5 h-3.5"
                                    strokeWidth={2.5}
                                />
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

            {/* Summary Cards (as of today) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <StatCard
                    title="Annual Outflow"
                    loading={isLoading}
                    value={formatSGD(totalAnnualOutflow)}
                    subtitle={`${formatSGD(monthlyAmortizedOutflow)}/mo`}
                    tooltip="Insurance and tax active today."
                    icon={<DollarSign className="w-4 h-4" />}
                    iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                />

                <StatCard
                    title="Next Renewal"
                    loading={isLoading}
                    value={
                        <TruncatedText
                            as="div"
                            className="font-display font-black tracking-tight text-base sm:text-lg"
                            text={nextRenewal?.item.name ?? "None"}
                        />
                    }
                    subtitle={nextRenewalSub}
                    icon={<CalendarCheck className="w-4 h-4" />}
                    iconBg="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                />
            </div>

            {isLoading ? (
                <RecurringContentSkeleton />
            ) : (
                <>
                    {/* 12-Month Renewal Calendar */}
                    <Card variant="white" padding="md">
                        <RenewalCalendar recurringItems={inScopeItems} />
                    </Card>

                    {/* Recurring Table */}
                    <RecurringTable
                        title="All Recurring"
                        recurringItems={inScopeItems}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                        isDeleting={isDeletingRecurring}
                        onAdd={handleOpenAddModal}
                    />
                </>
            )}

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
