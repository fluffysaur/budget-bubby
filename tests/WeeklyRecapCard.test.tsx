import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { WeeklyRecapCard } from "../src/components/dashboard/WeeklyRecapCard";
import { financeService } from "../src/services/financeService";
import { readBubbyStore } from "../src/lib/bubby/storage";

const WEEK = { start: "2026-10-26", end: "2026-11-01" };

describe("WeeklyRecapCard", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([]);
        vi.spyOn(financeService, "getExpenses").mockResolvedValue([]);
    });

    it("shows Last Week with a win and two explicit actions; Nice! acknowledges", async () => {
        const onSeeSpend = vi.fn();
        await act(async () => {
            render(
                <HouseholdProvider>
                    <WeeklyRecapCard week={WEEK} onSeeSpend={onSeeSpend} />
                </HouseholdProvider>,
            );
        });

        expect(
            screen.getByRole("region", { name: "Last Week" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Logged 0 of 7 days")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "See Spend" }),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Nice!" }));
        expect(
            screen.queryByRole("region", { name: "Last Week" }),
        ).not.toBeInTheDocument();
        expect(readBubbyStore().recapSeenWeek).toBe(WEEK.start);
        expect(onSeeSpend).not.toHaveBeenCalled();
    });
});
