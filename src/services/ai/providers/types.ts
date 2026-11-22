/**
 * Provider-neutral AI types for Bubby AI.
 */

export type AiProviderId = "gemini" | "anthropic" | "openai" | "openrouter";

export interface AiToolCall {
    id: string;
    name: string;
    args: Record<string, unknown>;
}

export interface AiToolResult {
    toolCallId: string;
    name: string;
    result: Record<string, unknown>;
}

export type AiMessage =
    | {
          role: "user";
          text: string;
      }
    | {
          role: "assistant";
          text?: string;
          toolCalls?: AiToolCall[];
      }
    | {
          role: "tool";
          results: AiToolResult[];
      };

export type AiSchemaType =
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "object"
    | "array";

export interface AiSchemaProperty {
    type: AiSchemaType;
    description?: string;
    enum?: string[];
    properties?: Record<string, AiSchemaProperty>;
    items?: AiSchemaProperty;
    required?: string[];
}

export interface AiToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, AiSchemaProperty>;
        required?: string[];
    };
}

export interface AiTurnResult {
    text: string;
    toolCalls: AiToolCall[];
}

export interface TestConnectionResult {
    ok: boolean;
    error?: string;
}

export interface StreamTurnOptions {
    apiKey: string;
    model?: string;
    messages: AiMessage[];
    systemInstruction?: string;
    tools?: AiToolDefinition[];
    signal?: AbortSignal;
    onTextDelta?: (delta: string) => void;
}

export interface AiProviderAdapter {
    id: AiProviderId;
    streamTurn(options: StreamTurnOptions): Promise<AiTurnResult>;
    testConnection(
        apiKey: string,
        model?: string,
    ): Promise<TestConnectionResult>;
}

export interface AiModelOption {
    value: string;
    label: string;
}

export interface AiProviderMeta {
    id: AiProviderId;
    label: string;
    keyLabel: string;
    placeholder: string;
    defaultModel: string;
    curatedModels: readonly AiModelOption[];
}
