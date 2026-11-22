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
const lifestyle = mockCategories.find((c) => c.name === "Lifestyle")!;
const tithing = mockCategories.find((c) => c.name === "Tithing")!;

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

    it("edits all fields inline on the card without an Edit modal and saves on Confirm", async () => {
        renderInbox();
        const card = await findCard();
        expect(
            screen.queryByRole("button", { name: "Edit" }),
        ).not.toBeInTheDocument();

        fireEvent.change(within(card).getByLabelText("Description"), {
            target: { value: "Grab Dinner" },
        });
        fireEvent.change(within(card).getByPlaceholderText("0.00"), {
            target: { value: "24.50" },
        });
        fireEvent.click(within(card).getByRole("button", { name: /^more/i }));
        fireEvent.change(within(card).getByLabelText("Notes"), {
            target: { value: "Late night" },
        });
        fireEvent.change(within(card).getByLabelText("Tags"), {
            target: { value: "Supper" },
        });
        fireEvent.click(within(card).getByRole("button", { name: "+ Tag" }));

        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
        await waitFor(() =>
            expect(screen.getByText("2 to sort")).toBeInTheDocument(),
        );
        const expenses = await mockFinanceService.getExpenses();
        expect(
            expenses.find((e) => e.item === "Grab Dinner"),
        ).toMatchObject({
            amount: 24.5,
            remarks: "Late night",
            tags: ["#Supper"],
        });
    });

    it("navigates between cards with Prev/Next and keyboard while preserving per-card edits", async () => {
        renderInbox();
        let card = await findCard();
        expect(screen.getByTestId("inbox-position")).toHaveTextContent(
            "1 of 3",
        );
        expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();

        // Edit card 1 description and notes
        fireEvent.change(within(card).getByLabelText("Description"), {
            target: { value: "Edited Grab" },
        });

        // Navigate Next by button
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(screen.getByTestId("inbox-position")).toHaveTextContent(
            "2 of 3",
        );
        card = await findCard();
        expect(within(card).getByLabelText("Description")).not.toHaveValue(
            "Edited Grab",
        );

        // Navigate Next by keyboard (ArrowDown)
        fireEvent.keyDown(window, { key: "ArrowDown" });
        expect(screen.getByTestId("inbox-position")).toHaveTextContent(
            "3 of 3",
        );
        expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

        // Navigate Prev by keyboard (ArrowUp) then button
        fireEvent.keyDown(window, { key: "ArrowUp" });
        expect(screen.getByTestId("inbox-position")).toHaveTextContent(
            "2 of 3",
        );
        fireEvent.click(screen.getByRole("button", { name: "Prev" }));
        expect(screen.getByTestId("inbox-position")).toHaveTextContent(
            "1 of 3",
        );

        // Unsaved edit on card 1 is preserved
        card = await findCard();
        expect(within(card).getByLabelText("Description")).toHaveValue(
            "Edited Grab",
        );
    });

    it("ignores swipe gestures inside interactive controls while allowing swipe on card header", async () => {
        class TestPointerEvent extends MouseEvent {
            pointerId: number;
            constructor(type: string, init: PointerEventInit = {}) {
                super(type, init);
                this.pointerId = init.pointerId ?? 0;
            }
        }
        vi.stubGlobal("PointerEvent", TestPointerEvent);
        try {
            renderInbox();
            const card = await findCard();
            const descInput = within(card).getByLabelText("Description");

            // Pointer gesture starting on an input should not translate the card
            fireEvent.pointerDown(descInput, {
                button: 0,
                pointerId: 1,
                clientX: 100,
                clientY: 100,
            });
            fireEvent.pointerMove(card, {
                pointerId: 1,
                clientX: 250,
                clientY: 100,
            });
            fireEvent.pointerUp(card, {
                pointerId: 1,
                clientX: 250,
                clientY: 100,
            });
            expect(screen.getByText("3 to sort")).toBeInTheDocument();

            // Pointer gesture starting on a range slider should not translate the card
            fireEvent.click(within(card).getByRole("button", { name: /^more/i }));
            fireEvent.click(within(card).getByRole("button", { name: /shared/i }));
            const slider = within(card).getByLabelText(/partner's share/i);
            fireEvent.pointerDown(slider, {
                button: 0,
                pointerId: 2,
                clientX: 100,
                clientY: 100,
            });
            fireEvent.pointerMove(card, {
                pointerId: 2,
                clientX: 250,
                clientY: 100,
            });
            fireEvent.pointerUp(card, {
                pointerId: 2,
                clientX: 250,
                clientY: 100,
            });
            expect(screen.getByText("3 to sort")).toBeInTheDocument();

            // Pointer gesture on non-interactive card area should allow swipe-to-discard
            const nonInteractive = within(card).getAllByText("Today")[0];
            fireEvent.pointerDown(nonInteractive, {
                button: 0,
                pointerId: 3,
                clientX: 200,
                clientY: 40,
            });
            fireEvent.pointerMove(card, {
                pointerId: 3,
                clientX: 10,
                clientY: 40,
            });
            fireEvent.pointerUp(card, {
                pointerId: 3,
                clientX: 10,
                clientY: 40,
            });
            await waitFor(() =>
                expect(screen.getByText("2 to sort")).toBeInTheDocument(),
            );
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("auto-expands non-spendable category chips when the guessed category is an allocation category", async () => {
        await mockFinanceService.upsertMerchantRule({
            merchant_key: "giving sg",
            category_id: tithing.id,
        });
        mockFinanceService.inbox.setItems([
            item({
                id: "alloc-1",
                merchant: "Giving SG",
                merchant_key: "giving sg",
                amount: 50,
            }),
        ]);
        renderInbox();
        const card = await findCard();
        expect(
            within(card).getByRole("button", { name: /^Tithing/ }),
        ).toHaveAttribute("aria-pressed", "true");
    });

    it("maps keyboard shortcuts 1-5 to the visible category chips on the card", async () => {
        renderInbox();
        const card = await findCard();
        // Default mock item guesses Transport (3rd visible chip); key "1" should pick 1st visible chip (Food), "2" -> Lifestyle
        expect(
            within(card).getByRole("button", { name: /^Transport/ }),
        ).toHaveAttribute("aria-pressed", "true");

        fireEvent.keyDown(window, { key: "1" });
        expect(
            within(card).getByRole("button", { name: /^Food/ }),
        ).toHaveAttribute("aria-pressed", "true");

        fireEvent.keyDown(window, { key: "2" });
        expect(
            within(card).getByRole("button", { name: /^Lifestyle/ }),
        ).toHaveAttribute("aria-pressed", "true");

        // Confirm uses the keyboard-picked category (Lifestyle)
        fireEvent.keyDown(window, { key: "ArrowRight" });
        await waitFor(() =>
            expect(screen.getByText("2 to sort")).toBeInTheDocument(),
        );
        const expenses = await mockFinanceService.getExpenses();
        expect(expenses.find((e) => e.item === "Grab Food")?.category_id).toBe(
            lifestyle.id,
        );
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
