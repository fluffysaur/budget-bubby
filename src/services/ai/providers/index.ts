/**
 * Provider-agnostic AI registry, per-provider localStorage persistence,
 * and legacy Gemini storage migration.
 */

import {
    DEFAULT_GEMINI_MODEL,
    geminiAdapter,
    normalizeGeminiModel,
} from "./gemini";
import { DEFAULT_ANTHROPIC_MODEL, anthropicAdapter } from "./anthropic";
import {
    DEFAULT_OPENAI_MODEL,
    DEFAULT_OPENROUTER_MODEL,
    openaiAdapter,
    openrouterAdapter,
} from "./openaiCompatible";
import type {
    AiProviderAdapter,
    AiProviderId,
    AiProviderMeta,
    AiReasoningEffort,
    AiTurnResult,
    StreamTurnOptions,
    TestConnectionResult,
} from "./types";

export const AI_CONFIG_CHANGED_EVENT = "bubby:ai-config-changed";

export const AI_ACTIVE_PROVIDER_STORAGE_KEY = "budget_bubby_ai_provider";
export const AI_REASONING_EFFORT_STORAGE_KEY =
    "budget_bubby_ai_reasoning_effort";
export const DEFAULT_REASONING_EFFORT: AiReasoningEffort = "low";
export const LEGACY_GEMINI_API_KEY_STORAGE_KEY = "budget_bubby_gemini_api_key";
export const LEGACY_GEMINI_MODEL_STORAGE_KEY = "budget_bubby_gemini_model";

export function getProviderKeyStorageKey(provider: AiProviderId): string {
    return `budget_bubby_ai_key_${provider}`;
}

export function getProviderModelStorageKey(provider: AiProviderId): string {
    return `budget_bubby_ai_model_${provider}`;
}

