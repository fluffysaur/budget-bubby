import { test, expect } from "@playwright/test";

// Demo data seeds 2+ overdue cards, so "Settle Overdue" shows on Home.
test.describe("Card Payments header", () => {
    for (const width of [360, 390]) {
        test(`title and buttons do not overlap at ${width}px`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 800 });
            await page.goto("/");

            const region = page.getByRole("region", { name: "Card Payments" });
            await expect(region).toBeVisible({ timeout: 20_000 });
            const title = region.getByRole("heading", {
                name: "Card Payments",
            });
            const settle = region.getByRole("button", {
                name: /Settle Overdue/,
            });
            const viewAll = region.getByRole("button", { name: "View All" });
            await expect(settle).toBeVisible();
            await expect(viewAll).toBeVisible();

            const boxes = [title, settle, viewAll].map(async (l) => {
                const b = await l.boundingBox();
                expect(b).not.toBeNull();
                return b!;
            });
            const [t, s, v] = await Promise.all(boxes);
            const overlaps = (a: typeof t, b: typeof t) =>
                a.x < b.x + b.width &&
                b.x < a.x + a.width &&
                a.y < b.y + b.height &&
                b.y < a.y + a.height;
            expect(overlaps(t, s)).toBe(false);
            expect(overlaps(t, v)).toBe(false);
            expect(overlaps(s, v)).toBe(false);
            expect(s.height).toBeGreaterThanOrEqual(43.5);
            expect(v.height).toBeGreaterThanOrEqual(43.5);
            for (const b of [t, s, v]) {
                expect(b.x).toBeGreaterThanOrEqual(0);
                expect(b.x + b.width).toBeLessThanOrEqual(width);
            }
            const noHScroll = await page.evaluate(
                () =>
                    document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth,
            );
            expect(noHScroll).toBe(true);
        });
    }
});
