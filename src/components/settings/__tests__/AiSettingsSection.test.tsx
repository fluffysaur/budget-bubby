import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LazyMotion, domAnimation } from "motion/react";
import { PrivacyProvider } from "../../../context/PrivacyContext";
import { AiSettingsSection } from "../AiSettingsSection";
import * as aiProviders from "../../../services/ai/providers";

function renderSection() {
    return render(
        <LazyMotion features={domAnimation} strict>
            <PrivacyProvider>
                <AiSettingsSection />
            </PrivacyProvider>
        </LazyMotion>,
    );
}

describe("AiSettingsSection", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("saves, toggles visibility, tests connection, and clears the API key", async () => {
        const testSpy = vi
            .spyOn(aiProviders, "testAiConnection")
            .mockResolvedValue({ ok: true });

        renderSection();

        expect(screen.getByText("Not Set")).toBeInTheDocument();

        // Expand the collapsible section
        fireEvent.click(screen.getByRole("button", { name: /Bubby AI/i }));

        const input = screen.getByTestId(
            "ai-api-key-input",
        ) as HTMLInputElement;
        expect(input.type).toBe("password");

        fireEvent.click(screen.getByTestId("toggle-ai-key-visibility"));
        expect(input.type).toBe("text");

        fireEvent.change(input, { target: { value: "AIza-demo-key" } });
        fireEvent.click(screen.getByTestId("save-ai-key-btn"));

        expect(aiProviders.getProviderApiKey("gemini")).toBe("AIza-demo-key");
        expect(
            screen.getByTestId("ai-settings-feedback"),
        ).toHaveTextContent(/saved locally/i);

        fireEvent.click(screen.getByTestId("test-ai-connection-btn"));
        await waitFor(() => {
            expect(testSpy).toHaveBeenCalledWith(
                "gemini",
                "AIza-demo-key",
                aiProviders.AI_PROVIDER_META.gemini.defaultModel,
            );
            expect(
                screen.getByTestId("ai-settings-feedback"),
            ).toHaveTextContent(/Connection verified/i);
        });

        fireEvent.click(screen.getByTestId("clear-ai-key-btn"));
        expect(aiProviders.getProviderApiKey("gemini")).toBe("");
    });

    it("switches providers while preserving saved keys and supports custom model IDs", () => {
        renderSection();

        fireEvent.click(screen.getByRole("button", { name: /Bubby AI/i }));

        // Save Gemini key
        fireEvent.change(screen.getByTestId("ai-api-key-input"), {
            target: { value: "AIza-gem-1" },
        });
        fireEvent.click(screen.getByTestId("save-ai-key-btn"));

        // Switch to OpenRouter
        fireEvent.change(screen.getByTestId("ai-provider-select"), {
            target: { value: "openrouter" },
        });

        expect(aiProviders.getActiveAiProvider()).toBe("openrouter");
        expect(
            (screen.getByTestId("ai-api-key-input") as HTMLInputElement).value,
        ).toBe("");

        // Select custom model ID and type a custom OpenRouter model
        fireEvent.change(screen.getByTestId("ai-model-select"), {
            target: { value: "__custom__" },
        });
        const customInput = screen.getByTestId(
            "ai-custom-model-input",
        ) as HTMLInputElement;
        fireEvent.change(customInput, {
            target: { value: "deepseek/deepseek-r1" },
        });

        fireEvent.change(screen.getByTestId("ai-api-key-input"), {
            target: { value: "sk-or-v1-abc" },
        });
        fireEvent.click(screen.getByTestId("save-ai-key-btn"));

        expect(aiProviders.getProviderApiKey("openrouter")).toBe(
            "sk-or-v1-abc",
        );
        expect(aiProviders.getProviderModel("openrouter")).toBe(
            "deepseek/deepseek-r1",
        );
        // Gemini key is still preserved
        expect(aiProviders.getProviderApiKey("gemini")).toBe("AIza-gem-1");
    });
});
