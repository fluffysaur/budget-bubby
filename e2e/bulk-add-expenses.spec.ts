import { test, expect, type Page } from "@playwright/test";

async function openBulkAdd(page: Page) {
    await page.goto("/expenses");
    await page
        .getByRole("button", { name: /Bulk Add/i })
        .first()
        .click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(
        modal.getByRole("heading", { level: 2, name: "Bulk Add" }),
    ).toBeVisible();
    return modal;
}

test.describe("Bulk Add Expenses", () => {
    test("adds two rows with the keyboard, using the Yesterday chip", async ({
        page,
    }) => {
        const modal = await openBulkAdd(page);

        // First amount is focused on open; Enter moves amount -> description -> next row
        await expect(modal.getByLabel("Amount for row 1")).toBeFocused();
        await page.keyboard.type("7.77");
        await page.keyboard.press("Enter");
        await expect(modal.getByLabel("Description for row 1")).toBeFocused();
        await page.keyboard.type("E2E bulk lunch");
        await page.keyboard.press("Enter");

        // Valid last row + Enter adds a row and focuses its amount
        await expect(modal.getByLabel("Amount for row 2")).toBeFocused();

        await modal.getByRole("radio", { name: "Yesterday" }).click();
        await modal.getByRole("button", { name: "+ Row" }).click();
        await expect(modal.getByLabel("Amount for row 3")).toBeFocused();
        await page.keyboard.type("3.33");
        await page.keyboard.press("Enter");
        await page.keyboard.type("E2E bulk grab");

        // Row 2 is an empty spare row and is ignored
        await modal.getByRole("button", { name: /^Save 2/ }).click();

        await expect(modal).not.toBeVisible();
        await expect(page.getByText("E2E bulk lunch").first()).toBeVisible();
        await expect(page.getByText("E2E bulk grab").first()).toBeVisible();
    });

    test("shows inline errors only after Save", async ({ page }) => {
        const modal = await openBulkAdd(page);
        await modal.getByLabel("Amount for row 1").fill("5");
        await expect(modal.getByText("Add description")).toHaveCount(0);

        await modal.getByRole("button", { name: /^Save/ }).click();
        await expect(modal.getByText("Add description")).toBeVisible();
        await expect(modal).toBeVisible();
    });

    test("mobile layout keeps Save visible and inputs zoom-safe", async ({
        page,
        isMobile,
    }) => {
        test.skip(!isMobile, "Mobile-only layout checks");
        const modal = await openBulkAdd(page);

        for (let i = 0; i < 5; i++) {
            await modal.getByRole("button", { name: "+ Row" }).click();
        }
        await expect(modal.getByLabel("Amount for row 6")).toBeVisible();

        // Sticky Save bar stays inside the viewport
        const save = modal.getByRole("button", { name: /^Save/ });
        const box = await save.boundingBox();
        const viewport = page.viewportSize();
        expect(box).not.toBeNull();
        expect(viewport).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

        // Decimal keypad and 16px font prevent iOS zoom on focus
        const amount = modal.getByLabel("Amount for row 1");
        await expect(amount).toHaveAttribute("inputmode", "decimal");
        const fontSize = await amount.evaluate(
            (el) => getComputedStyle(el).fontSize,
        );
        expect(fontSize).toBe("16px");

        // No horizontal scroll
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth,
        );
        expect(overflow).toBe(false);
    });
});
