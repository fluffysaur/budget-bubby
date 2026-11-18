/**
 * AddEditGoalModal Component
 * Accessible dialog for creating or updating a savings milestone goal.
 * Features:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Emoji picker preset chips & custom emoji input
 * - Title, Target Amount and Target Date inputs (progress comes from the
 *   household pool on the Roadmap, so there is no "saved so far")
 * - Error alerts and accessible form controls
 * - Dual mode: addGoal or updateGoal via financeService
 */

import { useState, useEffect, useRef, type FormEvent } from "react";
import { Target } from "lucide-react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import {
    useAddGoalMutation,
    useUpdateGoalMutation,
} from "../../hooks/useFinanceQueries";
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
    const addGoalMutation = useAddGoalMutation();
    const updateGoalMutation = useUpdateGoalMutation();

    // Form State
    const [emoji, setEmoji] = useState<string>("🎯");
    const [title, setTitle] = useState<string>("");
    const [targetAmount, setTargetAmount] = useState<string>("");
    const [targetDate, setTargetDate] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Reset or populate state whenever isOpen or goal changes
    useEffect(() => {
        if (isOpen) {
            if (goal) {
                setEmoji(goal.emoji || "🎯");
                setTitle(goal.title);
                setTargetAmount(goal.target_amount.toString());
                setTargetDate(
                    goal.target_date ? goal.target_date.substring(0, 10) : "",
                );
            } else {
                setEmoji("🎯");
                setTitle("");
                setTargetAmount("");
                const oneYearAhead = new Date();
                oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
                setTargetDate(formatISODate(oneYearAhead));
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

    const numericTarget = parseFloat(targetAmount) || 0;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!title.trim()) {
            setErrorMessage("Add a title");
            titleInputRef.current?.focus();
            return;
        }

        if (isNaN(numericTarget) || numericTarget <= 0) {
            setErrorMessage("Target must exceed 0");
            return;
        }

        if (!targetDate) {
            setErrorMessage("Please select a target completion date");
            return;
        }

        try {
            setIsSubmitting(true);

            // Ensure normalized date string
            const normalizedDate =
                targetDate.length === 7 ? `${targetDate}-01` : targetDate;

            if (goal) {
                // Update Mode
                const updated = await updateGoalMutation.mutateAsync({
                    id: goal.id,
                    updates: {
                        emoji: emoji || "🎯",
                        title: title.trim(),
                        target_amount: numericTarget,
                        target_date: normalizedDate,
                    },
                });
                onGoalSaved?.(updated);
            } else {
                // Create Mode
                const input: CreateGoalInput = {
                    household_id: householdId,
                    emoji: emoji || "🎯",
                    title: title.trim(),
                    target_amount: numericTarget,
                    target_date: normalizedDate,
                };
                const created = await addGoalMutation.mutateAsync(input);
                onGoalSaved?.(created);
            }

            onClose();
        } catch (err: unknown) {
            setErrorMessage(
                err instanceof Error
                    ? err.message
                    : "Failed to save savings goal",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col min-h-0 flex-1 overflow-hidden"
            >
                <ModalHeader
                    id="goal-modal-title"
                    title={goal ? "Edit Savings Goal" : "New Savings Goal"}
                    icon={<Target className="h-4.5 w-4.5" strokeWidth={2.5} />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {/* Error Alert */}
                    {errorMessage && (
                        <Alert variant="danger">{errorMessage}</Alert>
                    )}

                    {/* Emoji Presets & Custom Selector */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                            Icon
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {EMOJI_PRESETS.map((p) => (
                                <button
                                    key={p.label}
                                    type="button"
                                    aria-label={p.label}
                                    onClick={() => setEmoji(p.emoji)}
                                    className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-press cursor-pointer ${
                                        emoji === p.emoji
                                            ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                            : "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle)"
                                    }`}
                                >
                                    <span className="text-sm">{p.emoji}</span>
                                    <span className="text-[11px]">
                                        {p.label}
                                    </span>
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
                            <span className="text-xs text-(--text-muted)">
                                Custom emoji
                            </span>
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
                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-base sm:text-sm font-semibold text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                    </div>

                    {/* Target Amount & Target Date Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label
                                htmlFor="goal-target"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Target *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-sm font-bold text-(--text-muted)">
                                    S$
                                </span>
                                <input
                                    id="goal-target"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="20,000"
                                    value={targetAmount}
                                    onChange={(e) =>
                                        setTargetAmount(e.target.value)
                                    }
                                    className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-9 pr-3.5 py-2 text-base sm:text-sm font-mono-num font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="goal-date"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Target Date
                            </label>
                            <input
                                id="goal-date"
                                type="date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-2 text-base sm:text-xs font-mono-num font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac) cursor-pointer"
                            />
                        </div>
                    </div>

                    <p className="text-xs text-(--text-muted)">
                        Filled from your household pool in date order.
                    </p>
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
                    >
                        {goal ? "Save" : "Create"}
                    </Button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default AddEditGoalModal;
