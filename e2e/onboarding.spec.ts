import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Onboarding guide", () => {
    test("shows on first launch, can be reopened from BubbySheet, and grants a snack on checklist completion", async ({
        page,
    }) => {
        await page.goto("/");

        // First launch shows Welcome Guide modal
        const dialog = page.getByRole("dialog");
        await expect(
            dialog.getByRole("heading", { name: "Welcome Guide" }),
        ).toBeVisible();
        await expect(
            dialog.getByRole("heading", { name: "Budget" }),
        ).toBeVisible();

        // Step through Spend & Inbox, Plan, Meet Bubby, and Starter Tasks
        await dialog.getByRole("button", { name: /Next/i }).click();
        await expect(
            dialog.getByRole("heading", { name: "Spend & Inbox" }),
        ).toBeVisible();

        await dialog.getByRole("button", { name: /Next/i }).click();
        await expect(
            dialog.getByRole("heading", { name: "Plan" }),
        ).toBeVisible();

        await dialog.getByRole("button", { name: /Next/i }).click();
        await expect(
            dialog.getByRole("heading", { name: "Meet Bubby" }),
        ).toBeVisible();

        await dialog.getByRole("button", { name: /Next/i }).click();
        const checklist = dialog.getByRole("list", {
            name: "Onboarding checklist",
        });
        await expect(checklist).toBeVisible();

        // Dismiss and verify reload does not re-open automatically
        await dialog.getByRole("button", { name: "Done" }).click();
        await expect(dialog).not.toBeVisible();

        await page.reload();
        await expect(
            page.getByRole("dialog", { name: /Welcome Guide/i }),
        ).not.toBeVisible();

        // Reopen on demand via BubbySheet -> Guide
        await page.getByTestId("bubby-avatar").click();
        const bubbySheet = page.getByRole("dialog");
        await expect(
            bubbySheet.getByRole("heading", { name: "Bubby" }),
        ).toBeVisible();
        await bubbySheet.getByRole("button", { name: "Guide" }).click();

        const guide = page.getByRole("dialog");
        await expect(
            guide.getByRole("heading", { name: "Welcome Guide" }),
        ).toBeVisible();

        // Jump to Starter Tasks (Bubby task is already auto-completed by opening BubbySheet)
        await guide.getByRole("button", { name: /5\. Tasks/i }).click();
        const checkboxes = guide
            .getByRole("list", { name: "Onboarding checklist" })
            .getByRole("checkbox");
        const count = await checkboxes.count();
        for (let i = 0; i < count; i++) {
            const cb = checkboxes.nth(i);
            if ((await cb.getAttribute("aria-checked")) !== "true") {
                await cb.click();
            }
        }

        await expect(
            guide.getByTestId("onboarding-reward-banner"),
        ).toBeVisible();
        await guide.getByRole("button", { name: "Done" }).click();

        // Snack appears in BubbySheet's Snacks section
        await page.getByTestId("bubby-avatar").click();
        const sheetAfter = page.getByRole("dialog");
        await expect(
            sheetAfter.getByRole("region", { name: "Snacks" }).getByRole("listitem", {
                name: "Fish",
            }),
        ).toBeVisible();
    });
});
