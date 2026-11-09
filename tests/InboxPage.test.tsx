import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/queryClient";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { InboxPage } from "../src/pages/InboxPage";
import { mockFinanceService } from "../src/services/mockFinanceService";
import { financeService } from "../src/services/financeService";
import { SettingsProvider } from "../src/context/SettingsContext";
import { onInboxEvent } from "../src/lib/inbox/inboxEvents";
import { mockCategories } from "../src/data/mockSeedData";
import type { InboxItem } from "../src/types/finance";

function renderInbox() {
    return render(
        <QueryClientProvider client={queryClient}>
            <HouseholdProvider>
                <SettingsProvider>
                    <MemoryRouter initialEntries={["/inbox"]}>
                        <Routes>
                            <Route path="/inbox" element={<InboxPage />} />
                            <Route
                                path="/expenses"
                                element={<div>Expenses Page</div>}
                            />
                        </Routes>
                    </MemoryRouter>
                </SettingsProvider>
            </HouseholdProvider>
        </QueryClientProvider>,
    );
}

const transport = mockCategories.find((c) => c.name === "Transport")!;
const food = mockCategories.find((c) => c.name === "Food")!;

function item(over: Partial<InboxItem>): InboxItem {
    return {
        id: "x1",
        household_id: "hh-00000000-0001",
        member_id: "mem-00000000-0011",
        merchant: "Grab Food",
        merchant_key: "grab food",
        amount: 12.5,
        currency: "SGD",
        captured_at: new Date(Date.now() - 3600_000).toISOString(),
        status: "pending",
        ...over,
    };
}

async function findCard() {
    return screen.findByTestId("inbox-card", {}, { timeout: 10000 });
}

describe("InboxPage", () => {
    beforeEach(() => {
        localStorage.clear();
        mockFinanceService.resetData();
    });
    afterEach(() => vi.restoreAllMocks());

    it("shows the newest item with its category guessed", async () => {
        renderInbox();
        const card = await findCard();
        expect(within(card).getByText("Grab Food")).toBeInTheDocument();
        expect(screen.getByText("3 to sort")).toBeInTheDocument();
        expect(
            within(card).getByRole("button", { name: /Transport/ }),
        ).toHaveAttribute("aria-pressed", "true");
    });

    it("confirms by button and emits inbox:item-confirmed", async () => {
        const handler = vi.fn();
        const off = onInboxEvent("inbox:item-confirmed", handler);
        renderInbox();
        await findCard();
        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
        await waitFor(() =>
            expect(screen.getByText("2 to sort")).toBeInTheDocument(),
        );
        await waitFor(() => expect(handler).toHaveBeenCalled());
        expect(handler.mock.calls[0][0]).toMatchObject({
            via: "button",
            categoryId: transport.id,
            usedSuggestion: true,
            remaining: 2,
            amountSgd: 18.4,
        });
        const expenses = await mockFinanceService.getExpenses();
        expect(expenses.find((e) => e.item === "Grab Food")?.category_id).toBe(
            transport.id,
        );
        // The choice is remembered for next time
        const rules = await mockFinanceService.getMerchantRules();
        expect(rules).toEqual([
            expect.objectContaining({
                merchant_key: "grab food",
                category_id: transport.id,
            }),
        ]);
        off();
    });

    it("confirms by keyboard with a picked chip", async () => {
        renderInbox();
        const card = await findCard();
        fireEvent.click(within(card).getByRole("button", { name: /^Food/ }));
        fireEvent.keyDown(window, { key: "ArrowRight" });
        await waitFor(() =>
            expect(screen.getByText("2 to sort")).toBeInTheDocument(),
        );
        const expenses = await mockFinanceService.getExpenses();
        expect(expenses.find((e) => e.item === "Grab Food")?.category_id).toBe(
            food.id,
        );
    });

    it("discards by keyboard and Undo restores", async () => {
        const handler = vi.fn();
        const off = onInboxEvent("inbox:item-discarded", handler);
        renderInbox();
        await findCard();
        fireEvent.keyDown(window, { key: "ArrowLeft" });
        await waitFor(() =>
            expect(screen.getByText("2 to sort")).toBeInTheDocument(),
        );
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({ reason: "discarded", remaining: 2 }),
        );
        fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
        await waitFor(() =>
            expect(screen.getByText("3 to sort")).toBeInTheDocument(),
        );
        off();
    });

    it("batch-confirms rule-matched items", async () => {
        await mockFinanceService.upsertMerchantRule({
            merchant_key: "grab food",
            category_id: transport.id,
        });
        await mockFinanceService.upsertMerchantRule({
            merchant_key: "starbucks",
            category_id: food.id,
        });
        renderInbox();
        await findCard();
        fireEvent.click(
            await screen.findByRole("button", { name: "Confirm 2 Matched" }),
        );
        await waitFor(() =>
            expect(screen.getByText("1 to sort")).toBeInTheDocument(),
        );
        expect(
            within(await findCard()).getByText("Ntuc Fairprice"),
        ).toBeInTheDocument();
    });

    it("hints a duplicate and resolves it with Same One", async () => {
        const [existing] = await mockFinanceService.getExpenses();
        mockFinanceService.inbox.setItems([
            item({
                member_id: existing.payer_id,
                amount: existing.amount,
                captured_at: `${existing.date}T04:00:00.000Z`,
            }),
        ]);
        renderInbox();
        await findCard();
        expect(screen.getByText("Looks logged already")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Same One" }));
        expect(await screen.findByText("No Captures")).toBeInTheDocument();
    });

    it("fires inbox:cleared once the last item is sorted", async () => {
        mockFinanceService.inbox.setItems([item({})]);
        const handler = vi.fn();
        const off = onInboxEvent("inbox:cleared", handler);
        renderInbox();
        await findCard();
        fireEvent.click(screen.getByRole("button", { name: "Discard" }));
        await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
        expect(handler.mock.calls[0][0]).toMatchObject({ clearedCount: 1 });
        off();
    });

    it("shows both empty states", async () => {
        mockFinanceService.inbox.setItems([]);
        const { unmount } = renderInbox();
        expect(await screen.findByText("No Captures")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Set Up" }),
        ).toBeInTheDocument();
        unmount();
        queryClient.clear();
        await mockFinanceService.createCaptureToken("iPhone");
        renderInbox();
        expect(await screen.findByText("All Sorted")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Add Expense" }),
        ).toBeInTheDocument();
    });

    it("forces Edit for unsupported currencies", async () => {
        mockFinanceService.inbox.setItems([
            item({ currency: "XYZ", amount: 50 }),
        ]);
        renderInbox();
        await findCard();
        expect(screen.getByText("Check rate")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    });

    it("Edit opens the form and saving confirms the item", async () => {
        const handler = vi.fn();
        const off = onInboxEvent("inbox:item-confirmed", handler);
        renderInbox();
        await findCard();
        fireEvent.click(screen.getByRole("button", { name: "Edit" }));
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByLabelText("Description")).toHaveValue(
            "Grab Food",
        );
        fireEvent.click(
            within(dialog).getByRole("button", { name: "Confirm" }),
        );
        await waitFor(() =>
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({ via: "edit" }),
            ),
        );
        await waitFor(() =>
            expect(screen.getByText("2 to sort")).toBeInTheDocument(),
        );
        off();
    });

    it("redirects away before the migration", async () => {
        vi.spyOn(financeService, "getInboxItems").mockResolvedValue({
            available: false,
            items: [],
        });
        renderInbox();
        expect(await screen.findByText("Expenses Page")).toBeInTheDocument();
    });
});
