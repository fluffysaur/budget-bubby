import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    MultiSelect,
    type MultiSelectProps,
    type SelectItem,
} from "../src/components/ui/dropdown";
import { openSelect, toggleOptions } from "./helpers/select";

const CATEGORIES: SelectItem[] = [
    { value: "food", label: "Food" },
    { value: "fun", label: "Fun" },
    { value: "bills", label: "Bills" },
    { value: "travel", label: "Travel" },
];

function Harness({
    initial = [],
    onChange,
    ...props
}: Partial<MultiSelectProps> & {
    initial?: string[];
    onChange?: (values: string[]) => void;
}) {
    const [value, setValue] = useState<string[]>(initial);
    return (
        <MultiSelect
            label="Category"
            placeholder="All Categories"
            options={CATEGORIES}
            {...props}
            value={value}
            onValueChange={(next) => {
                setValue(next);
                onChange?.(next);
            }}
        />
    );
}

function mockViewport(mobile: boolean) {
    vi.spyOn(window, "matchMedia").mockImplementation(
        (query: string) =>
            ({
                matches: mobile && query.includes("max-width: 639.98px"),
                media: query,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false,
            }) as MediaQueryList,
    );
}

const trigger = () => screen.getByRole("combobox", { name: "Category" });

afterEach(() => {
    vi.restoreAllMocks();
});

describe("MultiSelect", () => {
    it("shows the placeholder when nothing is picked", () => {
        render(<Harness />);
        expect(trigger()).toHaveTextContent("All Categories");
    });

    it("shows the first label in option order plus +N", async () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        // Picked out of order: Bills, then Food
        await toggleOptions("Category", ["Bills", "Food"]);
        expect(onChange).toHaveBeenLastCalledWith(["bills", "food"]);
        expect(trigger()).toHaveTextContent("Food");
        expect(trigger()).toHaveTextContent("+1");
    });

    it("omits the count for a single pick", async () => {
        render(<Harness />);
        await toggleOptions("Category", ["Fun"]);
        expect(trigger()).toHaveTextContent("Fun");
        expect(trigger()).not.toHaveTextContent("+");
    });

    it("stays open, applies each toggle live and unticks on a second click", async () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        const listbox = await openSelect("Category");
        expect(listbox).toHaveAttribute("aria-multiselectable", "true");

        fireEvent.click(within(listbox).getByRole("option", { name: "Food" }));
        expect(onChange).toHaveBeenLastCalledWith(["food"]);
        expect(trigger()).toHaveAttribute("aria-expanded", "true");

        fireEvent.click(within(listbox).getByRole("option", { name: "Fun" }));
        expect(onChange).toHaveBeenLastCalledWith(["food", "fun"]);
        expect(
            within(listbox).getByRole("option", { name: "Fun" }),
        ).toHaveAttribute("aria-selected", "true");

        fireEvent.click(within(listbox).getByRole("option", { name: "Food" }));
        expect(onChange).toHaveBeenLastCalledWith(["fun"]);
        expect(
            within(listbox).getByRole("option", { name: "Food" }),
        ).toHaveAttribute("aria-selected", "false");
    });

    it("Clear all sets []", async () => {
        const onChange = vi.fn();
        render(<Harness initial={["food", "fun"]} onChange={onChange} />);
        expect(trigger()).toHaveTextContent("Food");
        await openSelect("Category");
        fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
        expect(onChange).toHaveBeenLastCalledWith([]);
        expect(trigger()).toHaveTextContent("All Categories");
    });

    it("hides Clear all when nothing is picked", async () => {
        render(<Harness />);
        await openSelect("Category");
        expect(
            screen.queryByRole("button", { name: "Clear all" }),
        ).not.toBeInTheDocument();
    });

    it("toggles with Arrow keys and Enter/Space, Escape closes", async () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        const listbox = await openSelect("Category");
        listbox.focus();

        fireEvent.keyDown(listbox, { key: "Enter" });
        expect(onChange).toHaveBeenLastCalledWith(["food"]);

        fireEvent.keyDown(listbox, { key: "ArrowDown" });
        fireEvent.keyDown(listbox, { key: " " });
        expect(onChange).toHaveBeenLastCalledWith(["food", "fun"]);
        expect(trigger()).toHaveAttribute("aria-expanded", "true");

        fireEvent.keyDown(listbox, { key: "End" });
        fireEvent.keyDown(listbox, { key: "Enter" });
        expect(onChange).toHaveBeenLastCalledWith(["food", "fun", "travel"]);

        fireEvent.keyDown(listbox, { key: "Escape" });
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
    });

    it("has no Done button on desktop", async () => {
        mockViewport(false);
        render(<Harness />);
        await openSelect("Category");
        expect(
            screen.queryByRole("button", { name: "Done" }),
        ).not.toBeInTheDocument();
    });

    it("shows a Done button on mobile that closes the sheet", async () => {
        mockViewport(true);
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        // The modal sheet aria-hides the page, so keep hold of the trigger.
        const button = trigger();
        const listbox = await openSelect(button);
        expect(screen.getByRole("dialog", { name: "Category" })).toBeVisible();

        fireEvent.click(within(listbox).getByRole("option", { name: "Food" }));
        expect(button).toHaveAttribute("aria-expanded", "true");

        fireEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(button).toHaveAttribute("aria-expanded", "false");
        expect(onChange).toHaveBeenLastCalledWith(["food"]);
    });

    it("does not open when disabled", () => {
        render(<Harness disabled />);
        fireEvent.click(trigger());
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
    });
});
