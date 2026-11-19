/**
 * Multi-step onboarding guide modal (first-launch & on-demand).
 * Covers core flows (Budget, Spend & Inbox, Plan, Bubby) plus an interactive
 * starter checklist that rewards a Bubby snack on completion.
 */

import { useCallback, useEffect, useState } from "react";
import {
    ArrowRight,
    Check,
    ChevronLeft,
    ChevronRight,
    Compass,
    PieChart,
    Receipt,
    Sparkles,
} from "lucide-react";
import {
    AnimatedModal,
    ModalBody,
    ModalFooter,
    ModalHeader,
} from "../ui/AnimatedModal";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Bubby } from "../bubby/Bubby";
import { SnackArt } from "../bubby/SnackArt";
import { emitAppEvent } from "../../lib/appEvents";
import {
    completeOnboardingTask,
    getOnboardingTasks,
    isOnboardingRewarded,
    ONBOARDING_SNACK,
    readOnboardingStore,
    toggleOnboardingTask,
    type OnboardingTask,
    type OnboardingTaskId,
} from "../../lib/onboarding";
import { snackLabel } from "../../lib/bubby/snacks";

export interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigateTab?: (tab: string) => void;
}

interface TourStep {
    id: OnboardingTaskId | "tasks";
    label: string;
    title: string;
    body: string;
    accent: string;
    ctaLabel?: string;
}

const STEPS: readonly TourStep[] = [
    {
        id: "budget",
        label: "Budget",
        title: "Budget",
        body: "Set your monthly take-home flow, category caps, and savings split.",
        accent: "bg-(--pastel-lilac-light)",
        ctaLabel: "Open Budget",
    },
    {
        id: "spend",
        label: "Spend",
        title: "Spend & Inbox",
        body: "Log expenses fast with Quick Add (C) or triage synced items in Inbox.",
        accent: "bg-(--pastel-butter-light)",
        ctaLabel: "Open Spend",
    },
    {
        id: "plan",
        label: "Plan",
        title: "Plan",
        body: "Track savings goals, recurring bills, and credit card statements together.",
        accent: "bg-(--pastel-mint-light)",
        ctaLabel: "Open Plan",
    },
    {
        id: "bubby",
        label: "Bubby",
        title: "Meet Bubby",
        body: "Log daily, sort your inbox, and pet Bubby to keep your penguins happy.",
        accent: "bg-(--pastel-pink-light)",
        ctaLabel: "See Bubby",
    },
    {
        id: "tasks",
        label: "Tasks",
        title: "Starter Tasks",
        body: "Complete all 4 tasks to earn a welcome snack for Bubby.",
        accent: "bg-(--pastel-butter-light)",
    },
];

function StepVisual({ step }: { step: TourStep }) {
    if (step.id === "bubby") {
        return (
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-(--border-ink) bg-(--pastel-pink-light) shadow-cute-sm">
                <Bubby size="sm" idle decorative />
            </div>
        );
    }

    const Icon =
        step.id === "budget"
            ? PieChart
            : step.id === "spend"
              ? Receipt
              : step.id === "plan"
                ? Compass
                : Sparkles;

    return (
        <div
            className={`flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-(--border-ink) ${step.accent} shadow-cute-sm`}
        >
            <Icon className="h-9 w-9 text-(--text-ink)" strokeWidth={2.5} />
        </div>
    );
}

