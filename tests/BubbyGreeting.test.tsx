import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { BubbyGreeting } from "../src/components/bubby/BubbyGreeting";
import { financeService } from "../src/services/financeService";
import { readBubbyStore, writeBubbyStore } from "../src/lib/bubby/storage";
import { resetFeedbackState } from "../src/lib/delight/feedback";
import { pickGreeting } from "../src/lib/bubby/greeting";

async function renderGreeting(onFab = vi.fn()) {
    await act(async () => {
        render(
            <HouseholdProvider>
                <BubbyGreeting />
                <button type="button" onClick={onFab}>
                    Quick Add
                </button>
            </HouseholdProvider>,
        );
    });
    return onFab;
}

describe("BubbyGreeting", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        resetFeedbackState();
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([]);
    });

    it("greets after the first paint and records the time", async () => {
        await renderGreeting();
        expect(await screen.findByTestId("bubby-greeting")).toBeInTheDocument();
        expect(readBubbyStore().lastGreetingAt).toBeGreaterThan(0);
    });

    it("keeps the FAB clickable and any pointerdown cancels the greeting", async () => {
        const onFab = await renderGreeting();
        await screen.findByTestId("bubby-greeting");

        const fab = screen.getByRole("button", { name: "Quick Add" });
        fireEvent.pointerDown(fab);
        fireEvent.click(fab);

        expect(onFab).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("bubby-greeting")).not.toBeInTheDocument();
    });

    it("is suppressed within 4h of the last greeting", async () => {
        writeBubbyStore({ lastGreetingAt: Date.now() - 60 * 60 * 1000 });
        await renderGreeting();
        await waitFor(() => expect(financeService.getDailyCheckins).toHaveBeenCalled());
        await act(async () => {
            await new Promise((r) => setTimeout(r, 300));
        });
        expect(screen.queryByTestId("bubby-greeting")).not.toBeInTheDocument();
    });
});

describe("pickGreeting", () => {
    const base = {
        inboxPending: 0,
        mood: "normal" as const,
        loggedToday: true,
        bothFedToday: false,
        minutes: 16 * 60,
        checkinMinutes: 18 * 60,
    };

    it("picks lines in priority order", () => {
        expect(pickGreeting({ ...base, inboxPending: 3 }).text).toBe("3 to sort");
        expect(pickGreeting({ ...base, mood: "rumbly" }).text).toBe("Snack time? 🍤");
        expect(pickGreeting({ ...base, mood: "missyou" }).text).toBe("Over here! 🐧");
        expect(pickGreeting({ ...base, loggedToday: false, minutes: 19 * 60 }).text).toBe("Log today?");
        expect(pickGreeting({ ...base, minutes: 8 * 60 }).text).toBe("Morning! ☕");
        expect(pickGreeting({ ...base, minutes: 12 * 60 }).text).toBe("Makan time?");
        expect(pickGreeting({ ...base, bothFedToday: true }).text).toBe("Both fed ✓");
        expect(pickGreeting(base).text).toBe("Hi again!");
    });
});
