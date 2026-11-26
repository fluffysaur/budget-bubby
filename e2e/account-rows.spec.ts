import { test, expect, type Page } from "@playwright/test";

const cashNames = (page: Page) =>
    page
        .locator("section")
        .filter({
            has: page.getByRole("heading", { level: 2, name: "Cash" }),
        })
        .getByTestId("account-row")
        .evaluateAll((rows) =>
            rows.map(
                (row) =>
                    row
                        .querySelector('[aria-label^="Move "]')
                        ?.getAttribute("aria-label")
                        ?.replace(/^Move | up$/g, "") ?? "",
            ),
        );

/** The Cash order in the demo data store: what a reload will show. */
const savedCashNames = (page: Page) =>
    page.evaluate(() => {
        const dataset = JSON.parse(
            localStorage.getItem("budget_buddy_mock_dataset_v1") ??
                '{"accounts":[]}',
        ) as {
            accounts: { type: string; name: string; sort_order: number }[];
        };
        return dataset.accounts
            .filter((account) => account.type === "Cash")
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((account) => account.name);
    });

test.describe("Account rows", () => {
    test.describe("on a phone", () => {
        // Phone emulation: no desktop scrollbar eating 15px of a 360px screen
        test.use({ isMobile: true, hasTouch: true });

        test("aligns columns and keeps the sparkline visible at 360px", async ({
            page,
        }) => {
            await page.setViewportSize({ width: 360, height: 780 });
            await page.goto("/accounts");
            const rows = page.getByTestId("account-row");
            await expect(rows.first()).toBeVisible();
            await expect(
                rows.first().getByRole("img", { name: /balance trend/i }),
            ).toBeVisible();

            const layout = await rows.evaluateAll((elements) =>
                elements.map((row) => {
                    const [, name, spark, amount] = Array.from(
                        row.children,
                    ).map((cell) => cell.getBoundingClientRect());
                    return {
                        name: name.width,
                        sparkX: spark.x,
                        sparkWidth: spark.width,
                        amountRight: amount.right,
                        overflow: row.scrollWidth - row.clientWidth,
                    };
                }),
            );
            for (const row of layout) {
                expect(row.name).toBeGreaterThanOrEqual(78);
                expect(row.sparkWidth).toBeGreaterThanOrEqual(63);
                expect(row.sparkX).toBeCloseTo(layout[0].sparkX, 0);
                expect(row.amountRight).toBeCloseTo(layout[0].amountRight, 0);
                expect(row.overflow).toBeLessThanOrEqual(0);
            }
            expect(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth -
                        document.documentElement.clientWidth,
                ),
            ).toBeLessThanOrEqual(0);
        });
    });

    test("reorders with the keyboard and keeps the order", async ({ page }) => {
        await page.goto("/accounts");
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        const before = await cashNames(page);
        expect(before.length).toBeGreaterThan(1);

        const down = page.getByRole("button", {
            name: `Move ${before[0]} down`,
        });
        await down.focus();
        await expect(down).toBeInViewport();
        await page.keyboard.press("Enter");

        const expected = [before[1], before[0], ...before.slice(2)];
        await expect.poll(() => cashNames(page)).toEqual(expected);
        await expect(down).toBeFocused();
        await expect(
            page.getByText(
                `${before[0]} moved to position 2 of ${before.length}`,
            ),
        ).toBeAttached();

        // The save finishes after the screen updates; reload only once stored
        await expect.poll(() => savedCashNames(page)).toEqual(expected);
        await page.reload();
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        await expect.poll(() => cashNames(page)).toEqual(expected);
    });

    test("reorders by dragging the handle", async ({ page }) => {
        await page.goto("/accounts");
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        const before = await cashNames(page);
        const handles = page.getByTestId("account-drag-handle");
        await handles.first().scrollIntoViewIfNeeded();
        const from = (await handles.first().boundingBox())!;
        const to = (await handles.nth(1).boundingBox())!;

        await page.mouse.move(
            from.x + from.width / 2,
            from.y + from.height / 2,
        );
        await page.mouse.down();
        // Drag updates are processed per animation frame, so on a slow runner
        // keep nudging until the rows swap, and only then let go.
        const expected = [before[1], before[0], ...before.slice(2)];
        let nudge = 0;
        await expect
            .poll(async () => {
                nudge = (nudge + 1) % 2;
                await page.mouse.move(
                    from.x + from.width / 2,
                    to.y + to.height + nudge,
                    { steps: 5 },
                );
                return cashNames(page);
            })
            .toEqual(expected);
        await page.mouse.up();

        // The save finishes after the screen updates; reload only once stored
        await expect.poll(() => savedCashNames(page)).toEqual(expected);
        await page.reload();
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        await expect.poll(() => cashNames(page)).toEqual(expected);
    });

    test("tapping a cut-off name shows it in full", async ({
        page,
        isMobile,
    }) => {
        await page.setViewportSize({ width: 320, height: 780 });
        await page.goto("/accounts");
        const info = page
            .getByRole("button", { name: /^show full name:/i })
            .first();
        if (isMobile) await info.tap();
        else await info.click();

        await expect(page.getByRole("tooltip")).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);
    });
});
