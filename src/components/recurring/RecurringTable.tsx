/**
 * RecurringTable Component
 * Table of recurring items: insurance, tax, subscriptions, bills and other.
 * Features:
 * - Columns: Name, Type badge, Owner, Frequency, Amount, Monthly Amortized, Due, Actions
 * - Optional title with a count that follows the filters ("7 of 9 items")
 * - Search by recurring item name or notes
 * - Type and Status dropdowns (Status defaults to Active; Active includes not-yet-started)
 * - Ended items dimmed with an "Ended" badge; future items show "Starts Mon 'YY"
 * - Stacked rows on mobile, table from sm up
 * - Empty states: no items (add CTA) and no matches (clear filters)
 * - Edit and Delete actions
 */

import { useState, useMemo } from "react";
import { Pencil, Trash2, Search, AlertCircle, Plus } from "lucide-react";
import {
    formatMonth,
    getSingaporeDate,
    MONTH_NAMES_SHORT as MONTH_NAMES,
} from "../../lib/dateUtils";
import { Select } from "../ui/Select";
import { TruncatedText } from "../ui/TruncatedText";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { RecurringTypeBadge } from "./RecurringTypeBadge";
import {
    getRecurringItemStatus,
    RECURRING_ITEM_TYPES,
    RECURRING_TYPE_LABELS,
    type RecurringItemStatus,
} from "../../lib/recurringItems";
import type { RecurringItem, RecurringItemType } from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";

export interface RecurringTableProps {
    recurringItems: RecurringItem[];
    onEdit?: (recurringItem: RecurringItem) => void;
    onDelete?: (itemId: string) => void;
    /** Shown as the empty-state CTA when there are no items at all */
    onAdd?: () => void;
    className?: string;
    /** Heading shown above the filters, with the filtered item count */
    title?: string;
    /** Overrides "today" (Singapore time) for Active / Ended status. */
    referenceDate?: Date;
}

type StatusFilter = "active" | "ended" | "all";

function formatStartsLabel(startDate: string): string {
    const [y, m] = formatMonth(startDate).split("-");
    return `Starts ${MONTH_NAMES[Number(m) - 1]} '${y.slice(2)}`;
}

