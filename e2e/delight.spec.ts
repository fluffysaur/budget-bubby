import { test, expect, type Page } from "@playwright/test";

async function addExpense(page: Page, isMobile: boolean) {
    if (isMobile) {
        await page
            .getByRole("navigation", { name: "Mobile Navigation" })
            .getByRole("button", { name: "Quick Add" })
            .click();
    } else {
        await page.keyboard.press("c");
    }
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await modal.locator('input[placeholder="0.00"]').fill("4.20");
    await modal.locator("#expense-item").fill("Kopi");
    const food = modal.getByRole("button", { name: /Food & Dining/i }).first();
    if (await food.isVisible()) await food.click();
    await modal.getByRole("button", { name: /^Add$/i }).click();
    await expect(modal).not.toBeVisible();
}

test.describe("Bubby", () => {
    test("feeding: add an expense, see the toast and a fed Bubby", async ({
        page,
        isMobile,
    }) => {
        await page.goto("/");
        const avatar = page.getByTestId("bubby-avatar");
        await expect(avatar).toBeVisible();
        await expect(
            page.getByRole("region", { name: "Quests" }),
        ).toBeVisible();

        await addExpense(page, isMobile);

        await expect(page.getByText("Cha-ching!")).toBeVisible();
        await expect(avatar).toHaveAttribute("data-mood", "normal");
        // The logger's dot lights up
        await expect(
            avatar.locator('[data-fed="true"]').first(),
        ).toBeAttached();
    });

    test("tapping Bubby pets it and opens the sheet, with no numbers", async ({
        page,
    }) => {
        await page.goto("/");
        await page.getByTestId("bubby-avatar").click();

        const sheet = page.getByRole("dialog");
        await expect(
            sheet.getByRole("heading", { name: "Bubby" }),
        ).toBeVisible();
        // A penguin each, side by side, each with its own meters
        await expect(sheet.getByTestId("bubby-penguin")).toHaveCount(2);
        await expect(
            sheet.getByRole("img", { name: "Nourishment, your Bubby" }),
        ).toBeVisible();
        await expect(
            sheet.getByRole("img", { name: "Fitness, your Bubby" }),
        ).toBeVisible();
        await expect(page.getByTestId("bubby-pair")).toBeVisible();
        const pet = sheet
            .getByRole("list", { name: "Today's quests" })
            .locator("li", { hasText: "Pet Bubby" });
        await expect(pet).toHaveAttribute("data-done", "true");
    });
});

test.describe("Bubby with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("runs no animations on Bubby", async ({ page }) => {
        await page.goto("/");
        const avatar = page.getByTestId("bubby-avatar");
        await expect(avatar).toBeVisible();
        await avatar.click();
        await page.keyboard.press("Escape");

        const running = await page.evaluate(
            () =>
                Array.from(
                    document.querySelectorAll("svg.bubby, svg.bubby *"),
                ).flatMap((el) =>
                    el.getAnimations().filter((a) => a.playState === "running"),
                ).length,
        );
        expect(running).toBe(0);
    });
});
