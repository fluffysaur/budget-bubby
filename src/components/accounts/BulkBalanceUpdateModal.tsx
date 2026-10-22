/**
 * BulkBalanceUpdateModal ("Month-End Check-In")
 * Allows updating all account balances for the end of the month in a single sheet.
 * Pre-fills each account with its last known balance so the user only changes
 * the accounts that moved, then saves all snapshots in one click.
 */

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { X, CalendarCheck2, Sparkles, Check, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { getTodayDateString } from "../../lib/dateUtils";
import { financeService } from "../../services/financeService";
import type { Account, BulkBalanceUpdateItem } from "../../types/finance";

export interface BulkBalanceUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    accounts: Account[];
    onBalancesUpdated?: (updatedAccounts: Account[]) => void;
}

export function BulkBalanceUpdateModal({ isOpen, onClose, accounts, onBalancesUpdated }: BulkBalanceUpdateModalProps) {
    const [snapshotDate, setSnapshotDate] = useState<string>(getTodayDateString());
    const [balancesMap, setBalancesMap] = useState<Record<string, string>>({});
    const [filterType, setFilterType] = useState<"all" | "non-cpf">("all");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Initialize balances from current account balances when opened
    useEffect(() => {
        if (isOpen) {
            const initialMap: Record<string, string> = {};
            for (const acc of accounts) {
                initialMap[acc.id] = String(acc.balance);
            }
            setBalancesMap(initialMap);
            setSnapshotDate(getTodayDateString());
            setErrorMessage(null);
            setIsSubmitting(false);
        }
    }, [isOpen, accounts]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const visibleAccounts = useMemo(() => {
        if (filterType === "non-cpf") {
            return accounts.filter((a) => a.type !== "CPF");
        }
        return accounts;
    }, [accounts, filterType]);

    // Calculate previous total vs new total
    const summary = useMemo(() => {
        let prevTotal = 0;
        let newTotal = 0;
        let changedCount = 0;

        for (const acc of accounts) {
            prevTotal += acc.balance;
            const parsed = parseFloat(balancesMap[acc.id] ?? String(acc.balance));
            const val = isNaN(parsed) ? acc.balance : parsed;
            newTotal += val;
            if (Math.abs(val - acc.balance) >= 0.01) {
                changedCount++;
            }
        }

        const delta = Math.round((newTotal - prevTotal) * 100) / 100;
        return {
            prevTotal: Math.round(prevTotal * 100) / 100,
            newTotal: Math.round(newTotal * 100) / 100,
            delta,
            changedCount,
        };
    }, [accounts, balancesMap]);

    if (!isOpen) return null;

    // Quick helper to add standard monthly CPF contribution (+S$1,200 OA, +S$450 SA, +S$350 MA)
    const handleAutoIncrementCpf = () => {
        setBalancesMap((prev) => {
            const next = { ...prev };
            for (const acc of accounts) {
                if (acc.type === "CPF") {
                    const currentVal = parseFloat(next[acc.id] ?? String(acc.balance)) || acc.balance;
                    const lower = acc.name.toLowerCase();
                    const increment = lower.includes("ordinary")
                        ? 1200
                        : lower.includes("special")
                          ? 450
                          : lower.includes("medisave")
                            ? 350
                            : 500;
                    next[acc.id] = (Math.round((currentVal + increment) * 100) / 100).toFixed(2);
                }
            }
            return next;
        });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        try {
            setIsSubmitting(true);
            const updates: BulkBalanceUpdateItem[] = accounts.map((acc) => {
                const raw = balancesMap[acc.id];
                const parsed = raw !== undefined ? parseFloat(raw) : acc.balance;
                if (isNaN(parsed) || parsed < 0) {
                    throw new Error(`Invalid balance entered for ${acc.name}`);
                }
                const rounded = Math.round(parsed * 100) / 100;
                return {
                    accountId: acc.id,
                    balance: rounded,
                    newBalance: rounded,
                    notes: `Month-end check-in (${snapshotDate})`,
                };
            });

            const updated = await financeService.bulkUpdateAccountBalances(updates, snapshotDate);
            onBalancesUpdated?.(updated);
            onClose();
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to update balances");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-balance-modal-title"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-xs"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="relative w-full max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800 max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                            <CalendarCheck2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h2
                                id="bulk-balance-modal-title"
                                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                            >
                                Month-End Balance Check-In
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Pre-filled with last balances — edit only what changed &amp; save all in 1 click
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close modal"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {errorMessage && (
                    <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 shrink-0">
                        {errorMessage}
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    className="mt-3.5 flex flex-col flex-1 min-h-0"
                >
                    {/* Controls Strip: Date, Filter, CPF Auto-Fill */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                        <div className="flex items-center gap-2">
                            <label
                                htmlFor="bulk-snapshot-date"
                                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                            >
                                Snapshot Date:
                            </label>
                            <input
                                id="bulk-snapshot-date"
                                type="date"
                                value={snapshotDate}
                                onChange={(e) => setSnapshotDate(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setFilterType("all")}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                        filterType === "all"
                                            ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                                            : "text-slate-500 dark:text-slate-400"
                                    }`}
                                >
                                    All ({accounts.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterType("non-cpf")}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                        filterType === "non-cpf"
                                            ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                                            : "text-slate-500 dark:text-slate-400"
                                    }`}
                                >
                                    Non-CPF ({accounts.filter((a) => a.type !== "CPF").length})
                                </button>
                            </div>

                            {accounts.some((a) => a.type === "CPF") && (
                                <button
                                    type="button"
                                    onClick={handleAutoIncrementCpf}
                                    className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50/70 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300 cursor-pointer"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    <span>+ Monthly CPF</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable Account Rows */}
                    <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 max-h-[50vh]">
                        {visibleAccounts.map((acc) => {
                            const currentInput = balancesMap[acc.id] ?? String(acc.balance);
                            const parsed = parseFloat(currentInput);
                            const diff = !isNaN(parsed) ? Math.round((parsed - acc.balance) * 100) / 100 : 0;

                            return (
                                <div
                                    key={acc.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-3.5 py-2.5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                                {acc.name}
                                            </span>
                                            <span className="rounded-md bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                                {acc.type}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            <span>Prev: {formatSGD(acc.balance)}</span>
                                            {Math.abs(diff) >= 0.01 && (
                                                <span
                                                    className={`inline-flex items-center font-semibold ${
                                                        diff > 0
                                                            ? "text-emerald-600 dark:text-emerald-400"
                                                            : "text-rose-600 dark:text-rose-400"
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
                                            )}
                                        </div>
                                    </div>

                                    <div className="relative w-36 sm:w-44 shrink-0">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                            S$
                                        </span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            aria-label={`Balance for ${acc.name}`}
                                            value={currentInput}
                                            onChange={(e) =>
                                                setBalancesMap((prev) => ({ ...prev, [acc.id]: e.target.value }))
                                            }
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-8 pr-3 text-right text-sm font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Live Total Preview & Submit Footer */}
                    <div className="pt-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 dark:text-slate-400 block">New Total Assets</span>
                                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                                    {formatSGD(summary.newTotal)}
                                </span>
                            </div>
                            <div className="h-7 w-px bg-slate-200 dark:bg-slate-800" />
                            <div>
                                <span className="text-slate-500 dark:text-slate-400 block">Net Change</span>
                                <span
                                    className={`text-sm font-bold ${
                                        summary.delta >= 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-rose-600 dark:text-rose-400"
                                    }`}
                                >
                                    {summary.delta >= 0 ? "+" : ""}
                                    {formatSGD(summary.delta)} ({summary.changedCount} edited)
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-600 disabled:opacity-50 transition-all cursor-pointer"
                            >
                                <Check className="h-4 w-4 stroke-[2.5]" />
                                <span>{isSubmitting ? "Saving Snapshot..." : "Save Month-End Snapshot"}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default BulkBalanceUpdateModal;
