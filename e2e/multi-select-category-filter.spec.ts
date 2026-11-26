import { test, expect } from "@playwright/test";
import { toggleOptions } from "./helpers/select";

// Mock data mode (see playwright.config.ts). The expense filter bar's
// Category field is a MultiSelect.

test.describe("Multi-select category filter", () => {
    test("filters the ledger by two categories and clears them", async ({
        page,
        isMobile,
    }) => {
        await page.goto("/expenses");

        // Phones keep the filter controls in a collapsible drawer.
        if (isMobile) {
            await page.getByRole("button", { name: "Toggle filters" }).click();
        }

        // The mock seed expenses live in 2026-09.
        await page.locator("#filter-month").fill("2026-09");

        const trigger = page.getByRole("combobox", {
            name: "Category",
            exact: true,
        });
        await expect(trigger).toContainText("All Categories");

        await toggleOptions(page, "Category", ["Food", "Transport"]);
        await expect(trigger).toContainText("Food");
        await expect(trigger).toContainText("+1");

        // One removable chip per picked category.
        await expect(
            page.getByRole("button", { name: /remove filter Food/i }),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: /remove filter Transport/i }),
        ).toBeVisible();

        // Every visible ledger row now belongs to one of the two categories.
        const rows = page.locator("tbody tr");
        await expect(rows.first()).toBeVisible();
        const total = await rows.count();
        for (let i = 0; i < total; i++) {
            await expect(rows.nth(i)).toContainText(/Food|Transport/);
        }

        // Removing one chip keeps the other.
        await page
            .getByRole("button", { name: /remove filter Transport/i })
            .click();
        await expect(trigger).toContainText("Food");
        await expect(trigger).not.toContainText("+1");

        // Clear all inside the dropdown restores "All Categories".
        await trigger.click();
        await page.getByRole("button", { name: "Clear all" }).click();
        if (isMobile) {
            // The sheet stays open until Done.
            await page.getByRole("button", { name: "Done" }).click();
        } else {
            await page.keyboard.press("Escape");
        }
        await expect(trigger).toContainText("All Categories");
    });
});
