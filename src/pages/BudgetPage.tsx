/**
 * BudgetPage Component
 * Integrated Monthly Budget Tracking & Base Profile Management
 * Coordinates:
 * - Selected month navigation ('YYYY-MM')
 * - Active perspective (Combined Household vs Yi Jia vs Rachel)
 * - High-level financial metric cards
 * - Spendable Category spending meters (Food, Lifestyle, Transport, Buffer) with recurring item tooltips
 * - Collapsible Wealth & Fixed Allocations (Investments, Savings, Tithing)
 * - Visual Budget Waterfall breakdown
 * - Bonus income shown outside category caps (logged in Plan › Bonus)
 * - Base profile editor modal
 */

import { useState, useMemo } from "react";
import { Settings, DollarSign, Wallet, PiggyBank, Tag } from "lucide-react";
import { useHousehold } from "../context/HouseholdContext";
import {
    PageHeader,
    Button,
    StatCard,
    BudgetContentSkeleton,
    MeterBar,
    Badge,
} from "../components/ui";
import { CollapsibleSection } from "../components/ui/CollapsibleSection";
import {
    useCategoriesQuery,
    useBaseProfilesQuery,
    useBaseAllocationsQuery,
    useRecurringItemsQuery,
    useBudgetDetailQuery,
    useInvalidateFinance,
} from "../hooks/useFinanceQueries";
import { financeService } from "../services/financeService";
import { formatSGD } from "../lib/currency";
import { getCurrentMonth } from "../lib/dateUtils";
import { useFollowCurrentMonth } from "../hooks/useCurrentMonth";
import { isValidUuid } from "../lib/uuid";
import {
    isSavingsCategory,
    isSpendableCategory,
} from "../lib/financialFormulas";
import {
    mockBaseProfiles,
    mockBaseAllocations,
    mockCategories,
} from "../data/mockSeedData";
import { MonthPicker } from "../components/budget/MonthPicker";
import { BudgetWaterfall } from "../components/budget/BudgetWaterfall";
import { CategoriesHeader } from "../components/budget/CategoriesHeader";
import { CategoryProgressList } from "../components/budget/CategoryProgressList";
import { BudgetEditorModal } from "../components/budget/BudgetEditorModal";
import { CategoryLimitWarningBanner } from "../components/budget/CategoryLimitWarningBanner";
import { SavingsBreakdownCard } from "../components/budget/SavingsBreakdownCard";
import { CumulativeSurplusCard } from "../components/budget/CumulativeSurplusCard";
import { UncategorizedRecurringRow } from "../components/budget/UncategorizedRecurringRow";
import type { BaseBudgetProfile } from "../types/finance";
import { CurrencyText } from "../components/ui/CurrencyText";

export interface BudgetPageProps {
    className?: string;
    embedded?: boolean;
    onNavigateTab?: (tab: string) => void;
}

