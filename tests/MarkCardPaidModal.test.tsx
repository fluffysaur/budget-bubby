import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MarkCardPaidModal } from "../src/components/accounts/MarkCardPaidModal";
import { financeService } from "../src/services/financeService";
import type { CardCycle } from "../src/lib/creditCardCycles";
import type { CreditCard } from "../src/types/finance";

const mockCard: CreditCard = {
    id: "card-1",
    household_id: "h1",
    owner_id: "u1",
    name: "DBS Altitude",
    bank: "DBS",
    billing_day: 15,
    due_day: 5,
    color: "#0284c7",
    is_active: true,
};

const mockCycle: CardCycle = {
    key: "card-1:2026-10",
    card: mockCard,
    month: "2026-10",
    statementDate: "2026-10-15",
    dueDate: "2026-11-05",
    statement: null,
    amount: null,
    status: "pending",
    daysUntilDue: -4,
};

describe("MarkCardPaidModal", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("renders bank launcher shortcut when bank has deep link", () => {
        render(
            <MarkCardPaidModal
                cycle={mockCycle}
                onClose={vi.fn()}
                onPaid={vi.fn()}
            />,
        );

        expect(screen.getByText(/Check statement in DBS/i)).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /open dbs.* app/i }),
        ).toBeInTheDocument();
    });

    it("allows setting $0 via the '$0 (No Spend)' button and submits", async () => {
        const upsert = vi
            .spyOn(financeService, "upsertCreditCardStatement")
            .mockResolvedValue({
                id: "s1",
                card_id: "card-1",
                household_id: "h1",
                month: "2026-10",
                statement_amount: 0,
                due_date: "2026-11-05",
                is_paid: true,
            });
        const onPaid = vi.fn();
        const onClose = vi.fn();

        render(
            <MarkCardPaidModal
                cycle={mockCycle}
                onClose={onClose}
                onPaid={onPaid}
            />,
        );

        const noSpendBtn = screen.getByRole("button", {
            name: /\$0 \(no spend\)/i,
        });
        fireEvent.click(noSpendBtn);

        const input = screen.getByLabelText(/amount paid/i) as HTMLInputElement;
        expect(input.value).toBe("0");

        fireEvent.click(screen.getByRole("button", { name: "Mark Paid" }));

        await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                card_id: "card-1",
                month: "2026-10",
                statement_amount: 0,
                is_paid: true,
            }),
        );
        expect(onClose).toHaveBeenCalled();
    });
});
