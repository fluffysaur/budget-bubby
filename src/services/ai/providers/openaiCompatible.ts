/**
 * OpenAI-compatible Chat Completions SSE adapter.
 * Used for both OpenAI and OpenRouter.
 */

import { readSseStream } from "./sse";
import type {
    AiMessage,
    AiProviderAdapter,
    AiProviderId,
    AiToolCall,
    AiToolDefinition,
    AiTurnResult,
    StreamTurnOptions,
    TestConnectionResult,
} from "./types";

export const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export const OPENROUTER_API_ENDPOINT =
    "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";

interface OpenAiCompatibleConfig {
    id: Extract<AiProviderId, "openai" | "openrouter">;
    label: string;
    endpoint: string;
    defaultModel: string;
    getExtraHeaders?: () => Record<string, string>;
}

type OpenAiChatMessage =
    | { role: "system"; content: string }
    | { role: "user"; content: string }
    | {
          role: "assistant";
          content: string | null;
          tool_calls?: Array<{
              id: string;
              type: "function";
              function: {
                  name: string;
                  arguments: string;
              };
          }>;
      }
    | {
          role: "tool";
          tool_call_id: string;
          content: string;
      };

function toOpenAiMessages(
    messages: AiMessage[],
    systemInstruction?: string,
): OpenAiChatMessage[] {
    const out: OpenAiChatMessage[] = [];
    if (systemInstruction) {
        out.push({ role: "system", content: systemInstruction });
    }

    for (const msg of messages) {
        if (msg.role === "user") {
            out.push({ role: "user", content: msg.text });
        } else if (msg.role === "assistant") {
            const toolCalls =
                msg.toolCalls && msg.toolCalls.length > 0
                    ? msg.toolCalls.map((tc) => ({
                          id: tc.id,
                          type: "function" as const,
                          function: {
                              name: tc.name,
                              arguments: JSON.stringify(tc.args),
                          },
                      }))
                    : undefined;
            out.push({
                role: "assistant",
                content: msg.text ?? null,
                ...(toolCalls ? { tool_calls: toolCalls } : {}),
            });
        } else if (msg.role === "tool") {
            for (const r of msg.results) {
                out.push({
                    role: "tool",
                    tool_call_id: r.toolCallId,
                    content: JSON.stringify(r.result),
                });
            }
        }
    }

    return out;
}

function toOpenAiTools(tools: AiToolDefinition[]) {
    return tools.map((tool) => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        },
    }));
}

async function extractOpenAiError(
    res: Response,
    label: string,
): Promise<string> {
    try {
        const body = (await res.json()) as {
            error?: { message?: string };
        };
        if (body?.error?.message) {
            return body.error.message;
        }
    } catch {
        // Ignore non-JSON error bodies
    }
    if (res.status === 401 || res.status === 403) {
        return `Invalid API key or permission denied (${res.status}).`;
    }
    if (res.status === 429) {
        return "Rate limit reached. Please wait a moment and try again.";
    }
    return `${label} request failed (${res.status}).`;
}

interface RawOpenAiChunk {
    choices?: Array<{
        delta?: {
            content?: string | null;
            tool_calls?: Array<{
                index?: number;
                id?: string;
                function?: {
                    name?: string;
                    arguments?: string;
                };
            }>;
        };
    }>;
}

