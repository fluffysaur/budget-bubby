import { test, expect } from "@playwright/test";

test.describe("Collapsible desktop sidebar", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("collapses to a rail, persists across reload, and expands again", async ({
        page,
    }) => {
        await page.goto("/");
        const toggle = page.getByTestId("sidebar-toggle");
        const sidebar = page.locator("#desktop-sidebar");

        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(sidebar.getByText("Budget Bubby")).toBeVisible();
        const expandedWidth = (await sidebar.boundingBox())?.width ?? 0;
        expect(expandedWidth).toBeGreaterThan(200);

        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(sidebar.getByText("Budget Bubby")).toHaveCount(0);
        await expect
            .poll(async () => (await sidebar.boundingBox())?.width ?? 999)
            .toBeLessThan(80);

        // Nav still works from the rail
        await sidebar.getByRole("button", { name: "Accounts" }).click();
        await expect(page).toHaveURL(/accounts/);

        await page.reload();
        await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute(
            "aria-expanded",
            "false",
        );

        await page.getByTestId("sidebar-toggle").click();
        await expect(sidebar.getByText("Budget Bubby")).toBeVisible();
    });
});

test.describe("Sidebar toggle on mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("is not shown below md", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByTestId("sidebar-toggle")).toBeHidden();
    });
});
