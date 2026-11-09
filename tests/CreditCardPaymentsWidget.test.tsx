import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreditCardPaymentsWidget } from "../src/components/dashboard/CreditCardPaymentsWidget";
import { financeService } from "../src/services/financeService";
import type { CreditCard, CreditCardStatement } from "../src/types/finance";

const card = (over: Partial<CreditCard> = {}): CreditCard => ({
    id: "c1",
    household_id: "h1",
    owner_id: "m1",
    name: "Daily Card",
    bank: "Bank",
    billing_day: 10,
    due_day: 28,
    color: "#000000",
    is_active: true,
    ...over,
});

const stmt = (
    over: Partial<CreditCardStatement> = {},
): CreditCardStatement => ({
    id: "s1",
    card_id: "c1",
    household_id: "h1",
    month: "2026-11",
    statement_amount: 250,
    due_date: "2026-11-28",
    is_paid: false,
    ...over,
});

describe("CreditCardPaymentsWidget", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("renders nothing when no cycles are unpaid", () => {
        const { container } = render(
            <CreditCardPaymentsWidget
                cards={[card()]}
                statements={[stmt({ is_paid: true })]}
                today="2026-11-12"
                onPaid={vi.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("shows Pending for an unlogged cycle with the computed due date", () => {
        render(
            <CreditCardPaymentsWidget
                cards={[card()]}
                statements={[]}
                today="2026-11-12"
                onPaid={vi.fn()}
            />,
        );
        expect(screen.getByText("Daily Card")).toBeInTheDocument();
        expect(screen.getByText("Pending")).toBeInTheDocument();
        expect(screen.getByText("Due in 16 days")).toBeInTheDocument();
    });

    it("shows the logged amount and overdue state", () => {
        render(
            <CreditCardPaymentsWidget
                cards={[card()]}
                statements={[stmt({ due_date: "2026-11-10" })]}
                today="2026-11-12"
                onPaid={vi.fn()}
            />,
        );
        expect(screen.getByText("Overdue by 2 days")).toBeInTheDocument();
        expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    });

    it("records a payment through the Mark Paid modal", async () => {
        const upsert = vi
            .spyOn(financeService, "upsertCreditCardStatement")
            .mockResolvedValue(stmt({ is_paid: true }));
        const onPaid = vi.fn();
        render(
            <CreditCardPaymentsWidget
                cards={[card()]}
                statements={[]}
                today="2026-11-12"
                onPaid={onPaid}
            />,
        );

        fireEvent.click(
            screen.getByRole("button", { name: /mark daily card paid/i }),
        );
        fireEvent.change(await screen.findByLabelText(/amount paid/i), {
            target: { value: "321.5" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Mark Paid" }));

        await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                card_id: "c1",
                month: "2026-11",
                statement_amount: 321.5,
                due_date: "2026-11-28",
                is_paid: true,
                paid_at: expect.any(String),
            }),
        );
    });

    it("renders bank app launcher button when card has a recognised bank", () => {
        render(
            <CreditCardPaymentsWidget
                cards={[card({ bank: "DBS" })]}
                statements={[]}
                today="2026-11-12"
                onPaid={vi.fn()}
            />,
        );

        expect(
            screen.getByRole("button", {
                name: /open dbs \/ posb app for daily card/i,
            }),
        ).toBeInTheDocument();
    });

    it("shows Settle Overdue button when 2 or more cards are overdue", () => {
        const c1 = card({ id: "c1", name: "Card 1", bank: "DBS" });
        const c2 = card({ id: "c2", name: "Card 2", bank: "OCBC" });
        const s1 = stmt({ card_id: "c1", due_date: "2026-11-10" });
        const s2 = stmt({ id: "s2", card_id: "c2", due_date: "2026-11-10" });

        render(
            <CreditCardPaymentsWidget
                cards={[c1, c2]}
                statements={[s1, s2]}
                today="2026-11-12"
                onPaid={vi.fn()}
            />,
        );

        const bulkBtn = screen.getByRole("button", {
            name: /settle overdue \(2\)/i,
        });
        expect(bulkBtn).toBeInTheDocument();

        fireEvent.click(bulkBtn);
        expect(screen.getByText("Settle Overdue Bills")).toBeInTheDocument();
    });
});
