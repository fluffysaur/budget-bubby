import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BulkSettleOverdueModal } from "../src/components/dashboard/BulkSettleOverdueModal";
import { financeService } from "../src/services/financeService";
import type { CardCycle } from "../src/lib/creditCardCycles";
import type { CreditCard } from "../src/types/finance";

const makeCard = (id: string, name: string, bank: string): CreditCard => ({
    id,
    household_id: "h1",
    owner_id: "u1",
    name,
    bank,
    billing_day: 15,
    due_day: 5,
    color: "#0284c7",
    is_active: true,
});

const makeCycle = (card: CreditCard, month: string, overdueDays: number): CardCycle => ({
    key: `${card.id}:${month}`,
    card,
    month,
    statementDate: `${month}-15`,
    dueDate: "2026-11-05",
    statement: null,
    amount: null,
    status: "pending",
    daysUntilDue: -overdueDays,
});

describe("BulkSettleOverdueModal", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("renders overdue cards with amount inputs defaulting to 0", () => {
        const c1 = makeCycle(makeCard("c1", "DBS Altitude", "DBS"), "2026-10", 4);
        const c2 = makeCycle(makeCard("c2", "OCBC 365", "OCBC"), "2026-10", 2);

        render(
            <BulkSettleOverdueModal
                cycles={[c1, c2]}
                isOpen={true}
                onClose={vi.fn()}
                onPaid={vi.fn()}
            />,
        );

        expect(screen.getByText("Settle Overdue Bills")).toBeInTheDocument();
        expect(screen.getByText("DBS Altitude")).toBeInTheDocument();
        expect(screen.getByText("OCBC 365")).toBeInTheDocument();

        const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
        expect(inputs).toHaveLength(2);
        expect(inputs[0].value).toBe("0");
        expect(inputs[1].value).toBe("0");
    });

    it("saves all statements with their amounts on submit", async () => {
        const c1 = makeCycle(makeCard("c1", "DBS Altitude", "DBS"), "2026-10", 4);
        const c2 = makeCycle(makeCard("c2", "OCBC 365", "OCBC"), "2026-10", 2);

        const upsert = vi
            .spyOn(financeService, "upsertCreditCardStatement")
            .mockResolvedValue({
                id: "s1",
                card_id: "c1",
                household_id: "h1",
                month: "2026-10",
                statement_amount: 0,
                due_date: "2026-11-05",
                is_paid: true,
            });

        const onPaid = vi.fn();
        const onClose = vi.fn();

        render(
            <BulkSettleOverdueModal
                cycles={[c1, c2]}
                isOpen={true}
                onClose={onClose}
                onPaid={onPaid}
            />,
        );

        const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
        // Change one amount to 150
        fireEvent.change(inputs[1], { target: { value: "150" } });

        fireEvent.click(
            screen.getByRole("button", { name: /settle 2 cards/i }),
        );

        await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
        expect(upsert).toHaveBeenCalledTimes(2);
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                card_id: "c1",
                statement_amount: 0,
                is_paid: true,
            }),
        );
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                card_id: "c2",
                statement_amount: 150,
                is_paid: true,
            }),
        );
        expect(onClose).toHaveBeenCalled();
    });
});
