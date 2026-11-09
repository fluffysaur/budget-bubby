import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { QuestCard } from "../src/components/dashboard/QuestCard";
import { financeService } from "../src/services/financeService";
import { onAppEvent } from "../src/lib/appEvents";

async function renderCard() {
    await act(async () => {
        render(
            <HouseholdProvider>
                <QuestCard />
            </HouseholdProvider>,
        );
    });
}

describe("QuestCard", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([]);
        vi.spyOn(financeService, "getExpenses").mockResolvedValue([]);
        vi.spyOn(financeService, "getAllAccountSnapshots").mockResolvedValue(
            [],
        );
        vi.spyOn(financeService, "getCreditCardStatements").mockResolvedValue(
            [],
        );
        vi.spyOn(financeService, "getGoals").mockResolvedValue([]);
    });

    it("shows only progress bars: no quest rows and no No Spend button", async () => {
        await renderCard();
        expect(
            await screen.findByRole("progressbar", {
                name: "Today: 1 of 3 done",
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("progressbar", { name: /^Week:/ }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("list")).toBeNull();
        expect(screen.queryByTestId("no-spend-checkin-btn")).toBeNull();
    });

    it("opens the Bubby sheet when the card is tapped", async () => {
        const opened = vi.fn();
        const off = onAppEvent("bubby:open-sheet", opened);
        await renderCard();
        fireEvent.click(await screen.findByTestId("quest-card"));
        expect(opened).toHaveBeenCalledTimes(1);
        off();
    });

    it("opens the sheet from the avatar button too", async () => {
        const opened = vi.fn();
        const off = onAppEvent("bubby:open-sheet", opened);
        await renderCard();
        fireEvent.click(
            await screen.findByRole("button", { name: "Open Bubby" }),
        );
        expect(opened).toHaveBeenCalledTimes(1);
        off();
    });
});
