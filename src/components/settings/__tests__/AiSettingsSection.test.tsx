import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LazyMotion, domAnimation } from "motion/react";
import { PrivacyProvider } from "../../../context/PrivacyContext";
import { AiSettingsSection } from "../AiSettingsSection";
import * as geminiClient from "../../../services/ai/geminiClient";

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
            .spyOn(geminiClient, "testGeminiConnection")
            .mockResolvedValue({ ok: true });

        renderSection();

        // Expand the collapsible section
        fireEvent.click(screen.getByRole("button", { name: /Bubby AI/i }));

        const input = screen.getByTestId(
            "gemini-api-key-input",
        ) as HTMLInputElement;
        expect(input.type).toBe("password");

        fireEvent.click(screen.getByTestId("toggle-gemini-key-visibility"));
        expect(input.type).toBe("text");

        fireEvent.change(input, { target: { value: "AIza-demo-key" } });
        fireEvent.click(screen.getByTestId("save-gemini-key-btn"));

        expect(geminiClient.getGeminiApiKey()).toBe("AIza-demo-key");
        expect(
            screen.getByTestId("gemini-settings-feedback"),
        ).toHaveTextContent(/saved locally/i);

        fireEvent.click(screen.getByTestId("test-gemini-connection-btn"));
        await waitFor(() => {
            expect(testSpy).toHaveBeenCalledWith(
                "AIza-demo-key",
                geminiClient.DEFAULT_GEMINI_MODEL,
            );
            expect(
                screen.getByTestId("gemini-settings-feedback"),
            ).toHaveTextContent(/Connection verified/i);
        });

        fireEvent.click(screen.getByTestId("clear-gemini-key-btn"));
        expect(geminiClient.getGeminiApiKey()).toBe("");
    });
});
