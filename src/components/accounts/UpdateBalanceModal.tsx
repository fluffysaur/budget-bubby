/**
 * UpdateBalanceModal Component
 * Streamlined, search-enabled balance update modal:
 * - Supports single-account quick edit (when `account` is passed)
 * - Supports multi-account batch update with instant change-detection (no checkboxes required)
 * - Instant search filter + Category filter pills
 * - Only modified accounts are saved
 * - Smooth entry/exit animations via AnimatedModal
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    Search,
    CheckCircle2,
    Calendar,
    Landmark,
    Plus,
} from "lucide-react";
import type { Account, BulkBalanceUpdateItem } from "../../types/finance";
import {
    useUpdateAccountBalanceMutation,
    useBulkUpdateAccountBalancesMutation,
} from "../../hooks/finance/accounts";
import { getTodayDateString, MONTH_NAMES_SHORT } from "../../lib/dateUtils";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { TruncatedText } from "../ui/TruncatedText";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { CurrencyText } from "../ui/CurrencyText";
import { CurrencyInput } from "../ui/CurrencyInput";
import { Input } from "../ui/Input";
import { FilterChip } from "../ui/FilterChip";
import { DeltaBadge } from "../ui/DeltaBadge";
import { recordExercise } from "../../lib/bubby/activity";
import { feedback } from "../../lib/delight/feedback";

export interface UpdateBalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    account?: Account | null;
    accounts?: Account[];
    onBalanceUpdated?: (updatedAccount: Account) => void;
    onBalancesUpdated?: (updatedAccounts: Account[]) => void;
    onOpenAddAccount?: () => void;
}

const TYPE_FILTERS = ["All", "Cash", "Investment", "CPF"] as const;

/** "Today" for the current date, else a short "25 Nov" label. */
function formatChipDate(dateStr: string): string {
    if (!dateStr || dateStr === getTodayDateString()) return "Today";
    const [, month, day] = dateStr.split("-");
    const monthName = MONTH_NAMES_SHORT[parseInt(month, 10) - 1];
    if (!monthName) return dateStr;
    return `${parseInt(day, 10)} ${monthName}`;
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
    const updateBalanceMutation = useUpdateAccountBalanceMutation();
    const bulkUpdateBalancesMutation = useBulkUpdateAccountBalancesMutation();
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

    const singleBalanceRef = useRef<HTMLInputElement>(null);
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

    // The date input overlays the chip, so taps reach it natively (iOS opens
    // its picker); desktop browsers also get showPicker() where supported.
    const openDatePicker = (e: React.MouseEvent<HTMLInputElement>) => {
        try {
            e.currentTarget.showPicker?.();
        } catch {
            // Native focus/picker behaviour still applies.
        }
    };

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
            const updatedAccount = await updateBalanceMutation.mutateAsync({
                accountId: account.id,
                newBalance: parsedBalance,
                notes: trimmedNotes,
                snapshotDate: date || getTodayDateString(),
            });

            feedback.routine("save");
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
                await bulkUpdateBalancesMutation.mutateAsync({
                    updates,
                    snapshotDate,
                });
            recordExercise("balances");
            feedback.routine("save");

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
                            No Accounts
                        </h3>
                        <p className="text-xs text-(--text-muted) mt-1">
                            Add an account to start tracking balances.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onOpenAddAccount();
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-(--text-ink) bg-(--pastel-lilac) border-2 border-(--border-ink) shadow-cute-sm hover:bg-(--text-ink) hover:text-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer"
                    >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                        <span>Add Account</span>
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
                initialFocusRef={singleBalanceRef}
            >
                <form
                    onSubmit={handleSingleSubmit}
                    className="flex flex-col min-h-0 flex-1 overflow-hidden"
                >
                    <ModalHeader
                        id="single-modal-title"
                        title="Update Account Balance"
                        subtitle={`${account.name} ${account.institution ? `(${account.institution})` : ""}`}
                        icon={
                            <Landmark
                                className="h-4.5 w-4.5"
                                strokeWidth={2.5}
                            />
                        }
                        iconBgColor="bg-(--pastel-butter-light)"
                        onClose={onClose}
                    />

                    <ModalBody>
                        {error && <Alert variant="danger">{error}</Alert>}

                        <div className="space-y-1.5">
                            <CurrencyInput
                                id="single-balance-input"
                                ref={singleBalanceRef}
                                label="Balance"
                                value={singleBalance}
                                onChange={(e) =>
                                    setSingleBalance(e.target.value)
                                }
                                required
                            />
                            <p className="text-xs text-(--text-muted)">
                                Previous:{" "}
                                <span className="text-(--text-ink)">
                                    <CurrencyText amount={account.balance} />
                                </span>
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                                id="single-date-input"
                                label="Snapshot Date"
                                type="date"
                                max={getTodayDateString()}
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                            <Input
                                id="single-notes-input"
                                label="Notes"
                                type="text"
                                value={singleNotes}
                                onChange={(e) =>
                                    setSingleNotes(e.target.value)
                                }
                                placeholder="e.g. Salary credited"
                            />
                        </div>
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={isSubmitting}
                            disabled={isSubmitting}
                            leftIcon={
                                <CheckCircle2
                                    className="h-4 w-4"
                                    strokeWidth={2.5}
                                />
                            }
                        >
                            Save Balance
                        </Button>
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
                    title="Update Balances"
                    icon={
                        <Landmark className="h-4.5 w-4.5" strokeWidth={2.5} />
                    }
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                {/* Search + date, then type filters */}
                <div className="px-4 sm:px-5 py-2.5 bg-(--bg-card) border-b border-(--border-subtle) space-y-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <Input
                            type="text"
                            aria-label="Search accounts"
                            placeholder="Search accounts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            sizeVariant="sm"
                            leftIcon={
                                <Search
                                    className="h-3.5 w-3.5"
                                    strokeWidth={2.5}
                                />
                            }
                            containerClassName="flex-1"
                        />
                        <label className="relative inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-2.5 text-xs font-bold text-(--text-ink) transition-press active:translate-x-0.5 active:translate-y-0.5 focus-within:ring-2 focus-within:ring-(--pastel-lilac)"
                        >
                            <Calendar
                                className="h-3.5 w-3.5 shrink-0"
                                strokeWidth={2.5}
                            />
                            <span>{formatChipDate(date)}</span>
                            <input
                                type="date"
                                aria-label="Balance date"
                                max={getTodayDateString()}
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                onClick={openDatePicker}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 text-base"
                            />
                        </label>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x">
                        {TYPE_FILTERS.map((cat) => (
                            <FilterChip
                                key={cat}
                                sizeVariant="sm"
                                selected={typeFilter === cat}
                                onClick={() => setTypeFilter(cat)}
                            >
                                {cat}
                            </FilterChip>
                        ))}
                    </div>
                </div>

                {/* Accounts List */}
                <ModalBody>
                    {error && <Alert variant="danger">{error}</Alert>}

                    {filteredAccounts.length === 0 ? (
                        <div className="text-center py-8 text-xs text-(--text-muted)">
                            No Matches
                        </div>
                    ) : (
                        <ul className="-mx-4 -my-2 sm:-mx-5 divide-y divide-(--border-subtle)">
                            {filteredAccounts.map((acc) => {
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
                                    <li
                                        key={acc.id}
                                        className={`flex items-center gap-2.5 px-4 sm:px-5 py-2 transition-colors ${
                                            isModified
                                                ? "bg-(--pastel-lilac-light)"
                                                : ""
                                        }`}
                                    >
                                        <div className="h-7 w-7 rounded-xl bg-(--bg-canvas) border border-(--border-subtle) flex items-center justify-center text-xs shrink-0">
                                            {acc.type === "Cash"
                                                ? "💵"
                                                : acc.type === "Investment"
                                                  ? "📈"
                                                  : "🏛️"}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <TruncatedText
                                                text={acc.name}
                                                className="text-xs sm:text-sm font-bold text-(--text-ink)"
                                            />
                                            <div className="mt-0.5 flex min-h-5 items-center text-2xs font-medium text-(--text-muted)">
                                                {isModified ? (
                                                    <DeltaBadge
                                                        value={diff}
                                                        goodWhen="up"
                                                        display={
                                                            <>
                                                                {diff > 0
                                                                    ? "+"
                                                                    : "-"}
                                                                <CurrencyText
                                                                    amount={Math.abs(
                                                                        diff,
                                                                    )}
                                                                />
                                                            </>
                                                        }
                                                    />
                                                ) : (
                                                    <span>
                                                        Prev{" "}
                                                        <CurrencyText
                                                            amount={currentVal}
                                                            tone="muted"
                                                        />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-32 shrink-0">
                                            <CurrencyInput
                                                aria-label={`Balance for ${acc.name}`}
                                                sizeVariant="sm"
                                                value={balancesMap[acc.id] ?? ""}
                                                onChange={(e) =>
                                                    setBalancesMap((prev) => ({
                                                        ...prev,
                                                        [acc.id]:
                                                            e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </ModalBody>

                {/* Footer Actions */}
                <ModalFooter className="justify-between">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleMultiSubmit}
                        isLoading={isSubmitting}
                        disabled={isSubmitting || modifiedAccounts.length === 0}
                        leftIcon={
                            <CheckCircle2
                                className="h-4 w-4"
                                strokeWidth={2.5}
                            />
                        }
                    >
                        {modifiedAccounts.length > 0
                            ? `Save ${modifiedAccounts.length}`
                            : "Save"}
                    </Button>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
}

export default UpdateBalanceModal;
