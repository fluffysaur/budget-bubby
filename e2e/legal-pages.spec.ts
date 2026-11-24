import { test, expect } from "@playwright/test";

test.describe("Legal pages", () => {
    for (const [path, title] of [
        ["/privacy", "Privacy Policy"],
        ["/terms", "Terms of Use"],
    ] as const) {
        test(`${path} is public and shows the draft notice`, async ({
            page,
        }) => {
            await page.goto(path);
            await expect(
                page.getByRole("heading", { level: 1, name: title }),
            ).toBeVisible();
            await expect(page.getByText(/Not yet reviewed/i)).toBeVisible();
        });
    }
});
