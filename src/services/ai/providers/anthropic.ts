/**
 * Anthropic Messages API REST/SSE adapter (native fetch, zero external SDK).
 */

import { readSseStream } from "./sse";
import type {
    AiMessage,
    AiProviderAdapter,
    AiToolCall,
    AiToolDefinition,
    AiTurnResult,
    StreamTurnOptions,
    TestConnectionResult,
} from "./types";

export const ANTHROPIC_API_ENDPOINT = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_API_VERSION = "2023-06-01";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";
const ANTHROPIC_MAX_TOKENS = 1024;

function buildAnthropicHeaders(apiKey: string): Record<string, string> {
    return {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
    };
}

type AnthropicContentBlock =
    | { type: "text"; text: string }
    | {
          type: "tool_use";
          id: string;
          name: string;
          input: Record<string, unknown>;
      }
    | { type: "tool_result"; tool_use_id: string; content: string };

interface AnthropicMessage {
    role: "user" | "assistant";
    content: string | AnthropicContentBlock[];
}

function toAnthropicMessages(messages: AiMessage[]): AnthropicMessage[] {
    const out: AnthropicMessage[] = [];

    for (const msg of messages) {
        if (msg.role === "user") {
            out.push({ role: "user", content: msg.text });
        } else if (msg.role === "assistant") {
            const blocks: AnthropicContentBlock[] = [];
            if (msg.text) {
                blocks.push({ type: "text", text: msg.text });
            }
            if (msg.toolCalls) {
                for (const tc of msg.toolCalls) {
                    blocks.push({
                        type: "tool_use",
                        id: tc.id,
                        name: tc.name,
                        input: tc.args,
                    });
                }
            }
            if (blocks.length > 0) {
                out.push({ role: "assistant", content: blocks });
            }
        } else if (msg.role === "tool") {
            const blocks: AnthropicContentBlock[] = msg.results.map((r) => ({
                type: "tool_result",
                tool_use_id: r.toolCallId,
                content: JSON.stringify(r.result),
            }));
            if (blocks.length > 0) {
                out.push({ role: "user", content: blocks });
            }
        }
    }

    return out;
}

function toAnthropicTools(tools: AiToolDefinition[]) {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
    }));
}

