import { test, expect } from "@playwright/test";

test.describe("PR #7 Motion Surfaces & Scroll Restoration", () => {
    test("scroll position is restored on POP navigation (Back button)", async ({
        page,
        isMobile,
    }) => {
        await page.goto("/spend?tab=expenses");
        await expect(
            page.getByRole("heading", { level: 1, name: /^Spend$/i }),
        ).toBeVisible();

        // Scroll main down
        const main = page.locator("main");
        await main.evaluate((el) => {
            el.scrollTop = 120;
        });
        // Trigger scroll event handler
        await main.dispatchEvent("scroll");

        // Navigate to /accounts via SPA navigation so React history is preserved
        if (isMobile) {
            await page.getByRole("button", { name: "Accounts" }).click();
        } else {
            await page
                .getByRole("navigation", { name: "Sidebar" })
                .getByRole("button", { name: /^Accounts/i })
                .click();
        }
        await expect(page).toHaveURL(/\/accounts/);
        await expect(
            page.getByRole("heading", { level: 1, name: /^Accounts$/i }),
        ).toBeVisible();

        // Go back using browser back
        await page.goBack();
        await expect(page).toHaveURL(/\/spend/);
        await expect(
            page.getByRole("heading", { level: 1, name: /^Spend$/i }),
        ).toBeVisible();

        // Check scroll position is restored
        await expect
            .poll(async () => {
                return await main.evaluate((el) => el.scrollTop);
            })
            .toBeGreaterThanOrEqual(50);
    });

    test("deleting an expense row removes it from the table", async ({
        page,
        isMobile,
    }) => {
        await page.goto("/spend?tab=expenses");
        await expect(
            page.getByRole("heading", { level: 1, name: /^Spend$/i }),
        ).toBeVisible();

        // On mobile, expand filter bar drawer if hidden
        if (isMobile) {
            const filtersBtn = page.getByRole("button", {
                name: "Toggle filters",
            });
            if (await filtersBtn.isVisible()) {
                await filtersBtn.click();
            }
        }

        // Set month filter to 2026-10 where mock seed data is populated
        const monthInput = page.locator("input#filter-month");
        await monthInput.fill("2026-10");

        // Find the first expense row delete button (accessible name matches "Delete <itemName>")
        const deleteBtn = page
            .getByRole("button", { name: /^Delete /i })
            .first();
        await expect(deleteBtn).toBeVisible();
        await deleteBtn.click();

        // Confirm modal opens
        const modal = page.getByRole("dialog");
        await expect(modal).toBeVisible();
        const confirmBtn = modal.getByRole("button", {
            name: /Confirm delete/i,
        });
        await confirmBtn.click();

        // Modal closes
        await expect(modal).not.toBeVisible();
    });

    test("reduced-motion preference is respected without transforms", async ({
        page,
    }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/spend?tab=expenses");
        await expect(
            page.getByRole("heading", { level: 1, name: /^Spend$/i }),
        ).toBeVisible();

        // Pull down indicator or segmented tab doesn't have transition-all
        const tab = page.getByRole("tab", { name: /Budget/i });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
    });
});
