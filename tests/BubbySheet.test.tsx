import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent, within } from "@testing-library/react";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { BubbySheet } from "../src/components/bubby/BubbySheet";
import { financeService } from "../src/services/financeService";
import { mockMembers } from "../src/data/mockSeedData";
import { toSgtDateString } from "../src/lib/bubby/dates";
import { readBubbyStore, writeBubbyStore } from "../src/lib/bubby/storage";

const [YJ, RACHEL] = mockMembers;

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

        // A meter pair per partner's penguin
        expect(
            screen.getByRole("img", { name: "Nourishment, your Bubby" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("img", { name: "Fitness, your Bubby" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("img", {
                name: `Nourishment, ${RACHEL.display_name}'s Bubby`,
            }),
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

    it("shows both penguins side by side, yours first, with scarves", async () => {
        await renderSheet();
        const penguins = within(
            screen.getByRole("list", { name: "Penguins" }),
        ).getAllByTestId("bubby-penguin");
        expect(penguins.map((p) => p.dataset.member)).toEqual([
            YJ.id,
            RACHEL.id,
        ]);
        const scarves = penguins.map((p) =>
            p.querySelector("[data-layer='scarf']")?.getAttribute("data-scarf"),
        );
        expect(scarves[0]).toBeTruthy();
        expect(scarves[1]).toBeTruthy();
        expect(scarves[0]).not.toBe(scarves[1]);
    });

    it("petting a partner's penguin credits their penguin, not the quest owner's", async () => {
        await renderSheet();
        fireEvent.click(
            screen.getByRole("button", {
                name: `Pet ${RACHEL.display_name}'s Bubby`,
            }),
        );
        const today = toSgtDateString();
        const store = readBubbyStore();
        // You did the petting (your daily quest), and their penguin got fed
        expect(store.petDays?.[YJ.id]).toEqual([today]);
        expect(store.petTargets?.[`${YJ.id}|${today}`]).toEqual([RACHEL.id]);
    });

    it("pets both penguins at once", async () => {
        await renderSheet();
        fireEvent.click(screen.getByRole("button", { name: "Pet Both" }));
        const today = toSgtDateString();
        expect(
            readBubbyStore().petTargets?.[`${YJ.id}|${today}`]?.sort(),
        ).toEqual([YJ.id, RACHEL.id].sort());
    });

    it("shows earned snacks", async () => {
        writeBubbyStore({ snacks: [{ id: "fish", week: "2026-11-02" }] });
        await renderSheet();
        expect(screen.getByLabelText("Fish")).toBeInTheDocument();
    });
});