async function extractAnthropicError(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as {
            error?: { message?: string; type?: string };
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
    return `Anthropic request failed (${res.status}).`;
}

interface AnthropicStreamPayload {
    type?: string;
    index?: number;
    error?: {
        message?: string;
    };
    content_block?: {
        type?: string;
        id?: string;
        name?: string;
        text?: string;
        input?: Record<string, unknown>;
    };
    delta?: {
        type?: string;
        text?: string;
        partial_json?: string;
    };
}

const ANTHROPIC_THINKING_BUDGETS = {
    medium: 2048,
    high: 4096,
} as const;

function isAnthropicThinkingModel(model: string): boolean {
    return /^claude-(3-7|sonnet-4|opus-4|haiku-4)/i.test(model);
}

export const anthropicAdapter: AiProviderAdapter = {
    id: "anthropic",

    async testConnection(
        apiKey: string,
        model: string = DEFAULT_ANTHROPIC_MODEL,
    ): Promise<TestConnectionResult> {
        const trimmedKey = apiKey.trim();
        if (!trimmedKey) {
            return { ok: false, error: "Enter an Anthropic API key first." };
        }
        const effectiveModel = model.trim() || DEFAULT_ANTHROPIC_MODEL;

        try {
            const res = await fetch(ANTHROPIC_API_ENDPOINT, {
                method: "POST",
                headers: buildAnthropicHeaders(trimmedKey),
                body: JSON.stringify({
                    model: effectiveModel,
                    max_tokens: 16,
                    messages: [{ role: "user", content: "Reply with OK." }],
                }),
            });

            if (!res.ok) {
                return { ok: false, error: await extractAnthropicError(res) };
            }
            return { ok: true };
        } catch (err) {
            return {
                ok: false,
                error:
                    err instanceof Error
                        ? err.message
                        : "Network error contacting Anthropic.",
            };
        }
    },

    async streamTurn(options: StreamTurnOptions): Promise<AiTurnResult> {
        const {
            apiKey,
            model = DEFAULT_ANTHROPIC_MODEL,
            reasoningEffort = "low",
            messages,
            systemInstruction,
            tools,
            signal,
            onTextDelta,
        } = options;

        const trimmedKey = apiKey.trim();
        if (!trimmedKey) {
            throw new Error(
                "Anthropic API key is not configured. Add your key in Settings.",
            );
        }

        const effectiveModel = model.trim() || DEFAULT_ANTHROPIC_MODEL;
        const thinkingBudget =
            reasoningEffort !== "low" &&
            isAnthropicThinkingModel(effectiveModel)
                ? ANTHROPIC_THINKING_BUDGETS[reasoningEffort]
                : undefined;

        const payload: Record<string, unknown> = {
            model: effectiveModel,
            max_tokens: thinkingBudget
                ? thinkingBudget + ANTHROPIC_MAX_TOKENS
                : ANTHROPIC_MAX_TOKENS,
            stream: true,
            messages: toAnthropicMessages(messages),
        };
        if (thinkingBudget) {
            payload.thinking = {
                type: "enabled",
                budget_tokens: thinkingBudget,
            };
        }
        if (systemInstruction) {
            payload.system = systemInstruction;
        }
        if (tools && tools.length > 0) {
            payload.tools = toAnthropicTools(tools);
        }

        const res = await fetch(ANTHROPIC_API_ENDPOINT, {
            method: "POST",
            headers: buildAnthropicHeaders(trimmedKey),
            body: JSON.stringify(payload),
            signal,
        });

        if (!res.ok) {
            throw new Error(await extractAnthropicError(res));
        }

        let fullText = "";
        const pendingToolBlocks = new Map<
            number,
            {
                id: string;
                name: string;
                jsonChunks: string[];
                initialInput?: Record<string, unknown>;
            }
        >();
        const finalizedIndices = new Set<number>();
        const toolCalls: AiToolCall[] = [];

        const finalizeBlock = (index: number) => {
            if (finalizedIndices.has(index)) return;
            const block = pendingToolBlocks.get(index);
            if (!block) return;
            finalizedIndices.add(index);

            let args: Record<string, unknown> = block.initialInput ?? {};
            const rawJson = block.jsonChunks.join("").trim();
            if (rawJson) {
                try {
                    const parsed = JSON.parse(rawJson) as unknown;
                    if (
                        parsed &&
                        typeof parsed === "object" &&
                        !Array.isArray(parsed)
                    ) {
                        args = parsed as Record<string, unknown>;
                    }
                } catch {
                    // Fallback to empty args if partial JSON failed to parse
                }
            }
            toolCalls.push({
                id: block.id,
                name: block.name,
                args,
            });
        };

        await readSseStream(res, ({ event, data }) => {
            let parsed: AnthropicStreamPayload;
            try {
                parsed = JSON.parse(data) as AnthropicStreamPayload;
            } catch {
                // Skip malformed partial frame
                return;
            }

            const eventType = parsed.type ?? event;
            if (eventType === "error" && parsed.error?.message) {
                throw new Error(parsed.error.message);
            }
            const index = parsed.index ?? 0;

            if (eventType === "content_block_start") {
                const cb = parsed.content_block;
                if (cb?.type === "tool_use" && cb.name) {
                    pendingToolBlocks.set(index, {
                        id: cb.id ?? `tool_${index}`,
                        name: cb.name,
                        jsonChunks: [],
                        initialInput:
                            cb.input && Object.keys(cb.input).length > 0
                                ? cb.input
                                : undefined,
                    });
                } else if (
                    cb?.type === "text" &&
                    typeof cb.text === "string" &&
                    cb.text.length > 0
                ) {
                    fullText += cb.text;
                    onTextDelta?.(cb.text);
                }
            } else if (eventType === "content_block_delta") {
                const delta = parsed.delta;
                if (
                    delta?.type === "text_delta" &&
                    typeof delta.text === "string" &&
                    delta.text.length > 0
                ) {
                    fullText += delta.text;
                    onTextDelta?.(delta.text);
                } else if (
                    delta?.type === "input_json_delta" &&
                    typeof delta.partial_json === "string"
                ) {
                    const block = pendingToolBlocks.get(index);
                    if (block) {
                        block.jsonChunks.push(delta.partial_json);
                    }
                }
            } else if (eventType === "content_block_stop") {
                finalizeBlock(index);
            }
        });

        // Finalize any tool blocks that didn't receive an explicit stop event
        for (const index of Array.from(pendingToolBlocks.keys()).sort(
            (a, b) => a - b,
        )) {
            finalizeBlock(index);
        }

        return { text: fullText, toolCalls };
    },
};
