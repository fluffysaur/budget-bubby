import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingModal } from "../src/components/onboarding/OnboardingModal";
import {
    completeOnboardingTask,
    getOnboardingTasks,
    hatchBubby,
    isBubbyHatched,
    isFirstLaunch,
    isMemberBubbyHatched,
    isOnboardingRewarded,
    markOnboardingSeen,
    ONBOARDING_SNACK,
    readOnboardingStore,
} from "../src/lib/onboarding";
import { readBubbyStore } from "../src/lib/bubby/storage";
import { onAppEvent } from "../src/lib/appEvents";

describe("onboarding store & egg hatch logic", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("starts as first launch, unhatched, with 4 incomplete starter quests", () => {
        expect(isFirstLaunch()).toBe(true);
        expect(isBubbyHatched()).toBe(false);
        expect(isOnboardingRewarded()).toBe(false);
        const tasks = getOnboardingTasks();
        expect(tasks).toHaveLength(4);
        expect(tasks.every((t) => !t.done)).toBe(true);
    });

    it("persists seen state on markOnboardingSeen", () => {
        markOnboardingSeen();
        expect(isFirstLaunch()).toBe(false);
    });

    it("combines persisted task visits with real data signals", () => {
        completeOnboardingTask("plan");
        const tasks = getOnboardingTasks(readOnboardingStore(), {
            hasBudget: true,
            hasAccount: true,
            hasExpense: false,
            hasPlan: false,
        });
        expect(tasks.find((t) => t.id === "budget")?.done).toBe(true);
        expect(tasks.find((t) => t.id === "account")?.done).toBe(true);
        expect(tasks.find((t) => t.id === "expense")?.done).toBe(false);
        expect(tasks.find((t) => t.id === "plan")?.done).toBe(true);
    });

    it("hatches Bubby per member so a partner must still hatch their own", () => {
        const first = hatchBubby("member-1");
        expect(first).toEqual({ hatchedNow: true, rewardedNow: true });
        expect(isMemberBubbyHatched("member-1")).toBe(true);
        expect(isMemberBubbyHatched("member-2")).toBe(false);
        expect(isOnboardingRewarded()).toBe(true);

        const snacks = readBubbyStore().snacks ?? [];
        expect(snacks).toContainEqual(ONBOARDING_SNACK);

        // Hatching the same member again is a no-op
        const repeat = hatchBubby("member-1");
        expect(repeat).toEqual({ hatchedNow: false, rewardedNow: false });

        // Partner can hatch independently without duplicating the welcome snack
        const partner = hatchBubby("member-2");
        expect(partner).toEqual({ hatchedNow: true, rewardedNow: false });
        expect(isMemberBubbyHatched("member-2")).toBe(true);
        expect(
            (readBubbyStore().snacks ?? []).filter(
                (s) => s.week === ONBOARDING_SNACK.week,
            ),
        ).toHaveLength(1);
    });
});

describe("OnboardingModal", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("walks through all 4 steps via Next/Back with non-clickable step tracker and opens BubbySheet on Let's Start!", () => {
        const onClose = vi.fn();
        const onOpenSheet = vi.fn();
        const off = onAppEvent("bubby:open-sheet", onOpenSheet);

        render(<OnboardingModal isOpen onClose={onClose} />);

        expect(
            screen.getByRole("heading", { name: "Welcome Guide" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("list", { name: "Onboarding steps" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: "Budget" }),
        ).toBeInTheDocument();
        // No per-step jump buttons that would close the modal early
        expect(
            screen.queryByRole("button", { name: "Open Budget" }),
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Next/i }));
        expect(
            screen.getByRole("heading", { name: "Spend & Inbox" }),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Back/i }));
        expect(
            screen.getByRole("heading", { name: "Budget" }),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Next/i }));
        fireEvent.click(screen.getByRole("button", { name: /Next/i }));
        expect(
            screen.getByRole("heading", { name: "Plan" }),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Next/i }));
        expect(
            screen.getByRole("heading", { name: "Meet Bubby" }),
        ).toBeInTheDocument();
        expect(screen.getByTestId("bubby-egg")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Let's Start!" }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onOpenSheet).toHaveBeenCalledTimes(1);
        off();
    });

    it("shows hatched Bubby visual on step 4 when already hatched", () => {
        render(<OnboardingModal isOpen onClose={vi.fn()} hatched />);

        fireEvent.click(screen.getByRole("button", { name: /Next/i }));
        fireEvent.click(screen.getByRole("button", { name: /Next/i }));
        fireEvent.click(screen.getByRole("button", { name: /Next/i }));

        expect(screen.queryByTestId("bubby-egg")).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Let's Start!" }),
        ).toBeInTheDocument();
    });
});
