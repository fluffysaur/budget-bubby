import { fireEvent, screen, waitFor, within } from "@testing-library/react";

type Name = string | RegExp;

/** The custom Select trigger (`role="combobox"`) for a label or aria-label. */
export function getSelectTrigger(name: Name, container?: HTMLElement) {
    const scope = container ? within(container) : screen;
    return scope.getByRole("combobox", { name });
}

/** Opens a custom Select if needed and returns its (portalled) listbox. */
export async function openSelect(
    trigger: Name | HTMLElement,
    container?: HTMLElement,
): Promise<HTMLElement> {
    const button =
        trigger instanceof HTMLElement
            ? trigger
            : getSelectTrigger(trigger, container);
    if (button.getAttribute("aria-expanded") !== "true") {
        fireEvent.click(button);
    }
    return waitFor(() => {
        const id = button.getAttribute("aria-controls");
        const listbox = id ? document.getElementById(id) : null;
        if (!listbox) throw new Error("Select listbox did not open");
        return listbox;
    });
}

/**
 * Clicks each of `optionLabels` in a MultiSelect named `trigger`. The list
 * stays open between toggles; call again to untick.
 *
 *     await toggleOptions("Category", ["Food", "Fun"]);
 */
export async function toggleOptions(
    trigger: Name | HTMLElement,
    optionLabels: Name[],
    container?: HTMLElement,
): Promise<void> {
    const listbox = await openSelect(trigger, container);
    for (const optionLabel of optionLabels) {
        fireEvent.click(
            within(listbox).getByRole("option", { name: optionLabel }),
        );
    }
}

/**
 * Picks `optionLabel` from the custom Select named `trigger` (its label or
 * aria-label). The RTL counterpart of the e2e `pickOption` helper.
 *
 *     await selectOption("Category", "Food");
 */
export async function selectOption(
    trigger: Name | HTMLElement,
    optionLabel: Name,
    container?: HTMLElement,
): Promise<void> {
    const listbox = await openSelect(trigger, container);
    fireEvent.click(within(listbox).getByRole("option", { name: optionLabel }));
}
