import { expect, type Locator, type Page } from "@playwright/test";

type Name = string | RegExp;

function pageOf(scope: Page | Locator): Page {
    return "goto" in scope ? scope : scope.page();
}

/**
 * Picks `optionLabel` from the custom Select whose label or aria-label is
 * `triggerName`. Works for the desktop popover and the mobile sheet. Pass a
 * dialog locator as `scope` to target a Select inside a modal.
 *
 *     await pickOption(modal, "Category", "Food");
 */
export async function pickOption(
    scope: Page | Locator,
    triggerName: Name,
    optionLabel: Name,
): Promise<void> {
    const trigger = scope.getByRole("combobox", {
        name: triggerName,
        exact: typeof triggerName === "string",
    });
    // The mobile sheet is modal and aria-hides the page (and any dialog the
    // trigger sits in), so keep hold of the trigger by id once it is open.
    const page = pageOf(scope);
    const triggerById = page.locator(
        `[id="${await trigger.getAttribute("id")}"]`,
    );
    await trigger.click();
    await expect(triggerById).toHaveAttribute("aria-expanded", "true");
    const listboxId = await triggerById.getAttribute("aria-controls");
    // The list is portalled to <body>, outside any dialog scope.
    const listbox = page.locator(`[id="${listboxId}"]`);
    await listbox
        .getByRole("option", {
            name: optionLabel,
            exact: typeof optionLabel === "string",
        })
        .click();
    await expect(listbox).toBeHidden();
}

/**
 * Ticks each of `optionLabels` in the MultiSelect named `triggerName`, then
 * closes it (Escape). The list stays open between toggles. Works for the
 * desktop popover and the mobile sheet.
 *
 *     await toggleOptions(page, "Category", ["Food", "Transport"]);
 */
export async function toggleOptions(
    scope: Page | Locator,
    triggerName: Name,
    optionLabels: Name[],
): Promise<void> {
    const trigger = scope.getByRole("combobox", {
        name: triggerName,
        exact: typeof triggerName === "string",
    });
    const page = pageOf(scope);
    const triggerById = page.locator(
        `[id="${await trigger.getAttribute("id")}"]`,
    );
    await trigger.click();
    await expect(triggerById).toHaveAttribute("aria-expanded", "true");
    const listboxId = await triggerById.getAttribute("aria-controls");
    const listbox = page.locator(`[id="${listboxId}"]`);
    for (const optionLabel of optionLabels) {
        await listbox
            .getByRole("option", {
                name: optionLabel,
                exact: typeof optionLabel === "string",
            })
            .click();
    }
    await page.keyboard.press("Escape");
    await expect(listbox).toBeHidden();
}
