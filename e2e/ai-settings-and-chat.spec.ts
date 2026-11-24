import { test, expect } from "@playwright/test";

test.describe("Bubby AI provider settings & chat drawer", () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                "bb_onboarding_v1",
                '{"seen":true,"hatched":true}',
            );
        });
    });

    test("switches AI providers, saves custom model ID, and opens Bubby chat drawer", async ({
        page,
    }) => {
        await page.goto("/");

        // Open Bubby AI drawer first (no key configured -> Add Key empty state)
        await page.getByTestId("open-bubby-chat-btn").click();
        const drawer = page.getByTestId("bubby-chat-drawer");
        await expect(drawer).toBeVisible();
        await expect(drawer.getByTestId("bubby-no-key-state")).toBeVisible();
        await expect(
            drawer.getByTestId("bubby-connect-openrouter-btn"),
        ).toBeVisible();

        // Click Open Settings CTA inside drawer
        await drawer.getByTestId("bubby-setup-key-cta").click();
        await expect(drawer).not.toBeVisible();

        // Expand Bubby AI section in Settings
        await page
            .getByRole("dialog")
            .getByRole("button", { name: /Bubby AI/i })
            .click();

        // Switch provider to OpenRouter and set a custom model ID
        await page
            .getByTestId("ai-provider-select")
            .selectOption("openrouter");
        await page.getByTestId("toggle-manual-openrouter-key").click();
        await page
            .getByTestId("ai-model-select")
            .selectOption("__custom__");
        await page
            .getByTestId("ai-custom-model-input")
            .fill("deepseek/deepseek-r1");
        await page.getByTestId("ai-api-key-input").fill("sk-or-v1-e2e-key");
        await page.getByTestId("save-ai-key-btn").click();

        await expect(page.getByTestId("ai-settings-feedback")).toContainText(
            /OpenRouter API key saved locally/i,
        );

        // Close Settings modal and reopen Bubby chat drawer
        await page.keyboard.press("Escape");
        const discardBtn = page
            .locator('[data-discard-dialog="true"]')
            .getByRole("button", { name: /Discard/i });
        if (await discardBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await discardBtn.click();
        }
        await expect(page.getByRole("dialog")).not.toBeVisible();
        await page.getByTestId("open-bubby-chat-btn").click();
        await expect(drawer).toBeVisible();
        await expect(
            drawer.getByText("OpenRouter", { exact: true }),
        ).toBeVisible();
        await expect(drawer.getByTestId("bubby-chat-input")).toBeEnabled();
    });
});
