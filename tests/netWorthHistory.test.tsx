import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { calculateMonthlyBalanceTrends } from "../src/lib/financialFormulas";
import { NetWorthChart } from "../src/components/accounts/NetWorthChart";
import type { Account, AccountSnapshot } from "../src/types/finance";

vi.mock("recharts", async (importOriginal) => {
    const original = await importOriginal<typeof import("recharts")>();
    return {
        ...original,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
            <div style={{ width: 600, height: 300 }}>{children}</div>
        ),
    };
});

function account(id: string, balance: number, type: Account["type"] = "Cash"): Account {
    return { id, household_id: "hh", owner_id: "m1", name: id, type, balance, is_joint: false } as Account;
}
function snap(accountId: string, date: string, balance: number): AccountSnapshot {
    return { id: `${accountId}-${date}`, account_id: accountId, household_id: "hh", balance, snapshot_date: date };
}

describe("calculateMonthlyBalanceTrends (real history only)", () => {
    it("starts at the first snapshot month, not before", () => {
        const points = calculateMonthlyBalanceTrends(
            [account("a", 1200)],
            [snap("a", "2026-09-30", 1000), snap("a", "2026-10-31", 1100)],
            6,
            "2026-11",
        );
        expect(points.map((p) => p.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
        expect(points.map((p) => p.netWorth)).toEqual([1000, 1100, 1200]);
    });

    it("counts a later account only from its first snapshot (no backfill)", () => {
        const points = calculateMonthlyBalanceTrends(
            [account("a", 1000), account("b", 500)],
            [snap("a", "2026-09-30", 1000), snap("a", "2026-10-31", 1000), snap("b", "2026-10-15", 500)],
            6,
            "2026-11",
        );
        expect(points.map((p) => p.netWorth)).toEqual([1000, 1500, 1500]);
    });

    it("uses live balances for the current month", () => {
        const points = calculateMonthlyBalanceTrends(
            [account("a", 2000)],
            [snap("a", "2026-10-31", 1000), snap("a", "2026-11-02", 1500)],
            6,
            "2026-11",
        );
        expect(points[points.length - 1].netWorth).toBe(2000);
    });

    it("caps the window to the last N months", () => {
        const points = calculateMonthlyBalanceTrends(
            [account("a", 10)],
            [snap("a", "2025-01-31", 1)],
            6,
            "2026-11",
        );
        expect(points).toHaveLength(6);
        expect(points[0].month).toBe("2026-06");
    });

    it("returns only the current month when there are no snapshots", () => {
        const points = calculateMonthlyBalanceTrends([account("a", 10)], [], 6, "2026-11");
        expect(points).toHaveLength(1);
    });
});

describe("NetWorthChart", () => {
    it("shows No History with an Update Balances action when there is under 2 months of data", () => {
        const onUpdate = vi.fn();
        render(<NetWorthChart accounts={[account("a", 10)]} snapshots={[]} onUpdateBalances={onUpdate} />);
        expect(screen.getByTestId("net-worth-no-history")).toBeInTheDocument();
        expect(screen.getByText("No History")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Update Balances" }));
        expect(onUpdate).toHaveBeenCalled();
    });

    it("draws the chart from snapshots when there is history", () => {
        render(
            <NetWorthChart
                accounts={[account("a", 1200)]}
                snapshots={[snap("a", "2025-12-31", 900), snap("a", "2026-01-31", 1000)]}
            />,
        );
        expect(screen.queryByTestId("net-worth-no-history")).not.toBeInTheDocument();
    });
});
