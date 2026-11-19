import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Onboarding guide & Bubby egg hatching", () => {
    test("shows Welcome Guide on first launch, then lets user hatch Bubby via Starter Quests to unlock regular quests and Fish snack", async ({
        page,
    }) => {
        await page.goto("/");

        // 1. First launch opens the 4-step Welcome Guide modal
        const dialog = page.getByRole("dialog");
        await expect(
            dialog.getByRole("heading", { name: "Welcome Guide" }),
        ).toBeVisible();
        await expect(
            dialog.getByRole("heading", { name: "Budget" }),
        ).toBeVisible();

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

        // Clicking "Let's Start!" closes the guide and opens BubbySheet with Starter Quests
        await dialog.getByRole("button", { name: "Let's Start!" }).click();
        const bubbySheet = page.getByRole("dialog");
        await expect(
            bubbySheet.getByRole("heading", { name: "Bubby" }),
        ).toBeVisible();
        await expect(
            bubbySheet.getByRole("list", { name: "Starter quests" }),
        ).toBeVisible();
        await expect(
            bubbySheet.getByRole("list", { name: "Today's quests" }),
        ).not.toBeVisible();

        // Reload does not re-open Welcome Guide automatically
        await page.reload();
        await expect(
            page.getByRole("dialog", { name: /Welcome Guide/i }),
        ).not.toBeVisible();

        // 2. Header shows unhatched Bubby egg
        const avatar = page.getByTestId("bubby-avatar");
        await expect(avatar).toHaveAttribute("data-hatched", "false");

        // 3. Reopen Welcome Guide on demand via BubbySheet -> Guide
        await avatar.click();
        const reopenedSheet = page.getByRole("dialog");
        await reopenedSheet.getByRole("button", { name: "Guide" }).click();
        const guide = page.getByRole("dialog");
        await expect(
            guide.getByRole("heading", { name: "Welcome Guide" }),
        ).toBeVisible();
        await guide.getByRole("button", { name: /Next/i }).click();
        await guide.getByRole("button", { name: /Next/i }).click();
        await guide.getByRole("button", { name: /Next/i }).click();
        await guide.getByRole("button", { name: "Let's Start!" }).click();

        // 4. Hatch Bubby via the fullscreen 3-tap interactive hatch stage
        const eggSheet = page.getByRole("dialog");
        const hatchBtn = eggSheet.getByTestId("hatch-bubby-btn");
        await expect(hatchBtn).toBeVisible();
        await hatchBtn.click();

        const hatchStage = page.getByTestId("hatch-stage");
        const eggTarget = hatchStage.getByTestId("hatch-egg-target");
        await expect(eggTarget).toBeVisible();
        await eggTarget.click();
        await eggTarget.click();
        await eggTarget.click();

        await expect(
            hatchStage.getByRole("heading", { name: "Bubby Hatched!" }),
        ).toBeVisible();
        await hatchStage.getByTestId("meet-bubby-btn").click();

        // 5. Regular quests unlock, Fish snack is awarded, and partner remains an egg
        const sheetAfter = page.getByRole("dialog");
        await expect(sheetAfter.getByTestId("bubby-penguin")).toHaveCount(1);
        await expect(sheetAfter.getByTestId("bubby-egg-card")).toHaveCount(1);
        await expect(
            sheetAfter.getByRole("list", { name: "Today's quests" }),
        ).toBeVisible();
        await expect(
            sheetAfter
                .getByRole("region", { name: "Snacks" })
                .getByRole("listitem", { name: "Fish" }),
        ).toBeVisible();
        await expect(avatar).toHaveAttribute("data-hatched", "true");
    });
});
