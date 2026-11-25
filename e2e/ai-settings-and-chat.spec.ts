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

        // The CTA deep-links to the Bubby AI settings page, which opens expanded
        await expect(page).toHaveURL(/\/settings\/ai$/);
        await expect(page.getByTestId("ai-provider-select")).toBeVisible();

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

        // Leave Settings (the app header is hidden there on phones) and reopen chat
        await page.goBack();
        await page.getByTestId("open-bubby-chat-btn").click();
        await expect(drawer).toBeVisible();
        await expect(
            drawer.getByText("OpenRouter", { exact: true }),
        ).toBeVisible();
        await expect(drawer.getByTestId("bubby-chat-input")).toBeEnabled();
    });
});
