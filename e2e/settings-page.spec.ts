import { test, expect } from "@playwright/test";

test.describe("Settings page", () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                "bb_onboarding_v1",
                '{"seen":true,"hatched":true}',
            );
        });
    });

    test("mobile: own header, no app chrome, drill into a group and back", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/settings");

        await expect(page.getByTestId("settings-row-general")).toBeVisible();
        await expect(page.locator("header").first()).toBeHidden();
        await expect(
            page.getByRole("navigation", { name: "Mobile Navigation" }),
        ).toBeHidden();
        await expect(page.getByTestId("app-version-label")).toBeVisible();

        await page.getByTestId("settings-row-notifications").click();
        await expect(page).toHaveURL(/\/settings\/notifications$/);
        await expect(page.getByTestId("toggle-push-enabled")).toBeVisible();

        await page.getByTestId("settings-back-btn").click();
        await expect(page).toHaveURL(/\/settings$/);
        await expect(page.getByTestId("settings-row-ai")).toBeVisible();
    });

    test("desktop: two panes with General selected", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/settings");

        await expect(page.getByTestId("toggle-sound-enabled")).toBeVisible();
        await expect(page.getByTestId("settings-row-general")).toHaveAttribute(
            "aria-current",
            "page",
        );
        await expect(page.getByTestId("settings-back-btn")).toHaveCount(0);

        await page.getByTestId("settings-row-notifications").click();
        await expect(page.getByTestId("toggle-push-enabled")).toBeVisible();
        await expect(page.locator("header").first()).toBeVisible();
    });
});