export const AI_PROVIDER_META: Record<AiProviderId, AiProviderMeta> = {
    gemini: {
        id: "gemini",
        label: "Gemini",
        keyLabel: "Gemini API Key",
        placeholder: "AIza...",
        defaultModel: DEFAULT_GEMINI_MODEL,
        curatedModels: [
            {
                value: "gemini-3.8-flash",
                label: "Gemini 3.8 Flash (Recommended)",
            },
            { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
        ],
    },
    anthropic: {
        id: "anthropic",
        label: "Anthropic (Claude)",
        keyLabel: "Anthropic API Key",
        placeholder: "sk-ant-...",
        defaultModel: DEFAULT_ANTHROPIC_MODEL,
        curatedModels: [
            {
                value: "claude-sonnet-4-5-20250929",
                label: "Claude Sonnet 4.5 (Recommended)",
            },
            {
                value: "claude-haiku-4-5-20251001",
                label: "Claude Haiku 4.5",
            },
            {
                value: "claude-opus-4-1-20250805",
                label: "Claude Opus 4.1",
            },
        ],
    },
    openai: {
        id: "openai",
        label: "OpenAI",
        keyLabel: "OpenAI API Key",
        placeholder: "sk-...",
        defaultModel: DEFAULT_OPENAI_MODEL,
        curatedModels: [
            { value: "gpt-4o-mini", label: "GPT-4o mini (Recommended)" },
            { value: "gpt-4o", label: "GPT-4o" },
            { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
            { value: "gpt-4.1", label: "GPT-4.1" },
        ],
    },
    openrouter: {
        id: "openrouter",
        label: "OpenRouter",
        keyLabel: "OpenRouter API Key",
        placeholder: "sk-or-v1-...",
        defaultModel: DEFAULT_OPENROUTER_MODEL,
        curatedModels: [
            {
                value: "anthropic/claude-sonnet-4.5",
                label: "Claude Sonnet 4.5 (Recommended)",
            },
            { value: "openai/gpt-4o-mini", label: "GPT-4o mini" },
            { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
            {
                value: "meta-llama/llama-3.3-70b-instruct",
                label: "Llama 3.3 70B Instruct",
            },
        ],
    },
};

export const AI_PROVIDER_LIST: readonly AiProviderMeta[] = [
    AI_PROVIDER_META.gemini,
    AI_PROVIDER_META.anthropic,
    AI_PROVIDER_META.openai,
    AI_PROVIDER_META.openrouter,
];

const ADAPTERS: Record<AiProviderId, AiProviderAdapter> = {
    gemini: geminiAdapter,
    anthropic: anthropicAdapter,
    openai: openaiAdapter,
    openrouter: openrouterAdapter,
};

function isValidProviderId(value: string | null): value is AiProviderId {
    return (
        value === "gemini" ||
        value === "anthropic" ||
        value === "openai" ||
        value === "openrouter"
    );
}

function isValidReasoningEffort(
    value: string | null,
): value is AiReasoningEffort {
    return value === "low" || value === "medium" || value === "high";
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

/**
 * Migrates legacy `budget_bubby_gemini_api_key` and `budget_bubby_gemini_model`
 * into per-provider storage under `"gemini"` as the active provider.
 * Idempotent: safe to call on every read.
 */
export function migrateLegacyGeminiStorage(storage: Storage | null): void {
    if (!storage) return;
    const legacyKey = storage.getItem(LEGACY_GEMINI_API_KEY_STORAGE_KEY)?.trim();
    const legacyModel = storage.getItem(LEGACY_GEMINI_MODEL_STORAGE_KEY)?.trim();

    if (!legacyKey && !legacyModel) return;

    const geminiKeySlot = getProviderKeyStorageKey("gemini");
    const geminiModelSlot = getProviderModelStorageKey("gemini");

    if (legacyKey && !storage.getItem(geminiKeySlot)) {
        storage.setItem(geminiKeySlot, legacyKey);
    }
    if (legacyModel && !storage.getItem(geminiModelSlot)) {
        storage.setItem(geminiModelSlot, normalizeGeminiModel(legacyModel));
    }
    if (!storage.getItem(AI_ACTIVE_PROVIDER_STORAGE_KEY)) {
        storage.setItem(AI_ACTIVE_PROVIDER_STORAGE_KEY, "gemini");
    }

    storage.removeItem(LEGACY_GEMINI_API_KEY_STORAGE_KEY);
    storage.removeItem(LEGACY_GEMINI_MODEL_STORAGE_KEY);
}

export function getAiAdapter(provider: AiProviderId): AiProviderAdapter {
    return ADAPTERS[provider];
}

export function getActiveAiProvider(): AiProviderId {
    const storage = getSafeStorage();
    migrateLegacyGeminiStorage(storage);
    const saved = storage?.getItem(AI_ACTIVE_PROVIDER_STORAGE_KEY) ?? null;
    return isValidProviderId(saved) ? saved : "gemini";
}

export function setActiveAiProvider(provider: AiProviderId): void {
    const storage = getSafeStorage();
    if (!storage) return;
    migrateLegacyGeminiStorage(storage);
    storage.setItem(AI_ACTIVE_PROVIDER_STORAGE_KEY, provider);
}

export function getProviderApiKey(provider: AiProviderId): string {
    const storage = getSafeStorage();
    migrateLegacyGeminiStorage(storage);
    return storage?.getItem(getProviderKeyStorageKey(provider))?.trim() ?? "";
}

export function setProviderApiKey(
    provider: AiProviderId,
    apiKey: string,
): void {
    const storage = getSafeStorage();
    if (!storage) return;
    migrateLegacyGeminiStorage(storage);
    const key = getProviderKeyStorageKey(provider);
    const trimmed = apiKey.trim();
    if (!trimmed) {
        storage.removeItem(key);
    } else {
        storage.setItem(key, trimmed);
    }
}

export function clearProviderApiKey(provider: AiProviderId): void {
    const storage = getSafeStorage();
    if (!storage) return;
    migrateLegacyGeminiStorage(storage);
    storage.removeItem(getProviderKeyStorageKey(provider));
}

export function getProviderModel(provider: AiProviderId): string {
    const storage = getSafeStorage();
    migrateLegacyGeminiStorage(storage);
    const saved =
        storage?.getItem(getProviderModelStorageKey(provider))?.trim() ?? "";
    if (provider === "gemini") {
        return normalizeGeminiModel(saved);
    }
    return saved || AI_PROVIDER_META[provider].defaultModel;
}

export function setProviderModel(provider: AiProviderId, model: string): void {
    const storage = getSafeStorage();
    if (!storage) return;
    migrateLegacyGeminiStorage(storage);
    const trimmed = model.trim();
    if (trimmed) {
        storage.setItem(getProviderModelStorageKey(provider), trimmed);
    }
}

export function getAiReasoningEffort(): AiReasoningEffort {
    const storage = getSafeStorage();
    const saved = storage?.getItem(AI_REASONING_EFFORT_STORAGE_KEY) ?? null;
    return isValidReasoningEffort(saved) ? saved : DEFAULT_REASONING_EFFORT;
}

export function setAiReasoningEffort(effort: AiReasoningEffort): void {
    const storage = getSafeStorage();
    if (!storage) return;
    storage.setItem(AI_REASONING_EFFORT_STORAGE_KEY, effort);
}

export function getActiveAiConfig(): {
    provider: AiProviderId;
    apiKey: string;
    model: string;
    reasoningEffort: AiReasoningEffort;
} {
    const provider = getActiveAiProvider();
    return {
        provider,
        apiKey: getProviderApiKey(provider),
        model: getProviderModel(provider),
        reasoningEffort: getAiReasoningEffort(),
    };
}

export function hasActiveAiKey(): boolean {
    const provider = getActiveAiProvider();
    return getProviderApiKey(provider).length > 0;
}

export async function streamAiTurn(
    options: StreamTurnOptions & { provider?: AiProviderId },
): Promise<AiTurnResult> {
    const provider = options.provider ?? getActiveAiProvider();
    return getAiAdapter(provider).streamTurn({
        ...options,
        reasoningEffort: options.reasoningEffort ?? getAiReasoningEffort(),
    });
}

export async function testAiConnection(
    provider: AiProviderId,
    apiKey: string,
    model?: string,
): Promise<TestConnectionResult> {
    return getAiAdapter(provider).testConnection(apiKey, model);
}

export type * from "./types";
