import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AI_ACTIVE_PROVIDER_STORAGE_KEY,
    LEGACY_GEMINI_API_KEY_STORAGE_KEY,
    LEGACY_GEMINI_MODEL_STORAGE_KEY,
    getActiveAiProvider,
    setActiveAiProvider,
    getProviderApiKey,
    setProviderApiKey,
    clearProviderApiKey,
    getProviderModel,
    setProviderModel,
    getActiveAiConfig,
    getProviderKeyStorageKey,
    getProviderModelStorageKey,
    streamAiTurn,
    testAiConnection,
} from "../index";
import { DEFAULT_GEMINI_MODEL } from "../gemini";
import { ANTHROPIC_API_ENDPOINT } from "../anthropic";
import {
    OPENAI_API_ENDPOINT,
    OPENROUTER_API_ENDPOINT,
} from "../openaiCompatible";
import type { AiToolDefinition } from "../types";

const SAMPLE_TOOLS: AiToolDefinition[] = [
    {
        name: "getExpenses",
        description: "List expenses for a month.",
        parameters: {
            type: "object",
            properties: {
                month: { type: "string", description: "YYYY-MM" },
                limit: { type: "integer", description: "Max items" },
            },
            required: ["month"],
        },
    },
];

function makeSseStream(frames: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const frame of frames) {
                controller.enqueue(encoder.encode(frame));
            }
            controller.close();
        },
    });
}

