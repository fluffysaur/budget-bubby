import { test, expect, type Page } from "@playwright/test";
import { pickOption } from "./helpers/select";

// Mock data mode (see playwright.config.ts). The Add Recurring category
// field is the first call site on the custom Select.

async function openAddRecurring(page: Page) {
    await page.goto("/plan?tab=recurring");
    await page.getByRole("button", { name: "Add Recurring" }).first().click();
    const modal = page
        .getByRole("dialog")
        .filter({ hasText: "Insurance, tax, subscriptions & bills" });
    await expect(modal).toBeVisible();
    await pickOption(modal, "Type", /Bill/);
    return modal;
}

test.describe("Custom Select", () => {
    test("picks a category and Escape closes only the dropdown", async ({
        page,
        isMobile,
    }) => {
        const modal = await openAddRecurring(page);
        const trigger = modal.getByRole("combobox", { name: "Category" });
        await expect(trigger).toHaveAttribute("aria-expanded", "false");

        await trigger.click();
        const listbox = page.getByRole("listbox", { name: "Category" });
        await expect(listbox).toBeVisible();
        // Sheet on phones, anchored popover on desktop
        await expect(
            page.getByRole("dialog", { name: "Category" }),
        ).toHaveCount(isMobile ? 1 : 0);

        const names = (await listbox.getByRole("option").allTextContents())
            .map((n) => n.trim())
            .filter(Boolean);
        expect(names.length).toBeGreaterThan(1);

        await page.keyboard.press("Escape");
        await expect(listbox).toBeHidden();
        await expect(modal).toBeVisible();
        await expect(trigger).toBeFocused();

        const current = ((await trigger.textContent()) ?? "").trim();
        const target = names.find((n) => n !== current) ?? names[0];
        await pickOption(modal, "Category", target);
        await expect(trigger).toContainText(target);
        await expect(modal).toBeVisible();
    });
});
