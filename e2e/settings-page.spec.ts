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

    test("desktop: group list stays put while the detail pane scrolls", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1280, height: 600 });
        // No 4px page entrance rise, so rows can be measured right away.
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/settings/notifications");
        await expect(page.getByTestId("toggle-push-enabled")).toBeVisible();
        const groupRow = page.getByTestId("settings-row-general");
        const before = await groupRow.boundingBox();
        const scrolled = await page.locator("main").evaluate((main) => {
            main.scrollTop = 400;
            return main.scrollTop;
        });

        expect(scrolled).toBeGreaterThan(0);
        await expect(
            page.getByTestId("toggle-push-enabled"),
        ).not.toBeInViewport();
        expect((await groupRow.boundingBox())?.y).toBeCloseTo(before!.y, 0);
    });
});
