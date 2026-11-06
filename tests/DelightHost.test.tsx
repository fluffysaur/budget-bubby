import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";

vi.mock("../src/lib/soundEffects", () => ({
    playChaChingSound: vi.fn(),
    playSoftPop: vi.fn(),
    playSuccessSound: vi.fn(),
    playBudgetWarningSound: vi.fn(),
    playBudgetExceededSound: vi.fn(),
    initAudioUnlock: vi.fn(),
    isSoundEffectsEnabled: () => true,
}));

import { HouseholdProvider } from "../src/context/HouseholdContext";
import { DelightHost } from "../src/components/bubby/DelightHost";
import { ExpenseSuccessCelebration } from "../src/components/expenses/ExpenseSuccessCelebration";
import { financeService } from "../src/services/financeService";
import { mockMembers } from "../src/data/mockSeedData";
import { addDays, toSgtDateString } from "../src/lib/bubby/dates";
import { readBubbyStore, writeBubbyStore } from "../src/lib/bubby/storage";
import { resetFeedbackState } from "../src/lib/delight/feedback";
import { resetActivityCheckinState } from "../src/lib/bubby/activity";
import { emitAppEvent, onAppEvent } from "../src/lib/appEvents";
import type { DailyCheckin } from "../src/types/finance";

const [YJ, RACHEL] = mockMembers;

function coupleDays(days: number, end = toSgtDateString()): DailyCheckin[] {
    const rows: DailyCheckin[] = [];
    for (let i = 0; i < days; i++) {
        for (const m of [YJ, RACHEL]) {
            rows.push({
                id: `${m.id}-${i}`,
                household_id: "hh",
                member_id: m.id,
                checkin_date: addDays(end, -i),
                type: "expense",
            });
        }
    }
    return rows;
}

async function renderHost() {
    await act(async () => {
        render(
            <HouseholdProvider>
                <ExpenseSuccessCelebration />
                <DelightHost />
            </HouseholdProvider>,
        );
    });
}

describe("DelightHost", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        resetFeedbackState();
        resetActivityCheckinState();
    });

    it("checks in the logger for today after an expense is added", async () => {
        // Yesterday only, so today's log is the first
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue(
            coupleDays(1, addDays(toSgtDateString(), -1)),
        );
        const record = vi
            .spyOn(financeService, "recordDailyCheckin")
            .mockResolvedValue({} as DailyCheckin);
        await renderHost();
        await waitFor(() => expect(financeService.getDailyCheckins).toHaveBeenCalled());

        await act(async () => {
            emitAppEvent("expenseAdded", {
                id: "e1",
                household_id: "hh",
                payer_id: RACHEL.id,
                date: "2026-10-01",
                item: "Dinner",
                amount: 30,
                is_shared: true,
                split_ratio: 0.5,
                settled: false,
                source: "form",
            });
        });

        expect(record).toHaveBeenCalledWith(YJ.id, toSgtDateString(), "expense");
        expect(screen.getByText("Cha-ching!")).toBeInTheDocument();
    });

    it("skips the toast for inbox confirms but still checks in", async () => {
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([]);
        const record = vi
            .spyOn(financeService, "recordDailyCheckin")
            .mockResolvedValue({} as DailyCheckin);
        await renderHost();
        await waitFor(() => expect(financeService.getDailyCheckins).toHaveBeenCalled());

        await act(async () => {
            emitAppEvent("expenseAdded", {
                id: "e2",
                household_id: "hh",
                payer_id: YJ.id,
                date: toSgtDateString(),
                item: "Grab",
                amount: 12,
                is_shared: false,
                split_ratio: 0,
                settled: false,
                source: "inbox",
            });
        });

        expect(screen.queryByText("Cha-ching!")).not.toBeInTheDocument();
        await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    });

    it("plays the hatch moment once per device, with confetti", async () => {
        // 10 couple days: 6 x 2 + 4 x 3 = 24 paws -> Hatchling
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue(coupleDays(10, addDays(toSgtDateString(), -1)));
        await renderHost();

        expect(await screen.findByText("Bubby hatched!")).toBeInTheDocument();
        expect(screen.getByTestId("confetti-burst")).toBeInTheDocument();
        expect(readBubbyStore().seenStage).toBe(2);

        fireEvent.click(screen.getByRole("button", { name: "Nice!" }));
        expect(screen.queryByText("Bubby hatched!")).not.toBeInTheDocument();
    });

    it("stays quiet when this device has already seen the stage", async () => {
        writeBubbyStore({ seenStage: 2, seenAccessories: [] });
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue(coupleDays(10, addDays(toSgtDateString(), -1)));
        await renderHost();
        await waitFor(() => expect(financeService.getDailyCheckins).toHaveBeenCalled());
        expect(screen.queryByTestId("milestone-toast")).not.toBeInTheDocument();
    });

    it("plays a couple-day moment once a day, without confetti", async () => {
        writeBubbyStore({ seenStage: 5, seenAccessories: [] });
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue(coupleDays(3));
        await renderHost();

        expect(await screen.findByText("Couple day! 🔥 3")).toBeInTheDocument();
        expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
        expect(readBubbyStore().celebrated).toContain(`couple-day:${toSgtDateString()}`);
    });

    it("gives a 7-day couple streak full confetti", async () => {
        writeBubbyStore({ seenStage: 5, seenAccessories: [] });
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue(coupleDays(7));
        await renderHost();

        expect(await screen.findByText("7-day couple streak")).toBeInTheDocument();
        expect(screen.getByTestId("confetti-burst")).toBeInTheDocument();
    });

    it("soft-cues each inbox triage without a toast", async () => {
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([]);
        await renderHost();
        const reactions: string[] = [];
        const off = onAppEvent("bubby:react", (d) => reactions.push(d.kind));
        act(() => {
            emitAppEvent("inbox:item-discarded", { itemId: "i1", reason: "discarded", remaining: 2 });
        });
        off();
        expect(reactions).toEqual(["nod"]);
        expect(screen.queryByTestId("milestone-toast")).not.toBeInTheDocument();
    });

    it("celebrates inbox zero once when triage empties the inbox", async () => {
        writeBubbyStore({ seenStage: 5, seenAccessories: [] });
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([]);
        vi.spyOn(financeService, "recordDailyCheckin").mockResolvedValue({} as DailyCheckin);
        await renderHost();

        act(() => {
            emitAppEvent("inbox:item-discarded", { itemId: "i1", reason: "duplicate", remaining: 1 });
            emitAppEvent("inbox:item-discarded", { itemId: "i2", reason: "discarded", remaining: 0 });
            emitAppEvent("inbox:cleared", { clearedCount: 2, durationMs: 4000, date: toSgtDateString() });
        });

        expect(screen.getByText("Inbox zero! 🎉")).toBeInTheDocument();
        expect(screen.getByText("2 sorted")).toBeInTheDocument();
        expect(screen.getAllByTestId("confetti-burst")).toHaveLength(1);
        expect(readBubbyStore().inboxZeroDays).toEqual([toSgtDateString()]);
    });

    it("does nothing when the inbox is already empty on load", async () => {
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([]);
        await renderHost();
        act(() => {
            emitAppEvent("inbox:items-arrived", { newCount: 0, pendingCount: 0 });
            emitAppEvent("inbox:cleared", { clearedCount: 0, durationMs: 0, date: toSgtDateString() });
        });
        expect(screen.queryByText("Inbox zero! 🎉")).not.toBeInTheDocument();
        expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
    });
});
