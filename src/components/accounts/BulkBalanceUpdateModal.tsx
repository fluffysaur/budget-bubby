/**
 * BulkBalanceUpdateModal ("Month-End Check-In")
 * Allows updating all account balances for the end of the month in a single sheet.
 * Pre-fills each account with its last known balance so the user only changes
 * the accounts that moved, then saves all snapshots in one click.
 */

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { CalendarCheck2, Sparkles, Check, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { getTodayDateString } from "../../lib/dateUtils";
import { financeService } from "../../services/financeService";
import type { Account, BulkBalanceUpdateItem } from "../../types/finance";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";

export interface BulkBalanceUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    accounts: Account[];
    onBalancesUpdated?: (updatedAccounts: Account[]) => void;
}

export function BulkBalanceUpdateModal({
    isOpen,
    onClose,
    accounts,
    onBalancesUpdated,
}: BulkBalanceUpdateModalProps) {
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
            const currentEntered = balancesMap[acc.id];
            const parsed = parseFloat(currentEntered !== undefined ? currentEntered : String(acc.balance));
            const valid = !isNaN(parsed) ? parsed : acc.balance;
            newTotal += valid;
            if (Math.abs(valid - acc.balance) >= 0.01) {
                changedCount += 1;
            }
        }

        return {
            prevTotal,
            newTotal,
            delta: newTotal - prevTotal,
            changedCount,
        };
    }, [accounts, balancesMap]);

    const handleBalanceChange = (accountId: string, value: string) => {
        setBalancesMap((prev) => ({
            ...prev,
            [accountId]: value,
        }));
    };

    // Quick Action: Auto-add CPF contributions for OA/SA/MA
    const handleAutoIncrementCpf = () => {
        setBalancesMap((prev) => {
            const next = { ...prev };
            for (const acc of accounts) {
                if (acc.type === "CPF") {
                    const current = parseFloat(next[acc.id] || String(acc.balance)) || 0;
                    const increment = acc.name.includes("OA")
                        ? 1200
                        : acc.name.includes("SA")
                          ? 400
                          : 350;
                    next[acc.id] = (current + increment).toFixed(2);
                }
            }
            return next;
        });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const updates: BulkBalanceUpdateItem[] = [];

        for (const acc of accounts) {
            const entered = balancesMap[acc.id];
            if (entered !== undefined && entered.trim() !== "") {
                const numeric = parseFloat(entered);
                if (isNaN(numeric) || numeric < 0) {
                    setErrorMessage(`Please enter a valid balance for ${acc.name}`);
                    return;
                }
                if (Math.abs(numeric - acc.balance) >= 0.01) {
                    updates.push({
                        accountId: acc.id,
                        balance: numeric,
                    });
                }
            }
        }

        if (updates.length === 0) {
            onClose();
            return;
        }

        try {
            setIsSubmitting(true);
            const updated = await financeService.bulkUpdateAccountBalances(updates, snapshotDate);
            onBalancesUpdated?.(updated);
            onClose();
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to save balance snapshots");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    id="bulk-balance-modal-title"
                    title="Month-End Check-In"
                    subtitle="Pre-filled with last balances — edit only what changed & save all"
                    icon={<CalendarCheck2 className="h-4.5 w-4.5 stroke-[2.5]" />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {errorMessage && (
                        <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            {errorMessage}
                        </div>
                    )}

                    {/* Controls Strip: Date, Filter, CPF Auto-Fill */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-(--border-subtle)">
                        <div className="flex items-center gap-2">
                            <label
                                htmlFor="bulk-snapshot-date"
                                className="text-xs font-bold text-(--text-muted)"
                            >
                                Snapshot Date:
                            </label>
                            <input
                                id="bulk-snapshot-date"
                                type="date"
                                value={snapshotDate}
                                onChange={(e) => setSnapshotDate(e.target.value)}
                                className="rounded-lg border-2 border-(--border-ink) bg-(--bg-canvas) px-2.5 py-1 text-xs font-mono-num font-medium text-(--text-ink)"
                            />
                        </div>

                        <div className="flex items-center gap-1.5">
                            <div className="inline-flex rounded-lg bg-(--bg-canvas) p-0.5 border border-(--border-subtle)">
                                <button
                                    type="button"
                                    onClick={() => setFilterType("all")}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                        filterType === "all"
                                            ? "bg-(--pastel-lilac) text-(--text-ink) shadow-cute-sm"
                                            : "text-(--text-muted) hover:text-(--text-ink)"
                                    }`}
                                >
                                    All ({accounts.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterType("non-cpf")}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                        filterType === "non-cpf"
                                            ? "bg-(--pastel-lilac) text-(--text-ink) shadow-cute-sm"
                                            : "text-(--text-muted) hover:text-(--text-ink)"
                                    }`}
                                >
                                    Non-CPF ({accounts.filter((a) => a.type !== "CPF").length})
                                </button>
                            </div>

                            {accounts.some((a) => a.type === "CPF") && (
                                <button
                                    type="button"
                                    onClick={handleAutoIncrementCpf}
                                    className="inline-flex items-center gap-1 rounded-lg border border-(--border-ink) bg-(--pastel-butter-light) px-2.5 py-1 text-xs font-bold text-(--text-ink) hover:bg-(--pastel-butter) cursor-pointer"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    <span>+ CPF</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Account Rows */}
                    <div className="space-y-2.5">
                        {visibleAccounts.map((account) => {
                            const entered = balancesMap[account.id] ?? String(account.balance);
                            const numericEntered = parseFloat(entered);
                            const isChanged = !isNaN(numericEntered) && Math.abs(numericEntered - account.balance) >= 0.01;
                            const diff = !isNaN(numericEntered) ? numericEntered - account.balance : 0;

                            return (
                                <div
                                    key={account.id}
                                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                        isChanged
                                            ? "border-(--border-ink) bg-(--pastel-butter-light) shadow-cute-sm"
                                            : "border-(--border-subtle) bg-(--bg-card)"
                                    }`}
                                >
                                    <div className="min-w-0 flex-1 mr-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-(--text-ink) truncate">
                                                {account.name}
                                            </span>
                                            {account.is_joint && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-(--pastel-lilac) text-(--text-ink)">
                                                    Joint
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-(--text-muted)">
                                            <span>{account.type}</span>
                                            <span>•</span>
                                            <span className="font-mono-num">Last: {formatSGD(account.balance)}</span>
                                            {isChanged && (
                                                <span
                                                    className={`inline-flex items-center font-bold font-mono-num ${
                                                        diff >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                                                    }`}
                                                >
                                                    {diff >= 0 ? (
                                                        <ArrowUpRight className="h-3 w-3" />
                                                    ) : (
                                                        <ArrowDownRight className="h-3 w-3" />
                                                    )}
                                                    {formatSGD(Math.abs(diff))}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-32 relative shrink-0">
                                        <span className="absolute left-2.5 top-2 text-xs font-bold text-(--text-muted)">
                                            S$
                                        </span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={entered}
                                            onChange={(e) =>
                                                handleBalanceChange(account.id, e.target.value)
                                            }
                                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) py-1.5 pl-8 pr-2.5 text-right text-sm font-bold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ModalBody>

                <ModalFooter className="flex-col sm:flex-row sm:justify-between">
                    <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-start">
                        <div>
                            <span className="text-(--text-muted) block text-[10px]">New Total Assets</span>
                            <span className="text-base font-black text-(--text-ink) font-mono-num">
                                {formatSGD(summary.newTotal)}
                            </span>
                        </div>
                        <div className="h-7 w-px bg-(--border-subtle)" />
                        <div>
                            <span className="text-(--text-muted) block text-[10px]">Net Change</span>
                            <span
                                className={`text-sm font-black font-mono-num ${
                                    summary.delta >= 0
                                        ? "text-emerald-700 dark:text-emerald-300"
                                        : "text-rose-700 dark:text-rose-300"
                                }`}
                            >
                                {summary.delta >= 0 ? "+" : ""}
                                {formatSGD(summary.delta)} ({summary.changedCount} edited)
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) px-5 py-2.5 text-xs font-black text-(--text-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
                        >
                            <Check className="h-4 w-4 stroke-[2.5]" />
                            <span>{isSubmitting ? "Saving..." : "Save Month-End Snapshot"}</span>
                        </button>
                    </div>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default BulkBalanceUpdateModal;
