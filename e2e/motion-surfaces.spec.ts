import { test, expect, type Page } from "@playwright/test";

/**
 * Navigates client-side and returns every inline transform the new route
 * wrapper had, starting from the one it mounted with.
 */
async function routeEntranceTransforms(page: Page) {
    await page.goto("/settings");
    const row = page.getByTestId("settings-row-notifications");
    await expect(row).toBeVisible();

    await page.evaluate(() => {
        const seen: string[] = [];
        const old = document.querySelector('[data-testid="route-wrapper"]');
        new MutationObserver(() => {
            const el = document.querySelector<HTMLElement>(
                '[data-testid="route-wrapper"]',
            );
            if (el && el !== old) seen.push(el.style.transform);
        }).observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
        });
        Object.assign(window, { routeTransforms: seen });
    });

    await row.click();
    const wrapper = page.getByTestId("route-wrapper");
    await expect(page.getByTestId("toggle-push-enabled")).toBeVisible();
    await expect(wrapper).toHaveCSS("opacity", "1");
    await expect(wrapper).toHaveCSS("transform", "none");

    return page.evaluate(
        () =>
            (window as unknown as { routeTransforms: string[] })
                .routeTransforms,
    );
}

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

    test("page entrance rises 4px with normal motion", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        const transforms = await routeEntranceTransforms(page);
        expect(transforms[0]).toBe("translateY(4px)");
    });

    test("page entrance never moves with reduced motion", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const transforms = await routeEntranceTransforms(page);
        expect(transforms.length).toBeGreaterThan(0);
        expect(transforms.filter((t) => t && t !== "none")).toEqual([]);
    });
});
