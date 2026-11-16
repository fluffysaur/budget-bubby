import { test, expect } from "@playwright/test";

test.describe("Credit Card Paid Cycle Sync", () => {
    test("syncs paid status between Credit Cards tab and Home widget", async ({
        page,
    }) => {
        await page.goto("/accounts");
        await page.getByRole("tab", { name: /Credit Cards/ }).click();

        // Default view is Current
        await expect(
            page.getByTestId("credit-card-period-label"),
        ).toHaveText("Current");
        await expect(
            page.getByRole("button", { name: "Next Month" }),
        ).toBeDisabled();

        // Mark OCBC 365 Dining & Groceries paid in Credit Cards tab
        await page
            .getByRole("button", {
                name: /Mark OCBC 365 Dining & Groceries statement as Paid/i,
            })
            .click();

        await expect(
            page.getByRole("button", {
                name: /Mark OCBC 365 Dining & Groceries statement as Unpaid/i,
            }),
        ).toBeVisible();

        // Navigate Home and verify OCBC 365 is no longer in Card Payments unpaid list
        await page.goto("/");
        const cardPayments = page.getByRole("region", {
            name: "Card Payments",
        });
        await expect(cardPayments).toBeVisible();
        await expect(
            cardPayments.getByText("OCBC 365 Dining & Groceries"),
        ).not.toBeVisible();

        // Unmark OCBC 365 back in Credit Cards tab -> reappears on Home
        await page.goto("/accounts");
        await page.getByRole("tab", { name: /Credit Cards/ }).click();
        await page
            .getByRole("button", {
                name: /Mark OCBC 365 Dining & Groceries statement as Unpaid/i,
            })
            .click();

        await page.goto("/");
        await expect(
            page
                .getByRole("region", { name: "Card Payments" })
                .getByText("OCBC 365 Dining & Groceries"),
        ).toBeVisible();
    });
});
