/**
 * BonusFormModal Component
 * Two-step Log / Edit Bonus flow:
 * 1. Details: recipient, type, date, gross, CPF (auto 20%, editable), note
 * 2. Split: five buckets from the recipient's default split; the Goals share
 *    funds selected goals for real, the rest is recorded as intent.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Lock, RotateCcw, Sparkles, Unlock } from "lucide-react";
import {
    Alert,
    AnimatedModal,
    Badge,
    Button,
    CurrencyText,
    Input,
    ModalBody,
    ModalFooter,
    ModalHeader,
    SegmentedTabs,
    Select,
    TruncatedText,
} from "../ui";
import { BonusGoalPicker } from "./BonusGoalPicker";
import {
    BONUS_SPLIT_BUCKETS,
    BONUS_SPLIT_KEYS,
    BONUS_TYPES,
    BONUS_TYPE_LABELS,
    DEFAULT_BONUS_CPF_RATE,
    cloneDefaultSplit,
    computeBonusSplit,
    defaultBonusCpf,
    defaultBonusType,
    getSplitAmount,
} from "../../lib/bonusFormulas";
import {
    distributeGoalShare,
    isGoalFundable,
    type GoalDistributionMode,
} from "../../lib/goalDistribution";
import { autoBalanceAllocations } from "../../lib/financialFormulas";
import { getTodayDateString } from "../../lib/dateUtils";
import { useBonusSplitDefaultQuery } from "../../hooks/useFinanceQueries";
import { financeService } from "../../services/financeService";
import type {
    BaseBudgetProfile,
    BonusEvent,
    BonusSplitKey,
    BonusSplitShare,
    BonusType,
    HouseholdMember,
    SavingsGoal,
} from "../../types/finance";

type Step = "details" | "split";

export interface BonusSavedInfo {
    event: BonusEvent;
    created: boolean;
    goalTotal: number;
    reachedGoalTitle: string | null;
}

export interface BonusFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    members: HouseholdMember[];
    goals: SavingsGoal[];
    baseProfiles?: BaseBudgetProfile[];
    defaultRecipientId?: string;
    /** Event to edit; omit to log a new bonus. */
    editingEvent?: BonusEvent | null;
    /** Show "Save as default" (hidden while the bonus log is unavailable). */
    canSaveDefault?: boolean;
    onSaved?: (info: BonusSavedInfo) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const EMPTY_GOALS: SavingsGoal[] = [];

function splitToPercentInputs(
    split: readonly BonusSplitShare[],
): Record<BonusSplitKey, string> {
    const out = {} as Record<BonusSplitKey, string>;
    for (const key of BONUS_SPLIT_KEYS) {
        const pct = split.find((s) => s.key === key)?.pct ?? 0;
        out[key] = String(Math.round(pct * 10000) / 100);
    }
    return out;
}

function lastMonthDate(): string {
    const today = getTodayDateString();
    const [y, m] = today.split("-").map(Number);
    const year = m === 1 ? y - 1 : y;
    const month = m === 1 ? 12 : m - 1;
    return `${year}-${String(month).padStart(2, "0")}-15`;
}

function useOnlineStatus(): boolean {
    const [online, setOnline] = useState<boolean>(
        typeof navigator === "undefined" ? true : navigator.onLine !== false,
    );
    useEffect(() => {
        const update = () => setOnline(navigator.onLine !== false);
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => {
            window.removeEventListener("online", update);
            window.removeEventListener("offline", update);
        };
    }, []);
    return online;
}

