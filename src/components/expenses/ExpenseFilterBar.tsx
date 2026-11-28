/**
 * Expense Filter Bar
 * Allows filtering and sorting expense ledger by:
 * - Search keyword (merchant / item description / remarks) with instant dismiss button
 * - Mobile-friendly compact sub-bar with Filter drawer toggle & Sort selector
 * - Inline collapsible drawer for Category, Payer, Type/Split, and Month selectors
 * - Dismissible active filter chips strip
 * - Responsive desktop layout with inline Search, Sort, and filter grid
 * - "Clear all" text button (in the chips row) when search, filters or sort are active
 */

import {
    useState,
    useMemo,
    useRef,
    useEffect,
    useCallback,
    type ChangeEvent,
} from "react";
import {
    Search,
    Filter,
    ArrowUpDown,
    ChevronDown,
    ChevronUp,
    X,
} from "lucide-react";
import type {
    Category,
    HouseholdMember,
    ExpenseFilter,
    ExpenseSortField,
    SortDirection,
} from "../../types/finance";
import { useLazyMockDefaults } from "../../hooks/useLazyMockDefaults";
import { isMockModeActive } from "../../services/financeService";
import {
    MultiSelect,
    Select,
    categoryToSelectOption,
    memberToSelectOption,
    type SelectOption,
} from "../ui/dropdown";
import { getFilterCategoryIds } from "../../lib/expenseFilter";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { formatShortMonth } from "../../lib/dateUtils";
import { useCurrentMonth } from "../../hooks/useCurrentMonth";

export const EXPENSE_SEARCH_DEBOUNCE_MS = 250;

const DESKTOP_SORT_OPTIONS: SelectOption[] = [
    { value: "date-desc", label: "Newest" },
    { value: "date-asc", label: "Oldest" },
    { value: "amount-desc", label: "Highest" },
    { value: "amount-asc", label: "Lowest" },
    { value: "category-asc", label: "Category (A-Z)" },
    { value: "payer-asc", label: "Payer (A-Z)" },
];

const MOBILE_SORT_OPTIONS: SelectOption[] = [
    { value: "date-desc", label: "Date (Newest)" },
    { value: "date-asc", label: "Date (Oldest)" },
    { value: "amount-desc", label: "Amount (Highest)" },
    { value: "amount-asc", label: "Amount (Lowest)" },
    { value: "category-asc", label: "Category (A-Z)" },
    { value: "payer-asc", label: "Payer (A-Z)" },
];

const SHARED_OPTIONS: SelectOption[] = [
    { value: "all", label: "All Expenses" },
    { value: "shared", label: "Shared (50/50)" },
    { value: "personal", label: "Personal Only" },
];

export interface ExpenseFilterBarProps {
    filter: ExpenseFilter;
    onFilterChange: (newFilter: ExpenseFilter) => void;
    categories?: Category[];
    members?: HouseholdMember[];
    onReset?: () => void;
    /** Restores the default sort order (used by "Clear all"). */
    onSortReset?: () => void;
    className?: string;
    sortBy?: ExpenseSortField | null;
    sortOrder?: SortDirection;
    onSortChange?: (field: ExpenseSortField, order: SortDirection) => void;
    embeddedInCard?: boolean;
}

