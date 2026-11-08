import { test, expect, type Locator } from "@playwright/test";

/**
 * On mobile, the month picker takes a full row and the header action button
 * sits below it at full width with its label visible.
 */
async function expectStackedBelow(
    top: Locator,
    bottom: Locator,
    container: Locator,
) {
    const topBox = await top.boundingBox();
    const bottomBox = await bottom.boundingBox();
    const containerBox = await container.boundingBox();
    expect(topBox).not.toBeNull();
    expect(bottomBox).not.toBeNull();
    expect(containerBox).not.toBeNull();

    // Button starts below the picker
    expect(bottomBox!.y).toBeGreaterThanOrEqual(topBox!.y + topBox!.height - 1);
    // Both span the full row width
    expect(topBox!.width).toBeGreaterThanOrEqual(containerBox!.width - 2);
    expect(bottomBox!.width).toBeGreaterThanOrEqual(containerBox!.width - 2);
}

test.describe("Mobile header layout", () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
    });

    test("budget: month picker full width with Edit Budget below", async ({
        page,
    }) => {
        await page.goto("/budget");

        const actions = page.getByTestId("budget-header-actions");
        await expect(actions).toBeVisible();

        const editButton = actions.getByRole("button", { name: "Edit Budget" });
        await expect(editButton).toBeVisible();
        await expect(editButton).toHaveText(/Edit Budget/);

        const picker = actions
            .getByRole("button", { name: /Choose month/ })
            .locator("..");
        await expectStackedBelow(picker, editButton, actions);
    });

    test("credit cards: month stepper full width with Add Card below", async ({
        page,
    }) => {
        await page.goto("/accounts");
        await page.getByRole("tab", { name: /Credit Cards/ }).click();

        const actions = page.getByTestId("credit-card-header-actions");
        await expect(actions).toBeVisible();

        const addButton = actions.getByRole("button", {
            name: "Add Credit Card",
        });
        await expect(addButton).toBeVisible();
        await expect(addButton).toHaveText(/Add Card/);

        const stepper = actions
            .getByRole("button", { name: "Previous Month" })
            .locator("..");
        await expectStackedBelow(stepper, addButton, actions);
    });
});
