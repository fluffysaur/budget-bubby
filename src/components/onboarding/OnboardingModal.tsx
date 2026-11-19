/**
 * Multi-step Welcome Guide modal (first-launch & on-demand).
 * Walks users sequentially through Budget > Spend > Plan > Bubby using
 * Back / Next navigation, ending with "Let's Start!" to open BubbySheet
 * and show their Starter Quests.
 */

import { useCallback, useEffect, useState } from "react";
import {
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
import { Button } from "../ui/Button";
import { Bubby } from "../bubby/Bubby";
import { BubbyEgg } from "../bubby/BubbyEgg";
import { emitAppEvent } from "../../lib/appEvents";
import { isBubbyHatched, readOnboardingStore } from "../../lib/onboarding";

export interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    hatched?: boolean;
}

type GuideStepId = "budget" | "spend" | "plan" | "bubby";

interface TourStep {
    id: GuideStepId;
    label: string;
    title: string;
    body: string;
    accent: string;
}

const STEPS: readonly TourStep[] = [
    {
        id: "budget",
        label: "Budget",
        title: "Budget",
        body: "Set your monthly take-home flow, category caps, and savings split.",
        accent: "bg-(--pastel-lilac-light)",
    },
    {
        id: "spend",
        label: "Spend",
        title: "Spend & Inbox",
        body: "Log expenses fast with Quick Add (C) or triage synced items in Inbox.",
        accent: "bg-(--pastel-butter-light)",
    },
    {
        id: "plan",
        label: "Plan",
        title: "Plan",
        body: "Track savings goals, recurring bills, and credit card statements together.",
        accent: "bg-(--pastel-mint-light)",
    },
    {
        id: "bubby",
        label: "Bubby",
        title: "Meet Bubby",
        body: "Log daily, sort your inbox, and pet Bubby to keep your penguins happy.",
        accent: "bg-(--pastel-pink-light)",
    },
];

function StepVisual({ step, hatched }: { step: TourStep; hatched: boolean }) {
    if (step.id === "bubby") {
        return (
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-(--border-ink) bg-(--pastel-pink-light) shadow-cute-sm">
                {hatched ? (
                    <Bubby size="sm" idle decorative />
                ) : (
                    <BubbyEgg size="sm" cracks={1} decorative />
                )}
            </div>
        );
    }

    const Icon =
        step.id === "budget"
            ? PieChart
            : step.id === "spend"
              ? Receipt
              : Compass;

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
    hatched: hatchedProp,
}: OnboardingModalProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [hatchedState, setHatchedState] = useState<boolean>(() =>
        isBubbyHatched(),
    );

    useEffect(() => {
        if (!isOpen) return;
        setHatchedState(isBubbyHatched(readOnboardingStore()));
        setStepIndex(0);
    }, [isOpen]);

    const hatched = hatchedProp ?? hatchedState;
    const current = STEPS[stepIndex] ?? STEPS[0];
    const isLast = stepIndex === STEPS.length - 1;

    const handleStart = useCallback(() => {
        onClose();
        emitAppEvent("bubby:open-sheet", {});
    }, [onClose]);

    const bodyCopy =
        current.id === "bubby" && !hatched
            ? "Finish starter quests to hatch your Bubby egg, then log daily to keep your penguins happy."
            : current.body;

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <ModalHeader
                title="Welcome Guide"
                subtitle={`Step ${stepIndex + 1} of ${STEPS.length}`}
                onClose={onClose}
            />

            <ModalBody className="space-y-4">
                {/* Non-clickable sequential step tracker */}
                <ol
                    aria-label="Onboarding steps"
                    className="flex flex-wrap items-center justify-center gap-1 text-xs font-bold"
                >
                    {STEPS.map((s, idx) => {
                        const active = idx === stepIndex;
                        const passed = idx < stepIndex;
                        return (
                            <li
                                key={s.id}
                                aria-current={active ? "step" : undefined}
                                className="inline-flex items-center gap-1"
                            >
                                <span
                                    className={
                                        active
                                            ? "rounded-full border-2 border-(--border-ink) bg-(--pastel-lilac) px-2.5 py-0.5 text-(--text-ink) shadow-cute-sm"
                                            : passed
                                              ? "px-1 text-(--text-ink)"
                                              : "px-1 text-(--text-faint)"
                                    }
                                >
                                    {s.label}
                                </span>
                                {idx < STEPS.length - 1 && (
                                    <ChevronRight
                                        className="h-3.5 w-3.5 text-(--text-faint)"
                                        strokeWidth={2.5}
                                        aria-hidden="true"
                                    />
                                )}
                            </li>
                        );
                    })}
                </ol>

                <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-5 text-center">
                    <StepVisual step={current} hatched={hatched} />
                    <div className="space-y-1.5">
                        <h3 className="text-xl font-black font-display tracking-tight text-(--text-ink)">
                            {current.title}
                        </h3>
                        <p className="text-sm font-medium text-(--text-muted)">
                            {bodyCopy}
                        </p>
                    </div>
                </div>
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
                        <Button
                            variant="primary"
                            size="sm"
                            rightIcon={
                                <Sparkles
                                    className="h-4 w-4"
                                    strokeWidth={2.5}
                                />
                            }
                            onClick={handleStart}
                        >
                            Let&apos;s Start!
                        </Button>
                    )}
                </div>
            </ModalFooter>
        </AnimatedModal>
    );
}

export default OnboardingModal;
