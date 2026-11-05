/**
 * AddRecurringModal start / end dates:
 * - Both dates are optional and submitted as null when empty
 * - End date before start date is rejected
 * - Editing pre-fills both dates
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AddRecurringModal } from "../src/components/recurring/AddRecurringModal";
import type { RecurringItem } from "../src/types/finance";

const baseItem: RecurringItem = {
    id: "ri-dates",
    household_id: "hh-01",
    owner_id: "mem-00000000-0011",
    type: "insurance",
    name: "Shield Plan",
    amount: 600,
    frequency: "annually",
    payment_month: 3,
    start_date: "2024-03-01",
    end_date: "2027-02-28",
    notes: null,
    monthly_amortized_amount: 50,
};

function fillRequired() {
    fireEvent.change(screen.getByLabelText(/^Name/i), {
        target: { value: "Car Insurance" },
    });
    fireEvent.change(screen.getByLabelText(/^Amount/i), {
        target: { value: "900" },
    });
}

async function save() {
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    });
}

describe("AddRecurringModal start and end dates", () => {
    it("submits null dates when both are left empty", async () => {
        const onSave = vi.fn();
        render(<AddRecurringModal isOpen onClose={vi.fn()} onSave={onSave} />);
        fillRequired();
        await save();
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({ start_date: null, end_date: null }),
        );
    });

    it("submits both dates when set", async () => {
        const onSave = vi.fn();
        render(<AddRecurringModal isOpen onClose={vi.fn()} onSave={onSave} />);
        fillRequired();
        fireEvent.change(screen.getByLabelText(/^Start/i), {
            target: { value: "2026-01-01" },
        });
        fireEvent.change(screen.getByLabelText(/^End/i), {
            target: { value: "2028-12-31" },
        });
        await save();
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                start_date: "2026-01-01",
                end_date: "2028-12-31",
            }),
        );
    });

    it("rejects an end date before the start date", async () => {
        const onSave = vi.fn();
        render(<AddRecurringModal isOpen onClose={vi.fn()} onSave={onSave} />);
        fillRequired();
        fireEvent.change(screen.getByLabelText(/^Start/i), {
            target: { value: "2026-06-01" },
        });
        fireEvent.change(screen.getByLabelText(/^End/i), {
            target: { value: "2026-05-01" },
        });
        await act(async () => {
            // Bypass native min validation to exercise the in-form check
            fireEvent.submit(
                screen
                    .getByRole("button", { name: /^Save$/i })
                    .closest("form")!,
            );
        });
        expect(onSave).not.toHaveBeenCalled();
        expect(
            screen.getByText(/End date must be on or after/i),
        ).toBeInTheDocument();
    });

    it("pre-fills start and end dates when editing", () => {
        render(
            <AddRecurringModal
                isOpen
                initialItem={baseItem}
                onClose={vi.fn()}
                onSave={vi.fn()}
            />,
        );
        expect(
            (screen.getByLabelText(/^Start/i) as HTMLInputElement).value,
        ).toBe("2024-03-01");
        expect((screen.getByLabelText(/^End/i) as HTMLInputElement).value).toBe(
            "2027-02-28",
        );
    });
});
