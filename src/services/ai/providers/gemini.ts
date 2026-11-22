/**
 * Google Gemini REST/SSE adapter (native fetch, zero external SDK).
 */

import { generateUuid } from "../../../lib/uuid";
import { readSseStream } from "./sse";
import type {
    AiMessage,
    AiProviderAdapter,
    AiSchemaProperty,
    AiToolCall,
    AiToolDefinition,
    AiTurnResult,
    StreamTurnOptions,
    TestConnectionResult,
} from "./types";

export const GEMINI_API_BASE =
    "https://generativelanguage.googleapis.com/v1beta";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export const RETIRED_GEMINI_MODELS = new Set([
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]);

export function normalizeGeminiModel(model?: string): string {
    const trimmed = model?.trim();
    if (!trimmed || RETIRED_GEMINI_MODELS.has(trimmed)) {
        return DEFAULT_GEMINI_MODEL;
    }
    return trimmed;
}

interface GeminiSchemaProperty {
    type: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "OBJECT" | "ARRAY";
    description?: string;
    enum?: string[];
    properties?: Record<string, GeminiSchemaProperty>;
    items?: GeminiSchemaProperty;
    required?: string[];
}

function toGeminiSchema(prop: AiSchemaProperty): GeminiSchemaProperty {
    const mapped: GeminiSchemaProperty = {
        type: prop.type.toUpperCase() as GeminiSchemaProperty["type"],
    };
    if (prop.description !== undefined) mapped.description = prop.description;
    if (prop.enum !== undefined) mapped.enum = prop.enum;
    if (prop.required !== undefined) mapped.required = prop.required;
    if (prop.items !== undefined) mapped.items = toGeminiSchema(prop.items);
    if (prop.properties !== undefined) {
        mapped.properties = Object.fromEntries(
            Object.entries(prop.properties).map(([k, v]) => [
                k,
                toGeminiSchema(v),
            ]),
        );
    }
    return mapped;
}

function toGeminiFunctionDeclarations(tools: AiToolDefinition[]) {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
            type: "OBJECT" as const,
            properties: Object.fromEntries(
                Object.entries(tool.parameters.properties).map(([k, v]) => [
                    k,
                    toGeminiSchema(v),
                ]),
            ),
            ...(tool.parameters.required
                ? { required: tool.parameters.required }
                : {}),
        },
    }));
}

interface GeminiPart {
    text?: string;
    functionCall?: {
        name: string;
        args?: Record<string, unknown>;
    };
    functionResponse?: {
        name: string;
        response: Record<string, unknown>;
    };
}

interface GeminiContent {
    role: "user" | "model";
    parts: GeminiPart[];
}

function toGeminiContents(messages: AiMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
        if (msg.role === "user") {
            contents.push({
                role: "user",
                parts: [{ text: msg.text }],
            });
        } else if (msg.role === "assistant") {
            const parts: GeminiPart[] = [];
            if (msg.text) {
                parts.push({ text: msg.text });
            }
            if (msg.toolCalls) {
                for (const tc of msg.toolCalls) {
                    parts.push({
                        functionCall: {
                            name: tc.name,
                            args: tc.args,
                        },
                    });
                }
            }
            if (parts.length > 0) {
                contents.push({ role: "model", parts });
            }
        } else if (msg.role === "tool") {
            const parts: GeminiPart[] = msg.results.map((r) => ({
                functionResponse: {
                    name: r.name,
                    response: r.result,
                },
            }));
            if (parts.length > 0) {
                contents.push({ role: "user", parts });
            }
        }
    }

    return contents;
}

async function extractGeminiError(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as {
            error?: { message?: string; status?: string };
        };
        if (body?.error?.message) {
            return body.error.message;
        }
    } catch {
        // Ignore non-JSON error bodies
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
        return `Invalid API key or permission denied (${res.status}).`;
    }
    if (res.status === 429) {
        return "Rate limit reached. Please wait a moment and try again.";
    }
    return `Gemini request failed (${res.status}).`;
}

interface RawGeminiChunk {
    candidates?: Array<{
        content?: {
            parts?: GeminiPart[];
        };
    }>;
}

export const geminiAdapter: AiProviderAdapter = {
    id: "gemini",

    async testConnection(
        apiKey: string,
        model: string = DEFAULT_GEMINI_MODEL,
    ): Promise<TestConnectionResult> {
        const trimmedKey = apiKey.trim();
        if (!trimmedKey) {
            return { ok: false, error: "Enter a Gemini API key first." };
        }
        const effectiveModel = normalizeGeminiModel(model);

        try {
            const res = await fetch(
                `${GEMINI_API_BASE}/models/${encodeURIComponent(effectiveModel)}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": trimmedKey,
                    },
                    body: JSON.stringify({
                        contents: [
                            { role: "user", parts: [{ text: "Reply with OK." }] },
                        ],
                    }),
                },
            );

            if (!res.ok) {
                return { ok: false, error: await extractGeminiError(res) };
            }
            return { ok: true };
        } catch (err) {
            return {
                ok: false,
                error:
                    err instanceof Error
                        ? err.message
                        : "Network error contacting Gemini.",
            };
        }
    },

    async streamTurn(options: StreamTurnOptions): Promise<AiTurnResult> {
        const {
            apiKey,
            model,
            messages,
            systemInstruction,
            tools,
            signal,
            onTextDelta,
        } = options;

        const trimmedKey = apiKey.trim();
        if (!trimmedKey) {
            throw new Error(
                "Gemini API key is not configured. Add your key in Settings.",
            );
        }

        const effectiveModel = normalizeGeminiModel(model);
        const payload: Record<string, unknown> = {
            contents: toGeminiContents(messages),
        };
        if (systemInstruction) {
            payload.systemInstruction = {
                parts: [{ text: systemInstruction }],
            };
        }
        if (tools && tools.length > 0) {
            payload.tools = [
                { functionDeclarations: toGeminiFunctionDeclarations(tools) },
            ];
        }

        const res = await fetch(
            `${GEMINI_API_BASE}/models/${encodeURIComponent(effectiveModel)}:streamGenerateContent?alt=sse`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": trimmedKey,
                },
                body: JSON.stringify(payload),
                signal,
            },
        );

        if (!res.ok) {
            throw new Error(await extractGeminiError(res));
        }

        let fullText = "";
        const toolCalls: AiToolCall[] = [];

        await readSseStream(res, ({ data }) => {
            try {
                const parsed = JSON.parse(data) as RawGeminiChunk;
                const parts = parsed.candidates?.[0]?.content?.parts ?? [];
                for (const part of parts) {
                    if (typeof part.text === "string" && part.text.length > 0) {
                        fullText += part.text;
                        onTextDelta?.(part.text);
                    }
                    if (
                        part.functionCall &&
                        typeof part.functionCall.name === "string"
                    ) {
                        toolCalls.push({
                            id: generateUuid(),
                            name: part.functionCall.name,
                            args: part.functionCall.args ?? {},
                        });
                    }
                }
            } catch {
                // Skip malformed partial frame
            }
        });

        return { text: fullText, toolCalls };
    },
};
