import { test, expect } from "@playwright/test";

test.describe("Update balance modal", () => {
    test("never jumps above the viewport while opening and never flashes the bulk list while closing", async ({
        page,
    }) => {
        await page.goto("/accounts");
        await page
            .getByRole("button", { name: /update balance for/i })
            .first()
            .click();

        const sheet = page.locator(".modal-sheet-enter, .modal-sheet-exit");
        const tops: number[] = [];
        for (let i = 0; i < 14; i++) {
            const top = await sheet
                .first()
                .evaluate((el) => el.getBoundingClientRect().top)
                .catch(() => null);
            if (top !== null) tops.push(top);
            await page.waitForTimeout(25);
        }
        expect(tops.length).toBeGreaterThan(0);
        // The sheet only ever travels down/into place, never above the screen.
        expect(Math.min(...tops)).toBeGreaterThanOrEqual(0);

        await page.keyboard.press("Escape");
        const closingTitles: string[] = [];
        for (let i = 0; i < 10; i++) {
            const text = await page
                .locator('[role="dialog"]')
                .first()
                .textContent({ timeout: 100 })
                .catch(() => "");
            closingTitles.push(text ?? "");
            await page.waitForTimeout(30);
        }
        expect(closingTitles.some((t) => t.includes("Update Balances"))).toBe(
            false,
        );
    });

    test("table has no inline edit; tapping the balance opens the modal", async ({
        page,
    }) => {
        await page.goto("/accounts");
        await page
            .getByRole("button", { name: /update balance for/i })
            .first()
            .click();
        await expect(page.getByText("Update Account Balance")).toBeVisible();
        await expect(page.getByLabel("Save inline balance")).toHaveCount(0);
    });
});