export function BudgetPage({
    className = "",
    embedded = false,
    onNavigateTab,
}: BudgetPageProps) {
    const { perspective, activeMember, members, overview, isMockMode } =
        useHousehold();
    const { invalidateBudget, invalidateCategories } = useInvalidateFinance();

    // State
    const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth);
    useFollowCurrentMonth(selectedMonth, setSelectedMonth);

    // Cached Metadata Queries
    const { data: categoriesData } = useCategoriesQuery();
    const { data: baseProfilesData } = useBaseProfilesQuery();
    const { data: baseAllocationsData } = useBaseAllocationsQuery();
    const { data: recurringItemsData } = useRecurringItemsQuery();

    const categories = useMemo(() => {
        if (categoriesData && categoriesData.length > 0) return categoriesData;
        return isMockMode ? mockCategories : [];
    }, [categoriesData, isMockMode]);

    const baseProfiles = useMemo(() => {
        if (baseProfilesData && baseProfilesData.length > 0)
            return baseProfilesData;
        return isMockMode ? mockBaseProfiles : [];
    }, [baseProfilesData, isMockMode]);

    const baseAllocations = useMemo(() => {
        if (baseAllocationsData && baseAllocationsData.length > 0)
            return baseAllocationsData;
        return isMockMode ? mockBaseAllocations : [];
    }, [baseAllocationsData, isMockMode]);

    // Modal State
    const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
    const [editingProfileMemberId, setEditingProfileMemberId] = useState<
        string | null
    >(null);

    // Determine perspective display name

    // Combined household budget in the Combined view, otherwise the member's budget
    const memberIds = useMemo(() => members.map((m) => m.id), [members]);
    const {
        data: budgetDetailData,
        isLoading: budgetLoading,
        isPlaceholderData: budgetPlaceholder,
    } = useBudgetDetailQuery(
        selectedMonth,
        perspective,
        activeMember?.id,
        memberIds,
    );

    const budgetDetail = budgetDetailData ?? null;
    const isLoading = budgetLoading && !budgetDetailData;

    // Handle opening editor
    const handleOpenEditor = (memberId?: string) => {
        const targetId =
            memberId || (activeMember ? activeMember.id : members[0]?.id);
        setEditingProfileMemberId(targetId);
        setIsEditorOpen(true);
    };

    // Find profile to edit
    const activeProfile = useMemo((): BaseBudgetProfile => {
        const targetMember =
            (editingProfileMemberId
                ? members.find((m) => m.id === editingProfileMemberId)
                : activeMember) || members[0];
        const targetId = targetMember?.id || "";
        const targetHouseholdId =
            targetMember?.household_id || overview?.household?.id || "";

        const found = baseProfiles.find((p) => p.owner_id === targetId);
        if (found) return found;

        if (isMockMode) {
            const mockFound =
                mockBaseProfiles.find((p) => p.owner_id === targetId) ||
                mockBaseProfiles[0];
            if (mockFound) return mockFound;
        }

        // Default clean profile for this real member and household (no mock IDs in live mode)
        return {
            id:
                typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : "",
            household_id: targetHouseholdId,
            owner_id: targetId,
            gross_salary: 5000,
            cpf_employee_rate: 0.2,
            tithing_enabled: true,
            updated_at: new Date().toISOString(),
        };
    }, [
        baseProfiles,
        editingProfileMemberId,
        activeMember,
        members,
        overview,
        isMockMode,
    ]);

    const activeAllocations = useMemo(() => {
        if (!activeProfile?.id) return [];
        const existing = baseAllocations.filter(
            (a) => a.profile_id === activeProfile.id,
        );
        if (existing.length > 0) return existing;

        // If new profile with no allocations yet, provide standard default percentage split
        const defaultPcts: Record<string, number> = {
            food: 0.15,
            lifestyle: 0.15,
            transport: 0.05,
            investments: 0.35,
            savings: 0.15,
            tithing: 0.1,
            buffer: 0.05,
        };

        return categories.map((cat) => {
            const key = cat.name.toLowerCase();
            const pct = defaultPcts[key] ?? 0;
            return {
                id:
                    typeof crypto !== "undefined" && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `alloc-${cat.id}`,
                profile_id: activeProfile.id,
                category_id: cat.id,
                target_percentage: pct,
            };
        });
    }, [baseAllocations, activeProfile, categories]);

    const handleProfileSaved = async () => {
        invalidateBudget();
    };

    const handleCategoriesChanged = async () => {
        invalidateCategories();
    };

    // Split categories into Spendable (Food, Lifestyle, Transport, Buffer) vs Wealth/Fixed Allocations (Investments, Savings, Tithing)
    const { spendableCats, allocationCats } = useMemo(() => {
        const all = budgetDetail?.categories || [];
        const spendable = all.filter((c) => isSpendableCategory(c.category));
        const allocations = all.filter((c) => !isSpendableCategory(c.category));
        return { spendableCats: spendable, allocationCats: allocations };
    }, [budgetDetail]);

    const handleViewBonus = () =>
        onNavigateTab
            ? onNavigateTab("plan?tab=bonus")
            : typeof window !== "undefined"
              ? window.location.assign("/plan?tab=bonus")
              : undefined;
    const disposablePool = budgetDetail?.disposablePool || 0;
    const totalSpent = budgetDetail?.totalSpent || 0;
    const totalRemaining = budgetDetail?.totalRemaining || 0;

    const spendableAllocated = spendableCats.reduce(
        (s, c) => s + c.allocated_amount,
        0,
    );
    const spendableSpent = spendableCats.reduce(
        (s, c) => s + (c.actualSpent || 0),
        0,
    );
    const spendableRemaining = spendableAllocated - spendableSpent;
    const savingsCats = allocationCats.filter((c) =>
        isSavingsCategory(c.category),
    );
    const baseSavings = savingsCats.reduce((s, c) => s + c.allocated_amount, 0);

    return (
        <div
            className={`space-y-5 ${!embedded ? "pb-20 md:pb-12" : ""} ${className}`.trim()}
        >
            {/* Top Header Section */}
            {!embedded ? (
                <PageHeader
                    title="Budget"
                    actions={
                        <div
                            className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto"
                            data-testid="budget-header-actions"
                        >
                            <div className="w-full sm:w-auto">
                                <MonthPicker
                                    selectedMonth={selectedMonth}
                                    onChangeMonth={setSelectedMonth}
                                />
                            </div>

                            <Button
                                variant="secondary"
                                leftIcon={
                                    <Settings
                                        className="h-4 w-4 text-slate-500"
                                        strokeWidth={2.5}
                                    />
                                }
                                onClick={() => handleOpenEditor()}
                                className="w-full sm:w-auto min-h-11 sm:min-h-0 shrink-0 justify-center"
                            >
                                Edit Budget
                            </Button>
                        </div>
                    }
                />
            ) : (
                <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    data-testid="budget-header-actions"
                >
                    <div className="w-full sm:w-auto">
                        <MonthPicker
                            selectedMonth={selectedMonth}
                            onChangeMonth={setSelectedMonth}
                        />
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={
                            <Settings
                                className="h-3.5 w-3.5 text-slate-500"
                                strokeWidth={2.5}
                            />
                        }
                        onClick={() => handleOpenEditor()}
                        className="w-full sm:w-auto min-h-11 sm:min-h-0 shrink-0 justify-center"
                    >
                        Edit Budget
                    </Button>
                </div>
            )}

            {/* Category Limit Warning Banner (Guardrails) */}
            <CategoryLimitWarningBanner
                categories={budgetDetail?.categories || []}
            />

            {/* High-Level Budget Hero Card */}
            <div
                className={
                    budgetPlaceholder
                        ? "space-y-5 opacity-60 transition-opacity"
                        : "space-y-5 transition-opacity"
                }
            >
                <StatCard
                    title={totalRemaining < 0 ? "Over" : "Left"}
                    loading={isLoading}
                    value={
                        <CurrencyText
                            formatted={formatSGD(Math.abs(totalRemaining), {
                                showCents: false,
                            })}
                        />
                    }
                    badge={
                        totalRemaining < 0 ? (
                            <Badge variant="over">Over</Badge>
                        ) : (
                            <Badge variant="ok">On Track</Badge>
                        )
                    }
                    tooltip={`Take-home pool of ${formatSGD(disposablePool)} minus ${formatSGD(totalSpent)} spent.`}
                    icon={<Wallet className="h-4 w-4" />}
                    iconBg="bg-(--pastel-mint-light) text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    footer={
                        disposablePool > 0 ? (
                            <MeterBar
                                value={totalSpent}
                                max={disposablePool}
                                size="md"
                                aria-label="Monthly budget spent"
                            />
                        ) : undefined
                    }
                />

                {/* Loading Indicator */}
                {isLoading ? (
                    <BudgetContentSkeleton />
                ) : (
                    <>
                        {/* Section: Spendable Category Spending Meters (Food, Lifestyle, Transport, Buffer) */}
                        <div className="space-y-3">
                            <CategoriesHeader
                                remaining={spendableRemaining}
                                allocated={spendableAllocated}
                                spent={spendableSpent}
                            />

                            {categories.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
                                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                                        <Tag className="h-5 w-5" />
                                    </div>
                                    <h3 className="mt-2.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                                        No Categories
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-(--text-faint)">
                                        Add categories or restore presets to
                                        start tracking.
                                    </p>
                                    <div className="mt-3 flex items-center justify-center gap-2.5">
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => handleOpenEditor()}
                                        >
                                            Add Category
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                                await financeService.seedDefaultCategories();
                                                await handleCategoriesChanged();
                                            }}
                                        >
                                            Presets
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <CategoryProgressList
                                    categories={
                                        spendableCats.length > 0
                                            ? spendableCats
                                            : budgetDetail?.categories || []
                                    }
                                />
                            )}

                            <UncategorizedRecurringRow
                                amount={
                                    budgetDetail?.uncategorizedRecurringSpent ??
                                    0
                                }
                                items={
                                    budgetDetail?.uncategorizedRecurringItems
                                }
                            />
                        </div>

                        {/* Cumulative Spending Surplus / Deficit Card */}
                        <CumulativeSurplusCard
                            selectedMonth={selectedMonth}
                            memberId={
                                perspective !== "household" && activeMember
                                    ? activeMember.id
                                    : undefined
                            }
                            perspective={perspective}
                        />

                        {savingsCats.length > 0 && (
                            <SavingsBreakdownCard
                                baseSavings={baseSavings}
                                spendableAllocated={spendableAllocated}
                                spendableSpent={spendableSpent}
                            />
                        )}

                        {/* Collapsible: Wealth & Fixed Allocations (Savings, Investments, Tithing) */}
                        {allocationCats.length > 0 && (
                            <CollapsibleSection
                                title="Allocations"
                                subtitle={`${formatSGD(
                                    allocationCats.reduce(
                                        (s, c) => s + c.allocated_amount,
                                        0,
                                    ),
                                    { showCents: false },
                                )}/mo`}
                                icon={
                                    <PiggyBank className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                                }
                                defaultOpen={false}
                            >
                                <CategoryProgressList
                                    categories={allocationCats}
                                    compact
                                />
                            </CollapsibleSection>
                        )}

                        {/* Collapsible: Budget Waterfall Breakdown */}
                        <CollapsibleSection
                            title="Income Flow"
                            icon={
                                <DollarSign className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                            }
                            defaultOpen={true}
                        >
                            <BudgetWaterfall
                                budget={budgetDetail?.budget}
                                categories={budgetDetail?.categories}
                                bonusSummary={budgetDetail?.bonusSummary}
                                onEditProfile={() => handleOpenEditor()}
                                onViewBonus={handleViewBonus}
                            />
                        </CollapsibleSection>
                    </>
                )}
            </div>

            {/* Unified Budget & Categories Editor Modal */}
            {activeProfile && (
                <BudgetEditorModal
                    isOpen={isEditorOpen}
                    onClose={() => setIsEditorOpen(false)}
                    profile={activeProfile}
                    allocations={activeAllocations}
                    categories={categories}
                    members={members}
                    recurringItems={recurringItemsData || []}
                    onManageRecurring={() =>
                        onNavigateTab
                            ? onNavigateTab("recurring")
                            : typeof window !== "undefined"
                              ? window.location.assign("/plan?tab=recurring")
                              : undefined
                    }
                    initialTaxes={budgetDetail?.budget.taxes_deduction}
                    initialInsurance={budgetDetail?.budget.insurance_deduction}
                    monthlyBudgetId={
                        perspective !== "household" &&
                        budgetDetail?.budget.id &&
                        isValidUuid(budgetDetail.budget.id)
                            ? budgetDetail.budget.id
                            : undefined
                    }
                    selectedMonth={selectedMonth}
                    onSaveSuccess={handleProfileSaved}
                    onCategoriesChanged={handleCategoriesChanged}
                    onSelectMember={(memberId) =>
                        setEditingProfileMemberId(memberId)
                    }
                />
            )}
        </div>
    );
}

export default BudgetPage;
