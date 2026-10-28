/**
 * UpdateBalanceModal Component
 * Streamlined, search-enabled balance update modal:
 * - Supports single-account quick edit (when `account` is passed)
 * - Supports multi-account batch update with instant change-detection (no checkboxes required)
 * - Instant search filter + Category filter pills
 * - Only modified accounts are saved
 * - Smooth entry/exit animations via AnimatedModal
 */

import React, { useState, useEffect, useMemo } from "react";
import {
    Search,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Landmark,
    Plus,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";
import type { Account, BulkBalanceUpdateItem } from "../../types/finance";
import { financeService } from "../../services/financeService";
import { formatSGD } from "../../lib/currency";
import { getTodayDateString } from "../../lib/dateUtils";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { TruncatedText } from "../ui/TruncatedText";

export interface UpdateBalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    account?: Account | null;
    accounts?: Account[];
    onBalanceUpdated?: (updatedAccount: Account) => void;
    onBalancesUpdated?: (updatedAccounts: Account[]) => void;
    onOpenAddAccount?: () => void;
}

export function UpdateBalanceModal({
    isOpen,
    onClose,
    account,
    accounts,
    onBalanceUpdated,
    onBalancesUpdated,
    onOpenAddAccount,
}: UpdateBalanceModalProps) {
    const accountsList = useMemo(() => accounts || [], [accounts]);

    // Common states
    const [date, setDate] = useState<string>(getTodayDateString());
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Single-account state
    const [singleBalance, setSingleBalance] = useState<string>("");
    const [singleNotes, setSingleNotes] = useState<string>("");

    // Multi-account states
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [balancesMap, setBalancesMap] = useState<Record<string, string>>({});
    const [notesMap, setNotesMap] = useState<Record<string, string>>({});
    const [typeFilter, setTypeFilter] = useState<
        "All" | "Cash" | "Investment" | "CPF"
    >("All");

    const isMultiMode = !account;

    // Initialize state when modal opens or target changes
    useEffect(() => {
        if (!isOpen) return;

        setDate(getTodayDateString());
        setError(null);
        setIsSubmitting(false);
        setSearchQuery("");

        if (account) {
            setSingleBalance(account.balance.toString());
            setSingleNotes(account.notes || "");
        } else if (accountsList.length > 0) {
            const bMap: Record<string, string> = {};
            const nMap: Record<string, string> = {};
            accountsList.forEach((a) => {
                bMap[a.id] = a.balance.toString();
                nMap[a.id] = a.notes || "";
            });
            setBalancesMap(bMap);
            setNotesMap(nMap);
        }
    }, [isOpen, account, accountsList]);

    // Filtered accounts for multi-mode (Search + Type Filter)
    const filteredAccounts = useMemo(() => {
        return accountsList.filter((a) => {
            const matchesType = typeFilter === "All" || a.type === typeFilter;
            const q = searchQuery.trim().toLowerCase();
            const matchesSearch =
                !q ||
                a.name.toLowerCase().includes(q) ||
                (a.institution && a.institution.toLowerCase().includes(q)) ||
                a.type.toLowerCase().includes(q);
            return matchesType && matchesSearch;
        });
    }, [accountsList, typeFilter, searchQuery]);

    // Identify modified accounts across all accounts
    const modifiedAccounts = useMemo(() => {
        return accountsList.filter((a) => {
            const currentVal = a.balance;
            const rawEntered = balancesMap[a.id];
            if (rawEntered === undefined) return false;
            const parsed = parseFloat(rawEntered);
            if (isNaN(parsed)) return false;
            const balanceChanged = Math.abs(parsed - currentVal) >= 0.01;
            const notesChanged =
                (notesMap[a.id] || "").trim() !== (a.notes || "").trim();
            return balanceChanged || notesChanged;
        });
    }, [accountsList, balancesMap, notesMap]);

    // --- Handlers for Single Mode ---
    const handleSingleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!account) return;

        const parsedBalance = parseFloat(singleBalance);
        if (isNaN(parsedBalance)) {
            setError("Please enter a valid numeric balance");
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            const trimmedNotes = singleNotes.trim();
            const updatedAccount = await financeService.updateAccountBalance(
                account.id,
                parsedBalance,
                trimmedNotes,
                date || getTodayDateString(),
            );

            onBalanceUpdated?.(updatedAccount);
            onClose();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to update account balance",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Handlers for Multi Mode ---
    const handleMultiSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (modifiedAccounts.length === 0) {
            setError("No balance changes detected to save.");
            return;
        }

        const updates: BulkBalanceUpdateItem[] = [];
        for (const acc of modifiedAccounts) {
            const rawVal = balancesMap[acc.id];
            const parsed = parseFloat(rawVal);
            if (isNaN(parsed)) {
                setError(
                    `Invalid balance for ${acc.name}. Please enter numbers only.`,
                );
                return;
            }

            updates.push({
                accountId: acc.id,
                balance: parsed,
                newBalance: parsed,
                notes: notesMap[acc.id]?.trim() || undefined,
            });
        }

        try {
            setIsSubmitting(true);
            setError(null);

            const snapshotDate = date || getTodayDateString();
            const updatedAccounts =
                await financeService.bulkUpdateAccountBalances(
                    updates,
                    snapshotDate,
                );

            onBalancesUpdated?.(updatedAccounts);
            if (updatedAccounts.length > 0) {
                onBalanceUpdated?.(updatedAccounts[0]);
            }
            onClose();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to update balances",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // Empty state when 0 accounts exist
    if (isMultiMode && accountsList.length === 0) {
        if (!onOpenAddAccount) return null;
        return (
            <AnimatedModal
                isOpen={isOpen}
                onClose={onClose}
                maxWidth="max-w-md"
            >
                <div className="p-6 text-center space-y-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-(--pastel-butter-light) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm">
                        <Landmark className="h-6 w-6" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-(--text-ink) font-display">
                            No Accounts Found
                        </h3>
                        <p className="text-xs text-(--text-muted) mt-1">
                            Add your first bank account or CPF to start tracking
                            balances.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onOpenAddAccount();
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-(--text-ink) bg-(--pastel-lilac) border-2 border-(--border-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                    >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                        <span>Add First Account</span>
                    </button>
                </div>
            </AnimatedModal>
        );
    }

    // RENDER: Single Account Mode
    if (account) {
        return (
            <AnimatedModal
                isOpen={isOpen}
                onClose={onClose}
                maxWidth="max-w-md"
            >
                <form
                    onSubmit={handleSingleSubmit}
                    className="flex flex-col min-h-0 flex-1 overflow-hidden"
                >
                    <ModalHeader
                        id="single-modal-title"
                        title="Update Account Balance"
                        subtitle={`${account.name} ${account.institution ? `(${account.institution})` : ""}`}
                        icon={<Landmark className="h-4.5 w-4.5" strokeWidth={2.5} />}
                        iconBgColor="bg-(--pastel-butter-light)"
                        onClose={onClose}
                    />

                    <ModalBody>
                        {error && (
                            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-medium">
                                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div>
                            <label
                                htmlFor="single-balance-input"
                                className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                            >
                                New Balance (S$)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-(--text-muted) select-none">
                                    S$
                                </span>
                                <input
                                    id="single-balance-input"
                                    type="number"
                                    step="0.01"
                                    value={singleBalance}
                                    onChange={(e) =>
                                        setSingleBalance(e.target.value)
                                    }
                                    placeholder="0.00"
                                    required
                                    autoFocus
                                    className="w-full pl-11 pr-3.5 py-2.5 rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) text-base font-bold font-mono-num focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>
                            <p className="text-[11px] text-(--text-muted) mt-1.5">
                                Previous:{" "}
                                <span className="font-bold text-(--text-ink)">
                                    {formatSGD(account.balance)}
                                </span>
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label
                                    htmlFor="single-date-input"
                                    className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                                >
                                    Snapshot Date
                                </label>
                                <input
                                    id="single-date-input"
                                    type="date"
                                    value={date}
                                    onChange={(e) =>
                                        setDate(e.target.value)
                                    }
                                    className="w-full px-3 py-2 rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-xs font-medium text-(--text-ink) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="single-notes-input"
                                    className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                                >
                                    Notes (Optional)
                                </label>
                                <input
                                    id="single-notes-input"
                                    type="text"
                                    value={singleNotes}
                                    onChange={(e) =>
                                        setSingleNotes(e.target.value)
                                    }
                                    placeholder="e.g. Salary credited"
                                    className="w-full px-3 py-2 rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>
                        </div>
                    </ModalBody>

                    <ModalFooter>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black text-(--text-ink) bg-(--pastel-lilac) border-2 border-(--border-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Save Balance</span>
                                </>
                            )}
                        </button>
                    </ModalFooter>
                </form>
            </AnimatedModal>
        );
    }

    // RENDER: Multi-Account Batch Update Mode
    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                {/* Header */}
                <ModalHeader
                    id="multi-modal-title"
                    title="Update Account Balances"
                    subtitle="Type directly into any balance. Only modified accounts will be saved."
                    icon={<Landmark className="h-4.5 w-4.5" strokeWidth={2.5} />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                {/* Search, Filter Pills & Date */}
                <div className="px-4 sm:px-5 py-2.5 bg-(--bg-card) border-b border-(--border-subtle) flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                    {/* Search bar */}
                    <div className="relative flex-1 min-w-40 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Search accounts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-1 focus:ring-(--pastel-lilac)"
                        />
                    </div>

                    {/* Type Filters */}
                    <div className="flex items-center gap-1">
                        {(["All", "Cash", "Investment", "CPF"] as const).map(
                            (cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setTypeFilter(cat)}
                                    className={`px-2.5 py-1 rounded-xl text-[11px] border transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                                        typeFilter === cat
                                            ? "bg-(--pastel-lilac) text-(--text-ink) border-(--border-ink) shadow-cute-sm font-bold"
                                            : "bg-(--bg-canvas) text-(--text-muted) border-(--border-subtle) hover:border-(--border-ink) hover:text-(--text-ink) font-semibold"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ),
                        )}
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                            Date:
                        </span>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="px-2 py-1 rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-xs font-medium text-(--text-ink) focus:outline-none focus:ring-1 focus:ring-(--pastel-lilac)"
                        />
                    </div>
                </div>

                {/* Change Counter Banner */}
                <div className="px-4 sm:px-5 py-1.5 bg-(--bg-canvas) border-b border-(--border-subtle) flex items-center justify-between text-xs shrink-0">
                    <span className="text-[11px] font-bold text-(--text-muted)">
                        Showing {filteredAccounts.length} of{" "}
                        {accountsList.length} accounts
                    </span>
                    <span className="text-[11px] font-black text-(--text-ink) bg-(--pastel-butter-light) px-2 py-0.5 rounded-full border border-(--border-ink)">
                        {modifiedAccounts.length} modified
                    </span>
                </div>

                {/* Accounts List */}
                <ModalBody className="p-4 sm:p-5 space-y-2">
                    {error && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-medium">
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                            <span>{error}</span>
                        </div>
                    )}

                    {filteredAccounts.length === 0 ? (
                        <div className="text-center py-8 text-xs text-(--text-muted)">
                            No accounts match "{searchQuery}"
                        </div>
                    ) : (
                        filteredAccounts.map((acc) => {
                            const currentVal = acc.balance;
                            const enteredVal = parseFloat(
                                balancesMap[acc.id] || "0",
                            );
                            const isModified =
                                !isNaN(enteredVal) &&
                                Math.abs(enteredVal - currentVal) >= 0.01;
                            const diff = !isNaN(enteredVal)
                                ? enteredVal - currentVal
                                : 0;

                            return (
                                <div
                                    key={acc.id}
                                    className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 ${
                                        isModified
                                            ? "border-2 border-(--border-ink) bg-(--pastel-butter-light)/40 shadow-cute-sm"
                                            : "border border-(--border-subtle) hover:border-(--border-ink) bg-(--bg-card)"
                                    }`}
                                >
                                    {/* Account Name & Info */}
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="h-7 w-7 rounded-xl bg-(--bg-canvas) border border-(--border-subtle) flex items-center justify-center text-xs shrink-0">
                                            {acc.type === "Cash"
                                                ? "💵"
                                                : acc.type === "Investment"
                                                  ? "📈"
                                                  : "🏛️"}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <TruncatedText
                                                    text={acc.name}
                                                    className="text-xs sm:text-sm font-bold text-(--text-ink)"
                                                />
                                                {acc.is_joint && (
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-(--pastel-lilac-light) text-(--text-ink) border border-(--border-ink) shrink-0">
                                                        Joint
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-(--text-muted) flex items-center gap-1.5 font-medium mt-0.5">
                                                <span>
                                                    {acc.institution ||
                                                        acc.type}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    Prev:{" "}
                                                    <span className="font-mono-num font-bold">
                                                        {formatSGD(currentVal)}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Input & Delta Indicator */}
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                        {/* Delta Pill */}
                                        {isModified ? (
                                            <span
                                                className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-(--border-ink) shadow-cute-sm ${
                                                    diff > 0
                                                        ? "bg-(--pastel-sage-light) text-(--text-ink)"
                                                        : "bg-(--pastel-coral-light) text-(--text-ink)"
                                                }`}
                                            >
                                                {diff > 0 ? (
                                                    <ArrowUpRight className="h-3 w-3" />
                                                ) : (
                                                    <ArrowDownRight className="h-3 w-3" />
                                                )}
                                                {diff > 0 ? "+" : ""}
                                                {formatSGD(diff)}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-(--text-muted) opacity-40 hidden sm:inline">
                                                —
                                            </span>
                                        )}

                                        {/* Numeric Input */}
                                        <div className="relative w-32 sm:w-36">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-(--text-muted) select-none">
                                                S$
                                            </span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={
                                                    balancesMap[acc.id] ?? ""
                                                }
                                                onChange={(e) =>
                                                    setBalancesMap((prev) => ({
                                                        ...prev,
                                                        [acc.id]:
                                                            e.target.value,
                                                    }))
                                                }
                                                placeholder="0.00"
                                                className={`w-full pl-8 pr-2.5 py-1.5 rounded-xl border text-right text-xs font-bold font-mono-num transition-all focus:outline-none focus:ring-1 focus:ring-(--pastel-lilac) ${
                                                    isModified
                                                        ? "border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink)"
                                                        : "border border-(--border-subtle) hover:border-(--border-ink) bg-(--bg-canvas) text-(--text-ink)"
                                                }`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </ModalBody>

                {/* Footer Actions */}
                <ModalFooter className="justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleMultiSubmit}
                        disabled={isSubmitting || modifiedAccounts.length === 0}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black text-(--text-ink) bg-(--pastel-lilac) border-2 border-(--border-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>
                                    {modifiedAccounts.length > 0
                                        ? `Save ${modifiedAccounts.length} Modified Account${modifiedAccounts.length === 1 ? "" : "s"}`
                                        : "No Changes to Save"}
                                </span>
                            </>
                        )}
                    </button>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
}

export default UpdateBalanceModal;