export function BonusFormModal({
    isOpen,
    onClose,
    members,
    goals,
    baseProfiles = [],
    defaultRecipientId,
    editingEvent = null,
    canSaveDefault = true,
    onSaved,
}: BonusFormModalProps) {
    const isEdit = Boolean(editingEvent);
    const online = useOnlineStatus();

    const [step, setStep] = useState<Step>("details");
    const [recipientId, setRecipientId] = useState<string>("");
    const [type, setType] = useState<BonusType>("performance");
    const [receivedOn, setReceivedOn] = useState<string>(getTodayDateString);
    const [grossInput, setGrossInput] = useState<string>("");
    const [cpfInput, setCpfInput] = useState<string>("");
    const [cpfAuto, setCpfAuto] = useState<boolean>(true);
    const [note, setNote] = useState<string>("");

    const [pctInputs, setPctInputs] = useState<Record<BonusSplitKey, string>>(
        () => splitToPercentInputs(cloneDefaultSplit()),
    );
    const [lockedBuckets, setLockedBuckets] = useState<Record<string, boolean>>(
        {},
    );
    const [splitTouched, setSplitTouched] = useState<boolean>(false);

    const [selectedGoalIds, setSelectedGoalIds] = useState<Set<string>>(
        new Set(),
    );
    const [goalPreset, setGoalPreset] = useState<GoalDistributionMode | null>(
        null,
    );
    const [manualAmounts, setManualAmounts] = useState<Record<string, string>>(
        {},
    );
    const [goalsInitialized, setGoalsInitialized] = useState<boolean>(false);

    const [saveAsDefault, setSaveAsDefault] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const { data: splitDefaultData } = useBonusSplitDefaultQuery(
        isOpen && recipientId ? recipientId : undefined,
    );

    // Reset whenever the modal opens
    useEffect(() => {
        if (!isOpen) return;
        setStep("details");
        setErrorMessage(null);
        setIsSubmitting(false);
        setSaveAsDefault(false);
        setLockedBuckets({});
        if (editingEvent) {
            setRecipientId(editingEvent.recipient_id);
            setType(editingEvent.type);
            setReceivedOn(editingEvent.received_on);
            setGrossInput(String(editingEvent.gross));
            setCpfInput(String(editingEvent.cpf));
            setCpfAuto(false);
            setNote(editingEvent.note ?? "");
            setPctInputs(
                splitToPercentInputs(
                    editingEvent.split.length > 0
                        ? editingEvent.split
                        : cloneDefaultSplit(),
                ),
            );
            setSplitTouched(true);
            setSelectedGoalIds(
                new Set(editingEvent.goal_contributions.map((c) => c.goal_id)),
            );
            setManualAmounts(
                Object.fromEntries(
                    editingEvent.goal_contributions.map((c) => [
                        c.goal_id,
                        String(c.amount),
                    ]),
                ),
            );
            setGoalPreset(null);
            setGoalsInitialized(true);
        } else {
            const today = getTodayDateString();
            setRecipientId(defaultRecipientId || members[0]?.id || "");
            setType(defaultBonusType(today));
            setReceivedOn(today);
            setGrossInput("");
            setCpfInput("");
            setCpfAuto(true);
            setNote("");
            setPctInputs(splitToPercentInputs(cloneDefaultSplit()));
            setSplitTouched(false);
            setSelectedGoalIds(new Set());
            setManualAmounts({});
            setGoalPreset(null);
            setGoalsInitialized(false);
        }
    }, [isOpen, editingEvent, defaultRecipientId, members]);

    // Start from the recipient's saved default until the user edits the split
    useEffect(() => {
        if (!isOpen || splitTouched || !splitDefaultData) return;
        setPctInputs(splitToPercentInputs(splitDefaultData));
    }, [isOpen, splitTouched, splitDefaultData]);

    const recipient = members.find((m) => m.id === recipientId);
    const recipientName = recipient?.display_name ?? "Recipient";
    const cpfRate =
        Number(
            baseProfiles.find((p) => p.owner_id === recipientId)
                ?.cpf_employee_rate,
        ) || DEFAULT_BONUS_CPF_RATE;

    const gross = Math.max(0, parseFloat(grossInput) || 0);
    const cpf = cpfAuto
        ? defaultBonusCpf(gross, cpfRate)
        : Math.max(0, parseFloat(cpfInput) || 0);
    const net = round2(gross - cpf);

    const detailsError = !recipientId
        ? "Pick a recipient."
        : !receivedOn
          ? "Pick the date received."
          : gross <= 0
            ? null
            : cpf > gross
              ? "CPF can't exceed gross."
              : null;
    const detailsValid = Boolean(
        recipientId && receivedOn && gross > 0 && cpf <= gross,
    );

    const splitShares = useMemo<BonusSplitShare[]>(
        () =>
            BONUS_SPLIT_KEYS.map((key) => ({
                key,
                pct: Math.max(0, parseFloat(pctInputs[key]) || 0) / 100,
            })),
        [pctInputs],
    );
    const pctTotal = round2(splitShares.reduce((s, x) => s + x.pct * 100, 0));
    const splitValid = Math.abs(pctTotal - 100) < 0.01;
    const computedSplit = useMemo(
        () => computeBonusSplit(net, splitShares),
        [net, splitShares],
    );
    const goalShare = getSplitAmount(computedSplit, "goals");

    // Recipient's goals first, then joint goals. Goals already funded by this
    // bonus stay listed even if they are now achieved.
    const eligibleGoals = useMemo(() => {
        const fundedIds = new Set(
            editingEvent?.goal_contributions.map((c) => c.goal_id) ?? [],
        );
        const list = (goals ?? EMPTY_GOALS).filter(
            (g) =>
                fundedIds.has(g.id) ||
                (isGoalFundable(g) &&
                    (!g.owner_id ||
                        g.owner_id === "joint" ||
                        g.owner_id === recipientId)),
        );
        return [...list].sort((a, b) => {
            const aOwn = a.owner_id === recipientId ? 0 : 1;
            const bOwn = b.owner_id === recipientId ? 0 : 1;
            return aOwn - bOwn;
        });
    }, [goals, recipientId, editingEvent]);

    const selectedGoals = useMemo(
        () => eligibleGoals.filter((g) => selectedGoalIds.has(g.id)),
        [eligibleGoals, selectedGoalIds],
    );

    const goalAmounts = useMemo<Record<string, number>>(() => {
        if (goalPreset) {
            const dist = distributeGoalShare(
                goalShare,
                selectedGoals,
                goalPreset,
                selectedGoals[0]?.id,
            );
            return Object.fromEntries(dist.map((c) => [c.goal_id, c.amount]));
        }
        return Object.fromEntries(
            Object.entries(manualAmounts).map(([id, v]) => [
                id,
                Math.max(0, parseFloat(v) || 0),
            ]),
        );
    }, [goalPreset, goalShare, selectedGoals, manualAmounts]);

    const assignedToGoals = round2(
        selectedGoals.reduce((s, g) => s + (goalAmounts[g.id] || 0), 0),
    );
    const overAssigned = assignedToGoals - goalShare > 0.005;
    const originalGoalShare = editingEvent
        ? getSplitAmount(
              computeBonusSplit(
                  editingEvent.net,
                  editingEvent.split.length > 0
                      ? editingEvent.split
                      : cloneDefaultSplit(),
              ),
              "goals",
          )
        : 0;
    const showMismatchWarning =
        isEdit &&
        !goalPreset &&
        assignedToGoals > 0 &&
        Math.abs(goalShare - originalGoalShare) > 0.005 &&
        Math.abs(assignedToGoals - goalShare) > 0.005;

    const handleGoNext = () => {
        if (!detailsValid) return;
        if (!goalsInitialized) {
            const own = eligibleGoals.filter((g) => g.owner_id === recipientId);
            if (own.length === 1) {
                setSelectedGoalIds(new Set([own[0].id]));
                setGoalPreset("single");
            } else {
                setSelectedGoalIds(new Set(eligibleGoals.map((g) => g.id)));
                setGoalPreset("gap");
            }
            setGoalsInitialized(true);
        }
        setStep("split");
    };

    const handleRecipientChange = (id: string) => {
        setRecipientId(id);
        if (!isEdit) {
            // New recipient: reload their default split and goal selection
            setSplitTouched(false);
            setGoalsInitialized(false);
        }
    };

    const handlePctChange = (key: BonusSplitKey, raw: string) => {
        setSplitTouched(true);
        const next = { ...pctInputs, [key]: raw };
        const balanced = autoBalanceAllocations<string>(
            [...BONUS_SPLIT_KEYS],
            next,
            { ...lockedBuckets, [key]: true },
            true,
        );
        if (balanced.error) {
            setPctInputs(next);
            return;
        }
        setPctInputs({
            ...(balanced.updatedPercentages as Record<BonusSplitKey, string>),
            [key]: raw,
        });
    };

    const handleResetSplit = () => {
        setPctInputs(
            splitToPercentInputs(splitDefaultData ?? cloneDefaultSplit()),
        );
        setLockedBuckets({});
    };

    const handleToggleGoal = (goalId: string) => {
        const next = new Set(selectedGoalIds);
        if (next.has(goalId)) {
            next.delete(goalId);
        } else {
            next.add(goalId);
        }
        if (!goalPreset) {
            setManualAmounts((prev) => {
                const copy = { ...prev };
                if (!next.has(goalId)) delete copy[goalId];
                return copy;
            });
        }
        setSelectedGoalIds(next);
    };

    const handleGoalAmountChange = (goalId: string, value: string) => {
        setManualAmounts((prev) => {
            const base = goalPreset
                ? Object.fromEntries(
                      Object.entries(goalAmounts).map(([id, amt]) => [
                          id,
                          String(amt),
                      ]),
                  )
                : prev;
            return { ...base, [goalId]: value };
        });
        setGoalPreset(null);
    };

    const handlePreset = (mode: GoalDistributionMode) => {
        setManualAmounts({});
        setGoalPreset(mode);
    };

    const canSave =
        detailsValid && splitValid && !overAssigned && online && !isSubmitting;

    const handleSubmit = async (e?: FormEvent) => {
        e?.preventDefault();
        if (step === "details") {
            handleGoNext();
            return;
        }
        if (!canSave) return;

        const contributions = selectedGoals
            .map((g) => ({
                goal_id: g.id,
                amount: round2(goalAmounts[g.id] || 0),
            }))
            .filter((c) => c.amount > 0);

        try {
            setIsSubmitting(true);
            setErrorMessage(null);
            const saved = await financeService.saveBonusEvent({
                id: editingEvent?.id,
                recipient_id: recipientId,
                type,
                received_on: receivedOn,
                gross: round2(gross),
                cpf: round2(cpf),
                note: note.trim() || null,
                split: computedSplit,
                goal_contributions: contributions,
            });
            if (saveAsDefault && canSaveDefault) {
                await financeService.saveBonusSplitDefault(
                    recipientId,
                    splitShares,
                );
            }

            const previous = new Map(
                editingEvent?.goal_contributions.map((c) => [
                    c.goal_id,
                    c.amount,
                ]) ?? [],
            );
            const reached = contributions.find((c) => {
                const g = goals.find((x) => x.id === c.goal_id);
                if (!g || g.saved_so_far >= g.target_amount) return false;
                return (
                    g.saved_so_far -
                        (previous.get(c.goal_id) ?? 0) +
                        c.amount >=
                    g.target_amount
                );
            });
            onSaved?.({
                event: saved,
                created: !isEdit,
                goalTotal: round2(
                    contributions.reduce((s, c) => s + c.amount, 0),
                ),
                reachedGoalTitle: reached
                    ? (goals.find((g) => g.id === reached.goal_id)?.title ??
                      null)
                    : null,
            });
            onClose();
        } catch (err: unknown) {
            setErrorMessage(
                err instanceof Error ? err.message : "Failed to save bonus.",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const memberOptions = members.map((m) => ({
        value: m.id,
        label: m.display_name,
    }));

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
            <form
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                aria-label={isEdit ? "Edit Bonus" : "Log Bonus"}
            >
                <ModalHeader
                    id="bonus-form-title"
                    title={isEdit ? "Edit Bonus" : "Log Bonus"}
                    icon={
                        <Sparkles className="h-4.5 w-4.5" strokeWidth={2.5} />
                    }
                    iconBgColor="bg-(--pastel-lilac-light)"
                    onClose={onClose}
                />

                <ModalBody className="space-y-4">
                    <SegmentedTabs
                        ariaLabel="Bonus steps"
                        size="sm"
                        tabs={[
                            { id: "details", label: "Details" },
                            { id: "split", label: "Split" },
                        ]}
                        activeTab={step}
                        onChange={(id) => {
                            if (id === "details") setStep("details");
                        }}
                    />

                    {errorMessage && (
                        <Alert variant="danger">{errorMessage}</Alert>
                    )}
                    {!online && (
                        <Alert variant="warning" title="You're offline">
                            Reconnect to save bonuses.
                        </Alert>
                    )}

                    {step === "details" ? (
                        <div className="space-y-4">
                            <Select
                                label="Recipient"
                                id="bonus-recipient"
                                value={recipientId}
                                onChange={(e) =>
                                    handleRecipientChange(e.target.value)
                                }
                                options={memberOptions}
                            />

                            <div className="space-y-1.5">
                                <span className="block text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                    Type
                                </span>
                                <div
                                    className="flex flex-wrap gap-1.5"
                                    role="group"
                                    aria-label="Type"
                                >
                                    {BONUS_TYPES.map((t) => (
                                        <Button
                                            key={t}
                                            type="button"
                                            size="sm"
                                            variant={
                                                type === t
                                                    ? "secondary"
                                                    : "outline"
                                            }
                                            aria-pressed={type === t}
                                            onClick={() => setType(t)}
                                        >
                                            {BONUS_TYPE_LABELS[t]}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Input
                                    label="Received"
                                    id="bonus-received"
                                    type="date"
                                    value={receivedOn}
                                    onChange={(e) =>
                                        setReceivedOn(e.target.value)
                                    }
                                />
                                <div className="flex gap-1.5">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            setReceivedOn(getTodayDateString())
                                        }
                                    >
                                        Today
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            setReceivedOn(lastMonthDate())
                                        }
                                    >
                                        Last month
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Input
                                    label="Gross"
                                    id="bonus-gross"
                                    inputMode="decimal"
                                    mono
                                    placeholder="0.00"
                                    value={grossInput}
                                    onChange={(e) =>
                                        setGrossInput(e.target.value)
                                    }
                                />
                                <div className="space-y-1.5">
                                    <Input
                                        label="CPF"
                                        id="bonus-cpf"
                                        inputMode="decimal"
                                        mono
                                        value={
                                            cpfAuto
                                                ? gross > 0
                                                    ? String(cpf)
                                                    : ""
                                                : cpfInput
                                        }
                                        placeholder="0.00"
                                        onChange={(e) => {
                                            setCpfAuto(false);
                                            setCpfInput(e.target.value);
                                        }}
                                        rightElement={
                                            cpfAuto ? (
                                                <Badge variant="mint" size="sm">
                                                    Auto
                                                </Badge>
                                            ) : undefined
                                        }
                                    />
                                    {!cpfAuto && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            leftIcon={
                                                <RotateCcw className="h-3.5 w-3.5" />
                                            }
                                            onClick={() => setCpfAuto(true)}
                                        >
                                            Reset
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-(--border-ink) bg-(--pastel-mint-light) px-3 py-2.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                    Net
                                </span>
                                <span
                                    className="shrink-0 font-mono-num text-sm font-black text-(--text-ink)"
                                    data-testid="bonus-net"
                                >
                                    <CurrencyText amount={net} />
                                </span>
                            </div>

                            <Input
                                label="Note"
                                id="bonus-note"
                                placeholder="FY26 AWS"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />

                            {detailsError && (
                                <Alert variant="danger">{detailsError}</Alert>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-(--text-ink)">
                                    <CurrencyText amount={net} /> net to split
                                </p>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    leftIcon={
                                        <RotateCcw className="h-3.5 w-3.5" />
                                    }
                                    onClick={handleResetSplit}
                                >
                                    Reset
                                </Button>
                            </div>

                            <div className="divide-y divide-(--border-subtle)">
                                {BONUS_SPLIT_BUCKETS.map((bucket) => {
                                    const locked = Boolean(
                                        lockedBuckets[bucket.key],
                                    );
                                    return (
                                        <div
                                            key={bucket.key}
                                            className="flex items-center gap-2 py-2"
                                            data-testid={`bonus-split-${bucket.key}`}
                                        >
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        bucket.color,
                                                }}
                                            />
                                            <div className="min-w-0 flex-1 text-sm font-bold text-(--text-ink)">
                                                <TruncatedText
                                                    text={bucket.label}
                                                />
                                            </div>
                                            <div className="w-20 shrink-0">
                                                <Input
                                                    id={`bonus-pct-${bucket.key}`}
                                                    aria-label={`${bucket.label} %`}
                                                    inputMode="decimal"
                                                    mono
                                                    value={
                                                        pctInputs[bucket.key]
                                                    }
                                                    onChange={(e) =>
                                                        handlePctChange(
                                                            bucket.key,
                                                            e.target.value,
                                                        )
                                                    }
                                                    rightElement={
                                                        <span className="text-xs text-(--text-muted)">
                                                            %
                                                        </span>
                                                    }
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={`${locked ? "Unlock" : "Lock"} ${bucket.label}`}
                                                aria-pressed={locked}
                                                onClick={() =>
                                                    setLockedBuckets(
                                                        (prev) => ({
                                                            ...prev,
                                                            [bucket.key]:
                                                                !prev[
                                                                    bucket.key
                                                                ],
                                                        }),
                                                    )
                                                }
                                            >
                                                {locked ? (
                                                    <Lock className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Unlock className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                            <span className="w-20 shrink-0 text-right font-mono-num text-sm font-bold text-(--text-ink)">
                                                <CurrencyText
                                                    amount={getSplitAmount(
                                                        computedSplit,
                                                        bucket.key,
                                                    )}
                                                />
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {!splitValid && (
                                <Alert variant="danger">
                                    Split totals {pctTotal}%, not 100%.
                                </Alert>
                            )}

                            <div className="space-y-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                        Goals
                                    </span>
                                    <span className="shrink-0 font-mono-num text-sm font-black text-(--text-ink)">
                                        <CurrencyText amount={goalShare} />
                                    </span>
                                </div>
                                {eligibleGoals.length === 0 ? (
                                    <Alert
                                        variant="info"
                                        title="No active goals"
                                    >
                                        Goals share is recorded only.
                                    </Alert>
                                ) : (
                                    <>
                                        {showMismatchWarning && (
                                            <Alert
                                                variant="warning"
                                                action={
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            handlePreset("gap")
                                                        }
                                                    >
                                                        Rebalance
                                                    </Button>
                                                }
                                            >
                                                Amounts don't match Goals share.
                                            </Alert>
                                        )}
                                        <BonusGoalPicker
                                            goals={eligibleGoals}
                                            selectedIds={selectedGoalIds}
                                            amounts={goalAmounts}
                                            amountInputs={
                                                goalPreset
                                                    ? undefined
                                                    : manualAmounts
                                            }
                                            goalShare={goalShare}
                                            activePreset={goalPreset}
                                            onToggle={handleToggleGoal}
                                            onAmountChange={
                                                handleGoalAmountChange
                                            }
                                            onPreset={handlePreset}
                                        />
                                    </>
                                )}
                            </div>

                            {canSaveDefault && (
                                <label className="flex min-h-11 cursor-pointer select-none items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={saveAsDefault}
                                        onChange={(e) =>
                                            setSaveAsDefault(e.target.checked)
                                        }
                                        className="h-4 w-4 cursor-pointer rounded-md border-(--border-ink) accent-(--text-ink)"
                                    />
                                    <span className="text-xs font-bold text-(--text-ink)">
                                        Save as default for {recipientName}
                                    </span>
                                </label>
                            )}
                        </div>
                    )}
                </ModalBody>

                <ModalFooter>
                    {step === "details" ? (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={!detailsValid}
                            >
                                Next
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setStep("details")}
                            >
                                Back
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={!canSave}
                                isLoading={isSubmitting}
                            >
                                {isEdit ? "Save" : "Log Bonus"}
                            </Button>
                        </>
                    )}
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default BonusFormModal;
