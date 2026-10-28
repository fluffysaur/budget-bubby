/**
 * AddEditGoalModal Component
 * Accessible dialog for creating or updating a savings milestone goal.
 * Features:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Emoji picker preset chips & custom emoji input
 * - Title, Target Amount, Saved So Far, Target Date, Monthly Contribution inputs
 * - Live pacing calculator preview (Required pace & status indicator)
 * - Error alerts and accessible form controls
 * - Dual mode: addGoal or updateGoal via financeService
 */

import { useState, useEffect, useRef, type FormEvent } from "react";
import { Target, AlertCircle, TrendingUp } from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { financeService } from "../../services/financeService";
import { calculateGoalPacing } from "../../lib/financialFormulas";
import { formatSGD } from "../../lib/currency";
import { formatISODate } from "../../lib/dateUtils";
import type { SavingsGoal, CreateGoalInput } from "../../types/finance";

export interface AddEditGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    goal?: SavingsGoal | null;
    onGoalSaved?: (goal: SavingsGoal) => void;
    householdId?: string;
}

const EMOJI_PRESETS = [
    { emoji: "💍", label: "Wedding" },
    { emoji: "🏖️", label: "Honeymoon" },
    { emoji: "🏠", label: "HDB Down Payment" },
    { emoji: "🔨", label: "Renovation" },
    { emoji: "🍼", label: "Baby Fund" },
    { emoji: "✈️", label: "Vacation" },
    { emoji: "🚗", label: "Car" },
    { emoji: "🛡️", label: "Emergency Fund" },
    { emoji: "🎯", label: "Other Goal" },
];

