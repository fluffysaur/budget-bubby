/**
 * Credit card statements: partial payment logging (#84)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CreditCardTrackerSection } from "../src/components/accounts/CreditCardTrackerSection";
import { financeService } from "../src/services/financeService";
import { mockFinanceService } from "../src/services/mockFinanceService";
import { SupabaseFinanceServiceImpl } from "../src/services/supabaseFinanceService";
import {
    isPartialPayment,
    validatePartialAmount,
} from "../src/lib/creditCardPayments";
import type {
    HouseholdMember,
    UpsertCreditCardStatementInput,
} from "../src/types/finance";

const members: HouseholdMember[] = [
    {
        id: "mem-00000000-0011",
        household_id: "hh-00000000-0001",
        display_name: "Member A",
        role: "owner",
    },
    {
        id: "mem-00000000-0012",
        household_id: "hh-00000000-0001",
        display_name: "Member B",
        role: "member",
    },
];

const MARK_DBS_PAID = /Mark DBS Altitude Visa statement as Paid/i;

async function openPaidModal() {
    render(<CreditCardTrackerSection members={members} perspective="household" />);
    await screen.findByText("DBS Altitude Visa");
    fireEvent.click(screen.getByRole("button", { name: MARK_DBS_PAID }));
    return screen.findByRole("button", { name: "Confirm" });
}

describe("validatePartialAmount", () => {
    it("accepts an amount between 0 and the statement, rounded to cents", () => {
        expect(validatePartialAmount("100.555", 500)).toEqual({
            value: 100.56,
            error: null,
        });
    });

    it("rejects empty, zero and negative amounts", () => {
        for (const raw of ["", "0", "-5", "abc"]) {
            expect(validatePartialAmount(raw, 500).error).toBe(
                "Enter an amount",
            );
        }
    });

    it("rejects amounts at or above the statement", () => {
        expect(validatePartialAmount("500", 500).error).toBe(
            "Must be below statement",
        );
        expect(validatePartialAmount("600", 500).error).toBe(
            "Must be below statement",
        );
    });
});

describe("isPartialPayment", () => {
    it("is true only for paid statements with an amount", () => {
        expect(isPartialPayment({ is_paid: true, amount_paid: 50 })).toBe(true);
        expect(isPartialPayment({ is_paid: true, amount_paid: null })).toBe(
            false,
        );
        expect(isPartialPayment({ is_paid: false, amount_paid: 50 })).toBe(
            false,
        );
    });
});

describe("Partial payment flow", () => {
    beforeEach(() => {
        mockFinanceService.resetData();
        // Demo data has a logged, unpaid DBS statement for 2026-10
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-15T04:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("defaults to a full payment with the amount input hidden", async () => {
        const upsert = vi.spyOn(financeService, "upsertCreditCardStatement");
        const confirm = await openPaidModal();

        expect(screen.getByLabelText("Partial payment")).not.toBeChecked();
        expect(screen.queryByLabelText("Amount Paid")).not.toBeInTheDocument();

        fireEvent.click(confirm);

        await waitFor(() => {
            expect(upsert).toHaveBeenCalledWith(
                expect.objectContaining({ is_paid: true, amount_paid: null }),
            );
        });
    });

    it("logs a partial amount and shows it on the statement", async () => {
        const upsert = vi.spyOn(financeService, "upsertCreditCardStatement");
        const confirm = await openPaidModal();

        fireEvent.click(screen.getByLabelText("Partial payment"));
        fireEvent.change(await screen.findByLabelText("Amount Paid"), {
            target: { value: "1.25" },
        });
        fireEvent.click(confirm);

        await waitFor(() => {
            expect(upsert).toHaveBeenCalledWith(
                expect.objectContaining({ is_paid: true, amount_paid: 1.25 }),
            );
        });
        expect(
            await screen.findAllByTestId(/^credit-card-partial-/),
        ).not.toHaveLength(0);
    });

    it("blocks an amount at or above the statement", async () => {
        const upsert = vi.spyOn(financeService, "upsertCreditCardStatement");
        const confirm = await openPaidModal();

        fireEvent.click(screen.getByLabelText("Partial payment"));
        fireEvent.change(await screen.findByLabelText("Amount Paid"), {
            target: { value: "999999" },
        });
        fireEvent.click(confirm);

        expect(
            await screen.findByText("Must be below statement"),
        ).toBeInTheDocument();
        expect(upsert).not.toHaveBeenCalled();
    });

    it("clears the partial amount when a statement is marked unpaid", async () => {
        const upsert = vi.spyOn(financeService, "upsertCreditCardStatement");
        const confirm = await openPaidModal();
        fireEvent.click(confirm);

        fireEvent.click(
            await screen.findByRole("button", {
                name: /Mark DBS Altitude Visa statement as Unpaid/i,
            }),
        );

        await waitFor(() => {
            expect(upsert).toHaveBeenLastCalledWith(
                expect.objectContaining({ is_paid: false, amount_paid: null }),
            );
        });
    });
});

describe("Statement amount_paid persistence", () => {
    const base: UpsertCreditCardStatementInput = {
        card_id: "card-test",
        household_id: "hh-test",
        month: "2026-11",
        statement_amount: 500,
        due_date: "2026-11-25",
        is_paid: true,
        paid_at: "2026-11-20T00:00:00.000Z",
    };

    beforeEach(() => {
        mockFinanceService.resetData();
    });

    it("mock service sets, keeps and clears amount_paid", async () => {
        const created = await mockFinanceService.upsertCreditCardStatement({
            ...base,
            amount_paid: 200,
        });
        expect(created.amount_paid).toBe(200);

        // An edit that omits amount_paid keeps it
        const kept = await mockFinanceService.upsertCreditCardStatement({
            ...base,
            notes: "edited",
        });
        expect(kept.amount_paid).toBe(200);

        const cleared = await mockFinanceService.upsertCreditCardStatement({
            ...base,
            amount_paid: null,
        });
        expect(cleared.amount_paid).toBeNull();
    });

    it("Supabase upsert sends amount_paid only when provided", async () => {
        const upsert = vi.fn(() => ({
            select: () => ({
                single: vi
                    .fn()
                    .mockResolvedValue({ data: { id: "s1" }, error: null }),
            }),
        }));
        const client = {
            from: vi.fn(() => ({ upsert })),
        } as unknown as SupabaseClient;
        const service = new SupabaseFinanceServiceImpl(client);

        await service.upsertCreditCardStatement({ ...base, amount_paid: 120 });
        expect(upsert).toHaveBeenLastCalledWith(
            expect.objectContaining({ amount_paid: 120 }),
            expect.anything(),
        );

        await service.upsertCreditCardStatement(base);
        const lastPayload = (
            upsert.mock.calls.at(-1) as unknown as [Record<string, unknown>]
        )[0];
        expect(lastPayload).not.toHaveProperty("amount_paid");
    });
});
