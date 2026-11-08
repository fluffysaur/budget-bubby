import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { App } from "../src/App";
import { ExpenseFormModal } from "../src/components/expenses/ExpenseFormModal";
import { mockFinanceService } from "../src/services/mockFinanceService";
import { mockCategories, mockMembers } from "../src/data/mockSeedData";
import { onInboxEvent } from "../src/lib/inbox/inboxEvents";

vi.mock("recharts", async (importOriginal) => {
    const original = await importOriginal<typeof import("recharts")>();
    return {
        ...original,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
            <div style={{ width: 800, height: 400 }}>{children}</div>
        ),
    };
});

describe("Inbox counts", () => {
    beforeEach(() => {
        localStorage.clear();
        mockFinanceService.resetData();
    });

    it("shows the Home card and the Spend badges", async () => {
        render(<App initialEntries={["/"]} />);
        const card = await screen.findByRole(
            "region",
            { name: "Inbox" },
            { timeout: 15000 },
        );
        expect(within(card).getByText("3 to sort")).toBeInTheDocument();
        expect(within(card).getByText(/unsorted/)).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Spend, 3 to sort" }),
        ).toBeInTheDocument();
        expect(screen.getByTestId("spend-inbox-badge")).toHaveTextContent("3");
        const sidebar = screen.getByRole("navigation", { name: "Sidebar" });
        expect(within(sidebar).getByLabelText("3 to sort")).toBeInTheDocument();

        fireEvent.click(within(card).getByRole("button", { name: "Sort Now" }));
        expect(
            await screen.findByTestId("inbox-card", {}, { timeout: 10000 }),
        ).toBeInTheDocument();
    }, 30000);

    it("hides the Home card when nothing is pending", async () => {
        mockFinanceService.inbox.setItems([]);
        render(<App initialEntries={["/"]} />);
        await screen.findByRole(
            "region",
            { name: "Left to Spend" },
            { timeout: 15000 },
        );
        expect(
            screen.queryByRole("region", { name: "Inbox" }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("spend-inbox-badge"),
        ).not.toBeInTheDocument();
    }, 30000);
});

describe("From Inbox chips in Add Expense", () => {
    beforeEach(() => {
        localStorage.clear();
        mockFinanceService.resetData();
    });

    it("prefills from an inbox item and confirms it instead of adding", async () => {
        const handler = vi.fn();
        const off = onInboxEvent("inbox:item-confirmed", handler);
        render(
            <ExpenseFormModal
                isOpen
                onClose={() => {}}
                categories={mockCategories}
                members={mockMembers}
                goals={[]}
            />,
        );
        fireEvent.click(
            await screen.findByRole("button", { name: "From Inbox (3)" }),
        );
        fireEvent.click(screen.getByRole("button", { name: /Starbucks/ }));
        expect(screen.getByLabelText("Description")).toHaveValue("Starbucks");
        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
        await waitFor(() =>
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({ via: "edit" }),
            ),
        );
        const pending = (await mockFinanceService.getInboxItems()).items;
        expect(pending.map((i) => i.merchant)).not.toContain("Starbucks");
        off();
    });
});
