import { test, expect } from "@playwright/test";

test.describe("Cold start cache & Demo Mode isolation", () => {
    test("reloading Dashboard and Expenses keeps hatched Bubby, real amounts, and writes no persisted cache in Demo Mode", async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                "bb_onboarding_v1",
                JSON.stringify({ seen: true, hatched: true }),
            );
        });

        await page.goto("/");
        const avatar = page.getByTestId("bubby-avatar");
        await expect(avatar).toBeVisible();
        await expect(avatar).toHaveAttribute("data-hatched", "true");
        await expect(page.getByTestId("bubby-egg")).toHaveCount(0);

        const heroAmount = page.getByTestId("left-to-spend-amount");
        await expect(heroAmount).toBeVisible();
        const initialText = await heroAmount.textContent();
        expect(initialText).not.toBe("S$0");

        // Reload Dashboard and verify no egg flash and no S$0 flash
        await page.reload();
        await expect(page.getByTestId("bubby-avatar")).toHaveAttribute(
            "data-hatched",
            "true",
        );
        await expect(page.getByTestId("bubby-egg")).toHaveCount(0);
        await expect(page.getByTestId("left-to-spend-amount")).toHaveText(
            initialText ?? "",
        );

        // Navigate to Expenses and reload
        await page.goto("/expenses");
        await expect(page.getByText("Spendable")).toBeVisible();
        await page.reload();
        await expect(page.getByText("Spendable")).toBeVisible();
        await expect(page.getByTestId("bubby-avatar")).toHaveAttribute(
            "data-hatched",
            "true",
        );

        // Demo/Mock mode must never write persisted TanStack Query cache to localStorage
        const persistedCache = await page.evaluate(() =>
            localStorage.getItem("budget_bubby_rq_cache_v1"),
        );
        expect(persistedCache).toBeNull();
    });
});
