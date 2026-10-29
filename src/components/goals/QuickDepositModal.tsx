/**
 * QuickDepositModal Component
 * Accessible dialog to quickly deposit funds into a savings goal.
 * Features:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Quick preset chips (+S$100, +S$250, +S$500, +S$1,000, +S$5,000)
 * - Custom numeric deposit input
 * - Live preview of updated balance and new progress %
 * - Updates goal saved_so_far via financeService.updateGoal
 */

import { useState, useEffect, useRef, type FormEvent } from "react";
import { Coins, AlertCircle } from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { financeService } from "../../services/financeService";
import { formatSGD } from "../../lib/currency";
import { haptics } from "../../lib/haptics";
import type { SavingsGoal } from "../../types/finance";

export interface QuickDepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    goal: SavingsGoal | null;
    onDepositSaved?: (updatedGoal: SavingsGoal) => void;
}

const DEPOSIT_PRESETS = [100, 250, 500, 1000, 5000];

export function QuickDepositModal({
    isOpen,
    onClose,
    goal,
    onDepositSaved,
}: QuickDepositModalProps) {
    const depositInputRef = useRef<HTMLInputElement>(null);

    const [depositAmount, setDepositAmount] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setDepositAmount("");
            setErrorMessage(null);
            setIsSubmitting(false);

            const timer = setTimeout(() => {
                depositInputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen, goal]);

    if (!isOpen || !goal) return null;

    const numericDeposit = parseFloat(depositAmount) || 0;
    const newSavedSoFar = goal.saved_so_far + numericDeposit;
    const newProgressPercent =
        goal.target_amount > 0 ? Math.min(100, Math.round((newSavedSoFar / goal.target_amount) * 100)) : 0;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (isNaN(numericDeposit) || numericDeposit <= 0) {
            setErrorMessage("Please enter a deposit amount greater than S$0.00");
            depositInputRef.current?.focus();
            return;
        }

        try {
            setIsSubmitting(true);
            const updated = await financeService.updateGoal(goal.id, {
                saved_so_far: Math.round(newSavedSoFar * 100) / 100,
            });
            haptics.goalMilestone();
            onDepositSaved?.(updated);
            onClose();
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to process deposit");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    id="deposit-modal-title"
                    title="Quick Deposit"
                    subtitle={`Deposit into ${goal.title}`}
                    icon={<Coins className="h-4.5 w-4.5 stroke-[2.5]" />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {/* Error Alert */}
                    {errorMessage && (
                        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Quick Deposit Chips */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                            Quick Deposit Presets
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {DEPOSIT_PRESETS.map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setDepositAmount(amt.toString())}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                        numericDeposit === amt
                                            ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                            : "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle)"
                                    }`}
                                >
                                    +{formatSGD(amt)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Deposit Amount */}
                    <div>
                        <label
                            htmlFor="deposit-amount"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Deposit Amount (S$) *
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-base font-bold text-(--text-muted)">S$</span>
                            <input
                                id="deposit-amount"
                                ref={depositInputRef}
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                placeholder="0.00"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-10 pr-3.5 py-2.5 text-lg font-mono-num font-bold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            />
                        </div>
                    </div>

                    {/* Updated Progress Preview */}
                    {numericDeposit > 0 && (
                        <div className="rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-3 text-xs shadow-cute-sm space-y-2">
                            <div className="flex justify-between font-bold text-(--text-ink)">
                                <span>Projected Balance:</span>
                                <span className="font-mono-num">{formatSGD(newSavedSoFar)}</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-(--bg-canvas) border border-(--border-ink) overflow-hidden">
                                <div
                                    className="h-full bg-(--pastel-lilac) transition-all duration-300"
                                    style={{ width: `${newProgressPercent}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[11px] text-(--text-muted)">
                                <span>New Progress:</span>
                                <span className="font-bold text-(--text-ink)">{newProgressPercent}%</span>
                            </div>
                        </div>
                    )}
                </ModalBody>

                <ModalFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || numericDeposit <= 0}
                        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) px-5 py-2.5 text-xs font-black text-(--text-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
                    >
                        <Coins className="h-4 w-4 stroke-[2.5]" />
                        <span>{isSubmitting ? "Depositing..." : "Confirm Deposit"}</span>
                    </button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default QuickDepositModal;
