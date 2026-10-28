/**
 * Expense Filter Bar
 * Allows filtering and sorting expense ledger by:
 * - Search keyword (merchant / item description / remarks) with instant dismiss button
 * - Mobile-friendly compact sub-bar with Filter drawer toggle & Sort selector
 * - Inline collapsible drawer for Category, Payer, Type/Split, and Month selectors
 * - Dismissible active filter chips strip
 * - Responsive desktop layout with inline Search, Sort, Reset, and filter grid
 */

import { useState, useMemo, type ChangeEvent } from "react";
import {
    Search,
    RotateCcw,
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
import { mockCategories, mockMembers } from "../../data/mockSeedData";
import { Select } from "../ui/Select";
import { formatShortMonth, getCurrentMonth } from "../../lib/dateUtils";

export interface ExpenseFilterBarProps {
    filter: ExpenseFilter;
    onFilterChange: (newFilter: ExpenseFilter) => void;
    categories?: Category[];
    members?: HouseholdMember[];
    onReset?: () => void;
    className?: string;
    sortBy?: ExpenseSortField | null;
    sortOrder?: SortDirection;
    onSortChange?: (field: ExpenseSortField, order: SortDirection) => void;
    embeddedInCard?: boolean;
}

export function ExpenseFilterBar({
    filter,
    onFilterChange,
    categories = mockCategories,
    members = mockMembers,
    onReset,
    className = "",
    sortBy,
    sortOrder = "desc",
    onSortChange,
    embeddedInCard = false,
}: ExpenseFilterBarProps) {
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

    const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
        onFilterChange({
            ...filter,
            search: e.target.value,
        });
    };

    const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        onFilterChange({
            ...filter,
            categoryId: value ? value : undefined,
        });
    };

    const handlePayerChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        onFilterChange({
            ...filter,
            payerId: value ? value : undefined,
        });
    };

    const handleSharedChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
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
        if (onReset) {
            onReset();
        } else {
            onFilterChange({
                search: "",
                categoryId: undefined,
                payerId: undefined,
                isShared: undefined,
                month: undefined,
                tag: undefined,
            });
        }
    };

    // Calculate active filter count for the badge
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filter.search?.trim()) count++;
        if (filter.categoryId) count++;
        if (filter.payerId) count++;
        if (filter.isShared !== undefined) count++;
        if (filter.month && filter.month !== getCurrentMonth()) count++;
        if (filter.tag) count++;
        return count;
    }, [filter]);

    const hasActiveFilters = Boolean(
        filter.search ||
        filter.categoryId ||
        filter.payerId ||
        filter.isShared !== undefined ||
        (filter.month && filter.month !== getCurrentMonth()) ||
        filter.tag,
    );

    // Active filter chips
    const activeChips = useMemo(() => {
        const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

        if (filter.search?.trim()) {
            chips.push({
                id: "search",
                label: `"${filter.search.trim()}"`,
                onRemove: () => onFilterChange({ ...filter, search: "" }),
            });
        }

        if (filter.categoryId) {
            const cat = categories.find((c) => c.id === filter.categoryId);
            chips.push({
                id: "category",
                label: cat ? cat.name : "Category",
                onRemove: () => onFilterChange({ ...filter, categoryId: undefined }),
            });
        }

        if (filter.payerId) {
            const mem = members.find((m) => m.id === filter.payerId);
            chips.push({
                id: "payer",
                label: mem ? mem.display_name : "Payer",
                onRemove: () => onFilterChange({ ...filter, payerId: undefined }),
            });
        }

        if (filter.isShared !== undefined) {
            chips.push({
                id: "shared",
                label: filter.isShared ? "Shared (50/50)" : "Personal",
                onRemove: () => onFilterChange({ ...filter, isShared: undefined }),
            });
        }

        if (filter.month && filter.month !== getCurrentMonth()) {
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
    }, [filter, categories, members, onFilterChange]);

    const containerStyle = embeddedInCard
        ? `w-full min-w-0 transition-colors ${className}`
        : `w-full min-w-0 overflow-hidden rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 shadow-(--shadow-cute-sm) transition-colors ${className}`;

    return (
        <div className={containerStyle}>
            <div className="space-y-2.5">
                {/* Row 1: Search Input (Full width on mobile with Reset icon, flex-1 on desktop) */}
                <div className="flex items-center gap-2">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--text-muted) pointer-events-none" />
                        <input
                            id="filter-search"
                            type="text"
                            placeholder="Search merchant, item, note..."
                            value={filter.search || ""}
                            onChange={handleSearchChange}
                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-9 pr-8 py-2 text-xs font-medium text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                        {filter.search && (
                            <button
                                type="button"
                                aria-label="Dismiss search"
                                onClick={() => onFilterChange({ ...filter, search: "" })}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-(--text-muted) hover:text-(--text-ink) text-xs font-bold cursor-pointer transition-colors"
                            >
                                <X className="h-3 w-3 stroke-[3]" />
                            </button>
                        )}
                    </div>

                    {/* Desktop Sort Dropdown */}
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <ArrowUpDown className="h-3.5 w-3.5 text-(--text-muted) shrink-0" />
                        <Select
                            aria-label="Sort ledger"
                            value={sortBy ? `${sortBy}-${sortOrder || "desc"}` : ""}
                            onChange={(e) => {
                                if (!e.target.value) {
                                    onSortChange?.("date", "desc");
                                    return;
                                }
                                const [field, order] = e.target.value.split("-") as [
                                    ExpenseSortField,
                                    SortDirection,
                                ];
                                onSortChange?.(field, order);
                            }}
                            sizeVariant="sm"
                            containerClassName="w-48"
                            className="bg-(--bg-canvas) font-bold text-xs py-1.5"
                        >
                            <option value="">Default order</option>
                            <option value="date-desc">Date (Newest first)</option>
                            <option value="date-asc">Date (Oldest first)</option>
                            <option value="amount-desc">Amount (Highest first)</option>
                            <option value="amount-asc">Amount (Lowest first)</option>
                            <option value="category-asc">Category (A-Z)</option>
                            <option value="payer-asc">Payer (A-Z)</option>
                        </Select>
                    </div>

                    {/* Single Unified Reset Button (Icon-only on mobile, Icon+Text on desktop) */}
                    <button
                        type="button"
                        onClick={handleResetClick}
                        title="Reset Filters"
                        aria-label="Reset filters"
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 px-3 sm:px-3.5 text-xs font-bold transition-all shrink-0 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                            hasActiveFilters
                                ? "border-(--border-ink) bg-(--pastel-coral-light) text-(--text-ink) shadow-(--shadow-cute-sm)"
                                : "border-(--border-ink) bg-(--bg-canvas) text-(--text-muted) hover:bg-(--pastel-butter-light)"
                        }`}
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Reset</span>
                    </button>
                </div>

                {/* Mobile Row 2: Filter Drawer Toggle Button & Quick Sort Selector */}
                <div className="sm:hidden flex items-center gap-2">
                    <button
                        type="button"
                        aria-expanded={isMobileFilterOpen}
                        aria-label="Toggle filters"
                        onClick={() => setIsMobileFilterOpen((prev) => !prev)}
                        className={`flex-1 inline-flex items-center justify-between gap-1.5 rounded-xl border-2 border-(--border-ink) px-3 py-2 text-xs font-bold transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                            activeFilterCount > 0
                                ? "bg-(--pastel-lilac-light) text-(--text-ink) shadow-(--shadow-cute-sm)"
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
                                <span className="flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-(--pastel-lilac) border border-(--border-ink) text-[10px] font-black text-(--text-ink)">
                                    {activeFilterCount}
                                </span>
                            )}
                        </div>
                        {isMobileFilterOpen ? (
                            <ChevronUp className="h-4 w-4 text-(--text-muted)" strokeWidth={2.5} />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-(--text-muted)" strokeWidth={2.5} />
                        )}
                    </button>

                    <div className="flex-1">
                        <Select
                            aria-label="Sort ledger"
                            value={sortBy ? `${sortBy}-${sortOrder || "desc"}` : ""}
                            onChange={(e) => {
                                if (!e.target.value) {
                                    onSortChange?.("date", "desc");
                                    return;
                                }
                                const [field, order] = e.target.value.split("-") as [
                                    ExpenseSortField,
                                    SortDirection,
                                ];
                                onSortChange?.(field, order);
                            }}
                            sizeVariant="sm"
                            className="bg-(--bg-canvas) font-bold text-xs py-2 w-full"
                        >
                            <option value="">Default order</option>
                            <option value="date-desc">Date (Newest)</option>
                            <option value="date-asc">Date (Oldest)</option>
                            <option value="amount-desc">Amount (Highest)</option>
                            <option value="amount-asc">Amount (Lowest)</option>
                            <option value="category-asc">Category (A-Z)</option>
                            <option value="payer-asc">Payer (A-Z)</option>
                        </Select>
                    </div>
                </div>

                {/* Filter Controls (Collapsible drawer on mobile, always visible grid on desktop) */}
                <div
                    className={`${isMobileFilterOpen ? "block" : "hidden sm:block"} pt-2.5 border-t border-(--border-subtle)`}
                >
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                        {/* Category Select */}
                        <div className="min-w-0">
                            <Select
                                id="filter-category"
                                label="Category"
                                labelClassName="text-[11px] mb-1 tracking-wider"
                                value={filter.categoryId || ""}
                                onChange={handleCategoryChange}
                                sizeVariant="sm"
                                className="bg-(--bg-canvas)"
                            >
                                <option value="">All Categories</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        {/* Payer Select */}
                        <div className="min-w-0">
                            <Select
                                id="filter-payer"
                                label="Payer"
                                labelClassName="text-[11px] mb-1 tracking-wider"
                                value={filter.payerId || ""}
                                onChange={handlePayerChange}
                                sizeVariant="sm"
                                className="bg-(--bg-canvas)"
                            >
                                <option value="">All Payers</option>
                                {members.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.display_name}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        {/* Shared Split Select */}
                        <div className="min-w-0">
                            <Select
                                id="filter-shared"
                                label="Type / Split"
                                labelClassName="text-[11px] mb-1 tracking-wider"
                                value={
                                    filter.isShared === undefined
                                        ? "all"
                                        : filter.isShared
                                          ? "shared"
                                          : "personal"
                                }
                                onChange={handleSharedChange}
                                sizeVariant="sm"
                                className="bg-(--bg-canvas)"
                            >
                                <option value="all">All Expenses</option>
                                <option value="shared">Shared (50/50)</option>
                                <option value="personal">Personal Only</option>
                            </Select>
                        </div>

                        {/* Month Selector */}
                        <div className="min-w-0">
                            <label
                                htmlFor="filter-month"
                                className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                            >
                                Month
                            </label>
                            <input
                                id="filter-month"
                                type="month"
                                value={filter.month || ""}
                                onChange={handleMonthChange}
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 pr-3.5 py-1.5 text-xs font-mono-num font-semibold text-(--text-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac) cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Active Filter Chips Strip */}
                {activeChips.length > 0 && (
                    <div className="pt-2 border-t border-(--border-subtle) flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mr-0.5">
                            Active:
                        </span>
                        {activeChips.map((chip) => (
                            <span
                                key={chip.id}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-(--pastel-lilac-light) text-(--text-ink) border border-(--border-ink) shadow-(--shadow-cute-sm)"
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
                    </div>
                )}
            </div>
        </div>
    );
}

export default ExpenseFilterBar;
