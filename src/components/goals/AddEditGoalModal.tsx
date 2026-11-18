/**
 * AddEditGoalModal Component
 * Accessible dialog for creating or updating a savings milestone goal.
 * Features:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Goal or Buffer type (one buffer per household, funded first)
 * - Free-form tags with suggestions (Wedding, Housing, Child, Education,
 *   Travel, Car); a suggestion sets the emoji and title only, tags carry no
 *   rules. Plus a custom emoji input
 * - Buffer: target = N months of average spending, snapshotted when set,
 *   with "Refresh target"
 * - Title, Target Amount and Target Date inputs (progress comes from the
 *   household pool on the Roadmap, so there is no "saved so far")
 * - Error alerts and accessible form controls
 * - Dual mode: addGoal or updateGoal via financeService
 */

import { useState, useEffect, useRef, type FormEvent } from "react";
import { RefreshCw, Target, X } from "lucide-react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Switch } from "../ui/Switch";
import {
    useAddGoalMutation,
    useUpdateGoalMutation,
} from "../../hooks/useFinanceQueries";
import { formatISODate } from "../../lib/dateUtils";
import { CurrencyText } from "../ui/CurrencyText";
import {
    BUFFER_EMOJI,
    BUFFER_MAX_MONTHS,
    BUFFER_MIN_MONTHS,
    DEFAULT_BUFFER_MONTHS,
    GOAL_TAG_SUGGESTIONS,
    MAX_GOAL_TAGS,
    bufferTarget,
    clampBufferMonths,
    emojiForTag,
    normalizeGoalTags,
} from "../../lib/roadmap/goalSettings";
import type {
    SavingsGoal,
    CreateGoalInput,
    GoalType,
} from "../../types/finance";

export interface AddEditGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    goal?: SavingsGoal | null;
    onGoalSaved?: (goal: SavingsGoal) => void;
    householdId?: string;
    /** Average monthly spending, for the buffer target. */
    averageMonthlySpend?: number;
    /** The household already has a buffer goal (only one is allowed). */
    hasBufferGoal?: boolean;
}

/**
 * Suggested tags set a label and emoji only. They never prefill amounts,
 * which would go stale and could read as financial advice.
 */
const SUGGESTION_LABELS: ReadonlySet<string> = new Set(
    GOAL_TAG_SUGGESTIONS.map((t) => t.label),
);
const SUGGESTION_EMOJIS: ReadonlySet<string> = new Set(
    GOAL_TAG_SUGGESTIONS.map((t) => t.emoji),
);

const LABEL_CLASS =
    "block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5";
const INPUT_BASE =
    "rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-base sm:text-sm font-semibold text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)";
const INPUT_CLASS = `w-full ${INPUT_BASE}`;
const CHIP_CLASS =
    "inline-flex min-h-9 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-press cursor-pointer";
const CHIP_ON =
    "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm";
const CHIP_OFF =
    "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle)";

