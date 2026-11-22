import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    GEMINI_API_KEY_STORAGE_KEY,
    GEMINI_MODEL_STORAGE_KEY,
    DEFAULT_GEMINI_MODEL,
    getGeminiApiKey,
    setGeminiApiKey,
    clearGeminiApiKey,
    hasGeminiApiKey,
    getGeminiModel,
    setGeminiModel,
    testGeminiConnection,
    streamGeminiTurn,
} from "../geminiClient";

describe("geminiClient", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("persists and clears the Gemini API key in localStorage", () => {
        expect(hasGeminiApiKey()).toBe(false);
        expect(getGeminiApiKey()).toBe("");

        setGeminiApiKey("  AIza-test-key-123  ");
        expect(hasGeminiApiKey()).toBe(true);
        expect(getGeminiApiKey()).toBe("AIza-test-key-123");
        expect(localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)).toBe(
            "AIza-test-key-123",
        );

        clearGeminiApiKey();
        expect(hasGeminiApiKey()).toBe(false);
        expect(localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)).toBeNull();
    });

    it("returns default model, migrates retired models, and persists selection", () => {
        expect(getGeminiModel()).toBe(DEFAULT_GEMINI_MODEL);
        expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.8-flash");

        localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, "gemini-2.5-flash");
        expect(getGeminiModel()).toBe("gemini-3.8-flash");

        setGeminiModel("gemini-2.5-pro");
        expect(getGeminiModel()).toBe("gemini-2.5-pro");
        expect(localStorage.getItem(GEMINI_MODEL_STORAGE_KEY)).toBe(
            "gemini-2.5-pro",
        );
    });

    it("tests Gemini connection and reports success or API error", async () => {
        const emptyResult = await testGeminiConnection("   ");
        expect(emptyResult.ok).toBe(false);

        const fetchMock = vi.fn().mockResolvedValueOnce(
            new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const okResult = await testGeminiConnection(
            "AIza-valid",
            "gemini-3.8-flash",
        );
        expect(okResult).toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("/models/gemini-3.8-flash:generateContent"),
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "x-goog-api-key": "AIza-valid",
                }),
            }),
        );

        fetchMock.mockResolvedValueOnce(
            new Response(
                JSON.stringify({ error: { message: "API key not valid." } }),
                { status: 400 },
            ),
        );
        const failResult = await testGeminiConnection("AIza-bad");
        expect(failResult).toEqual({
            ok: false,
            error: "API key not valid.",
        });
    });

    it("streams SSE text deltas and collects function calls", async () => {
        const encoder = new TextEncoder();
        const ssePayload = [
            `data: ${JSON.stringify({
                candidates: [{ content: { parts: [{ text: "You have " }] } }],
            })}\n\n`,
            `data: ${JSON.stringify({
                candidates: [
                    {
                        content: {
                            parts: [
                                { text: "S$420 left." },
                                {
                                    functionCall: {
                                        name: "getMonthlyBudget",
                                        args: { month: "2026-11" },
                                    },
                                },
                            ],
                        },
                    },
                ],
            })}\n\n`,
        ];

        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                for (const chunk of ssePayload) {
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            },
        });

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(stream, { status: 200 })),
        );

        const deltas: string[] = [];
        const result = await streamGeminiTurn({
            apiKey: "AIza-valid",
            contents: [{ role: "user", parts: [{ text: "Budget?" }] }],
            onTextDelta: (d) => deltas.push(d),
        });

        expect(deltas).toEqual(["You have ", "S$420 left."]);
        expect(result.text).toBe("You have S$420 left.");
        expect(result.functionCalls).toEqual([
            { name: "getMonthlyBudget", args: { month: "2026-11" } },
        ]);
    });

    it("throws a clear error when API key is missing", async () => {
        await expect(
            streamGeminiTurn({
                apiKey: "",
                contents: [{ role: "user", parts: [{ text: "Hi" }] }],
            }),
        ).rejects.toThrow(/not configured/i);
    });
});
