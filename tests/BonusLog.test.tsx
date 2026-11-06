import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { BonusLogPanel } from "../src/components/bonus/BonusLogPanel";
import { mockFinanceService } from "../src/services/mockFinanceService";
import * as soundEffects from "../src/lib/soundEffects";
import { cloneDefaultSplit, computeBonusSplit } from "../src/lib/bonusFormulas";

const RACHEL = "mem-00000000-0012";
const HDB = "goal-00000000-0503";

function renderPanel() {
    return render(
        <MemoryRouter>
            <HouseholdProvider>
                <BonusLogPanel />
            </HouseholdProvider>
        </MemoryRouter>,
    );
}

async function seedBonus(overrides: { received_on?: string; withGoal?: boolean } = {}) {
    return mockFinanceService.saveBonusEvent({
        recipient_id: RACHEL,
        type: "performance",
        received_on: overrides.received_on ?? `${new Date().getFullYear()}-03-10`,
        gross: 10000,
        cpf: 2000,
        note: "FY26 Performance",
        split: computeBonusSplit(8000, cloneDefaultSplit()),
        goal_contributions: overrides.withGoal === false ? [] : [{ goal_id: HDB, amount: 3200 }],
    });
}

describe("BonusLogPanel", () => {
    beforeEach(() => {
        mockFinanceService.resetData();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        mockFinanceService.resetData();
    });

    it("shows the empty state formula", async () => {
        renderPanel();
        expect(await screen.findByText("No Bonuses")).toBeInTheDocument();
        expect(screen.getByText("Log a bonus to track it and fund goals.")).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: "Log Bonus" }).length).toBe(2);
    });

    it("logs a bonus: auto CPF, split, goal presets, over-assign guard and celebration", async () => {
        const chime = vi.spyOn(soundEffects, "playChaChingSound").mockImplementation(() => {});
        renderPanel();
        fireEvent.click((await screen.findAllByRole("button", { name: "Log Bonus" }))[0]);

        const next = await screen.findByRole("button", { name: "Next" });
        expect(next).toBeDisabled();

        fireEvent.change(screen.getByLabelText("Gross"), { target: { value: "10000" } });
        const cpfInput = screen.getByLabelText("CPF") as HTMLInputElement;
        expect(cpfInput.value).toBe("2000");
        expect(screen.getByText("Auto")).toBeInTheDocument();

        // Override, then reset back to auto
        fireEvent.change(cpfInput, { target: { value: "1500" } });
        expect(screen.getByTestId("bonus-net")).toHaveTextContent("8,500.00");
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        expect((screen.getByLabelText("CPF") as HTMLInputElement).value).toBe("2000");
        expect(screen.getByTestId("bonus-net")).toHaveTextContent("8,000.00");

        expect(next).toBeEnabled();
        fireEvent.click(next);

        // Default split: Goals 40% of S$8,000
        expect(await screen.findByTestId("bonus-split-goals")).toHaveTextContent("3,200.00");

        // Editing one bucket rebalances the others to 100%
        fireEvent.change(screen.getByLabelText("Tithing %"), { target: { value: "20" } });
        const pctValues = ["Tithing", "Goals", "Savings", "Investments", "Lifestyle"].map(
            (l) => parseFloat((screen.getByLabelText(`${l} %`) as HTMLInputElement).value),
        );
        expect(Math.round(pctValues.reduce((s, v) => s + v, 0))).toBe(100);
        expect(screen.queryByText(/not 100%/)).not.toBeInTheDocument();

        // Over-assigning blocks Save
        fireEvent.change(screen.getByLabelText("Amount for HDB Down Payment"), {
            target: { value: "999999" },
        });
        expect(screen.getByText(/Over by/)).toBeInTheDocument();
        const submit = screen.getAllByRole("button", { name: "Log Bonus" }).at(-1)!;
        expect(submit).toBeDisabled();

        // By gap fully assigns the Goals share
        fireEvent.click(screen.getByRole("button", { name: "By gap" }));
        expect(screen.getByText("Fully assigned")).toBeInTheDocument();
        expect(submit).toBeEnabled();
        fireEvent.click(submit);

        expect(await screen.findByTestId("bonus-celebration")).toHaveTextContent("bonus logged");
        expect(screen.getByTestId("bonus-celebration")).toHaveTextContent("to goals");
        expect(chime).toHaveBeenCalled();
        expect(await screen.findByTestId("bonus-row")).toBeInTheDocument();

        const { events } = await mockFinanceService.getBonusEvents();
        expect(events).toHaveLength(1);
        const goalTotal = events[0].goal_contributions.reduce((s, c) => s + c.amount, 0);
        expect(Math.round(goalTotal * 100) / 100).toBe(
            events[0].split.find((s) => s.key === "goals")?.amount,
        );
    });

    it("pre-fills edit and does not celebrate on save", async () => {
        const chime = vi.spyOn(soundEffects, "playChaChingSound").mockImplementation(() => {});
        await seedBonus();
        renderPanel();

        fireEvent.click(await screen.findByRole("button", { name: "Edit bonus" }));
        expect(await screen.findByText("Edit Bonus")).toBeInTheDocument();
        expect((screen.getByLabelText("Gross") as HTMLInputElement).value).toBe("10000");
        expect((screen.getByLabelText("Note") as HTMLInputElement).value).toBe("FY26 Performance");

        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        expect((screen.getByLabelText("Amount for HDB Down Payment") as HTMLInputElement).value).toBe(
            "3200",
        );
        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(screen.queryByText("Edit Bonus")).not.toBeInTheDocument());
        expect(screen.queryByTestId("bonus-celebration")).not.toBeInTheDocument();
        expect(chime).not.toHaveBeenCalled();
    });

    it("warns when goal amounts no longer match after changing gross", async () => {
        await seedBonus();
        renderPanel();
        fireEvent.click(await screen.findByRole("button", { name: "Edit bonus" }));
        fireEvent.change(await screen.findByLabelText("Gross"), { target: { value: "5000" } });
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(screen.getByText("Goal amounts no longer match the Goals share.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Rebalance" }));
        expect(screen.queryByText("Goal amounts no longer match the Goals share.")).not.toBeInTheDocument();
    });

    it("confirms delete with the goals copy", async () => {
        await seedBonus();
        renderPanel();
        fireEvent.click(await screen.findByRole("button", { name: "Delete bonus" }));
        expect(await screen.findByText("Delete Bonus?")).toBeInTheDocument();
        expect(screen.getByText(/Performance for Rachel\./)).toBeInTheDocument();
        expect(screen.getByText(/Removes/)).toHaveTextContent("Removes S$3,200.00 from goals.");

        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        expect(await screen.findByText("No Bonuses")).toBeInTheDocument();
    });

    it("groups by year and renders the YTD table", async () => {
        const year = new Date().getFullYear();
        await seedBonus({ received_on: `${year}-03-10` });
        await seedBonus({ received_on: `${year - 1}-12-15`, withGoal: false });
        renderPanel();

        const table = await screen.findByTestId("bonus-ytd-table");
        expect(within(table).getByText("Rachel")).toBeInTheDocument();
        expect(within(table).getByText("Household")).toBeInTheDocument();
        expect(screen.getByText(String(year), { selector: "span" })).toBeInTheDocument();
        expect(screen.getByText(String(year - 1), { selector: "span" })).toBeInTheDocument();
        expect(screen.getByLabelText("Year")).toBeInTheDocument();
    });
});
