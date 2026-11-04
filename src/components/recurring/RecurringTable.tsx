/**
 * RecurringTable Component
 * Table displaying recurring insurance recurring items, taxes, and subscriptions.
 * Features:
 * - Columns: Policy Name, Type badge, Insured/Owner, Frequency, Premium Amount, Monthly Amortized Outflow, Renewal Month, Actions
 * - Search by recurring item name or notes
 * - Filter by recurring item type (All, Insurance, Tax, Subscription)
 * - Empty state with clear filters option
 * - Edit and Delete actions
 */

import { useState, useMemo } from "react";
import {
    Shield,
    FileText,
    Repeat,
    Pencil,
    Trash2,
    Search,
    AlertCircle,
    HelpCircle,
} from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { MONTH_NAMES_SHORT as MONTH_NAMES } from "../../lib/dateUtils";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { TruncatedText } from "../ui/TruncatedText";
import type { RecurringItem, RecurringItemType } from "../../types/finance";

export interface RecurringTableProps {
    recurringItems: RecurringItem[];
    onEdit?: (recurringItem: RecurringItem) => void;
    onDelete?: (itemId: string) => void;
    className?: string;
}

export function RecurringTable({
    recurringItems,
    onEdit,
    onDelete,
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

    // Type badge styling
    const renderTypeBadge = (type: RecurringItemType) => {
        switch (type) {
            case "insurance":
                return (
                    <span
                        role="status"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink)"
                    >
                        <Shield className="w-3 h-3 text-purple-600 dark:text-purple-300" />
                        Insurance
                    </span>
                );
            case "tax":
                return (
                    <span
                        role="status"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-(--pastel-butter) text-(--text-ink) border-2 border-(--border-ink)"
                    >
                        <FileText className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                        Tax
                    </span>
                );
            case "subscription":
                return (
                    <span
                        role="status"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-(--pastel-mint) text-(--text-ink) border-2 border-(--border-ink)"
                    >
                        <Repeat className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                        Subscription
                    </span>
                );
            default:
                return (
                    <span
                        role="status"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-(--bg-cream) text-(--text-ink) border-2 border-(--border-ink)"
                    >
                        <HelpCircle className="w-3 h-3" />
                        {type}
                    </span>
                );
        }
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
                        placeholder="Search recurring items or notes..."
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
                        { id: "insurance", label: "Insurance" },
                        { id: "tax", label: "Tax" },
                        { id: "subscription", label: "Subscription" },
                    ]}
                    activeTab={selectedType}
                    onChange={(typeId) => setSelectedType(typeId as "all" | RecurringItemType)}
                    accent="butter"
                    size="sm"
                    ariaLabel="Policy type filter"
                />
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute)">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b-2 border-(--border-ink) bg-(--bg-cream) text-xs font-bold text-(--text-ink) uppercase tracking-wider font-display">
                            <th scope="col" className="py-3.5 px-4">
                                Policy Name
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
                                Premium
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
                                        No recurring items found
                                    </p>
                                    <p className="text-xs text-(--text-muted) mt-1">
                                        Try adjusting your search query or
                                        filter selection.
                                    </p>
                                    {(searchTerm || selectedType !== "all") && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchTerm("");
                                                setSelectedType("all");
                                            }}
                                            className="mt-3 inline-flex items-center text-xs font-bold text-(--text-ink) underline cursor-pointer"
                                        >
                                            Clear active filters
                                        </button>
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
                                        {/* Policy Name & Notes */}
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
                                            {renderTypeBadge(recurringItem.type)}
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

                                        {/* Premium Amount */}
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