export function ExpenseFilterBar({
    filter,
    onFilterChange,
    categories: propCategories,
    members: propMembers,
    onReset,
    onSortReset,
    className = "",
    sortBy,
    sortOrder = "desc",
    onSortChange,
    embeddedInCard = false,
}: ExpenseFilterBarProps) {
    const isMock = isMockModeActive();
    const { categories: mockCategories, members: mockMembers } =
        useLazyMockDefaults(isMock && (!propCategories || !propMembers));
    const categories = useMemo(
        () => propCategories ?? (isMock ? mockCategories : []),
        [propCategories, isMock, mockCategories],
    );
    const members = useMemo(
        () => propMembers ?? (isMock ? mockMembers : []),
        [propMembers, isMock, mockMembers],
    );
    const categoryOptions = useMemo<SelectOption[]>(
        () => categories.map(categoryToSelectOption),
        [categories],
    );
    const payerOptions = useMemo<SelectOption[]>(
        () => members.map(memberToSelectOption),
        [members],
    );
    const selectedCategoryIds = useMemo(
        () => getFilterCategoryIds(filter),
        [filter],
    );
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    const currentMonth = useCurrentMonth();

    const [searchText, setSearchText] = useState<string>(filter.search || "");
    const [prevPropSearch, setPrevPropSearch] = useState<string>(
        filter.search || "",
    );
    if ((filter.search || "") !== prevPropSearch) {
        setPrevPropSearch(filter.search || "");
        setSearchText(filter.search || "");
    }

    const latestRef = useRef({ filter, onFilterChange });

    useEffect(() => {
        latestRef.current = { filter, onFilterChange };
    });

    useEffect(() => {
        const currentSearch = latestRef.current.filter.search || "";
        if (searchText === currentSearch) return;
        const timer = setTimeout(() => {
            latestRef.current.onFilterChange({
                ...latestRef.current.filter,
                search: searchText,
            });
        }, EXPENSE_SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchText]);

    const handleSortValueChange = (value: string) => {
        if (!value) {
            onSortChange?.("date", "desc");
            return;
        }
        const [field, order] = value.split("-") as [
            ExpenseSortField,
            SortDirection,
        ];
        onSortChange?.(field, order);
    };

    const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSearchText(e.target.value);
    };

    const handleClearSearch = useCallback(() => {
        setSearchText("");
        onFilterChange({ ...filter, search: "" });
    }, [filter, onFilterChange]);

    const handleCategoryChange = (values: string[]) => {
        onFilterChange({
            ...filter,
            categoryIds: values.length > 0 ? values : undefined,
            categoryId: undefined,
        });
    };

    const handlePayerChange = (value: string) => {
        onFilterChange({
            ...filter,
            payerId: value ? value : undefined,
        });
    };

    const handleSharedChange = (val: string) => {
        let isShared: boolean | undefined = undefined;
        if (val === "shared") isShared = true;
        if (val === "personal") isShared = false;

        onFilterChange({
            ...filter,
            isShared,
        });
    };

    const handleMonthChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        onFilterChange({
            ...filter,
            month: value ? value : undefined,
        });
    };

    const handleResetClick = () => {
        setSearchText("");
        if (isSortActive) {
            if (onSortReset) onSortReset();
            else onSortChange?.("date", "desc");
        }
        if (onReset) {
            onReset();
        } else {
            onFilterChange({
                search: "",
                categoryIds: undefined,
                categoryId: undefined,
                payerId: undefined,
                isShared: undefined,
                month: undefined,
                tag: undefined,
            });
        }
    };

    // Newest-first (or no explicit sort) is the default order
    const isSortActive = Boolean(
        sortBy && !(sortBy === "date" && sortOrder === "desc"),
    );

    // Calculate active filter count for the badge
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filter.search?.trim()) count++;
        if (selectedCategoryIds.length > 0) count++;
        if (filter.payerId) count++;
        if (filter.isShared !== undefined) count++;
        if (filter.month && filter.month !== currentMonth) count++;
        if (filter.tag) count++;
        return count;
    }, [filter, currentMonth]);

    const hasActiveFilters = Boolean(
        filter.search ||
        selectedCategoryIds.length > 0 ||
        filter.payerId ||
        filter.isShared !== undefined ||
        (filter.month && filter.month !== currentMonth) ||
        filter.tag,
    );

    const showClearAll =
        hasActiveFilters || isSortActive || searchText.trim().length > 0;

    // Active filter chips
    const activeChips = useMemo(() => {
        const chips: Array<{
            id: string;
            label: string;
            onRemove: () => void;
        }> = [];

        if (filter.search?.trim()) {
            chips.push({
                id: "search",
                label: `"${filter.search.trim()}"`,
                onRemove: handleClearSearch,
            });
        }

        for (const categoryId of selectedCategoryIds) {
            const cat = categories.find((c) => c.id === categoryId);
            chips.push({
                id: `category-${categoryId}`,
                label: cat ? cat.name : "Category",
                onRemove: () =>
                    handleCategoryChange(
                        selectedCategoryIds.filter((id) => id !== categoryId),
                    ),
            });
        }

        if (filter.payerId) {
            const mem = members.find((m) => m.id === filter.payerId);
            chips.push({
                id: "payer",
                label: mem ? mem.display_name : "Payer",
                onRemove: () =>
                    onFilterChange({ ...filter, payerId: undefined }),
            });
        }

        if (filter.isShared !== undefined) {
            chips.push({
                id: "shared",
                label: filter.isShared ? "Shared (50/50)" : "Personal",
                onRemove: () =>
                    onFilterChange({ ...filter, isShared: undefined }),
            });
        }

        if (filter.month && filter.month !== currentMonth) {
            chips.push({
                id: "month",
                label: formatShortMonth(filter.month),
                onRemove: () => onFilterChange({ ...filter, month: undefined }),
            });
        }

        if (filter.tag) {
            chips.push({
                id: "tag",
                label: `#${filter.tag}`,
                onRemove: () => onFilterChange({ ...filter, tag: undefined }),
            });
        }

        return chips;
    }, [
        filter,
        categories,
        members,
        onFilterChange,
        currentMonth,
        handleClearSearch,
    ]);

    const containerStyle = embeddedInCard
        ? `w-full min-w-0 transition-colors ${className}`
        : `w-full min-w-0 overflow-hidden rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 shadow-cute-sm transition-colors ${className}`;

    return (
        <div className={containerStyle}>
            <div className="space-y-2.5">
                {/* Row 1: Search Input (full width on mobile, flex-1 beside Sort on desktop) */}
                <div className="flex items-center gap-2">
                    {/* Search Input */}
                    <div className="min-w-0 flex-1">
                        <Input
                            id="filter-search"
                            type="text"
                            sizeVariant="sm"
                            className="min-h-11"
                            leftIcon={<Search className="h-4 w-4" />}
                            placeholder="Search merchant, item, note..."
                            value={searchText}
                            onChange={handleSearchChange}
                            rightElement={
                                searchText || filter.search ? (
                                    <button
                                        type="button"
                                        aria-label="Dismiss search"
                                        onClick={handleClearSearch}
                                        className="relative flex h-5 w-5 items-center justify-center rounded-full after:absolute after:-inset-3 after:content-[''] bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-(--text-muted) hover:text-(--text-ink) text-xs font-bold cursor-pointer transition-colors"
                                    >
                                        <X className="h-3 w-3 stroke-3" />
                                    </button>
                                ) : undefined
                            }
                        />
                    </div>

                    {/* Desktop Sort Dropdown */}
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <ArrowUpDown className="h-3.5 w-3.5 text-(--text-muted) shrink-0" />
                        <Select
                            aria-label="Sort ledger"
                            value={
                                sortBy ? `${sortBy}-${sortOrder || "desc"}` : ""
                            }
                            onValueChange={handleSortValueChange}
                            placeholder="Default order"
                            clearable
                            sizeVariant="sm"
                            className="min-h-11"
                            containerClassName="w-48"
                            options={DESKTOP_SORT_OPTIONS}
                        />
                    </div>
                </div>

                {/* Mobile Row 2: Filter Drawer Toggle Button & Quick Sort Selector */}
                <div className="sm:hidden flex items-center gap-2">
                    <button
                        type="button"
                        aria-expanded={isMobileFilterOpen}
                        aria-label="Toggle filters"
                        onClick={() => setIsMobileFilterOpen((prev) => !prev)}
                        className={`flex-1 inline-flex items-center justify-between gap-1.5 min-h-11 rounded-xl border-2 border-(--border-ink) px-3 text-base sm:text-xs font-bold transition-press cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                            activeFilterCount > 0
                                ? "bg-(--pastel-lilac-light) text-(--text-ink) shadow-cute-sm"
                                : "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light)"
                        }`}
                    >
                        <div className="flex items-center gap-1.5">
                            <Filter
                                className="h-3.5 w-3.5 text-purple-700 dark:text-purple-300"
                                strokeWidth={2.5}
                            />
                            <span>Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-(--pastel-lilac) border border-(--border-ink) text-2xs font-black text-(--text-on-pastel)">
                                    {activeFilterCount}
                                </span>
                            )}
                        </div>
                        {isMobileFilterOpen ? (
                            <ChevronUp
                                className="h-4 w-4 text-(--text-muted)"
                                strokeWidth={2.5}
                            />
                        ) : (
                            <ChevronDown
                                className="h-4 w-4 text-(--text-muted)"
                                strokeWidth={2.5}
                            />
                        )}
                    </button>

                    <div className="min-w-0 flex-1">
                        <Select
                            aria-label="Sort ledger"
                            value={
                                sortBy ? `${sortBy}-${sortOrder || "desc"}` : ""
                            }
                            onValueChange={handleSortValueChange}
                            placeholder="Sort"
                            clearable
                            sizeVariant="sm"
                            className="min-h-11"
                            containerClassName="w-full"
                            options={MOBILE_SORT_OPTIONS}
                        />
                    </div>
                </div>

                {/* Filter Controls (Collapsible drawer on mobile, always visible grid on desktop) */}
                <div
                    className={`${isMobileFilterOpen ? "block" : "hidden sm:block"} pt-2.5 border-t border-(--border-subtle)`}
                >
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                        {/* Category Select */}
                        <div className="min-w-0">
                            <MultiSelect
                                id="filter-category"
                                label="Category"
                                value={selectedCategoryIds}
                                onValueChange={handleCategoryChange}
                                options={categoryOptions}
                                placeholder="All Categories"
                                sizeVariant="sm"
                            />
                        </div>

                        {/* Payer Select */}
                        {members.length > 0 && (
                            <div className="min-w-0">
                                <Select
                                    id="filter-payer"
                                    label="Payer"
                                    value={filter.payerId || ""}
                                    onValueChange={handlePayerChange}
                                    options={payerOptions}
                                    placeholder="All Payers"
                                    clearable
                                    sizeVariant="sm"
                                />
                            </div>
                        )}

                        {/* Shared Split Select */}
                        <div className="min-w-0">
                            <Select
                                id="filter-shared"
                                label="Type / Split"
                                value={
                                    filter.isShared === undefined
                                        ? "all"
                                        : filter.isShared
                                          ? "shared"
                                          : "personal"
                                }
                                onValueChange={handleSharedChange}
                                options={SHARED_OPTIONS}
                                sizeVariant="sm"
                            />
                        </div>

                        {/* Month Selector */}
                        <div className="min-w-0">
                            <Input
                                id="filter-month"
                                label="Month"
                                type="month"
                                sizeVariant="sm"
                                mono
                                value={filter.month || ""}
                                onChange={handleMonthChange}
                                className="cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Active Filter Chips Strip */}
                {showClearAll && (
                    <div className="pt-2 border-t border-(--border-subtle) flex flex-wrap items-center gap-1.5">
                        {activeChips.length > 0 && (
                            <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mr-0.5">
                                Active:
                            </span>
                        )}
                        {activeChips.map((chip) => (
                            <span
                                key={chip.id}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-(--pastel-lilac-light) text-(--text-ink) border border-(--border-ink) shadow-cute-sm"
                            >
                                <span>{chip.label}</span>
                                <button
                                    type="button"
                                    aria-label={`Remove filter ${chip.label}`}
                                    onClick={chip.onRemove}
                                    className="text-(--text-ink) hover:text-rose-600 text-sm font-black cursor-pointer leading-none ml-0.5"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetClick}
                            aria-label="Clear all filters and sort"
                            className="ml-auto min-h-11"
                        >
                            Clear all
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ExpenseFilterBar;
