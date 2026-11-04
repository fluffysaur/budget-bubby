/**
 * RecurringTable Component
 * Table of recurring items: insurance, tax, subscriptions, bills and other.
 * Features:
 * - Columns: Name, Type badge, Owner, Frequency, Amount, Monthly Amortized, Due, Actions
 * - Search by recurring item name or notes
 * - Filter by type (All, Insurance, Tax, Subscription, Bill, Other)
 * - Empty states: no items (add CTA) and no matches (clear filters)
 * - Edit and Delete actions
 */

import { useState, useMemo } from "react";
import { Pencil, Trash2, Search, AlertCircle, Plus } from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { MONTH_NAMES_SHORT as MONTH_NAMES } from "../../lib/dateUtils";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { TruncatedText } from "../ui/TruncatedText";
import { Button } from "../ui/Button";
import { RecurringTypeBadge } from "./RecurringTypeBadge";
import {
    RECURRING_ITEM_TYPES,
    RECURRING_TYPE_LABELS,
} from "../../lib/recurringItems";
import type { RecurringItem, RecurringItemType } from "../../types/finance";

export interface RecurringTableProps {
    recurringItems: RecurringItem[];
    onEdit?: (recurringItem: RecurringItem) => void;
    onDelete?: (itemId: string) => void;
    /** Shown as the empty-state CTA when there are no items at all */
    onAdd?: () => void;
    className?: string;
}

export function RecurringTable({
    recurringItems,
    onEdit,
    onDelete,
    onAdd,
    className = "",
}: RecurringTableProps) {
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [selectedType, setSelectedType] = useState<
        "all" | RecurringItemType
    >("all");

    // Filtered recurring items
    const filteredItems = useMemo(() => {
        return recurringItems.filter((recurringItem) => {
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
    }, [recurringItems, selectedType, searchTerm]);

    const hasNoItems = recurringItems.length === 0;

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
        <div className={`space-y-4 ${className}`}>
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-ink)/50" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search name or notes..."
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border-2 border-(--border-ink) bg-white dark:bg-slate-900 text-(--color-ink) dark:text-white placeholder-slate-400 shadow-(--shadow-cute-sm) focus:outline-none focus:shadow-(--shadow-cute) transition-all"
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

                {/* Type filter */}
                <SegmentedTabs
                    tabs={[
                        { id: "all", label: "All" },
                        ...RECURRING_ITEM_TYPES.map((t) => ({
                            id: t,
                            label: RECURRING_TYPE_LABELS[t],
                        })),
                    ]}
                    activeTab={selectedType}
                    onChange={(typeId) => setSelectedType(typeId as "all" | RecurringItemType)}
                    accent="butter"
                    size="sm"
                    ariaLabel="Recurring type filter"
                />
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute)">
                <table className="w-full text-left border-collapse">
                    <thead>
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
                    <tbody className="divide-y-2 divide-(--border-ink) text-sm">
                        {filteredItems.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="py-12 text-center text-(--text-muted)"
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
                                              selectedType !== "all") && (
                                              <Button
                                                  variant="secondary"
                                                  size="sm"
                                                  className="mt-3"
                                                  onClick={() => {
                                                      setSearchTerm("");
                                                      setSelectedType("all");
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

                                return (
                                    <tr
                                        key={recurringItem.id}
                                        className="hover:bg-(--bg-cream)/70 transition-colors"
                                    >
                                        {/* Name & Notes */}
                                        <td className="py-3.5 px-4 font-bold text-(--color-ink) dark:text-white">
                                            <div className="min-w-0 max-w-65">
                                                <TruncatedText
                                                    text={recurringItem.name}
                                                    className="font-display font-bold"
                                                />
                                                {recurringItem.notes && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 font-normal">
                                                        {recurringItem.notes}
                                                    </p>
                                                )}
                                            </div>
                                        </td>

                                        {/* Type Badge */}
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <RecurringTypeBadge type={recurringItem.type} />
                                        </td>

                                        {/* Owner / Insured */}
                                        <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                            <span className="inline-flex items-center gap-2 font-bold">
                                                <span className="text-xs">
                                                    {ownerIcon}
                                                </span>
                                                {owner}
                                            </span>
                                        </td>

                                        {/* Frequency */}
                                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium capitalize">
                                            {recurringItem.frequency}
                                        </td>

                                        {/* Amount */}
                                        <td className="py-3 px-4 whitespace-nowrap text-right font-bold font-mono-num text-(--color-ink) dark:text-white">
                                            {formatSGD(recurringItem.amount)}
                                        </td>

                                        {/* Monthly Amortized Outflow */}
                                        <td className="py-3 px-4 whitespace-nowrap text-right text-slate-700 dark:text-slate-300 font-bold font-mono-num">
                                            {formatSGD(
                                                recurringItem.monthly_amortized_amount,
                                            )}
                                            <span className="text-xs text-slate-400 font-normal ml-0.5">
                                                /mo
                                            </span>
                                        </td>

                                        {/* Renewal Month */}
                                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
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
                                        <td className="py-3 px-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {onEdit && (
                                                    <button
                                                        type="button"
                                                        aria-label={`Edit ${recurringItem.name}`}
                                                        onClick={() =>
                                                            onEdit(recurringItem)
                                                        }
                                                        className="p-1.5 rounded-lg border-2 border-transparent hover:border-(--border-ink) hover:bg-(--pastel-butter) text-slate-600 hover:text-(--color-ink) transition-all cursor-pointer"
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
                                                        className="p-1.5 rounded-lg border-2 border-transparent hover:border-(--border-ink) hover:bg-(--pastel-coral-subtle) text-rose-500 hover:text-rose-700 transition-all cursor-pointer"
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