export function AddEditGoalModal({
    isOpen,
    onClose,
    goal,
    onGoalSaved,
    householdId,
    averageMonthlySpend = 0,
    hasBufferGoal = false,
}: AddEditGoalModalProps) {
    const titleInputRef = useRef<HTMLInputElement>(null);
    const addGoalMutation = useAddGoalMutation();
    const updateGoalMutation = useUpdateGoalMutation();

    // Form State
    const [emoji, setEmoji] = useState<string>("🎯");
    const [title, setTitle] = useState<string>("");
    const [targetAmount, setTargetAmount] = useState<string>("");
    const [targetDate, setTargetDate] = useState<string>("");
    const [useCpfOa, setUseCpfOa] = useState<boolean>(false);
    const [cpfOaCap, setCpfOaCap] = useState<string>("");
    const [goalType, setGoalType] = useState<GoalType>("standard");
    const [tags, setTags] = useState<string[]>([]);
    const [tagDraft, setTagDraft] = useState<string>("");
    const [bufferMonths, setBufferMonths] = useState<number>(
        DEFAULT_BUFFER_MONTHS,
    );
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
                setUseCpfOa(!!goal.use_cpf_oa);
                setCpfOaCap(
                    goal.cpf_oa_cap != null ? goal.cpf_oa_cap.toString() : "",
                );
                setGoalType(
                    goal.goal_type === "buffer" ? "buffer" : "standard",
                );
                setTags(normalizeGoalTags(goal.tags));
                setBufferMonths(
                    clampBufferMonths(
                        goal.buffer_months ?? DEFAULT_BUFFER_MONTHS,
                    ),
                );
            } else {
                setEmoji("🎯");
                setGoalType("standard");
                setTags([]);
                setBufferMonths(DEFAULT_BUFFER_MONTHS);
                setUseCpfOa(false);
                setCpfOaCap("");
                setTitle("");
                setTargetAmount("");
                const oneYearAhead = new Date();
                oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
                setTargetDate(formatISODate(oneYearAhead));
            }
            setTagDraft("");
            setErrorMessage(null);
            setIsSubmitting(false);

            const timer = setTimeout(() => {
                titleInputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen, goal]);

    if (!isOpen) return null;

    const isBuffer = goalType === "buffer";
    const numericTarget = parseFloat(targetAmount) || 0;
    // Buffer is offered on a new goal unless the household already has one.
    const canChooseType = !goal && !hasBufferGoal;

    const chooseType = (next: GoalType) => {
        setGoalType(next);
        if (next === "buffer") {
            setEmoji(BUFFER_EMOJI);
            if (!title.trim() || SUGGESTION_LABELS.has(title.trim())) {
                setTitle("Buffer");
            }
            setTargetAmount(
                String(bufferTarget(bufferMonths, averageMonthlySpend)),
            );
        } else {
            if (emoji === BUFFER_EMOJI) setEmoji("🎯");
            if (title.trim() === "Buffer") setTitle("");
            setTargetAmount("");
        }
    };

    /** Sets the months and snapshots the target from today's average. */
    const snapshotBuffer = (months: number) => {
        const clamped = clampBufferMonths(months);
        setBufferMonths(clamped);
        setTargetAmount(String(bufferTarget(clamped, averageMonthlySpend)));
    };

    const addTag = (raw: string) => {
        const next = normalizeGoalTags([...tags, raw]);
        if (next.length === tags.length) return;
        setTags(next);
        const tagEmoji = emojiForTag(raw);
        if (tagEmoji && (emoji === "🎯" || SUGGESTION_EMOJIS.has(emoji))) {
            setEmoji(tagEmoji);
        }
        // Fill the title only if it is empty or another suggestion's label.
        const suggestion = GOAL_TAG_SUGGESTIONS.find(
            (t) => t.label.toLowerCase() === raw.trim().toLowerCase(),
        );
        if (
            suggestion &&
            (!title.trim() || SUGGESTION_LABELS.has(title.trim()))
        ) {
            setTitle(suggestion.label);
        }
    };

    const removeTag = (tag: string) =>
        setTags(tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()));

    const hasTag = (tag: string) =>
        tags.some((t) => t.toLowerCase() === tag.toLowerCase());

    const commitTagDraft = () => {
        if (tagDraft.trim()) addTag(tagDraft);
        setTagDraft("");
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!title.trim()) {
            setErrorMessage("Add a title");
            titleInputRef.current?.focus();
            return;
        }

        if (isNaN(numericTarget) || numericTarget <= 0) {
            setErrorMessage(
                isBuffer ? "Log spending to size it" : "Target must exceed 0",
            );
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

            const parsedCap = parseFloat(cpfOaCap);
            const cpfOn = useCpfOa && !isBuffer;
            const cpfFields = {
                use_cpf_oa: cpfOn,
                cpf_oa_cap:
                    cpfOn && Number.isFinite(parsedCap) && parsedCap > 0
                        ? Math.round(parsedCap * 100) / 100
                        : null,
                tags: isBuffer ? [] : normalizeGoalTags([...tags, tagDraft]),
                goal_type: goalType,
                buffer_months: isBuffer ? bufferMonths : null,
            };

            if (goal) {
                // Update Mode
                const updated = await updateGoalMutation.mutateAsync({
                    id: goal.id,
                    updates: {
                        emoji: emoji || "🎯",
                        title: title.trim(),
                        target_amount: numericTarget,
                        target_date: normalizedDate,
                        ...cpfFields,
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
                    ...cpfFields,
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
                    title={
                        isBuffer
                            ? goal
                                ? "Edit Buffer"
                                : "New Buffer"
                            : goal
                              ? "Edit Savings Goal"
                              : "New Savings Goal"
                    }
                    icon={<Target className="h-4.5 w-4.5" strokeWidth={2.5} />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {/* Error Alert */}
                    {errorMessage && (
                        <Alert variant="danger">{errorMessage}</Alert>
                    )}

                    {canChooseType && (
                        <div
                            role="radiogroup"
                            aria-label="Goal type"
                            className="grid grid-cols-2 gap-1.5"
                        >
                            {(
                                [
                                    ["standard", "Goal", "🎯"],
                                    ["buffer", "Buffer", BUFFER_EMOJI],
                                ] as const
                            ).map(([value, label, icon]) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={goalType === value}
                                    onClick={() => chooseType(value)}
                                    className={`${CHIP_CLASS} min-h-11 justify-center ${
                                        goalType === value ? CHIP_ON : CHIP_OFF
                                    }`}
                                >
                                    <span className="text-sm">{icon}</span>
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    {isBuffer ? (
                        <div>
                            <label
                                htmlFor="goal-buffer-months"
                                className={LABEL_CLASS}
                            >
                                Months of spending
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="goal-buffer-months"
                                    type="number"
                                    inputMode="numeric"
                                    min={BUFFER_MIN_MONTHS}
                                    max={BUFFER_MAX_MONTHS}
                                    step={1}
                                    value={bufferMonths}
                                    onChange={(e) =>
                                        snapshotBuffer(Number(e.target.value))
                                    }
                                    className={`${INPUT_BASE} text-base sm:text-sm w-20 shrink-0 font-mono-num text-center`}
                                />
                                <span className="min-w-0 flex-1 text-xs text-(--text-muted)">
                                    ×{" "}
                                    <CurrencyText
                                        amount={averageMonthlySpend}
                                    />{" "}
                                    avg/mo
                                </span>
                            </div>
                            {goal && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-1.5 min-h-11"
                                    onClick={() => snapshotBuffer(bufferMonths)}
                                    leftIcon={
                                        <RefreshCw
                                            className="h-3.5 w-3.5"
                                            strokeWidth={2.5}
                                        />
                                    }
                                >
                                    Refresh target
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div>
                            <span className={LABEL_CLASS}>Tags</span>
                            <div
                                role="group"
                                aria-label="Suggested tags"
                                className="flex flex-wrap gap-1.5 mb-2"
                            >
                                {GOAL_TAG_SUGGESTIONS.map((p) => {
                                    const on = hasTag(p.label);
                                    return (
                                        <button
                                            key={p.label}
                                            type="button"
                                            aria-label={p.label}
                                            aria-pressed={on}
                                            onClick={() =>
                                                on
                                                    ? removeTag(p.label)
                                                    : addTag(p.label)
                                            }
                                            className={`${CHIP_CLASS} ${on ? CHIP_ON : CHIP_OFF}`}
                                        >
                                            <span className="text-sm">
                                                {p.emoji}
                                            </span>
                                            <span className="text-[11px]">
                                                {p.label}
                                            </span>
                                        </button>
                                    );
                                })}
                                {tags
                                    .filter((t) => !SUGGESTION_LABELS.has(t))
                                    .map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            aria-label={`Remove ${t}`}
                                            onClick={() => removeTag(t)}
                                            className={`${CHIP_CLASS} ${CHIP_ON} max-w-40`}
                                        >
                                            <span className="min-w-0 truncate text-[11px]">
                                                {t}
                                            </span>
                                            <X
                                                className="h-3 w-3 shrink-0"
                                                strokeWidth={3}
                                            />
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
                                    className="w-14 shrink-0 text-center rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) py-2 text-xl shadow-xs"
                                    placeholder="🎯"
                                />
                                <input
                                    type="text"
                                    aria-label="Add tag"
                                    placeholder="Add tag"
                                    value={tagDraft}
                                    maxLength={24}
                                    disabled={tags.length >= MAX_GOAL_TAGS}
                                    onChange={(e) =>
                                        setTagDraft(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === "Enter" ||
                                            e.key === ","
                                        ) {
                                            e.preventDefault();
                                            commitTagDraft();
                                        }
                                    }}
                                    onBlur={commitTagDraft}
                                    className={`${INPUT_CLASS} text-base sm:text-sm min-w-0 flex-1`}
                                />
                            </div>
                        </div>
                    )}

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
                                    readOnly={isBuffer}
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
                                {isBuffer ? "Build By" : "Target Date"}
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

                    {!isBuffer && (
                        <div>
                            <Switch
                                id="goal-use-cpf-oa"
                                label="Use CPF OA"
                                hint="Funds this goal from your CPF OA first."
                                checked={useCpfOa}
                                onChange={setUseCpfOa}
                            />
                            {useCpfOa && (
                                <div className="mt-2">
                                    <label
                                        htmlFor="goal-cpf-cap"
                                        className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                                    >
                                        Up to
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-sm font-bold text-(--text-muted)">
                                            S$
                                        </span>
                                        <input
                                            id="goal-cpf-cap"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="No cap"
                                            value={cpfOaCap}
                                            onChange={(e) =>
                                                setCpfOaCap(e.target.value)
                                            }
                                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-9 pr-3.5 py-2 text-base sm:text-sm font-mono-num font-semibold text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                        />
                                    </div>
                                    <a
                                        href="https://www.cpf.gov.sg/member/tools-and-services/calculators"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-1.5 inline-flex min-h-11 items-center text-xs font-bold text-(--text-muted) underline hover:text-(--text-ink)"
                                    >
                                        Check CPF limits
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-xs text-(--text-muted)">
                        {isBuffer
                            ? "Filled first, before every goal."
                            : "Filled from your household pool in date order."}
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
