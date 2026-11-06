import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useQuickAddDeepLink } from "../src/hooks/useQuickAddDeepLink";
import { parseQuickAddDeepLink, stripQuickAddParams } from "../src/lib/capture/deepLink";
import { ExpenseFormModal } from "../src/components/expenses/ExpenseFormModal";
import { mockCategories, mockMembers } from "../src/data/mockSeedData";
import type { ExpenseFormInitialValues } from "../src/components/expenses/ExpenseFormModal";

function Harness({ onOpen }: { onOpen: (v?: ExpenseFormInitialValues) => void }) {
    useQuickAddDeepLink(onOpen);
    const location = useLocation();
    return <div data-testid="search">{location.search}</div>;
}

function renderAt(url: string, onOpen = vi.fn()) {
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path="*" element={<Harness onOpen={onOpen} />} />
            </Routes>
        </MemoryRouter>,
    );
    return onOpen;
}

describe("parseQuickAddDeepLink", () => {
    it("ignores URLs without action=new", () => {
        expect(parseQuickAddDeepLink("?tab=budget")).toBeNull();
        expect(parseQuickAddDeepLink("")).toBeNull();
    });

    it("parses amount, merchant and time", () => {
        const at = new Date(Date.now() - 60_000).toISOString();
        const values = parseQuickAddDeepLink(
            `?action=new&amount=${encodeURIComponent("S$12.50")}&merchant=GRAB&card=DBS&at=${encodeURIComponent(at)}`,
        );
        expect(values).toMatchObject({ amount: 12.5, item: "Grab" });
        expect(values?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(values?.time).toMatch(/^\d{2}:\d{2}$/);
    });

    it("keeps foreign amounts in their currency", () => {
        expect(parseQuickAddDeepLink("?action=new&amount=US%244.99")).toEqual({
            original_currency: "USD",
            original_amount: 4.99,
        });
    });

    it("drops invalid values", () => {
        expect(
            parseQuickAddDeepLink("?action=new&amount=abc&merchant=%20%20&at=yesterday"),
        ).toEqual({});
        expect(
            parseQuickAddDeepLink("?action=new&at=2001-01-01T00:00:00Z"),
        ).toEqual({});
    });

    it("strips only the deep-link params", () => {
        expect(stripQuickAddParams("?action=new&amount=1&tab=expenses")).toBe("?tab=expenses");
        expect(stripQuickAddParams("?action=new")).toBe("");
    });
});

describe("useQuickAddDeepLink", () => {
    it("opens a prefilled form and strips the params", async () => {
        const onOpen = renderAt("/expenses?action=new&amount=S%2412.50&merchant=Grab");
        await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
        expect(onOpen).toHaveBeenCalledWith({ amount: 12.5, item: "Grab" });
        await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent(""));
    });

    it("does nothing without action=new", () => {
        const onOpen = renderAt("/expenses?tab=budget");
        expect(onOpen).not.toHaveBeenCalled();
        expect(screen.getByTestId("search")).toHaveTextContent("?tab=budget");
    });
});

describe("ExpenseFormModal initialValues", () => {
    it("prefills description and guesses the category", () => {
        render(
            <ExpenseFormModal
                isOpen
                onClose={() => {}}
                categories={mockCategories}
                members={mockMembers}
                goals={[]}
                initialValues={{ amount: 12.5, item: "Grab ride" }}
            />,
        );
        expect(screen.getByLabelText("Description")).toHaveValue("Grab ride");
        const transport = mockCategories.find((c) => /transport/i.test(c.name));
        if (transport) {
            const chip = screen.getByRole("button", { name: new RegExp(transport.name, "i") });
            expect(chip).toHaveAttribute("aria-pressed", "true");
        }
    });
});
