import { test, expect, type Page } from "@playwright/test";

async function openSettings(page: Page) {
    const desktopBtn = page.getByRole("button", { name: "Settings" });
    if (await desktopBtn.isVisible()) {
        await desktopBtn.click();
        return;
    }
    await page
        .getByRole("button", { name: "Select Financial Perspective" })
        .click();
    await page.getByTestId("mobile-settings-btn").click();
}

test.describe("What's new", () => {
    test("pops up once after an update and stays dismissed", async ({
        page,
    }) => {
        await page.addInitScript(() => {
            if (!sessionStorage.getItem("whats-new-seeded")) {
                localStorage.setItem("bb_whats_new_v1", "0.5.1");
                sessionStorage.setItem("whats-new-seeded", "1");
            }
        });
        await page.goto("/");

        const modal = page.getByTestId("whats-new-modal");
        await expect(modal).toBeVisible({ timeout: 10000 });
        await expect(modal.getByTestId("whats-new-version-0.6.0")).toBeVisible();

        await modal.getByRole("button", { name: "Got it" }).click();
        await expect(modal).toBeHidden();

        await page.reload();
        await page.waitForTimeout(2500);
        await expect(page.getByTestId("whats-new-modal")).toBeHidden();
    });

    test("opens the release history from Settings", async ({ page }) => {
        await page.goto("/");
        await openSettings(page);

        await page.getByTestId("settings-whats-new-btn").click();
        const modal = page.getByTestId("whats-new-modal");
        await expect(modal).toBeVisible();
        await expect(modal.getByTestId("whats-new-version-0.6.0")).toBeVisible();

        await modal.getByRole("button", { name: "Got it" }).click();
        await expect(modal).toBeHidden();
    });
});
