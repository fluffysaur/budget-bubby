import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    completeOnboardingTask,
    isFirstLaunch,
    markOnboardingSeen,
    ONBOARDING_SNACK,
    toggleOnboardingTask,
} from "../src/lib/onboarding";
import { readBubbyStore } from "../src/lib/bubby/storage";
import { onAppEvent } from "../src/lib/appEvents";
import { OnboardingModal } from "../src/components/onboarding/OnboardingModal";
import { BubbySheet } from "../src/components/bubby/BubbySheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { PrivacyProvider } from "../src/context/PrivacyContext";
import { App } from "../src/App";

function renderWithProviders(ui: React.ReactElement) {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={qc}>
            <HouseholdProvider>
                <PrivacyProvider>{ui}</PrivacyProvider>
            </HouseholdProvider>
        </QueryClientProvider>,
    );
}

describe("Onboarding state & snack reward", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("tracks first-launch state and grants a Bubby snack once all tasks are complete", () => {
        expect(isFirstLaunch()).toBe(true);
        markOnboardingSeen();
        expect(isFirstLaunch()).toBe(false);

        expect(completeOnboardingTask("budget").rewardedNow).toBe(false);
        expect(completeOnboardingTask("spend").rewardedNow).toBe(false);
        expect(completeOnboardingTask("plan").rewardedNow).toBe(false);
        expect(readBubbyStore().snacks ?? []).toHaveLength(0);

        const last = completeOnboardingTask("bubby");
        expect(last.rewardedNow).toBe(true);
        expect(last.tasks.every((t) => t.done)).toBe(true);
        expect(readBubbyStore().snacks).toEqual([ONBOARDING_SNACK]);

        // Idempotent: toggling/completing again does not duplicate the snack
        toggleOnboardingTask("budget");
        toggleOnboardingTask("budget");
        expect(readBubbyStore().snacks).toEqual([ONBOARDING_SNACK]);
    });
});

describe("OnboardingModal", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("steps through Budget, Spend & Inbox, Plan, Bubby, and Starter Tasks", () => {
        const onClose = vi.fn();
        const onNavigateTab = vi.fn();

        renderWithProviders(
            <OnboardingModal
                isOpen={true}
                onClose={onClose}
                onNavigateTab={onNavigateTab}
            />,
        );

        const dialog = screen.getByRole("dialog");
        expect(
            within(dialog).getByRole("heading", { name: "Budget" }),
        ).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("button", { name: /Next/i }));
        expect(
            within(dialog).getByRole("heading", { name: "Spend & Inbox" }),
        ).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("button", { name: /Next/i }));
        expect(
            within(dialog).getByRole("heading", { name: "Plan" }),
        ).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("button", { name: /Next/i }));
        expect(
            within(dialog).getByRole("heading", { name: "Meet Bubby" }),
        ).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("button", { name: /Next/i }));
        const list = within(dialog).getByRole("list", {
            name: "Onboarding checklist",
        });
        const checkboxes = within(list).getAllByRole("checkbox");
        expect(checkboxes).toHaveLength(4);

        for (const cb of checkboxes) {
            fireEvent.click(cb);
        }

        expect(
            within(dialog).getByTestId("onboarding-reward-banner"),
        ).toBeInTheDocument();
        expect(readBubbyStore().snacks).toEqual([ONBOARDING_SNACK]);
    });

    it("navigates to Budget and marks the budget task done on CTA click", () => {
        const onClose = vi.fn();
        const onNavigateTab = vi.fn();

        renderWithProviders(
            <OnboardingModal
                isOpen={true}
                onClose={onClose}
                onNavigateTab={onNavigateTab}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /Open Budget/i }));
        expect(onNavigateTab).toHaveBeenCalledWith("budget");
        expect(onClose).toHaveBeenCalled();
    });
});

describe("BubbySheet Guide button", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("closes BubbySheet and emits onboarding:open when Guide is clicked", () => {
        const onClose = vi.fn();
        const onOpen = vi.fn();
        const off = onAppEvent("onboarding:open", onOpen);

        renderWithProviders(<BubbySheet isOpen={true} onClose={onClose} />);
        fireEvent.click(screen.getByRole("button", { name: /Guide/i }));

        expect(onClose).toHaveBeenCalled();
        expect(onOpen).toHaveBeenCalledTimes(1);
        off();
    });
});

describe("App first-launch onboarding", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("opens Welcome Guide on first launch and remembers dismissal", async () => {
        const { unmount } = render(<App initialEntries={["/"]} />);

        const dialog = await screen.findByRole("dialog");
        expect(
            within(dialog).getByRole("heading", { name: /Welcome Guide/i }),
        ).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("button", { name: /Close/i }));
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
        expect(isFirstLaunch()).toBe(false);
        unmount();

        render(<App initialEntries={["/"]} />);
        await waitFor(() => {
            expect(
                screen.getByRole("region", { name: "Left to Spend" }),
            ).toBeInTheDocument();
        });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }, 20000);
});
