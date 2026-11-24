import { test, expect, type Page } from "@playwright/test";

async function openAddExpense(page: Page, isMobile: boolean) {
    await page.goto("/");
    if (isMobile) {
        await page
            .getByRole("navigation", { name: "Mobile Navigation" })
            .getByRole("button", { name: "Quick Add" })
            .click();
    } else {
        await page.getByRole("button", { name: "Quick Add" }).click();
    }
    const panel = page.getByRole("dialog").locator("> div").first();
    await expect(panel).toBeVisible();
    // Let the enter animation settle before measuring
    await page.waitForTimeout(400);
    return panel;
}

test.describe("Modal behaviour", () => {
    test("is a bottom sheet on phones and a centred dialog on desktop", async ({
        page,
        isMobile,
    }) => {
        const panel = await openAddExpense(page, isMobile);
        const box = (await panel.boundingBox())!;
        const viewport = page.viewportSize()!;

        if (isMobile) {
            // Anchored to the bottom edge
            expect(
                Math.abs(box.y + box.height - viewport.height),
            ).toBeLessThanOrEqual(2);
        } else {
            // Centred both ways
            expect(
                Math.abs(box.x + box.width / 2 - viewport.width / 2),
            ).toBeLessThanOrEqual(2);
            expect(
                Math.abs(box.y + box.height / 2 - viewport.height / 2),
            ).toBeLessThanOrEqual(2);
        }
    });

    test("skips the slide/scale animation when reduced motion is on", async ({
        page,
        isMobile,
    }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const panel = await openAddExpense(page, isMobile);
        const duration = await panel.evaluate(
            (el) => getComputedStyle(el).animationDuration,
        );
        expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
    });

    test("traps Tab focus inside modal and drawer and restores focus to trigger on Escape", async ({
        page,
        isMobile,
    }) => {
        test.skip(isMobile, "Desktop keyboard Tab traversal");
        await page.goto("/");
        await expect(
            page.getByRole("heading", { level: 1, name: /^Home$/i }),
        ).toBeVisible({ timeout: 15000 });

        const chatTrigger = page.getByTestId("open-bubby-chat-btn");
        await chatTrigger.focus();
        await chatTrigger.click();

        const drawer = page.getByTestId("bubby-chat-drawer");
        await expect(drawer).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(250);

        // Tab several times and ensure focus never leaves the drawer
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press("Tab");
            const insideDrawer = await drawer.evaluate((el) =>
                el.contains(document.activeElement),
            );
            expect(insideDrawer).toBe(true);
        }

        // Shift+Tab from first element wraps inside drawer
        await page.keyboard.press("Shift+Tab");
        const insideAfterShiftTab = await drawer.evaluate((el) =>
            el.contains(document.activeElement),
        );
        expect(insideAfterShiftTab).toBe(true);

        // Escape closes drawer and restores focus to the trigger button
        await page.keyboard.press("Escape");
        await expect(drawer).not.toBeVisible();
        await expect(chatTrigger).toBeFocused();
    });
});
