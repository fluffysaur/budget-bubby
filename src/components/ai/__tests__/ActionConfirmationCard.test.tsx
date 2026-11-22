import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LazyMotion, domAnimation } from "motion/react";
import { PrivacyProvider } from "../../../context/PrivacyContext";
import { ActionConfirmationCard } from "../ActionConfirmationCard";
import type { ProposedAction } from "../../../services/ai/aiTools";

function renderCard(
    action: ProposedAction,
    onConfirm = vi.fn().mockResolvedValue(undefined),
    onCancel = vi.fn(),
) {
    return {
        onConfirm,
        onCancel,
        ...render(
            <LazyMotion features={domAnimation} strict>
                <PrivacyProvider>
                    <ActionConfirmationCard
                        action={action}
                        onConfirm={onConfirm}
                        onCancel={onCancel}
                    />
                </PrivacyProvider>
            </LazyMotion>,
        ),
    };
}

describe("ActionConfirmationCard", () => {
    it("renders expense details and invokes onConfirm / onCancel", async () => {
        const action: ProposedAction = {
            id: "act-1",
            type: "proposeExpense",
            title: "Log Expense",
            status: "pending",
            payload: {
                item: "Kopi & Toast",
                amount: 5.2,
                date: "2026-11-22",
                payerId: "mem-1",
                categoryName: "Food & Dining",
                isShared: true,
                splitRatio: 0.5,
            },
        };

        const { onConfirm, onCancel } = renderCard(action);

        expect(screen.getByText("Kopi & Toast")).toBeInTheDocument();
        expect(screen.getByText("Food & Dining")).toBeInTheDocument();
        expect(screen.getByText(/Shared \(50%\)/)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("action-confirm-btn"));
        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(action));

        fireEvent.click(screen.getByTestId("action-cancel-btn"));
        expect(onCancel).toHaveBeenCalledWith("act-1");
    });

    it("hides action buttons when saved and displays error alert on failure", () => {
        const savedAction: ProposedAction = {
            id: "act-2",
            type: "proposeBalanceUpdate",
            title: "Update Balance",
            status: "confirmed",
            payload: {
                accountId: "acc-1",
                accountName: "DBS Multiplier",
                previousBalance: 10000,
                newBalance: 12000,
                date: "2026-11-22",
            },
        };
        const { unmount } = renderCard(savedAction);
        expect(screen.getByText("Saved")).toBeInTheDocument();
        expect(
            screen.queryByTestId("action-confirm-btn"),
        ).not.toBeInTheDocument();
        unmount();

        const erroredAction: ProposedAction = {
            id: "act-3",
            type: "proposeBudgetAdjustment",
            title: "Adjust Budget",
            status: "error",
            errorMessage: "Budget is locked.",
            payload: {
                month: "2026-11",
                bonus: 1500,
            },
        };
        renderCard(erroredAction);
        expect(screen.getByText("Budget is locked.")).toBeInTheDocument();
        expect(screen.getByTestId("action-confirm-btn")).toBeInTheDocument();
    });
});
