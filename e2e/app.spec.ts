import { test, expect } from "@playwright/test";

test.describe("Budget Bubby App Smoke Test", () => {
    test("should load homepage and display title, header, and dashboard", async ({
        page,
    }) => {
        await page.goto("/");

        // Page Title
        await expect(page).toHaveTitle(/Budget Bubby/i);

        // Header perspective switcher (dropdown at every viewport)
        const perspectiveSwitcher = page.getByRole("button", {
            name: "Select Financial Perspective",
        });
        await expect(perspectiveSwitcher).toBeVisible();
        await expect(perspectiveSwitcher).toContainText(/Combined/i);

        await perspectiveSwitcher.click();
        await expect(
            page.getByRole("option", { name: /Combined/i }),
        ).toBeVisible();
        await expect(
            page.getByRole("option", { name: /Yi Jia/i }),
        ).toBeVisible();
        await expect(
            page.getByRole("option", { name: /Rachel/i }),
        ).toBeVisible();
        await perspectiveSwitcher.click();

        // Home heading
        await expect(
            page.getByRole("heading", { level: 1, name: /^Home$/i }),
        ).toBeVisible();
    });
});
