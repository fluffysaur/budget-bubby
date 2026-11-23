import { test, expect, type Page } from "@playwright/test";

// Header renders a perspective dropdown at every viewport whose trigger shows the active label.
async function expectActivePerspective(page: Page, name: RegExp) {
    await expect(
        page.getByRole("button", { name: "Select Financial Perspective" }),
    ).toContainText(name);
}

async function selectPerspective(page: Page, name: RegExp) {
    await page
        .getByRole("button", { name: "Select Financial Perspective" })
        .click();
    await page.getByRole("option", { name }).click();
}

test.describe("Navigation and Perspective Switching", () => {
    test("should switch perspectives between household, Alex, and Sam", async ({
        page,
    }) => {
        await page.goto("/");

        await expectActivePerspective(page, /Combined/i);

        await selectPerspective(page, /Alex/i);
        await expectActivePerspective(page, /Alex/i);

        await selectPerspective(page, /Sam/i);
        await expectActivePerspective(page, /Sam/i);

        await selectPerspective(page, /Combined/i);
        await expectActivePerspective(page, /Combined/i);
    });

    test("should navigate across all views via desktop sidebar", async ({
        page,
        isMobile,
    }) => {
        test.skip(
            isMobile,
            "Sidebar navigation is only visible on desktop viewports",
        );
        await page.goto("/");
        const sidebar = page.getByRole("navigation", { name: "Sidebar" });

        // Spend: Expenses and Budget sub-tabs
        await sidebar.getByRole("button", { name: /^Spend/i }).click();
        await expect(
            page.getByRole("heading", { level: 1, name: /^Spend$/i }),
        ).toBeVisible();
        await page.getByRole("tab", { name: /Budget/i }).click();
        await expect(
            page.getByRole("tab", { name: /Budget/i }),
        ).toHaveAttribute("aria-selected", "true");
        await page.getByRole("tab", { name: /Expenses/i }).click();
        await expect(
            page.getByRole("tab", { name: /Expenses/i }),
        ).toHaveAttribute("aria-selected", "true");

        // Accounts
        await sidebar.getByRole("button", { name: /^Accounts/i }).click();
        await expect(page).toHaveURL(/\/accounts/);
        await expect(
            page.getByRole("heading", { level: 1, name: /^Accounts$/i }),
        ).toBeVisible();

        // Plan: Goals, Recurring and Loans sub-tabs
        await sidebar.getByRole("button", { name: /^Plan/i }).click();
        await expect(
            page.getByRole("heading", { level: 1, name: /^Plan$/i }),
        ).toBeVisible();
        for (const name of ["Goals", "Recurring", "Loans"]) {
            const tab = page.getByRole("tab", { name, exact: true });
            await tab.click();
            await expect(tab).toHaveAttribute("aria-selected", "true");
        }

        // Back to Home
        await sidebar.getByRole("button", { name: /^Home/i }).click();
        await expect(page).toHaveURL(/\/(dashboard)?$/);
        await expect(
            page.getByRole("heading", { level: 1, name: /^Home$/i }),
        ).toBeVisible();
    });
});