export function RecurringTable({
    recurringItems,
    onEdit,
    onDelete,
    onAdd,
    className = "",
    referenceDate,
    title,
}: RecurringTableProps) {
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [selectedType, setSelectedType] = useState<"all" | RecurringItemType>(
        "all",
    );
    const [selectedStatus, setSelectedStatus] =
        useState<StatusFilter>("active");

    // Status of each item as of this month
    const statusById = useMemo(() => {
        const month = formatMonth(referenceDate ?? getSingaporeDate());
        const map = new Map<string, RecurringItemStatus>();
        for (const item of recurringItems) {
            map.set(item.id, getRecurringItemStatus(item, month));
        }
        return map;
    }, [recurringItems, referenceDate]);

    // Filtered recurring items
    const filteredItems = useMemo(() => {
        return recurringItems.filter((recurringItem) => {
            // Status filter (Active includes not-yet-started items)
            const isEnded = statusById.get(recurringItem.id) === "ended";
            if (selectedStatus === "active" && isEnded) return false;
            if (selectedStatus === "ended" && !isEnded) return false;

            // Type filter
            if (selectedType !== "all" && recurringItem.type !== selectedType) {
                return false;
            }

            // Search term
            if (searchTerm.trim()) {
                const query = searchTerm.toLowerCase();
                const matchesName = recurringItem.name.toLowerCase().includes(query);
                const matchesNotes =
                    recurringItem.notes?.toLowerCase().includes(query) ?? false;
                if (!matchesName && !matchesNotes) {
                    return false;
                }
            }

            return true;
        });
    }, [recurringItems, selectedType, selectedStatus, searchTerm, statusById]);

    const hasNoItems = recurringItems.length === 0;
    const totalCount = recurringItems.length;
    const shownCount = filteredItems.length;
    const countLabel =
        shownCount === totalCount
            ? `${totalCount} ${totalCount === 1 ? "item" : "items"}`
            : `${shownCount} of ${totalCount} items`;

    // Helper for owner label
    const getOwnerLabel = (ownerId: string) => {
        if (
            ownerId.includes("0011") ||
            ownerId.toLowerCase().includes("yj") ||
            ownerId.toLowerCase().includes("yijia")
        ) {
            return "Yi Jia";
        }
        if (
            ownerId.includes("0012") ||
            ownerId.toLowerCase().includes("rc") ||
            ownerId.toLowerCase().includes("rachel")
        ) {
            return "Rachel";
        }
        return "Joint";
    };

    return (
        <div className={`space-y-3 ${className}`}>
            {title && (
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-(--text-ink) font-display">
                        {title}
                    </h2>
                    <span className="shrink-0 text-xs font-bold text-(--text-muted)">
                        {countLabel}
                    </span>
                </div>
            )}

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {/* Search input */}
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-ink)/50" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search name or notes..."
                        className="w-full pl-9 pr-4 py-2 text-base sm:text-sm rounded-xl border-2 border-(--border-ink) bg-white dark:bg-slate-900 text-(--color-ink) dark:text-white placeholder-slate-400 shadow-cute-sm focus:outline-none focus:shadow-cute transition-press"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-(--color-ink)/50 hover:text-(--color-ink) dark:hover:text-white"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Type & Status filters */}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                    <Select
                        aria-label="Type filter"
                        sizeVariant="sm"
                        containerClassName="sm:w-40"
                        value={selectedType}
                        onChange={(e) =>
                            setSelectedType(
                                e.target.value as "all" | RecurringItemType,
                            )
                        }
                    >
                        <option value="all">All types</option>
                        {RECURRING_ITEM_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {RECURRING_TYPE_LABELS[t]}
                            </option>
                        ))}
                    </Select>
                    <Select
                        aria-label="Status filter"
                        sizeVariant="sm"
                        containerClassName="sm:w-32"
                        value={selectedStatus}
                        onChange={(e) =>
                            setSelectedStatus(e.target.value as StatusFilter)
                        }
                    >
                        <option value="active">Active</option>
                        <option value="ended">Ended</option>
                        <option value="all">All</option>
                    </Select>
                </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-cute">
                <table className="w-full text-left border-collapse block sm:table">
                    <thead className="hidden sm:table-header-group">
                        <tr className="border-b-2 border-(--border-ink) bg-(--bg-cream) text-xs font-bold text-(--text-ink) uppercase tracking-wider font-display">
                            <th scope="col" className="py-3.5 px-4">
                                Name
                            </th>
                            <th scope="col" className="py-3.5 px-4">
                                Type
                            </th>
                            <th scope="col" className="py-3.5 px-4">
                                Owner
                            </th>
                            <th scope="col" className="py-3.5 px-4">
                                Frequency
                            </th>
                            <th scope="col" className="py-3.5 px-4 text-right">
                                Amount
                            </th>
                            <th scope="col" className="py-3.5 px-4 text-right">
                                Monthly Amortized
                            </th>
                            <th scope="col" className="py-3.5 px-4">
                                Renewal
                            </th>
                            <th scope="col" className="py-3.5 px-4 text-right">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-(--border-ink) text-sm block sm:table-row-group">
                        {filteredItems.length === 0 ? (
                            <tr className="block sm:table-row">
                                <td
                                    colSpan={8}
                                    className="block sm:table-cell py-12 px-4 text-center text-(--text-muted)"
                                >
                                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />
                                    <p className="font-bold text-base text-(--text-ink) font-display">
                                        {hasNoItems
                                            ? "Nothing Recurring"
                                            : "No Matches"}
                                    </p>
                                    <p className="text-xs text-(--text-muted) mt-1">
                                        {hasNoItems
                                            ? "Add a bill or subscription to start tracking."
                                            : "Try another search or filter."}
                                    </p>
                                    {hasNoItems
                                        ? onAdd && (
                                              <Button
                                                  variant="primary"
                                                  size="sm"
                                                  className="mt-3"
                                                  leftIcon={
                                                      <Plus
                                                          className="w-3.5 h-3.5"
                                                          strokeWidth={2.5}
                                                      />
                                                  }
                                                  onClick={onAdd}
                                              >
                                                  Add Recurring
                                              </Button>
                                          )
                                        : (searchTerm ||
                                              selectedType !== "all" ||
                                              selectedStatus !== "all") && (
                                              <Button
                                                  variant="secondary"
                                                  size="sm"
                                                  className="mt-3"
                                                  onClick={() => {
                                                      setSearchTerm("");
                                                      setSelectedType("all");
                                                      setSelectedStatus("all");
                                                  }}
                                              >
                                                  Clear Filters
                                              </Button>
                                          )}
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((recurringItem) => {
                                const isMonthly =
                                    recurringItem.frequency === "monthly";
                                const renewalMonthText = isMonthly
                                    ? "Monthly"
                                    : recurringItem.payment_month &&
                                        recurringItem.payment_month >= 1 &&
                                        recurringItem.payment_month <= 12
                                      ? `${MONTH_NAMES[recurringItem.payment_month - 1]} (M${recurringItem.payment_month})`
                                      : "N/A";
                                const owner = getOwnerLabel(recurringItem.owner_id);
                                const ownerIcon =
                                    owner === "Yi Jia"
                                        ? "👨"
                                        : owner === "Rachel"
                                          ? "👩"
                                          : "👥";

                                const status = statusById.get(recurringItem.id);
                                const isEnded = status === "ended";

                                return (
                                    <tr
                                        key={recurringItem.id}
                                        className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 p-3 sm:p-0 sm:table-row hover:bg-(--bg-cream)/70 transition-colors ${
                                            isEnded ? "opacity-60" : ""
                                        }`}
                                    >
                                        {/* Name & Notes */}
                                        <td className="order-1 w-full min-w-0 sm:w-auto sm:table-cell sm:py-3.5 sm:px-4 font-bold text-(--color-ink) dark:text-white">
                                            <div className="flex items-start gap-2">
                                                <div className="min-w-0 flex-1 sm:max-w-65">
                                                    <TruncatedText
                                                        text={
                                                            recurringItem.name
                                                        }
                                                        className="font-display font-bold"
                                                    />
                                                    {recurringItem.notes && (
                                                        <p className="text-xs text-slate-500 dark:text-(--text-faint) line-clamp-1 font-normal">
                                                            {
                                                                recurringItem.notes
                                                            }
                                                        </p>
                                                    )}
                                                    {(isEnded ||
                                                        (status ===
                                                            "upcoming" &&
                                                            recurringItem.start_date)) && (
                                                        <div className="mt-1">
                                                            {isEnded ? (
                                                                <Badge
                                                                    variant="slate"
                                                                    size="sm"
                                                                >
                                                                    Ended
                                                                </Badge>
                                                            ) : (
                                                                <Badge
                                                                    variant="lilac"
                                                                    size="sm"
                                                                >
                                                                    {formatStartsLabel(
                                                                        recurringItem.start_date!,
                                                                    )}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Amount (mobile) */}
                                                <span className="sm:hidden shrink-0">
                                                    <CurrencyText
                                                        amount={
                                                            recurringItem.amount
                                                        }
                                                    />
                                                </span>
                                            </div>
                                        </td>

                                        {/* Type Badge */}
                                        <td className="order-3 inline-flex sm:table-cell sm:py-3 sm:px-4 whitespace-nowrap">
                                            <RecurringTypeBadge
                                                type={recurringItem.type}
                                            />
                                        </td>

                                        {/* Owner / Insured */}
                                        <td className="order-6 inline-flex sm:table-cell sm:py-3 sm:px-4 whitespace-nowrap text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                                            <span className="inline-flex items-center gap-1 sm:gap-2 font-bold">
                                                <span className="text-xs">
                                                    {ownerIcon}
                                                </span>
                                                {owner}
                                            </span>
                                        </td>

                                        {/* Frequency */}
                                        <td className="order-4 hidden sm:table-cell sm:py-3 sm:px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium capitalize">
                                            {recurringItem.frequency}
                                        </td>

                                        {/* Amount */}
                                        <td className="hidden sm:table-cell py-3 px-4 whitespace-nowrap text-right text-(--color-ink) dark:text-white">
                                            <CurrencyText
                                                amount={recurringItem.amount}
                                            />
                                        </td>

                                        {/* Monthly Amortized Outflow */}
                                        <td className="hidden sm:table-cell py-3 px-4 whitespace-nowrap text-right text-slate-700 dark:text-slate-300 font-bold font-mono-num">
                                            <CurrencyText
                                                amount={
                                                    recurringItem.monthly_amortized_amount
                                                }
                                            />
                                            <span className="text-xs text-(--text-faint) font-normal ml-0.5">
                                                /mo
                                            </span>
                                        </td>

                                        {/* Renewal Month */}
                                        <td className="order-5 inline-flex sm:table-cell sm:py-3 sm:px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border-2 border-(--border-ink) ${
                                                    isMonthly
                                                        ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                        : "bg-(--pastel-mint-subtle) text-emerald-900 dark:text-emerald-200"
                                                }`}
                                            >
                                                {renewalMonthText}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="order-7 ml-auto inline-flex sm:table-cell sm:py-3 sm:px-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {onEdit && (
                                                    <button
                                                        type="button"
                                                        aria-label={`Edit ${recurringItem.name}`}
                                                        onClick={() =>
                                                            onEdit(recurringItem)
                                                        }
                                                        className="p-1.5 rounded-lg border-2 border-transparent hover:border-(--border-ink) hover:bg-(--pastel-butter) text-slate-600 hover:text-(--color-ink) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer"
                                                        title="Edit recurring item"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        type="button"
                                                        aria-label={`Delete ${recurringItem.name}`}
                                                        onClick={() =>
                                                            onDelete(recurringItem.id)
                                                        }
                                                        className="p-1.5 rounded-lg border-2 border-transparent hover:border-(--border-ink) hover:bg-(--pastel-coral-subtle) text-rose-500 hover:text-rose-700 active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer"
                                                        title="Delete recurring item"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default RecurringTable;
