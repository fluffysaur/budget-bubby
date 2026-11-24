import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    OPENROUTER_MODELS_ENDPOINT,
    clearOpenRouterModelsCache,
    fetchOpenRouterFreeModels,
} from "../openrouterModels";
import { AI_PROVIDER_META } from "../providers";

describe("openrouterModels", () => {
    beforeEach(() => {
        clearOpenRouterModelsCache();
        vi.restoreAllMocks();
    });

    it("fetches free tool-capable models and puts openrouter/free first", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    data: [
                        {
                            id: "openai/gpt-4o",
                            name: "OpenAI: GPT-4o",
                            pricing: { prompt: "0.000005", completion: "0.000015" },
                            supported_parameters: ["tools"],
                        },
                        {
                            id: "google/gemma-4-31b-it:free",
                            name: "Google: Gemma 4 31B (free)",
                            pricing: { prompt: "0", completion: "0" },
                            supported_parameters: ["tools", "temperature"],
                        },
                        {
                            id: "some/no-tools:free",
                            name: "No Tools Model (free)",
                            pricing: { prompt: "0", completion: "0" },
                            supported_parameters: ["temperature"],
                        },
                        {
                            id: "openrouter/free",
                            name: "Free Models Router",
                            pricing: { prompt: "0", completion: "0" },
                            supported_parameters: ["tools"],
                        },
                    ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        );

        const models = await fetchOpenRouterFreeModels();

        expect(fetchSpy).toHaveBeenCalledWith(OPENROUTER_MODELS_ENDPOINT);
        expect(models).toEqual([
            {
                value: "openrouter/free",
                label: "Free Models Router (Recommended)",
            },
            {
                value: "google/gemma-4-31b-it:free",
                label: "Google: Gemma 4 31B (free)",
            },
        ]);

        // Second call uses the in-memory cache
        await fetchOpenRouterFreeModels();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("falls back to curated free models when the request fails", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
            new Error("Network error"),
        );

        const models = await fetchOpenRouterFreeModels();

        expect(models).toEqual(AI_PROVIDER_META.openrouter.curatedModels);
    });
});