export function AddEditGoalModal({
    isOpen,
    onClose,
    goal,
    onGoalSaved,
    householdId,
}: AddEditGoalModalProps) {
    const titleInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [emoji, setEmoji] = useState<string>("🎯");
    const [title, setTitle] = useState<string>("" );
    const [targetAmount, setTargetAmount] = useState<string>("");
    const [savedSoFar, setSavedSoFar] = useState<string>("0");
    const [targetDate, setTargetDate] = useState<string>("");
    const [monthlyContribution, setMonthlyContribution] = useState<string>("0");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Reset or populate state whenever isOpen or goal changes
    useEffect(() => {
        if (isOpen) {
            if (goal) {
                setEmoji(goal.emoji || "🎯");
                setTitle(goal.title);
                setTargetAmount(goal.target_amount.toString());
                setSavedSoFar(goal.saved_so_far.toString());
                setTargetDate(goal.target_date ? goal.target_date.substring(0, 10) : "");
                setMonthlyContribution(goal.monthly_contribution ? goal.monthly_contribution.toString() : "0");
            } else {
                setEmoji("🎯");
                setTitle("");
                setTargetAmount("");
                setSavedSoFar("0");
                const oneYearAhead = new Date();
                oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
                setTargetDate(formatISODate(oneYearAhead));
                setMonthlyContribution("0");
            }
            setErrorMessage(null);
            setIsSubmitting(false);

            const timer = setTimeout(() => {
                titleInputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen, goal]);

    if (!isOpen) return null;

    // Derived pacing calculations for live feedback
    const numericTarget = parseFloat(targetAmount) || 0;
    const numericSaved = parseFloat(savedSoFar) || 0;
    const numericMonthly = parseFloat(monthlyContribution) || 0;

    const livePacing =
        numericTarget > 0 && targetDate
            ? calculateGoalPacing(numericTarget, numericSaved, targetDate, numericMonthly)
            : null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!title.trim()) {
            setErrorMessage("Please enter a goal title (e.g. Wedding Banquet, HDB Reno)");
            titleInputRef.current?.focus();
            return;
        }

        if (isNaN(numericTarget) || numericTarget <= 0) {
            setErrorMessage("Please enter a valid target amount greater than S$0.00");
            return;
        }

        if (isNaN(numericSaved) || numericSaved < 0) {
            setErrorMessage("Saved amount cannot be negative");
            return;
        }

        if (!targetDate) {
            setErrorMessage("Please select a target completion date");
            return;
        }

        if (isNaN(numericMonthly) || numericMonthly < 0) {
            setErrorMessage("Monthly contribution cannot be negative");
            return;
        }

        try {
            setIsSubmitting(true);

            // Ensure normalized date string
            const normalizedDate = targetDate.length === 7 ? `${targetDate}-01` : targetDate;

            if (goal) {
                // Update Mode
                const updated = await financeService.updateGoal(goal.id, {
                    emoji: emoji || "🎯",
                    title: title.trim(),
                    target_amount: numericTarget,
                    saved_so_far: numericSaved,
                    target_date: normalizedDate,
                    monthly_contribution: numericMonthly,
                });
                onGoalSaved?.(updated);
            } else {
                // Create Mode
                const input: CreateGoalInput = {
                    household_id: householdId,
                    emoji: emoji || "🎯",
                    title: title.trim(),
                    target_amount: numericTarget,
                    saved_so_far: numericSaved,
                    target_date: normalizedDate,
                    monthly_contribution: numericMonthly,
                };
                const created = await financeService.addGoal(input);
                onGoalSaved?.(created);
            }

            onClose();
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to save savings goal");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    id="goal-modal-title"
                    title={goal ? "Edit Savings Goal" : "New Savings Goal"}
                    subtitle="Track couple milestones, target dates, and monthly savings pace"
                    icon={<Target className="h-4.5 w-4.5 stroke-[2.5]" />}
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

                    {/* Emoji Presets & Custom Selector */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                            Goal Icon / Emoji
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {EMOJI_PRESETS.map((p) => (
                                <button
                                    key={p.label}
                                    type="button"
                                    aria-label={p.label}
                                    onClick={() => setEmoji(p.emoji)}
                                    className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                        emoji === p.emoji
                                            ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                            : "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle)"
                                    }`}
                                >
                                    <span className="text-sm">{p.emoji}</span>
                                    <span className="text-[11px]">{p.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                aria-label="Custom Emoji"
                                value={emoji}
                                onChange={(e) => setEmoji(e.target.value)}
                                maxLength={4}
                                className="w-14 text-center rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) py-2 text-xl shadow-xs"
                                placeholder="🎯"
                            />
                            <span className="text-xs text-(--text-muted)">Custom emoji</span>
                        </div>
                    </div>

                    {/* Goal Title */}
                    <div>
                        <label
                            htmlFor="goal-title"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Goal Title *
                        </label>
                        <input
                            id="goal-title"
                            ref={titleInputRef}
                            type="text"
                            placeholder="e.g. Wedding Banquet, HDB Renovation"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-sm font-semibold text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                    </div>

                    {/* Target Amount & Saved So Far Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label
                                htmlFor="goal-target"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Target Amount (S$) *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-sm font-bold text-(--text-muted)">S$</span>
                                <input
                                    id="goal-target"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="20,000"
                                    value={targetAmount}
                                    onChange={(e) => setTargetAmount(e.target.value)}
                                    className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-9 pr-3.5 py-2 text-sm font-mono-num font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="goal-saved"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Saved So Far (S$)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-sm font-bold text-(--text-muted)">S$</span>
                                <input
                                    id="goal-saved"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0"
                                    value={savedSoFar}
                                    onChange={(e) => setSavedSoFar(e.target.value)}
                                    className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-9 pr-3.5 py-2 text-sm font-mono-num font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Target Date & Monthly Contribution Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label
                                htmlFor="goal-date"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Target Date (Optional)
                            </label>
                            <input
                                id="goal-date"
                                type="date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-2 text-xs font-mono-num font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac) cursor-pointer"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="goal-monthly"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Monthly Contribution (S$)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-sm font-bold text-(--text-muted)">S$</span>
                                <input
                                    id="goal-monthly"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="500"
                                    value={monthlyContribution}
                                    onChange={(e) => setMonthlyContribution(e.target.value)}
                                    className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-9 pr-3.5 py-2 text-sm font-mono-num font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Live Pacing Preview */}
                    {livePacing && (
                        <div className="rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-3 text-xs shadow-cute-sm">
                            <div className="flex items-center justify-between font-bold text-(--text-ink)">
                                <span className="flex items-center gap-1.5">
                                    <TrendingUp className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                    Pacing Projection
                                </span>
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold border border-(--border-ink) ${
                                        livePacing.status === "achieved"
                                            ? "bg-(--pastel-mint) text-(--text-ink)"
                                            : livePacing.status === "on_track"
                                              ? "bg-(--pastel-lilac) text-(--text-ink)"
                                              : "bg-(--pastel-coral) text-white"
                                    }`}
                                >
                                    {livePacing.status === "achieved"
                                        ? "Achieved"
                                        : livePacing.status === "on_track"
                                          ? "On Track"
                                          : "Behind"}
                                </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-(--text-muted)">
                                <div>
                                    <span className="text-[11px] block">Required Pace:</span>
                                    <span className="font-bold text-(--text-ink) font-mono-num">
                                        {livePacing.status === "achieved"
                                            ? "Complete"
                                            : `${formatSGD(livePacing.neededPerMonth)}/mo`}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[11px] block">Time to Target:</span>
                                    <span className="font-bold text-(--text-ink) font-mono-num">
                                        {livePacing.monthsRemaining} months
                                    </span>
                                </div>
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
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) px-5 py-2.5 text-xs font-black text-(--text-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
                    >
                        {isSubmitting ? "Saving..." : goal ? "Save Changes" : "Create Goal"}
                    </button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default AddEditGoalModal;
