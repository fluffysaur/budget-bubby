import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExpenseFilterBar } from "../src/components/expenses/ExpenseFilterBar";
import { ExpenseListTable } from "../src/components/expenses/ExpenseListTable";
import { mockCategories, mockMembers } from "../src/data/mockSeedData";
import type { ExpenseFilter } from "../src/types/finance";

describe("Mobile-Friendly Filter, Search & Sort in Ledger", () => {
    it("renders search input, mobile filter toggle with active count badge, and quick sort selector", () => {
        const filter: ExpenseFilter = {
            search: "Bowl",
            categoryId: mockCategories[0].id,
            payerId: undefined,
            isShared: true,
            tag: "lunch-trip",
        };

        render(
            <ExpenseFilterBar
                filter={filter}
                onFilterChange={vi.fn()}
                categories={mockCategories}
                members={mockMembers}
            />,
        );

        // Search input
        const searchInput = screen.getByPlaceholderText(/search/i);
        expect(searchInput).toHaveValue("Bowl");

        // Mobile Filter Toggle button with count badge (Bowl, Category, Shared, Tag = 4)
        const toggleBtn = screen.getByRole("button", { name: /toggle filters/i });
        expect(toggleBtn).toBeInTheDocument();
        expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByText("4")).toBeInTheDocument();

        // Sort dropdown
        const sortSelects = screen.getAllByRole("combobox", { name: /sort ledger/i });
        expect(sortSelects.length).toBeGreaterThanOrEqual(1);
    });

    it("expands and collapses the mobile filter drawer when toggle button is clicked", () => {
        const filter: ExpenseFilter = { search: "" };
        render(
            <ExpenseFilterBar
                filter={filter}
                onFilterChange={vi.fn()}
                categories={mockCategories}
                members={mockMembers}
            />,
        );

        const toggleBtn = screen.getByRole("button", { name: /toggle filters/i });
        expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

        // Click to expand drawer
        fireEvent.click(toggleBtn);
        expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

        // Click again to collapse drawer
        fireEvent.click(toggleBtn);
        expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    });

    it("allows clearing search text via the search dismiss button", () => {
        const onFilterChange = vi.fn();
        const filter: ExpenseFilter = { search: "Salad" };

        render(
            <ExpenseFilterBar
                filter={filter}
                onFilterChange={onFilterChange}
                categories={mockCategories}
                members={mockMembers}
            />,
        );

        const dismissBtn = screen.getByRole("button", { name: /dismiss search/i });
        fireEvent.click(dismissBtn);

        expect(onFilterChange).toHaveBeenCalledWith(
            expect.objectContaining({ search: "" }),
        );
    });

    it("displays active filter chips and allows removing an individual chip", () => {
        const onFilterChange = vi.fn();
        const filter: ExpenseFilter = {
            search: "Salad",
            categoryId: mockCategories[0].id,
            tag: "travel",
        };

        render(
            <ExpenseFilterBar
                filter={filter}
                onFilterChange={onFilterChange}
                categories={mockCategories}
                members={mockMembers}
            />,
        );

        // Should display chips
        expect(screen.getByText('"Salad"')).toBeInTheDocument();
        expect(screen.getAllByText(mockCategories[0].name).length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText("#travel")).toBeInTheDocument();

        // Remove tag chip
        const removeTagBtn = screen.getByRole("button", { name: /remove filter #travel/i });
        fireEvent.click(removeTagBtn);

        expect(onFilterChange).toHaveBeenCalledWith(
            expect.objectContaining({ tag: undefined }),
        );
    });

    it("updates sort field and order when sort dropdown changes", () => {
        const onSortChange = vi.fn();
        const filter: ExpenseFilter = {};

        render(
            <ExpenseFilterBar
                filter={filter}
                onFilterChange={vi.fn()}
                categories={mockCategories}
                members={mockMembers}
                onSortChange={onSortChange}
            />,
        );

        const sortSelects = screen.getAllByRole("combobox", { name: /sort ledger/i });
        fireEvent.change(sortSelects[0], { target: { value: "amount-asc" } });

        expect(onSortChange).toHaveBeenCalledWith("amount", "asc");
    });

    it("embeds toolbar inside Ledger Card and preserves toolbar when results are empty", () => {
        const onResetFilters = vi.fn();
        const filter: ExpenseFilter = { search: "NonExistent" };

        render(
            <ExpenseListTable
                expenses={[]}
                categories={mockCategories}
                members={mockMembers}
                filter={filter}
                onFilterChange={vi.fn()}
                onResetFilters={onResetFilters}
            />,
        );

        // Search bar inside the card header remains visible
        expect(screen.getByPlaceholderText(/search merchant/i)).toBeInTheDocument();

        // Empty state is rendered inside the card body
        expect(screen.getByText(/no expenses found/i)).toBeInTheDocument();

        // Clear filters button triggers onResetFilters
        const clearBtn = screen.getByRole("button", { name: /clear filters/i });
        fireEvent.click(clearBtn);

        expect(onResetFilters).toHaveBeenCalledTimes(1);
    });
});