describe("AI providers & storage", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("migrates legacy budget_bubby_gemini_* keys to per-provider storage under gemini", () => {
        localStorage.setItem(
            LEGACY_GEMINI_API_KEY_STORAGE_KEY,
            "AIza-legacy-key",
        );
        localStorage.setItem(
            LEGACY_GEMINI_MODEL_STORAGE_KEY,
            "gemini-2.5-flash",
        );

        expect(getActiveAiProvider()).toBe("gemini");
        expect(getProviderApiKey("gemini")).toBe("AIza-legacy-key");
        // Retired model is normalized to DEFAULT_GEMINI_MODEL
        expect(getProviderModel("gemini")).toBe(DEFAULT_GEMINI_MODEL);
        expect(localStorage.getItem(LEGACY_GEMINI_API_KEY_STORAGE_KEY)).toBeNull();
        expect(localStorage.getItem(LEGACY_GEMINI_MODEL_STORAGE_KEY)).toBeNull();
        expect(localStorage.getItem(getProviderKeyStorageKey("gemini"))).toBe(
            "AIza-legacy-key",
        );
        expect(localStorage.getItem(AI_ACTIVE_PROVIDER_STORAGE_KEY)).toBe(
            "gemini",
        );
    });

    it("isolates keys and models per provider when switching active provider", () => {
        setProviderApiKey("gemini", "AIza-gem");
        setProviderModel("gemini", "gemini-2.5-pro");

        setActiveAiProvider("anthropic");
        setProviderApiKey("anthropic", "sk-ant-123");
        setProviderModel("anthropic", "claude-haiku-4-5-20251001");

        setActiveAiProvider("openrouter");
        setProviderApiKey("openrouter", "sk-or-v1-xyz");
        setProviderModel("openrouter", "deepseek/deepseek-r1");

        expect(getActiveAiConfig()).toEqual({
            provider: "openrouter",
            apiKey: "sk-or-v1-xyz",
            model: "deepseek/deepseek-r1",
        });

        // Other providers remain intact
        expect(getProviderApiKey("gemini")).toBe("AIza-gem");
        expect(getProviderModel("gemini")).toBe("gemini-2.5-pro");
        expect(getProviderApiKey("anthropic")).toBe("sk-ant-123");
        expect(getProviderModel("anthropic")).toBe("claude-haiku-4-5-20251001");
        expect(localStorage.getItem(getProviderModelStorageKey("openrouter"))).toBe(
            "deepseek/deepseek-r1",
        );

        clearProviderApiKey("anthropic");
        expect(getProviderApiKey("anthropic")).toBe("");
        expect(getProviderApiKey("openrouter")).toBe("sk-or-v1-xyz");
    });

    it("Gemini adapter converts schema to uppercase, streams SSE, and handles tool round-trip", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(
            new Response(
                makeSseStream([
                    `data: ${JSON.stringify({
                        candidates: [
                            { content: { parts: [{ text: "Checking " }] } },
                        ],
                    })}\n\n`,
                    `data: ${JSON.stringify({
                        candidates: [
                            {
                                content: {
                                    parts: [
                                        { text: "now." },
                                        {
                                            functionCall: {
                                                name: "getExpenses",
                                                args: { month: "2026-11" },
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    })}\n\n`,
                ]),
                { status: 200 },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        const deltas: string[] = [];
        const result = await streamAiTurn({
            provider: "gemini",
            apiKey: "AIza-test",
            model: "gemini-2.0-flash", // retired -> falls back to default
            systemInstruction: "Be concise.",
            tools: SAMPLE_TOOLS,
            messages: [
                { role: "user", text: "What did I spend?" },
                {
                    role: "assistant",
                    toolCalls: [
                        {
                            id: "call-1",
                            name: "getExpenses",
                            args: { month: "2026-11" },
                        },
                    ],
                },
                {
                    role: "tool",
                    results: [
                        {
                            toolCallId: "call-1",
                            name: "getExpenses",
                            result: { totalAmount: 42 },
                        },
                    ],
                },
            ],
            onTextDelta: (d) => deltas.push(d),
        });

        expect(deltas).toEqual(["Checking ", "now."]);
        expect(result.text).toBe("Checking now.");
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0]).toMatchObject({
            name: "getExpenses",
            args: { month: "2026-11" },
        });

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toContain(
            `/models/${DEFAULT_GEMINI_MODEL}:streamGenerateContent?alt=sse`,
        );
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        expect(body.tools).toEqual([
            {
                functionDeclarations: [
                    {
                        name: "getExpenses",
                        description: "List expenses for a month.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                month: {
                                    type: "STRING",
                                    description: "YYYY-MM",
                                },
                                limit: {
                                    type: "INTEGER",
                                    description: "Max items",
                                },
                            },
                            required: ["month"],
                        },
                    },
                ],
            },
        ]);
        expect(body.contents).toEqual([
            { role: "user", parts: [{ text: "What did I spend?" }] },
            {
                role: "model",
                parts: [
                    {
                        functionCall: {
                            name: "getExpenses",
                            args: { month: "2026-11" },
                        },
                    },
                ],
            },
            {
                role: "user",
                parts: [
                    {
                        functionResponse: {
                            name: "getExpenses",
                            response: { totalAmount: 42 },
                        },
                    },
                ],
            },
        ]);
    });

    it("Anthropic adapter sends required headers, parses SSE text & input_json_delta, and formats tool_result", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(
            new Response(
                makeSseStream([
                    `event: content_block_start\ndata: ${JSON.stringify({
                        type: "content_block_start",
                        index: 0,
                        content_block: { type: "text", text: "" },
                    })}\n\n`,
                    `event: content_block_delta\ndata: ${JSON.stringify({
                        type: "content_block_delta",
                        index: 0,
                        delta: { type: "text_delta", text: "Let me check. " },
                    })}\n\n`,
                    `event: content_block_start\ndata: ${JSON.stringify({
                        type: "content_block_start",
                        index: 1,
                        content_block: {
                            type: "tool_use",
                            id: "toolu_123",
                            name: "getExpenses",
                            input: {},
                        },
                    })}\n\n`,
                    `event: content_block_delta\ndata: ${JSON.stringify({
                        type: "content_block_delta",
                        index: 1,
                        delta: {
                            type: "input_json_delta",
                            partial_json: '{"month":',
                        },
                    })}\n\n`,
                    `event: content_block_delta\ndata: ${JSON.stringify({
                        type: "content_block_delta",
                        index: 1,
                        delta: {
                            type: "input_json_delta",
                            partial_json: '"2026-11","limit":10}',
                        },
                    })}\n\n`,
                    `event: content_block_stop\ndata: ${JSON.stringify({
                        type: "content_block_stop",
                        index: 1,
                    })}\n\n`,
                ]),
                { status: 200 },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        const deltas: string[] = [];
        const result = await streamAiTurn({
            provider: "anthropic",
            apiKey: "sk-ant-test",
            model: "claude-sonnet-4-5-20250929",
            systemInstruction: "System prompt",
            tools: SAMPLE_TOOLS,
            messages: [
                { role: "user", text: "Expenses?" },
                {
                    role: "assistant",
                    toolCalls: [
                        {
                            id: "toolu_prev",
                            name: "getExpenses",
                            args: { month: "2026-10" },
                        },
                    ],
                },
                {
                    role: "tool",
                    results: [
                        {
                            toolCallId: "toolu_prev",
                            name: "getExpenses",
                            result: { totalAmount: 100 },
                        },
                    ],
                },
            ],
            onTextDelta: (d) => deltas.push(d),
        });

        expect(deltas).toEqual(["Let me check. "]);
        expect(result.text).toBe("Let me check. ");
        expect(result.toolCalls).toEqual([
            {
                id: "toolu_123",
                name: "getExpenses",
                args: { month: "2026-11", limit: 10 },
            },
        ]);

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(ANTHROPIC_API_ENDPOINT);
        expect(init.headers).toMatchObject({
            "x-api-key": "sk-ant-test",
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
        });
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        expect(body.max_tokens).toBe(1024);
        expect(body.system).toBe("System prompt");
        expect(body.messages).toEqual([
            { role: "user", content: "Expenses?" },
            {
                role: "assistant",
                content: [
                    {
                        type: "tool_use",
                        id: "toolu_prev",
                        name: "getExpenses",
                        input: { month: "2026-10" },
                    },
                ],
            },
            {
                role: "user",
                content: [
                    {
                        type: "tool_result",
                        tool_use_id: "toolu_prev",
                        content: JSON.stringify({ totalAmount: 100 }),
                    },
                ],
            },
        ]);
    });

    it("OpenAI and OpenRouter adapters accumulate indexed tool_calls and send provider headers", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(
                    makeSseStream([
                        `data: ${JSON.stringify({
                            choices: [{ delta: { content: "Hi " } }],
                        })}\n\n`,
                        `data: ${JSON.stringify({
                            choices: [
                                {
                                    delta: {
                                        tool_calls: [
                                            {
                                                index: 0,
                                                id: "call_abc",
                                                function: {
                                                    name: "getExpenses",
                                                    arguments: '{"month":',
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        })}\n\n`,
                        `data: ${JSON.stringify({
                            choices: [
                                {
                                    delta: {
                                        tool_calls: [
                                            {
                                                index: 0,
                                                function: {
                                                    arguments: '"2026-11"}',
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        })}\n\n`,
                        "data: [DONE]\n\n",
                    ]),
                    { status: 200 },
                ),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ id: "ok" }), { status: 200 }),
            );
        vi.stubGlobal("fetch", fetchMock);

        const openAiResult = await streamAiTurn({
            provider: "openai",
            apiKey: "sk-openai",
            model: "gpt-4o-mini",
            systemInstruction: "Sys",
            tools: SAMPLE_TOOLS,
            messages: [
                { role: "user", text: "Spend?" },
                {
                    role: "tool",
                    results: [
                        {
                            toolCallId: "call_0",
                            name: "getExpenses",
                            result: { totalAmount: 5 },
                        },
                    ],
                },
            ],
        });

        expect(openAiResult.text).toBe("Hi ");
        expect(openAiResult.toolCalls).toEqual([
            {
                id: "call_abc",
                name: "getExpenses",
                args: { month: "2026-11" },
            },
        ]);

        const [openAiUrl, openAiInit] = fetchMock.mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(openAiUrl).toBe(OPENAI_API_ENDPOINT);
        expect(openAiInit.headers).toMatchObject({
            Authorization: "Bearer sk-openai",
        });
        const openAiBody = JSON.parse(openAiInit.body as string) as {
            messages: unknown[];
        };
        expect(openAiBody.messages[0]).toEqual({
            role: "system",
            content: "Sys",
        });
        expect(openAiBody.messages[2]).toEqual({
            role: "tool",
            tool_call_id: "call_0",
            content: JSON.stringify({ totalAmount: 5 }),
        });

        const orTest = await testAiConnection(
            "openrouter",
            "sk-or-v1-test",
            "anthropic/claude-sonnet-4.5",
        );
        expect(orTest).toEqual({ ok: true });
        const [orUrl, orInit] = fetchMock.mock.calls[1] as [
            string,
            RequestInit,
        ];
        expect(orUrl).toBe(OPENROUTER_API_ENDPOINT);
        expect(orInit.headers).toMatchObject({
            Authorization: "Bearer sk-or-v1-test",
            "X-Title": "Budget Bubby",
        });
        expect(
            (orInit.headers as Record<string, string>)["HTTP-Referer"],
        ).toBeTruthy();
    });

    it("surfaces API errors cleanly for testConnection and streamTurn", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        error: { message: "Invalid Anthropic key." },
                    }),
                    { status: 401 },
                ),
            )
            .mockResolvedValueOnce(
                new Response("Too many requests", { status: 429 }),
            );
        vi.stubGlobal("fetch", fetchMock);

        const failTest = await testAiConnection("anthropic", "sk-ant-bad");
        expect(failTest).toEqual({
            ok: false,
            error: "Invalid Anthropic key.",
        });

        await expect(
            streamAiTurn({
                provider: "openai",
                apiKey: "sk-test",
                messages: [{ role: "user", text: "Hi" }],
            }),
        ).rejects.toThrow(/Rate limit reached/i);

        await expect(
            streamAiTurn({
                provider: "openrouter",
                apiKey: "",
                messages: [{ role: "user", text: "Hi" }],
            }),
        ).rejects.toThrow(/not configured/i);
    });
});
