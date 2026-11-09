import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent, within } from "@testing-library/react";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { BubbySheet } from "../src/components/bubby/BubbySheet";
import { financeService } from "../src/services/financeService";
import { mockMembers } from "../src/data/mockSeedData";
import { toSgtDateString } from "../src/lib/bubby/dates";
import { readBubbyStore, writeBubbyStore } from "../src/lib/bubby/storage";

const [YJ] = mockMembers;

async function renderSheet() {
    await act(async () => {
        render(
            <HouseholdProvider>
                <BubbySheet isOpen onClose={vi.fn()} />
            </HouseholdProvider>,
        );
    });
}

describe("BubbySheet", () => {
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

    it("hides the monthly section until a monthly quest applies", async () => {
        await renderSheet();
        expect(
            screen.queryByRole("list", { name: "This month's quests" }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("list", { name: "This week's quests" }),
        ).toBeInTheDocument();
    });

    it("lists the monthly quests once a card statement is due", async () => {
        vi.spyOn(financeService, "getCreditCardStatements").mockResolvedValue([
            {
                id: "s1",
                card_id: "c1",
                household_id: "hh",
                month: toSgtDateString().slice(0, 7),
                statement_amount: 80,
                due_date: toSgtDateString(),
                is_paid: false,
            },
        ]);
        await renderSheet();
        const list = await screen.findByRole("list", {
            name: "This month's quests",
        });
        expect(within(list).getByText("Pay card bills")).toBeInTheDocument();
    });

    it("shows meters without numbers, quests and an empty snack shelf", async () => {
        await renderSheet();

        expect(
            screen.getByRole("img", { name: "Nourishment" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("img", { name: "Fitness" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("list", { name: "Today's quests" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("list", { name: "This week's quests" }),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Finish a week's quests to earn a treat."),
        ).toBeInTheDocument();
        // No counters anywhere in the sheet body
        const dialogText =
            screen.getByRole("list", { name: "Today's quests" }).closest("div")
                ?.textContent ?? "";
        expect(dialogText).not.toMatch(/\d/);
    });

    it("petting ticks the daily quest", async () => {
        await renderSheet();
        const today = screen.getByRole("list", { name: "Today's quests" });
        fireEvent.click(
            within(today).getByRole("button", { name: /Pet Bubby/ }),
        );

        expect(readBubbyStore().petDays?.[YJ.id]).toEqual([toSgtDateString()]);
        const pet = within(today).getByText("Pet Bubby").closest("li");
        expect(pet).toHaveAttribute("data-done", "true");
    });

    it("shows earned snacks", async () => {
        writeBubbyStore({ snacks: [{ id: "fish", week: "2026-11-02" }] });
        await renderSheet();
        expect(screen.getByLabelText("Fish")).toBeInTheDocument();
    });
});