export function createOpenAiCompatibleAdapter(
    config: OpenAiCompatibleConfig,
): AiProviderAdapter {
    const buildHeaders = (apiKey: string): Record<string, string> => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(config.getExtraHeaders ? config.getExtraHeaders() : {}),
    });

    return {
        id: config.id,

        async testConnection(
            apiKey: string,
            model: string = config.defaultModel,
        ): Promise<TestConnectionResult> {
            const trimmedKey = apiKey.trim();
            if (!trimmedKey) {
                return {
                    ok: false,
                    error: `Enter a ${config.label} API key first.`,
                };
            }
            const effectiveModel = model.trim() || config.defaultModel;

            try {
                const res = await fetch(config.endpoint, {
                    method: "POST",
                    headers: buildHeaders(trimmedKey),
                    body: JSON.stringify({
                        model: effectiveModel,
                        max_tokens: 16,
                        messages: [{ role: "user", content: "Reply with OK." }],
                    }),
                });

                if (!res.ok) {
                    return {
                        ok: false,
                        error: await extractOpenAiError(res, config.label),
                    };
                }
                return { ok: true };
            } catch (err) {
                return {
                    ok: false,
                    error:
                        err instanceof Error
                            ? err.message
                            : `Network error contacting ${config.label}.`,
                };
            }
        },

        async streamTurn(options: StreamTurnOptions): Promise<AiTurnResult> {
            const {
                apiKey,
                model = config.defaultModel,
                messages,
                systemInstruction,
                tools,
                signal,
                onTextDelta,
            } = options;

            const trimmedKey = apiKey.trim();
            if (!trimmedKey) {
                throw new Error(
                    `${config.label} API key is not configured. Add your key in Settings.`,
                );
            }

            const effectiveModel = model.trim() || config.defaultModel;
            const payload: Record<string, unknown> = {
                model: effectiveModel,
                stream: true,
                messages: toOpenAiMessages(messages, systemInstruction),
            };
            if (tools && tools.length > 0) {
                payload.tools = toOpenAiTools(tools);
            }

            const res = await fetch(config.endpoint, {
                method: "POST",
                headers: buildHeaders(trimmedKey),
                body: JSON.stringify(payload),
                signal,
            });

            if (!res.ok) {
                throw new Error(await extractOpenAiError(res, config.label));
            }

            let fullText = "";
            const toolCallAcc = new Map<
                number,
                { id: string; name: string; argumentsText: string }
            >();

            await readSseStream(res, ({ data }) => {
                try {
                    const parsed = JSON.parse(data) as RawOpenAiChunk;
                    const delta = parsed.choices?.[0]?.delta;
                    if (!delta) return;

                    if (
                        typeof delta.content === "string" &&
                        delta.content.length > 0
                    ) {
                        fullText += delta.content;
                        onTextDelta?.(delta.content);
                    }

                    if (Array.isArray(delta.tool_calls)) {
                        for (const tc of delta.tool_calls) {
                            const idx = tc.index ?? 0;
                            const existing = toolCallAcc.get(idx) ?? {
                                id: tc.id ?? `call_${idx}`,
                                name: "",
                                argumentsText: "",
                            };
                            if (tc.id) {
                                existing.id = tc.id;
                            }
                            if (tc.function?.name) {
                                existing.name += tc.function.name;
                            }
                            if (typeof tc.function?.arguments === "string") {
                                existing.argumentsText += tc.function.arguments;
                            }
                            toolCallAcc.set(idx, existing);
                        }
                    }
                } catch {
                    // Skip malformed partial frame
                }
            });

            const toolCalls: AiToolCall[] = [];
            for (const idx of Array.from(toolCallAcc.keys()).sort(
                (a, b) => a - b,
            )) {
                const entry = toolCallAcc.get(idx);
                if (!entry || !entry.name) continue;
                let args: Record<string, unknown> = {};
                const rawArgs = entry.argumentsText.trim();
                if (rawArgs) {
                    try {
                        const parsed = JSON.parse(rawArgs) as unknown;
                        if (
                            parsed &&
                            typeof parsed === "object" &&
                            !Array.isArray(parsed)
                        ) {
                            args = parsed as Record<string, unknown>;
                        }
                    } catch {
                        // Fallback to empty args on malformed JSON
                    }
                }
                toolCalls.push({
                    id: entry.id,
                    name: entry.name,
                    args,
                });
            }

            return { text: fullText, toolCalls };
        },
    };
}

export const openaiAdapter = createOpenAiCompatibleAdapter({
    id: "openai",
    label: "OpenAI",
    endpoint: OPENAI_API_ENDPOINT,
    defaultModel: DEFAULT_OPENAI_MODEL,
});

export const openrouterAdapter = createOpenAiCompatibleAdapter({
    id: "openrouter",
    label: "OpenRouter",
    endpoint: OPENROUTER_API_ENDPOINT,
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    getExtraHeaders: () => ({
        "HTTP-Referer":
            typeof window !== "undefined" && window.location?.origin
                ? window.location.origin
                : "https://budget-bubby.app",
        "X-Title": "Budget Bubby",
    }),
});
