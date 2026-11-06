/**
 * BonusGoalPicker Component
 * Spreads the Goals share of a bonus across selected goals, with Even,
 * By gap and One goal presets.
 */

import { Alert, Button, CurrencyText, Input, TruncatedText } from "../ui";
import type { GoalDistributionMode } from "../../lib/goalDistribution";
import type { SavingsGoal } from "../../types/finance";

export interface BonusGoalPickerProps {
    goals: SavingsGoal[];
    selectedIds: ReadonlySet<string>;
    amounts: Record<string, number>;
    /** Raw text while the user types amounts; falls back to `amounts`. */
    amountInputs?: Record<string, string>;
    goalShare: number;
    activePreset: GoalDistributionMode | null;
    onToggle: (goalId: string) => void;
    onAmountChange: (goalId: string, value: string) => void;
    onPreset: (mode: GoalDistributionMode) => void;
}

const PRESETS: { mode: GoalDistributionMode; label: string }[] = [
    { mode: "even", label: "Even" },
    { mode: "gap", label: "By gap" },
    { mode: "single", label: "One goal" },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function BonusGoalPicker({
    goals,
    selectedIds,
    amounts,
    amountInputs = {},
    goalShare,
    activePreset,
    onToggle,
    onAmountChange,
    onPreset,
}: BonusGoalPickerProps) {
    const assigned = round2(
        goals.reduce((s, g) => s + (selectedIds.has(g.id) ? amounts[g.id] || 0 : 0), 0),
    );
    const remaining = round2(goalShare - assigned);

    return (
        <div className="space-y-3" data-testid="bonus-goal-picker">
            <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                    <Button
                        key={p.mode}
                        type="button"
                        size="sm"
                        variant={activePreset === p.mode ? "secondary" : "outline"}
                        aria-pressed={activePreset === p.mode}
                        onClick={() => onPreset(p.mode)}
                        disabled={selectedIds.size === 0}
                    >
                        {p.label}
                    </Button>
                ))}
            </div>

            <div className="divide-y divide-(--border-subtle)">
                {goals.map((goal) => {
                    const checked = selectedIds.has(goal.id);
                    return (
                        <div key={goal.id} className="flex items-center gap-2 py-2">
                            <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => onToggle(goal.id)}
                                    aria-label={`Fund ${goal.title}`}
                                    className="h-4 w-4 shrink-0 cursor-pointer rounded-md border-(--border-ink) accent-(--text-ink)"
                                />
                                <span className="shrink-0" aria-hidden="true">
                                    {goal.emoji}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-(--text-ink)">
                                        <TruncatedText text={goal.title} />
                                    </div>
                                    <div className="font-mono-num text-xs text-(--text-muted)">
                                        <CurrencyText amount={goal.saved_so_far} /> /{" "}
                                        <CurrencyText amount={goal.target_amount} />
                                    </div>
                                </div>
                            </label>
                            <div className="w-28 shrink-0">
                                <Input
                                    id={`bonus-goal-amount-${goal.id}`}
                                    aria-label={`Amount for ${goal.title}`}
                                    inputMode="decimal"
                                    mono
                                    disabled={!checked}
                                    value={
                                        checked
                                            ? (amountInputs[goal.id] ?? String(amounts[goal.id] ?? 0))
                                            : ""
                                    }
                                    onChange={(e) => onAmountChange(goal.id, e.target.value)}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {remaining < -0.005 ? (
                <Alert variant="danger">Over by <CurrencyText amount={Math.abs(remaining)} /></Alert>
            ) : remaining > 0.005 ? (
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    <CurrencyText amount={remaining} /> unassigned
                </p>
            ) : (
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    Fully assigned
                </p>
            )}
        </div>
    );
}

export default BonusGoalPicker;
