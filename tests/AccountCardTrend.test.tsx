import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AccountCard } from "../src/components/accounts/AccountCard";
import type { Account } from "../src/types/finance";

const account: Account = {
    id: "a1",
    household_id: "h1",
    owner_id: "m1",
    name: "Demo Savings",
    type: "Cash",
    balance: 1000,
    currency: "SGD",
    institution: "Demo Bank",
    is_joint: false,
    notes: null,
    updated_at: new Date().toISOString(),
} as Account;

describe("AccountCard trend", () => {
    it("shows a hint when there is no trend", () => {
        render(<AccountCard account={account} />);
        expect(screen.getByTestId("account-trend-empty")).toHaveTextContent(
            "Needs 2 updates",
        );
    });

    it("shows sparkline and change chip with a trend", () => {
        render(
            <AccountCard
                account={account}
                trend={{ points: [700, 1000], delta: 300 }}
            />,
        );
        expect(
            screen.getByRole("img", { name: /balance trend/i }),
        ).toBeInTheDocument();
        expect(screen.getByTestId("account-trend-chip")).toHaveTextContent("+");
    });

    it("opens the update flow from the balance and has no Update text button", () => {
        const onUpdate = vi.fn();
        render(<AccountCard account={account} onUpdateBalance={onUpdate} />);
        fireEvent.click(
            screen.getByRole("button", { name: /update balance for/i }),
        );
        expect(onUpdate).toHaveBeenCalledWith(account);
        expect(screen.queryByText("Update")).not.toBeInTheDocument();
    });

    it("marks stale balances", () => {
        const old = { ...account, updated_at: "2025-01-01T00:00:00Z" };
        const { container } = render(<AccountCard account={old} />);
        expect(container.querySelector('[data-stale="true"]')).not.toBeNull();
    });
});
