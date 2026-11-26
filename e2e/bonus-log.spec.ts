import { test, expect, type Page } from "@playwright/test";
import { pickOption } from "./helpers/select";

// Mock data mode (see playwright.config.ts).
// A S$10,000 bonus at 20% CPF leaves S$8,000 net; Goals 40% = S$3,200.

async function logSamBonus(page: Page) {
    await page.goto("/plan?tab=bonus");
    await expect(page.getByText("No Bonuses")).toBeVisible();

    await page.getByRole("button", { name: "Log Bonus" }).first().click();
    const modal = page.getByRole("dialog");
    await expect(
        modal.getByRole("heading", { level: 2, name: "Log Bonus" }),
    ).toBeVisible();

    await pickOption(modal, "Recipient", "Sam");
    await modal.getByRole("button", { name: "Performance" }).click();
    await modal.getByLabel("Gross").fill("10000");
    await expect(modal.getByLabel("CPF")).toHaveValue("2000");
    await modal.getByRole("button", { name: "Next" }).click();

    await expect(modal.getByTestId("bonus-split-goals")).toContainText(
        "3,200.00",
    );

    const submit = modal.getByRole("button", { name: "Log Bonus" });
    await submit.scrollIntoViewIfNeeded();
    await submit.click();
    await expect(page.getByTestId("bonus-celebration")).toBeVisible();
    await expect(modal).not.toBeVisible();
}

test.describe("Bonus Log", () => {
    test("logs, shows outside caps, edits and deletes", async ({ page }) => {
        await logSamBonus(page);

        // Row under the current year, YTD net includes the bonus
        await expect(page.getByTestId("bonus-row")).toHaveCount(1);
        await expect(page.getByTestId("bonus-row")).toContainText("Sam");
        await expect(page.getByTestId("bonus-ytd-table")).toContainText(
            "S$8,000",
        );

        // Budget: Income Flow shows the bonus outside caps
        await page.goto("/spend?tab=budget");
        await page.getByRole("button", { name: "Income Flow" }).click();
        const strip = page.getByTestId("waterfall-bonus-strip");
        await expect(strip).toBeVisible();
        await expect(strip).toContainText("Outside caps");
        await expect(strip).toContainText("S$8,000.00");

        // Edit: change gross, save
        await page.goto("/plan?tab=bonus");
        await page.getByRole("button", { name: "Edit bonus" }).click();
        const modal = page.getByRole("dialog");
        await expect(
            modal.getByRole("heading", { level: 2, name: "Edit Bonus" }),
        ).toBeVisible();
        await modal.getByLabel("Gross").fill("5000");
        await modal.getByRole("button", { name: "Next" }).click();
        await modal.getByRole("button", { name: "Save" }).click();
        await expect(modal).not.toBeVisible();

        // Delete: confirm,
        await page.getByRole("button", { name: "Delete bonus" }).click();
        const confirm = page.getByRole("dialog");
        await expect(confirm).toContainText("Delete Bonus?");
        await expect(confirm).not.toContainText("from goals.");
        await confirm.getByRole("button", { name: "Delete" }).click();
        await expect(page.getByText("No Bonuses")).toBeVisible();
    });

    test("has no horizontal scroll on mobile and the modal footer is reachable", async ({
        page,
        isMobile,
    }) => {
        if (!isMobile) {
            await page.setViewportSize({ width: 390, height: 844 });
        }
        await logSamBonus(page);

        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);

        await page.getByRole("button", { name: "Edit bonus" }).click();
        const modal = page.getByRole("dialog");
        await modal.getByRole("button", { name: "Next" }).click();
        const save = modal.getByRole("button", { name: "Save" });
        await save.scrollIntoViewIfNeeded();
        await expect(save).toBeInViewport();
    });
});
