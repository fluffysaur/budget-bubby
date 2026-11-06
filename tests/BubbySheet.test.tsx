import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { BubbySheet } from "../src/components/bubby/BubbySheet";
import { financeService } from "../src/services/financeService";
import { mockMembers } from "../src/data/mockSeedData";
import { addDays, toSgtDateString } from "../src/lib/bubby/dates";
import { readBubbyStore } from "../src/lib/bubby/storage";
import type { DailyCheckin } from "../src/types/finance";

const [YJ, RACHEL] = mockMembers;

function rows(days: number, members = [YJ, RACHEL]): DailyCheckin[] {
    const today = toSgtDateString();
    const out: DailyCheckin[] = [];
    for (let i = 0; i < days; i++) {
        for (const m of members) {
            out.push({ id: `${m.id}-${i}`, household_id: "hh", member_id: m.id, checkin_date: addDays(today, -i), type: "expense" });
        }
    }
    return out;
}

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
    });

    it("shows stage progress and the couple day", async () => {
        // 16 couple days: 6 x 2 + 10 x 3 = 42 paws -> Hatchling, scarf unlocked
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue(rows(16));
        await renderSheet();

        expect(await screen.findByText("Hatchling")).toBeInTheDocument();
        expect(screen.getByText("18 🐾 to Chick")).toBeInTheDocument();
        expect(screen.getByText(/Couple day ✓ · 16/)).toBeInTheDocument();
    });

    it("equips and unequips with aria-pressed, and labels locked items", async () => {
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue(rows(16));
        await renderSheet();

        const scarf = await screen.findByRole("button", { name: "Butter Scarf" });
        expect(scarf).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(scarf);
        expect(scarf).toHaveAttribute("aria-pressed", "false");
        expect(readBubbyStore().equipped?.neck).toBeNull();

        expect(screen.getByRole("button", { name: "Locked, 58 🐾" })).toBeDisabled();
    });

    it("waits on the partner without nagging", async () => {
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue(rows(1, [YJ]));
        await renderSheet();
        expect(await screen.findByText(`Waiting on ${RACHEL.display_name}`)).toBeInTheDocument();
    });
});
