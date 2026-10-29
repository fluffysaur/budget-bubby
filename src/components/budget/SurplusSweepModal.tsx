import { useState, useEffect, useMemo, type FormEvent } from "react";
import { PiggyBank, Sparkles, Check, AlertCircle } from "lucide-react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Badge,
    CurrencyText,
} from "../ui";
import { formatSGD } from "../../lib/currency";
import { formatDisplayMonth } from "../../lib/dateUtils";
import { playChaChingSound } from "../../lib/soundEffects";
import { haptics } from "../../lib/haptics";
import type { SavingsGoal } from "../../types/finance";

export interface SurplusSweepAllocation {
    goalId: string;
    amount: number;
}

export interface SurplusSweepModalProps {
    isOpen: boolean;
    onClose: () => void;
    surplusAmount: number;
    month: string;
    goals: SavingsGoal[];
    onSweepComplete: (allocations: SurplusSweepAllocation[]) => Promise<void>;
}

type AllocationMode = "fixed" | "percent";

export function SurplusSweepModal({
    isOpen,
    onClose,
    surplusAmount,
    month,
    goals,
    onSweepComplete,
}: SurplusSweepModalProps) {
    const activeGoals = useMemo(() => {
        return goals.filter((g) => g.status !== "achieved");
    }, [goals]);

    const [mode, setMode] = useState<AllocationMode>("fixed");
    const [selectedGoalIds, setSelectedGoalIds] = useState<Set<string>>(
        new Set()
    );
    // Stores allocated value per goal (dollar or percent based on mode)
    const [allocations, setAllocations] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Initialize selections when opened
    useEffect(() => {
        if (isOpen) {
            setErrorMessage(null);
            setIsSubmitting(false);
            setMode("fixed");
            const initialIds = new Set(activeGoals.map((g) => g.id));
            setSelectedGoalIds(initialIds);

            // Default: empty allocations until preset or manual entry
            const initialMap: Record<string, number> = {};
            activeGoals.forEach((g) => {
                initialMap[g.id] = 0;
            });
            setAllocations(initialMap);
        }
    }, [isOpen, activeGoals]);

    // Compute effective dollar allocations
    const computedDollars = useMemo(() => {
        const result: Record<string, number> = {};
        for (const goal of activeGoals) {
            if (!selectedGoalIds.has(goal.id)) {
                result[goal.id] = 0;
                continue;
            }
            const val = allocations[goal.id] || 0;
            if (mode === "percent") {
                result[goal.id] =
                    Math.round(((surplusAmount * val) / 100) * 100) / 100;
            } else {
                result[goal.id] = Math.round(val * 100) / 100;
            }
        }
        return result;
    }, [activeGoals, selectedGoalIds, allocations, mode, surplusAmount]);

    const totalAllocatedDollars = useMemo(() => {
        return (
            Math.round(
                Object.values(computedDollars).reduce((s, v) => s + v, 0) * 100
            ) / 100
        );
    }, [computedDollars]);

    const remainingDollars =
        Math.round((surplusAmount - totalAllocatedDollars) * 100) / 100;
    const isExceeded = remainingDollars < -0.01;
    const isFullyAllocated = Math.abs(remainingDollars) <= 0.01 && totalAllocatedDollars > 0;

    // Toggle goal inclusion
    const handleToggleGoal = (goalId: string) => {
        const next = new Set(selectedGoalIds);
        if (next.has(goalId)) {
            next.delete(goalId);
            setAllocations((prev) => ({ ...prev, [goalId]: 0 }));
        } else {
            next.add(goalId);
        }
        setSelectedGoalIds(next);
    };

    // Value change for a goal
    const handleValueChange = (goalId: string, rawVal: string) => {
        const num = parseFloat(rawVal) || 0;
        setAllocations((prev) => ({
            ...prev,
            [goalId]: Math.max(0, num),
        }));
    };

    // Preset: Split Evenly
    const handleSplitEvenly = () => {
        const count = selectedGoalIds.size;
        if (count === 0) return;

        if (mode === "percent") {
            const pct = Math.floor((100 / count) * 10) / 10;
            const newMap: Record<string, number> = {};
            selectedGoalIds.forEach((id) => {
                newMap[id] = pct;
            });
            setAllocations(newMap);
        } else {
            const each = Math.floor((surplusAmount / count) * 100) / 100;
            const newMap: Record<string, number> = {};
            let assigned = 0;
            const ids = Array.from(selectedGoalIds);
            ids.forEach((id, idx) => {
                if (idx === ids.length - 1) {
                    newMap[id] =
                        Math.round((surplusAmount - assigned) * 100) / 100;
                } else {
                    newMap[id] = each;
                    assigned = Math.round((assigned + each) * 100) / 100;
                }
            });
            setAllocations(newMap);
        }
    };

    // Preset: 100% to first selected goal
    const handleAllToTopGoal = () => {
        const ids = Array.from(selectedGoalIds);
        if (ids.length === 0) return;
        const topId = ids[0];
        const newMap: Record<string, number> = {};
        ids.forEach((id) => {
            newMap[id] = id === topId ? (mode === "percent" ? 100 : surplusAmount) : 0;
        });
        setAllocations(newMap);
    };

    // Switch mode
    const handleModeSwitch = (newMode: AllocationMode) => {
        if (newMode === mode) return;
        setMode(newMode);
        // Convert current dollar allocations to percentage or vice versa
        const newMap: Record<string, number> = {};
        for (const goal of activeGoals) {
            if (newMode === "percent") {
                const dollars = computedDollars[goal.id] || 0;
                newMap[goal.id] =
                    surplusAmount > 0
                        ? Math.round(((dollars / surplusAmount) * 100) * 10) / 10
                        : 0;
            } else {
                newMap[goal.id] = computedDollars[goal.id] || 0;
            }
        }
        setAllocations(newMap);
    };

    const handleSubmit = async (e?: FormEvent) => {
        if (e) e.preventDefault();
        if (isExceeded || totalAllocatedDollars <= 0 || isSubmitting) return;

        const payload: SurplusSweepAllocation[] = [];
        for (const goal of activeGoals) {
            const amt = computedDollars[goal.id] || 0;
            if (amt > 0) {
                payload.push({ goalId: goal.id, amount: amt });
            }
        }

        if (payload.length === 0) return;

        try {
            setIsSubmitting(true);
            setErrorMessage(null);
            await onSweepComplete(payload);
            playChaChingSound();
            haptics.sweep();
            onClose();
        } catch (err: unknown) {
            setErrorMessage(
                err instanceof Error
                    ? err.message
                    : "Failed to allocate surplus. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose}>
            <ModalHeader
                title="Sweep Unspent Surplus"
                subtitle={`Allocate ${formatSGD(surplusAmount)} from ${formatDisplayMonth(month)} into your Savings Goals`}
                icon={<PiggyBank className="h-5 w-5 text-indigo-600" />}
                onClose={onClose}
            />

            <ModalBody className="space-y-4">
                {/* Celebration callout banner */}
                <div className="flex items-start gap-3 rounded-2xl border-2 border-(--border-ink) bg-(--accent-butter-subtle) p-3.5 shadow-(--shadow-cute-sm)">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--accent-butter) text-(--text-ink)">
                        <Sparkles className="h-5 w-5 stroke-[2.2]" />
                    </div>
                    <div className="text-xs sm:text-sm text-(--text-ink)">
                        <p className="font-bold">
                            🎉 Incredible work in {formatDisplayMonth(month)}!
                        </p>
                        <p className="text-(--text-muted) mt-0.5">
                            You stayed under your spendable limit with{" "}
                            <span className="font-bold text-(--text-ink)">
                                {formatSGD(surplusAmount)}
                            </span>{" "}
                            to spare. Deposit it into your goals to accelerate your milestones!
                        </p>
                    </div>
                </div>

                {/* Preset Chips & Mode Selector */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={handleSplitEvenly}
                            aria-label="Split evenly"
                        >
                            Split Evenly
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={handleAllToTopGoal}
                            aria-label="100% to first goal"
                        >
                            All to Top Goal
                        </Button>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex items-center rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-0.5">
                        <button
                            type="button"
                            onClick={() => handleModeSwitch("fixed")}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                mode === "fixed"
                                    ? "bg-(--border-ink) text-white"
                                    : "text-(--text-muted) hover:text-(--text-ink)"
                            }`}
                        >
                            S$ Amount
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeSwitch("percent")}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                mode === "percent"
                                    ? "bg-(--border-ink) text-white"
                                    : "text-(--text-muted) hover:text-(--text-ink)"
                            }`}
                        >
                            Percentage (%)
                        </button>
                    </div>
                </div>

                {/* Goals List */}
                <div className="space-y-2.5 max-h-75 overflow-y-auto pr-1">
                    {activeGoals.length === 0 ? (
                        <div className="text-center py-6 text-xs text-(--text-muted)">
                            No active savings goals found. Create a goal in the Goals tab first!
                        </div>
                    ) : (
                        activeGoals.map((goal) => {
                            const isSelected = selectedGoalIds.has(goal.id);
                            const allocatedAmt = computedDollars[goal.id] || 0;
                            const newTotal = goal.saved_so_far + allocatedAmt;
                            const currentPct =
                                goal.target_amount > 0
                                    ? Math.round(
                                          (goal.saved_so_far / goal.target_amount) * 100
                                      )
                                    : 0;
                            const newPct =
                                goal.target_amount > 0
                                    ? Math.min(
                                          100,
                                          Math.round(
                                              (newTotal / goal.target_amount) * 100
                                          )
                                      )
                                    : 0;

                            return (
                                <div
                                    key={goal.id}
                                    className={`rounded-xl border-2 transition-all p-3 ${
                                        isSelected
                                            ? "border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute-sm)"
                                            : "border-(--border-subtle) bg-(--bg-cream) opacity-60"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Toggle Checkbox */}
                                        <button
                                            type="button"
                                            onClick={() => handleToggleGoal(goal.id)}
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                                                isSelected
                                                    ? "border-(--border-ink) bg-(--accent-lilac) text-(--text-ink)"
                                                    : "border-slate-300 bg-white"
                                            }`}
                                            aria-label={`Toggle ${goal.title}`}
                                        >
                                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                        </button>

                                        {/* Emoji & Goal Info */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-base">{goal.emoji || "🎯"}</span>
                                                <span className="text-xs sm:text-sm font-bold text-(--text-ink) truncate">
                                                    {goal.title}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-(--text-muted) flex items-center gap-2 mt-0.5">
                                                <span>
                                                    Progress: {currentPct}% →{" "}
                                                    <strong className="text-emerald-700">
                                                        {newPct}%
                                                    </strong>
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    Target: {formatSGD(goal.target_amount)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Input Box */}
                                        {isSelected && (
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-(--text-muted)">
                                                        {mode === "fixed" ? "S$" : "%"}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        step={mode === "fixed" ? "5" : "1"}
                                                        min="0"
                                                        max={mode === "fixed" ? surplusAmount : 100}
                                                        value={allocations[goal.id] ?? 0}
                                                        onChange={(e) =>
                                                            handleValueChange(
                                                                goal.id,
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-24 sm:w-28 rounded-lg border-2 border-(--border-ink) py-1 pl-7 pr-2 text-right text-xs sm:text-sm font-bold text-(--text-ink) focus:outline-none focus:ring-2 focus:ring-(--accent-lilac)"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Live Allocation Balance Strip */}
                <div className="flex items-center justify-between rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3">
                    <div className="text-xs">
                        <span className="text-(--text-muted)">Allocated: </span>
                        <strong className="text-(--text-ink)">
                            <CurrencyText amount={totalAllocatedDollars} />
                        </strong>
                        <span className="text-(--text-muted)">
                            {" "}
                            of {formatSGD(surplusAmount)}
                        </span>
                    </div>

                    <div>
                        {isExceeded ? (
                            <Badge variant="rose">
                                Exceeded by {formatSGD(Math.abs(remainingDollars))}
                            </Badge>
                        ) : isFullyAllocated ? (
                            <Badge variant="emerald">100% Allocated</Badge>
                        ) : (
                            <Badge variant="slate">
                                {formatSGD(remainingDollars)} unallocated
                            </Badge>
                        )}
                    </div>
                </div>

                {errorMessage && (
                    <div className="flex items-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 p-2.5 text-xs text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}
            </ModalBody>

            <ModalFooter>
                <div className="flex items-center justify-between w-full">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => handleSubmit()}
                        disabled={
                            isExceeded ||
                            totalAllocatedDollars <= 0 ||
                            isSubmitting ||
                            activeGoals.length === 0
                        }
                        isLoading={isSubmitting}
                        leftIcon={<PiggyBank className="h-4 w-4 stroke-[2.5]" />}
                    >
                        Deposit {formatSGD(totalAllocatedDollars)} into Goals
                    </Button>
                </div>
            </ModalFooter>
        </AnimatedModal>
    );
}
