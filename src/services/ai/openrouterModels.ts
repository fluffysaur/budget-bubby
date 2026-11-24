/**
 * Live fetcher for OpenRouter's free, tool-capable models.
 * Falls back to the static curated list when offline or on error.
 */

import { AI_PROVIDER_META, type AiModelOption } from "./providers";

export const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface OpenRouterApiModel {
    id?: unknown;
    name?: unknown;
    pricing?: {
        prompt?: unknown;
        completion?: unknown;
    };
    supported_parameters?: unknown;
}

let cachedModels: AiModelOption[] | null = null;
let cachedAt = 0;

export function clearOpenRouterModelsCache(): void {
    cachedModels = null;
    cachedAt = 0;
}

function isFreeModel(model: OpenRouterApiModel): boolean {
    if (typeof model.id !== "string" || !model.id.trim()) return false;
    if (model.id === "openrouter/free" || model.id.endsWith(":free")) {
        return true;
    }
    return (
        model.pricing?.prompt === "0" && model.pricing?.completion === "0"
    );
}

function supportsTools(model: OpenRouterApiModel): boolean {
    if (!Array.isArray(model.supported_parameters)) return true;
    return model.supported_parameters.includes("tools");
}

export async function fetchOpenRouterFreeModels(): Promise<AiModelOption[]> {
    if (cachedModels && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedModels;
    }

    const fallback = [...AI_PROVIDER_META.openrouter.curatedModels];
    try {
        const response = await fetch(OPENROUTER_MODELS_ENDPOINT);
        if (!response.ok) return fallback;
        const payload = (await response.json()) as {
            data?: OpenRouterApiModel[];
        };
        if (!Array.isArray(payload.data)) return fallback;

        const freeOptions: AiModelOption[] = [];
        for (const item of payload.data) {
            if (!isFreeModel(item) || !supportsTools(item)) continue;
            const id = item.id as string;
            const rawName =
                typeof item.name === "string" && item.name.trim()
                    ? item.name.trim()
                    : id;
            freeOptions.push({
                value: id,
                label:
                    id === "openrouter/free"
                        ? "Free Models Router (Recommended)"
                        : rawName,
            });
        }

        if (freeOptions.length === 0) return fallback;

        freeOptions.sort((a, b) => {
            if (a.value === "openrouter/free") return -1;
            if (b.value === "openrouter/free") return 1;
            return a.label.localeCompare(b.label);
        });

        cachedModels = freeOptions;
        cachedAt = Date.now();
        return freeOptions;
    } catch {
        return fallback;
    }
}
