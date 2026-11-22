/**
 * Google Gemini REST API client with Bring-Your-Own-Key (BYOK) configuration.
 * Uses native fetch + SSE streaming (zero external SDK dependencies).
 */

export const GEMINI_API_KEY_STORAGE_KEY = "budget_bubby_gemini_api_key";
export const GEMINI_MODEL_STORAGE_KEY = "budget_bubby_gemini_model";
export const AI_CONFIG_CHANGED_EVENT = "bubby:ai-config-changed";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

const RETIRED_GEMINI_MODELS = new Set([
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]);

export const GEMINI_MODEL_OPTIONS = [
    { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash (Recommended)" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

export const GEMINI_API_BASE =
    "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiConfig {
    apiKey: string;
    model: string;
}

export interface GeminiFunctionCall {
    name: string;
    args: Record<string, unknown>;
}

export interface GeminiFunctionResponse {
    name: string;
    response: Record<string, unknown>;
}

export interface GeminiPart {
    text?: string;
    functionCall?: GeminiFunctionCall;
    functionResponse?: GeminiFunctionResponse;
}

export interface GeminiContent {
    role: "user" | "model";
    parts: GeminiPart[];
}

export interface GeminiSchemaProperty {
    type: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "OBJECT" | "ARRAY";
    description?: string;
    enum?: string[];
    properties?: Record<string, GeminiSchemaProperty>;
    required?: string[];
}

export interface GeminiFunctionDeclaration {
    name: string;
    description: string;
    parameters: {
        type: "OBJECT";
        properties: Record<string, GeminiSchemaProperty>;
        required?: string[];
    };
}

export interface GeminiTurnResult {
    text: string;
    functionCalls: GeminiFunctionCall[];
}

export interface TestConnectionResult {
    ok: boolean;
    error?: string;
}

function getSafeStorage(): Storage | null {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            return window.localStorage;
        }
    } catch {
        // Storage unavailable (private mode or restricted context)
    }
    return null;
}

export function getGeminiApiKey(): string {
    const storage = getSafeStorage();
    return storage?.getItem(GEMINI_API_KEY_STORAGE_KEY)?.trim() ?? "";
}

export function setGeminiApiKey(apiKey: string): void {
    const storage = getSafeStorage();
    if (!storage) return;
    const trimmed = apiKey.trim();
    if (!trimmed) {
        storage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    } else {
        storage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
    }
}

export function clearGeminiApiKey(): void {
    const storage = getSafeStorage();
    storage?.removeItem(GEMINI_API_KEY_STORAGE_KEY);
}

export function hasGeminiApiKey(): boolean {
    return getGeminiApiKey().length > 0;
}

export function getGeminiModel(): string {
    const storage = getSafeStorage();
    const saved = storage?.getItem(GEMINI_MODEL_STORAGE_KEY)?.trim();
    if (!saved || RETIRED_GEMINI_MODELS.has(saved)) {
        return DEFAULT_GEMINI_MODEL;
    }
    return saved;
}

export function setGeminiModel(model: string): void {
    const storage = getSafeStorage();
    if (!storage) return;
    const trimmed = model.trim();
    if (trimmed) {
        storage.setItem(GEMINI_MODEL_STORAGE_KEY, trimmed);
    }
}

export function getGeminiConfig(): GeminiConfig {
    return {
        apiKey: getGeminiApiKey(),
        model: getGeminiModel(),
    };
}

/** Extracts a readable error message from a failed Gemini API response. */
async function extractGeminiError(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as {
            error?: { message?: string; status?: string };
        };
        if (body?.error?.message) {
            return body.error.message;
        }
    } catch {
        // Ignore JSON parse errors on non-JSON error bodies
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
        return `Invalid API key or permission denied (${res.status}).`;
    }
    if (res.status === 429) {
        return "Rate limit reached. Please wait a moment and try again.";
    }
    return `Gemini request failed (${res.status}).`;
}

/** Verifies an API key and model by running a tiny generateContent ping. */
export async function testGeminiConnection(
    apiKey: string,
    model: string = getGeminiModel(),
): Promise<TestConnectionResult> {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
        return { ok: false, error: "Enter a Gemini API key first." };
    }

    try {
        const res = await fetch(
            `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`,
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
}

interface RawGeminiChunk {
    candidates?: Array<{
        content?: {
            parts?: GeminiPart[];
        };
    }>;
}

function collectPartsFromChunk(
    chunk: RawGeminiChunk,
    onTextDelta?: (delta: string) => void,
): { text: string; functionCalls: GeminiFunctionCall[] } {
    let text = "";
    const functionCalls: GeminiFunctionCall[] = [];
    const parts = chunk.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
        if (typeof part.text === "string" && part.text.length > 0) {
            text += part.text;
            onTextDelta?.(part.text);
        }
        if (part.functionCall && typeof part.functionCall.name === "string") {
            functionCalls.push({
                name: part.functionCall.name,
                args: part.functionCall.args ?? {},
            });
        }
    }
    return { text, functionCalls };
}

export interface StreamGeminiTurnOptions {
    apiKey: string;
    model?: string;
    contents: GeminiContent[];
    systemInstruction?: string;
    tools?: GeminiFunctionDeclaration[];
    signal?: AbortSignal;
    onTextDelta?: (delta: string) => void;
}

/**
 * Streams a single Gemini turn via SSE (`alt=sse`) and returns the accumulated
 * assistant text plus any emitted function calls.
 */
export async function streamGeminiTurn(
    options: StreamGeminiTurnOptions,
): Promise<GeminiTurnResult> {
    const {
        apiKey,
        model = DEFAULT_GEMINI_MODEL,
        contents,
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

    const payload: Record<string, unknown> = {
        contents,
    };
    if (systemInstruction) {
        payload.systemInstruction = {
            parts: [{ text: systemInstruction }],
        };
    }
    if (tools && tools.length > 0) {
        payload.tools = [{ functionDeclarations: tools }];
    }

    const res = await fetch(
        `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
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
    const functionCalls: GeminiFunctionCall[] = [];

    // Support both streaming ReadableStream bodies and fallback full-text bodies
    if (res.body && typeof res.body.getReader === "function") {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const processLine = (rawLine: string) => {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) return;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr || jsonStr === "[DONE]") return;
            try {
                const parsed = JSON.parse(jsonStr) as RawGeminiChunk;
                const extracted = collectPartsFromChunk(parsed, onTextDelta);
                fullText += extracted.text;
                functionCalls.push(...extracted.functionCalls);
            } catch {
                // Skip malformed partial frame
            }
        };

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                processLine(line);
            }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
            for (const line of buffer.split(/\r?\n/)) {
                processLine(line);
            }
        }
    } else {
        const rawText = await res.text();
        for (const line of rawText.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
                const parsed = JSON.parse(jsonStr) as RawGeminiChunk;
                const extracted = collectPartsFromChunk(parsed, onTextDelta);
                fullText += extracted.text;
                functionCalls.push(...extracted.functionCalls);
            } catch {
                // Skip malformed frame
            }
        }
    }

    return { text: fullText, functionCalls };
}
