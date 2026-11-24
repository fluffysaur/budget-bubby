import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LazyMotion, domAnimation } from "motion/react";
import { PrivacyProvider } from "../../../context/PrivacyContext";
import { AiSettingsSection } from "../AiSettingsSection";
import * as aiProviders from "../../../services/ai/providers";
import * as openrouterAuth from "../../../services/ai/openrouterAuth";
import * as openrouterModels from "../../../services/ai/openrouterModels";

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
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it("saves, toggles visibility, tests connection, and clears the API key", async () => {
        const testSpy = vi
            .spyOn(aiProviders, "testAiConnection")
            .mockResolvedValue({ ok: true });

        renderSection();

        expect(screen.getByText("Not Set")).toBeInTheDocument();

        // Expand the collapsible section (defaults to OpenRouter)
        fireEvent.click(screen.getByRole("button", { name: /Bubby AI/i }));
        expect(
            screen.getByTestId("connect-openrouter-btn"),
        ).toBeInTheDocument();

        // Switch to Gemini to test manual API key input flow
        fireEvent.change(screen.getByTestId("ai-provider-select"), {
            target: { value: "gemini" },
        });

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

        // Switch to Gemini and save Gemini key
        fireEvent.change(screen.getByTestId("ai-provider-select"), {
            target: { value: "gemini" },
        });
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
            screen.getByTestId("connect-openrouter-btn"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("ai-api-key-input"),
        ).not.toBeInTheDocument();

        // Reveal manual key input via toggle
        fireEvent.click(screen.getByTestId("toggle-manual-openrouter-key"));
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

    it("shows OpenRouter connected status, supports disconnect, and displays pending OAuth feedback", () => {
        aiProviders.setActiveAiProvider("openrouter");
        aiProviders.setProviderApiKey("openrouter", "sk-or-v1-oauth");
        openrouterAuth.setPendingOpenRouterFeedback({
            target: "settings",
            variant: "success",
            message: "OpenRouter connected on this device.",
        });

        const oauthSpy = vi
            .spyOn(openrouterAuth, "startOpenRouterOAuth")
            .mockResolvedValue();

        renderSection();

        // Section auto-expanded due to pending OAuth feedback
        expect(screen.getByTestId("ai-settings-feedback")).toHaveTextContent(
            "OpenRouter connected on this device.",
        );
        expect(
            screen.getByTestId("openrouter-connected-status"),
        ).toHaveTextContent(/OpenRouter connected · Stored locally/);

        fireEvent.click(screen.getByTestId("reconnect-openrouter-btn"));
        expect(oauthSpy).toHaveBeenCalledWith("settings", "/");

        fireEvent.click(screen.getByTestId("disconnect-openrouter-btn"));
        expect(aiProviders.getProviderApiKey("openrouter")).toBe("");
        expect(
            screen.getByTestId("connect-openrouter-btn"),
        ).toBeInTheDocument();
    });

    it("populates live free OpenRouter models when OpenRouter is selected", async () => {
        vi.spyOn(openrouterModels, "fetchOpenRouterFreeModels").mockResolvedValue([
            {
                value: "openrouter/free",
                label: "Free Models Router (Recommended)",
            },
            {
                value: "nvidia/nemotron-3.5-lightning:free",
                label: "NVIDIA: Nemotron 3.5 Lightning (free)",
            },
        ]);

        renderSection();
        fireEvent.click(screen.getByRole("button", { name: /Bubby AI/i }));
        fireEvent.change(screen.getByTestId("ai-provider-select"), {
            target: { value: "openrouter" },
        });

        await waitFor(() => {
            expect(
                screen.getByRole("option", {
                    name: "NVIDIA: Nemotron 3.5 Lightning (free)",
                }),
            ).toBeInTheDocument();
        });
    });

    it("defaults reasoning effort to low and allows customizing it", () => {
        renderSection();

        fireEvent.click(screen.getByRole("button", { name: /Bubby AI/i }));

        const effortSelect = screen.getByTestId(
            "ai-reasoning-effort-select",
        ) as HTMLSelectElement;
        expect(effortSelect.value).toBe("low");
        expect(aiProviders.getAiReasoningEffort()).toBe("low");

        fireEvent.change(effortSelect, { target: { value: "high" } });
        expect(effortSelect.value).toBe("high");
        expect(aiProviders.getAiReasoningEffort()).toBe("high");
    });
});
