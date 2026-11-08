import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    render,
    screen,
    act,
    waitFor,
    fireEvent,
} from "@testing-library/react";

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
import { addDays, mondayOf, toSgtDateString } from "../src/lib/bubby/dates";
import { readBubbyStore, writeBubbyStore } from "../src/lib/bubby/storage";
import { resetFeedbackState } from "../src/lib/delight/feedback";
import { resetActivityCheckinState } from "../src/lib/bubby/activity";
import { emitAppEvent, onAppEvent } from "../src/lib/appEvents";
import type { DailyCheckin, Expense } from "../src/types/finance";

const [YJ, RACHEL] = mockMembers;
const TODAY = toSgtDateString();

function chk(member_id: string, checkin_date: string): DailyCheckin {
    return {
        id: `${member_id}-${checkin_date}`,
        household_id: "hh",
        member_id,
        checkin_date,
        type: "expense",
    };
}

function expense(payer_id: string, date: string, n: number): Expense {
    return {
        id: `${payer_id}-${date}-${n}`,
        household_id: "hh",
        payer_id,
        date,
        item: "x",
        amount: 5,
        is_shared: false,
        split_ratio: 0,
        settled: false,
        created_at: `${date}T04:00:00.000Z`,
    };
}

function mockData({
    checkins = [] as DailyCheckin[],
    expenses = [] as Expense[],
} = {}) {
    vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue(checkins);
    vi.spyOn(financeService, "getExpenses").mockResolvedValue(expenses);
    vi.spyOn(financeService, "getAllAccountSnapshots").mockResolvedValue([]);
    vi.spyOn(financeService, "recordDailyCheckin").mockResolvedValue(
        {} as DailyCheckin,
    );
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
        mockData({ checkins: [chk(YJ.id, addDays(TODAY, -1))] });
        await renderHost();
        await waitFor(() =>
            expect(financeService.getDailyCheckins).toHaveBeenCalled(),
        );

        await act(async () => {
            emitAppEvent("expenseAdded", {
                ...expense(RACHEL.id, "2026-10-01", 1),
                source: "form",
            });
        });

        expect(financeService.recordDailyCheckin).toHaveBeenCalledWith(
            YJ.id,
            TODAY,
            "expense",
        );
        expect(screen.getByText("Cha-ching!")).toBeInTheDocument();
    });

    it("skips the toast for inbox confirms but still checks in", async () => {
        mockData();
        await renderHost();
        await waitFor(() =>
            expect(financeService.getDailyCheckins).toHaveBeenCalled(),
        );

        await act(async () => {
            emitAppEvent("expenseAdded", {
                ...expense(YJ.id, TODAY, 2),
                source: "inbox",
            });
        });

        expect(screen.queryByText("Cha-ching!")).not.toBeInTheDocument();
        await waitFor(() =>
            expect(financeService.recordDailyCheckin).toHaveBeenCalledTimes(1),
        );
    });

    it("plays a reunion when a feed brings Bubby back", async () => {
        writeBubbyStore({ lastMood: "teary", lastBody: "regular" });
        mockData({ checkins: [chk(YJ.id, TODAY)] });
        await renderHost();

        expect(await screen.findByText("Welcome back! 🐧")).toBeInTheDocument();
        expect(readBubbyStore().lastMood).toBe("normal");
    });

    it("celebrates a body change with confetti, once", async () => {
        writeBubbyStore({ lastBody: "regular", lastMood: "normal" });
        const expenses = [0, 1, 2, 3].flatMap((d) =>
            [YJ.id, RACHEL.id].map((m, i) =>
                expense(m, addDays(TODAY, -d), d * 10 + i),
            ),
        );
        mockData({ expenses });
        await renderHost();

        expect(
            await screen.findByText("Bubby's well fed!"),
        ).toBeInTheDocument();
        expect(screen.getAllByTestId("confetti-burst").length).toBeGreaterThan(
            0,
        );
        fireEvent.click(screen.getByRole("button", { name: "Nice!" }));
        expect(readBubbyStore().lastBody).toBe("chubby");
    });

    it("stays quiet on first run and when nothing changed", async () => {
        mockData({ checkins: [chk(YJ.id, TODAY)] });
        await renderHost();
        await waitFor(() => expect(readBubbyStore().lastMood).toBe("normal"));
        expect(screen.queryByTestId("milestone-toast")).not.toBeInTheDocument();
    });

    it("gives a full belly when today's quests are done", async () => {
        writeBubbyStore({
            lastBody: "regular",
            lastMood: "normal",
            petDays: { [YJ.id]: [TODAY] },
        });
        mockData({ checkins: [chk(YJ.id, TODAY)] });
        await renderHost();
        expect(await screen.findByText("Full belly! 🍤")).toBeInTheDocument();
    });

    it("adds a weekly snack when both weekly quests are done", async () => {
        writeBubbyStore({
            lastBody: "regular",
            lastMood: "normal",
            exercise: { balances: [TODAY], "recap-read": [TODAY] },
        });
        mockData();
        await renderHost();
        expect(await screen.findByText(/^Treat: /)).toBeInTheDocument();
        expect(readBubbyStore().snacks).toEqual([
            expect.objectContaining({ week: mondayOf(TODAY) }),
        ]);
    });

    it("cheers once when both partners have fed Bubby today", async () => {
        writeBubbyStore({ lastBody: "regular", lastMood: "normal" });
        mockData({ checkins: [chk(YJ.id, TODAY), chk(RACHEL.id, TODAY)] });
        const reactions: string[] = [];
        const off = onAppEvent("bubby:react", (d) => reactions.push(d.kind));
        await renderHost();
        await waitFor(() =>
            expect(readBubbyStore().celebrated).toContain(`both-fed:${TODAY}`),
        );
        off();
        expect(reactions).toContain("cheer");
    });

    it("celebrates inbox zero once when triage empties the inbox, and logs exercise", async () => {
        writeBubbyStore({ lastBody: "regular", lastMood: "normal" });
        mockData();
        await renderHost();

        act(() => {
            emitAppEvent("inbox:item-discarded", {
                itemId: "i1",
                reason: "duplicate",
                remaining: 1,
            });
            emitAppEvent("inbox:item-discarded", {
                itemId: "i2",
                reason: "discarded",
                remaining: 0,
            });
            emitAppEvent("inbox:cleared", {
                clearedCount: 2,
                durationMs: 4000,
                date: TODAY,
            });
        });

        expect(screen.getByText("Inbox zero! 🎉")).toBeInTheDocument();
        expect(screen.getByText("2 sorted")).toBeInTheDocument();
        expect(screen.getAllByTestId("confetti-burst")).toHaveLength(1);
        expect(readBubbyStore().exercise?.["inbox-clear"]).toEqual([TODAY]);
    });

    it("does nothing when the inbox is already empty on load", async () => {
        mockData();
        await renderHost();
        act(() => {
            emitAppEvent("inbox:items-arrived", {
                newCount: 0,
                pendingCount: 0,
            });
            emitAppEvent("inbox:cleared", {
                clearedCount: 0,
                durationMs: 0,
                date: TODAY,
            });
        });
        expect(screen.queryByText("Inbox zero! 🎉")).not.toBeInTheDocument();
        expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
    });
});