export function OnboardingModal({
    isOpen,
    onClose,
    onNavigateTab,
}: OnboardingModalProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [tasks, setTasks] = useState<OnboardingTask[]>(() =>
        getOnboardingTasks(),
    );
    const [rewarded, setRewarded] = useState<boolean>(() =>
        isOnboardingRewarded(),
    );

    useEffect(() => {
        if (!isOpen) return;
        const store = readOnboardingStore();
        setTasks(getOnboardingTasks(store));
        setRewarded(isOnboardingRewarded(store));
        setStepIndex(0);
    }, [isOpen]);

    const current = STEPS[stepIndex] ?? STEPS[0];
    const isLast = stepIndex === STEPS.length - 1;
    const doneCount = tasks.filter((t) => t.done).length;

    const handleJump = useCallback(
        (taskId: OnboardingTaskId) => {
            const res = completeOnboardingTask(taskId);
            setTasks(res.tasks);
            if (res.rewardedNow) setRewarded(true);
            onClose();

            if (taskId === "budget") {
                onNavigateTab?.("budget");
            } else if (taskId === "spend") {
                onNavigateTab?.("spend");
            } else if (taskId === "plan") {
                onNavigateTab?.("plan");
            } else if (taskId === "bubby") {
                emitAppEvent("bubby:open-sheet", {});
            }
        },
        [onClose, onNavigateTab],
    );

    const handleToggleTask = useCallback((taskId: OnboardingTaskId) => {
        const res = toggleOnboardingTask(taskId);
        setTasks(res.tasks);
        if (res.rewardedNow || isOnboardingRewarded()) {
            setRewarded(true);
        }
    }, []);

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <ModalHeader
                title="Welcome Guide"
                subtitle={`Step ${stepIndex + 1} of ${STEPS.length}`}
                onClose={onClose}
            />

            <ModalBody className="space-y-4">
                {/* Step selector pills */}
                <nav
                    aria-label="Onboarding steps"
                    className="flex flex-wrap items-center gap-1.5"
                >
                    {STEPS.map((s, idx) => {
                        const active = idx === stepIndex;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setStepIndex(idx)}
                                aria-current={active ? "step" : undefined}
                                className={`min-h-8 rounded-full border-2 px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                                    active
                                        ? "border-(--border-ink) bg-(--pastel-lilac) text-(--text-ink) shadow-cute-sm"
                                        : "border-(--border-subtle) bg-(--bg-cream) text-(--text-muted) hover:text-(--text-ink)"
                                }`}
                            >
                                {idx + 1}. {s.label}
                            </button>
                        );
                    })}
                </nav>

                {current.id !== "tasks" ? (
                    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-5 text-center">
                        <StepVisual step={current} />
                        <div className="space-y-1.5">
                            <h3 className="text-xl font-black font-display tracking-tight text-(--text-ink)">
                                {current.title}
                            </h3>
                            <p className="text-sm font-medium text-(--text-muted)">
                                {current.body}
                            </p>
                        </div>
                        {current.ctaLabel && (
                            <Button
                                variant="secondary"
                                size="sm"
                                rightIcon={
                                    <ArrowRight
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                                onClick={() =>
                                    handleJump(current.id as OnboardingTaskId)
                                }
                            >
                                {current.ctaLabel}
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-(--text-muted)">
                                {current.body}
                            </p>
                            <Badge variant={rewarded ? "mint" : "butter"}>
                                {doneCount}/{tasks.length}
                            </Badge>
                        </div>

                        <ul
                            aria-label="Onboarding checklist"
                            className="flex flex-col gap-2"
                        >
                            {tasks.map((task) => (
                                <li
                                    key={task.id}
                                    data-done={task.done ? "true" : "false"}
                                    className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 transition-colors ${
                                        task.done
                                            ? "border-(--border-subtle) bg-(--bg-cream) opacity-85"
                                            : "border-(--border-ink) bg-(--bg-card) shadow-cute-sm"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        role="checkbox"
                                        aria-checked={task.done}
                                        onClick={() =>
                                            handleToggleTask(task.id)
                                        }
                                        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                                                task.done
                                                    ? "border-(--border-ink) bg-(--pastel-mint-light)"
                                                    : "border-(--border-subtle) bg-(--bg-cream)"
                                            }`}
                                        >
                                            {task.done && (
                                                <Check
                                                    className="h-3.5 w-3.5 text-(--text-ink)"
                                                    strokeWidth={3}
                                                />
                                            )}
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span
                                                className={`truncate text-sm font-bold ${
                                                    task.done
                                                        ? "line-through text-(--text-muted)"
                                                        : "text-(--text-ink)"
                                                }`}
                                            >
                                                {task.label}
                                            </span>
                                            <span className="truncate text-xs font-medium text-(--text-muted)">
                                                {task.description}
                                            </span>
                                        </span>
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleJump(task.id)}
                                        aria-label={`Go to ${task.label}`}
                                        className="shrink-0"
                                    >
                                        Go
                                    </Button>
                                </li>
                            ))}
                        </ul>

                        {rewarded ? (
                            <div
                                data-testid="onboarding-reward-banner"
                                className="flex items-center gap-3 rounded-2xl border-2 border-(--border-ink) bg-(--pastel-mint-light) p-3 shadow-cute-sm"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--pastel-butter-light)">
                                    <SnackArt id={ONBOARDING_SNACK.id} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-(--text-ink)">
                                        Snack Unlocked:{" "}
                                        {snackLabel(ONBOARDING_SNACK.id)}
                                    </p>
                                    <p className="text-xs font-medium text-(--text-muted)">
                                        Added to Bubby&apos;s snack collection.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-(--border-subtle) bg-(--bg-cream) p-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-subtle) bg-(--bg-card) opacity-75">
                                    <SnackArt id={ONBOARDING_SNACK.id} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-(--text-ink)">
                                        Reward: {snackLabel(ONBOARDING_SNACK.id)}
                                    </p>
                                    <p className="text-xs font-medium text-(--text-muted)">
                                        Finish all 4 tasks to feed Bubby a treat.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ModalBody>

            <ModalFooter className="justify-between">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={stepIndex === 0}
                    leftIcon={
                        <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
                    }
                    onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                >
                    Back
                </Button>
                <div className="flex items-center gap-2">
                    {!isLast ? (
                        <Button
                            variant="primary"
                            size="sm"
                            rightIcon={
                                <ChevronRight
                                    className="h-4 w-4"
                                    strokeWidth={2.5}
                                />
                            }
                            onClick={() =>
                                setStepIndex((i) =>
                                    Math.min(STEPS.length - 1, i + 1),
                                )
                            }
                        >
                            Next
                        </Button>
                    ) : (
                        <Button variant="primary" size="sm" onClick={onClose}>
                            Done
                        </Button>
                    )}
                </div>
            </ModalFooter>
        </AnimatedModal>
    );
}

export default OnboardingModal;
