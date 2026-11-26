import { useState } from "react";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    Select,
    SEARCH_THRESHOLD,
    filterItems,
    flattenOptions,
    shouldShowSearch,
    type SelectItem,
    type SelectProps,
} from "../src/components/ui/dropdown";
import { AnimatedModal, ModalBody } from "../src/components/ui/AnimatedModal";
import { openSelect, selectOption } from "./helpers/select";

const FRUITS: SelectItem[] = [
    { value: "apple", label: "Apple" },
    { value: "banana", label: "Banana", disabled: true },
    { value: "cherry", label: "Cherry" },
    { value: "date", label: "Date" },
];

function manyOptions(count: number): SelectItem[] {
    return Array.from({ length: count }, (_, i) => ({
        value: `opt-${i}`,
        label: `Option ${i}`,
    }));
}

function Harness({
    initial = "",
    onChange,
    ...props
}: Partial<SelectProps> & {
    initial?: string;
    onChange?: (value: string) => void;
}) {
    const [value, setValue] = useState(initial);
    return (
        <Select
            label="Fruit"
            options={FRUITS}
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

const trigger = () => screen.getByRole("combobox", { name: "Fruit" });
const activeOptionText = (listbox: HTMLElement) => {
    const id = listbox.getAttribute("aria-activedescendant");
    return id ? (document.getElementById(id)?.textContent ?? null) : null;
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe("Select (custom dropdown)", () => {
    describe("trigger", () => {
        it("is a combobox named by its label and shows the placeholder", () => {
            render(<Harness placeholder="Pick a fruit" />);
            const button = trigger();
            expect(button).toHaveAttribute("aria-haspopup", "listbox");
            expect(button).toHaveAttribute("aria-expanded", "false");
            expect(button).toHaveTextContent("Pick a fruit");
            // Label click still works like a native select
            expect(screen.getByLabelText("Fruit")).toBe(button);
        });

        it("shows the selected label with its colour dot or icon", () => {
            render(
                <Harness
                    initial="cherry"
                    options={[
                        {
                            value: "cherry",
                            label: "Cherry",
                            icon: <svg data-testid="cherry-icon" />,
                        },
                    ]}
                />,
            );
            expect(trigger()).toHaveTextContent("Cherry");
            expect(
                within(trigger()).getByTestId("cherry-icon"),
            ).toBeInTheDocument();
        });

        it("uses aria-label when there is no visible label", () => {
            render(
                <Select
                    aria-label="Select currency"
                    variant="pill"
                    options={FRUITS}
                    value="apple"
                    onValueChange={vi.fn()}
                />,
            );
            expect(
                screen.getByRole("combobox", { name: "Select currency" }),
            ).toHaveClass("rounded-full");
        });

        it("does not open when disabled", () => {
            render(<Harness disabled />);
            fireEvent.click(trigger());
            expect(trigger()).toHaveAttribute("aria-expanded", "false");
            expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        });
    });

    describe("selection", () => {
        it("selects on click, closes and returns focus to the trigger", async () => {
            const onChange = vi.fn();
            render(<Harness initial="apple" onChange={onChange} />);
            const listbox = await openSelect("Fruit");
            expect(
                within(listbox).getByRole("option", { name: "Apple" }),
            ).toHaveAttribute("aria-selected", "true");

            fireEvent.click(
                within(listbox).getByRole("option", { name: "Cherry" }),
            );
            expect(onChange).toHaveBeenCalledWith("cherry");
            await waitFor(() =>
                expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
            );
            expect(trigger()).toHaveTextContent("Cherry");
            await waitFor(() => expect(trigger()).toHaveFocus());
        });

        it("ignores clicks on disabled options", async () => {
            const onChange = vi.fn();
            render(<Harness onChange={onChange} />);
            const listbox = await openSelect("Fruit");
            const banana = within(listbox).getByRole("option", {
                name: "Banana",
            });
            expect(banana).toHaveAttribute("aria-disabled", "true");
            fireEvent.click(banana);
            expect(onChange).not.toHaveBeenCalled();
            expect(screen.getByRole("listbox")).toBeInTheDocument();
        });

        it("works with the selectOption test helper", async () => {
            const onChange = vi.fn();
            render(<Harness onChange={onChange} />);
            await selectOption("Fruit", "Date");
            expect(onChange).toHaveBeenCalledWith("date");
        });

        it("does not re-fire onValueChange for the current value", async () => {
            const onChange = vi.fn();
            render(<Harness initial="apple" onChange={onChange} />);
            await selectOption("Fruit", "Apple");
            expect(onChange).not.toHaveBeenCalled();
        });
    });

    describe("keyboard", () => {
        it("opens with ArrowDown and starts on the selected option", async () => {
            render(<Harness initial="cherry" />);
            trigger().focus();
            fireEvent.keyDown(trigger(), { key: "ArrowDown" });
            const listbox = await screen.findByRole("listbox");
            await waitFor(() => expect(listbox).toHaveFocus());
            expect(activeOptionText(listbox)).toBe("Cherry");
        });

        it("skips disabled options, supports Home/End and selects with Enter", async () => {
            const onChange = vi.fn();
            render(<Harness onChange={onChange} />);
            const listbox = await openSelect("Fruit");
            await waitFor(() => expect(listbox).toHaveFocus());
            expect(activeOptionText(listbox)).toBe("Apple");

            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            expect(activeOptionText(listbox)).toBe("Cherry");
            fireEvent.keyDown(listbox, { key: "ArrowUp" });
            expect(activeOptionText(listbox)).toBe("Apple");
            fireEvent.keyDown(listbox, { key: "End" });
            expect(activeOptionText(listbox)).toBe("Date");
            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            expect(activeOptionText(listbox)).toBe("Date");
            fireEvent.keyDown(listbox, { key: "Home" });
            expect(activeOptionText(listbox)).toBe("Apple");

            fireEvent.keyDown(listbox, { key: "End" });
            fireEvent.keyDown(listbox, { key: "Enter" });
            expect(onChange).toHaveBeenCalledWith("date");
            await waitFor(() =>
                expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
            );
        });

        it("selects with Space", async () => {
            const onChange = vi.fn();
            render(<Harness onChange={onChange} />);
            const listbox = await openSelect("Fruit");
            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            fireEvent.keyDown(listbox, { key: " " });
            expect(onChange).toHaveBeenCalledWith("cherry");
        });

        it("moves to a typed match when there is no search box", async () => {
            render(<Harness />);
            const listbox = await openSelect("Fruit");
            await waitFor(() => expect(listbox).toHaveFocus());
            fireEvent.keyDown(listbox, { key: "d" });
            expect(activeOptionText(listbox)).toBe("Date");
        });

        it("closes on Escape without selecting", async () => {
            const onChange = vi.fn();
            render(<Harness onChange={onChange} />);
            const listbox = await openSelect("Fruit");
            fireEvent.keyDown(listbox, { key: "Escape" });
            await waitFor(() =>
                expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
            );
            expect(onChange).not.toHaveBeenCalled();
            await waitFor(() => expect(trigger()).toHaveFocus());
        });

        it("closes back to the trigger when tabbing out", async () => {
            render(<Harness />);
            const listbox = await openSelect("Fruit");
            await waitFor(() => expect(listbox).toHaveFocus());
            fireEvent.keyDown(listbox, { key: "Tab" });
            await waitFor(() =>
                expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
            );
        });
    });

    describe("groups", () => {
        it("renders labelled, non-selectable group headings", async () => {
            const onChange = vi.fn();
            render(
                <Harness
                    onChange={onChange}
                    options={[
                        { value: "none", label: "Unsorted" },
                        {
                            label: "Spend",
                            options: [
                                { value: "food", label: "Food" },
                                { value: "fun", label: "Fun" },
                            ],
                        },
                        {
                            label: "Set aside",
                            options: [{ value: "travel", label: "Travel" }],
                        },
                    ]}
                />,
            );
            const listbox = await openSelect("Fruit");
            const spend = within(listbox).getByRole("group", {
                name: "Spend",
            });
            expect(within(spend).getAllByRole("option")).toHaveLength(2);
            expect(
                within(listbox).getByRole("group", { name: "Set aside" }),
            ).toBeInTheDocument();
            expect(within(listbox).getAllByRole("option")).toHaveLength(4);

            // Keyboard order runs through the groups
            fireEvent.keyDown(listbox, { key: "End" });
            expect(activeOptionText(listbox)).toBe("Travel");

            fireEvent.click(within(spend).getByRole("option", { name: "Fun" }));
            expect(onChange).toHaveBeenCalledWith("fun");
        });
    });

    describe("search", () => {
        it(`appears only above ${SEARCH_THRESHOLD} enabled options`, async () => {
            const { unmount } = render(
                <Harness options={manyOptions(SEARCH_THRESHOLD)} />,
            );
            await openSelect("Fruit");
            expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
            unmount();

            render(<Harness options={manyOptions(SEARCH_THRESHOLD + 1)} />);
            await openSelect("Fruit");
            expect(screen.getByRole("searchbox")).toBeInTheDocument();
        });

        it("can be forced on or off with searchable", async () => {
            const { unmount } = render(
                <Harness options={manyOptions(20)} searchable={false} />,
            );
            await openSelect("Fruit");
            expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
            unmount();

            render(<Harness searchable />);
            await openSelect("Fruit");
            expect(screen.getByRole("searchbox")).toBeInTheDocument();
        });

        it("autofocuses on desktop, filters by label and description, and shows No matches", async () => {
            const onChange = vi.fn();
            render(
                <Harness
                    onChange={onChange}
                    searchable
                    options={[
                        { value: "a", label: "Groceries" },
                        {
                            value: "b",
                            label: "Dining",
                            description: "Restaurants and cafes",
                        },
                        { value: "c", label: "Transport" },
                    ]}
                />,
            );
            const listbox = await openSelect("Fruit");
            const search = screen.getByRole("searchbox");
            await waitFor(() => expect(search).toHaveFocus());

            fireEvent.change(search, { target: { value: "CAFE" } });
            expect(within(listbox).getAllByRole("option")).toHaveLength(1);
            expect(
                within(listbox).getByRole("option", { name: "Dining" }),
            ).toBeInTheDocument();

            // Enter in the search box picks the active match
            fireEvent.keyDown(search, { key: "Enter" });
            expect(onChange).toHaveBeenCalledWith("b");

            await openSelect("Fruit");
            const again = screen.getByRole("searchbox");
            expect(again).toHaveValue("");
            fireEvent.change(again, { target: { value: "zzz" } });
            expect(screen.getByRole("status")).toHaveTextContent("No matches");
        });

        it("drops group headings with no matches", async () => {
            render(
                <Harness
                    searchable
                    options={[
                        {
                            label: "Spend",
                            options: [{ value: "food", label: "Food" }],
                        },
                        {
                            label: "Set aside",
                            options: [{ value: "travel", label: "Travel" }],
                        },
                    ]}
                />,
            );
            const listbox = await openSelect("Fruit");
            fireEvent.change(screen.getByRole("searchbox"), {
                target: { value: "trav" },
            });
            expect(
                within(listbox).queryByRole("group", { name: "Spend" }),
            ).not.toBeInTheDocument();
            expect(
                within(listbox).getByRole("group", { name: "Set aside" }),
            ).toBeInTheDocument();
        });
    });

    describe("placeholder and clearable", () => {
        it("shows a Clear action only when there is a value", async () => {
            const onChange = vi.fn();
            const { unmount } = render(
                <Harness clearable placeholder="All" onChange={onChange} />,
            );
            await openSelect("Fruit");
            expect(
                screen.queryByRole("button", { name: "Clear" }),
            ).not.toBeInTheDocument();
            unmount();

            render(
                <Harness
                    clearable
                    placeholder="All"
                    initial="apple"
                    onChange={onChange}
                />,
            );
            await openSelect("Fruit");
            fireEvent.click(screen.getByRole("button", { name: "Clear" }));
            expect(onChange).toHaveBeenCalledWith("");
            await waitFor(() =>
                expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
            );
            expect(trigger()).toHaveTextContent("All");
        });

        it("treats null and unknown values as empty", () => {
            render(
                <Select
                    label="Fruit"
                    placeholder="None"
                    options={FRUITS}
                    value={null}
                    onValueChange={vi.fn()}
                />,
            );
            expect(trigger()).toHaveTextContent("None");
        });
    });

    describe("mobile vs desktop", () => {
        it("renders an anchored popover on desktop", async () => {
            mockViewport(false);
            render(<Harness />);
            await openSelect("Fruit");
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            expect(screen.queryByTestId("dropdown-scrim")).toBeNull();
        });

        it("renders a titled bottom sheet on mobile without focusing search", async () => {
            mockViewport(true);
            render(<Harness searchable />);
            const listbox = await openSelect("Fruit");
            const sheet = screen.getByRole("dialog", { name: "Fruit" });
            expect(sheet).toContainElement(listbox);
            expect(screen.getByTestId("dropdown-scrim")).toBeInTheDocument();
            await waitFor(() => expect(listbox).toHaveFocus());
            expect(screen.getByRole("searchbox")).not.toHaveFocus();
        });

        it("closes the sheet when the scrim is tapped", async () => {
            mockViewport(true);
            render(<Harness />);
            await openSelect("Fruit");
            const scrim = screen.getByTestId("dropdown-scrim");
            await act(async () => {
                fireEvent.pointerDown(scrim);
                fireEvent.mouseDown(scrim);
                fireEvent.click(scrim);
            });
            await waitFor(() =>
                expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
            );
        });
    });

    describe("inside AnimatedModal", () => {
        it.each([false, true])(
            "Escape closes only the select (mobile=%s)",
            async (mobile) => {
                mockViewport(mobile);
                const onClose = vi.fn();
                render(
                    <AnimatedModal isOpen onClose={onClose} ariaLabel="Form">
                        <ModalBody>
                            <Harness />
                        </ModalBody>
                    </AnimatedModal>,
                );
                const listbox = await openSelect("Fruit");
                await waitFor(() => expect(listbox).toHaveFocus());
                fireEvent.keyDown(document.activeElement ?? listbox, {
                    key: "Escape",
                });
                await waitFor(() =>
                    expect(
                        screen.queryByRole("listbox"),
                    ).not.toBeInTheDocument(),
                );
                expect(onClose).not.toHaveBeenCalled();

                // With the select closed, Escape reaches the modal again
                fireEvent.keyDown(trigger(), { key: "Escape" });
                await waitFor(() => expect(onClose).toHaveBeenCalled());
            },
        );

        it("selecting an option leaves the modal open", async () => {
            const onClose = vi.fn();
            render(
                <AnimatedModal isOpen onClose={onClose} ariaLabel="Form">
                    <ModalBody>
                        <Harness />
                    </ModalBody>
                </AnimatedModal>,
            );
            await selectOption("Fruit", "Cherry");
            await waitFor(() =>
                expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
            );
            expect(onClose).not.toHaveBeenCalled();
            expect(trigger()).toHaveTextContent("Cherry");
        });
    });
});

describe("dropdown option utils", () => {
    const items: SelectItem[] = [
        { value: "x", label: "Loose" },
        {
            label: "G",
            options: [
                { value: "a", label: "Alpha", description: "first" },
                { value: "b", label: "Beta", disabled: true },
            ],
        },
    ];

    it("flattens groups in display order", () => {
        expect(flattenOptions(items).map((o) => o.value)).toEqual([
            "x",
            "a",
            "b",
        ]);
    });

    it("counts only enabled options toward the search threshold", () => {
        const opts = [
            ...manyOptions(SEARCH_THRESHOLD),
            { value: "off", label: "Off", disabled: true },
        ];
        expect(shouldShowSearch(opts)).toBe(false);
        expect(shouldShowSearch(opts, true)).toBe(true);
    });

    it("filters case-insensitively on label and description", () => {
        expect(filterItems(items, "FIRST")).toEqual([
            {
                label: "G",
                options: [{ value: "a", label: "Alpha", description: "first" }],
            },
        ]);
        expect(filterItems(items, "  ")).toHaveLength(2);
    });
});
