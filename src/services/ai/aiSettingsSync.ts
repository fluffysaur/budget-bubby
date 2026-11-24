/**
 * Syncs Gemini and OpenRouter BYOK keys, models, and active provider between
 * the localStorage cache (read synchronously by the AI client) and the
 * owner-only member_ai_settings row. Never logs keys.
 */

import type { FinanceService } from "../financeService";
import {
    AI_ACTIVE_PROVIDER_STORAGE_KEY,
    AI_CONFIG_CHANGED_EVENT,
    getProviderApiKey,
    getProviderModelStorageKey,
    isValidProviderId,
    setActiveAiProvider,
    setProviderApiKey,
    setProviderModel,
    type AiProviderId,
} from "./providers";

export const AI_SETTINGS_SYNCED_STORAGE_KEY = "budget_bubby_ai_synced";

type AiSettingsStore = Pick<FinanceService, "getAiSettings" | "saveAiSettings">;

function getStorage(): Storage | null {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            return window.localStorage;
        }
    } catch {
        // Storage unavailable
    }
    return null;
}

function readLocalAiSettings(storage: Storage | null): {
    geminiKey: string;
    geminiModel: string;
    openrouterKey: string;
    openrouterModel: string;
    activeProvider: AiProviderId | "";
} {
    const rawProvider =
        storage?.getItem(AI_ACTIVE_PROVIDER_STORAGE_KEY)?.trim() ?? "";
    return {
        geminiKey: getProviderApiKey("gemini"),
        geminiModel:
            storage?.getItem(getProviderModelStorageKey("gemini"))?.trim() ?? "",
        openrouterKey: getProviderApiKey("openrouter"),
        openrouterModel:
            storage
                ?.getItem(getProviderModelStorageKey("openrouter"))
                ?.trim() ?? "",
        activeProvider: isValidProviderId(rawProvider) ? rawProvider : "",
    };
}

function syncModelSlot(
    storage: Storage,
    provider: "gemini" | "openrouter",
    localModel: string,
    nextModel: string,
): boolean {
    if (nextModel === localModel) return false;
    if (nextModel) {
        setProviderModel(provider, nextModel);
    } else {
        storage.removeItem(getProviderModelStorageKey(provider));
    }
    return true;
}

/** Pushes local Gemini, OpenRouter, and active provider settings to the remote row. */
export async function pushAiSettings(store: AiSettingsStore): Promise<boolean> {
    const storage = getStorage();
    const local = readLocalAiSettings(storage);
    try {
        await store.saveAiSettings({
            gemini_api_key: local.geminiKey || null,
            gemini_model: local.geminiModel || null,
            openrouter_api_key: local.openrouterKey || null,
            openrouter_model: local.openrouterModel || null,
            active_provider: local.activeProvider || null,
        });
        storage?.setItem(AI_SETTINGS_SYNCED_STORAGE_KEY, "1");
        return true;
    } catch {
        return false;
    }
}

/** @deprecated Use pushAiSettings instead. Kept for backward compatibility. */
export const pushGeminiSettings = pushAiSettings;

/**
 * Hydrates the local cache from the remote row on session load.
 * - First run on a device: any local value is migrated up where the remote is
 *   empty, and remote values win where present.
 * - After the first successful sync the remote is the source of truth for
 *   keys and models, so a key cleared on another device is cleared here too.
 * - A null remote active_provider never overwrites the local active provider.
 */
export async function hydrateAiSettings(store: AiSettingsStore): Promise<void> {
    const storage = getStorage();
    if (!storage) return;

    let remote;
    try {
        remote = await store.getAiSettings();
    } catch {
        return; // Offline or table missing: keep using the local cache
    }

    const local = readLocalAiSettings(storage);
    const alreadySynced =
        storage.getItem(AI_SETTINGS_SYNCED_STORAGE_KEY) === "1";

    const remoteGeminiKey = remote.gemini_api_key?.trim() ?? "";
    const remoteGeminiModel = remote.gemini_model?.trim() ?? "";
    const remoteOpenrouterKey = remote.openrouter_api_key?.trim() ?? "";
    const remoteOpenrouterModel = remote.openrouter_model?.trim() ?? "";
    const rawRemoteProvider = remote.active_provider?.trim() ?? "";
    const remoteProvider: AiProviderId | "" = isValidProviderId(
        rawRemoteProvider,
    )
        ? rawRemoteProvider
        : "";

    const nextGeminiKey = alreadySynced
        ? remoteGeminiKey
        : remoteGeminiKey || local.geminiKey;
    const nextGeminiModel = alreadySynced
        ? remoteGeminiModel
        : remoteGeminiModel || local.geminiModel;
    const nextOpenrouterKey = alreadySynced
        ? remoteOpenrouterKey
        : remoteOpenrouterKey || local.openrouterKey;
    const nextOpenrouterModel = alreadySynced
        ? remoteOpenrouterModel
        : remoteOpenrouterModel || local.openrouterModel;
    const nextProvider: AiProviderId | "" =
        remoteProvider || (!alreadySynced ? local.activeProvider : "");

    let localChanged = false;
    if (nextGeminiKey !== local.geminiKey) {
        setProviderApiKey("gemini", nextGeminiKey);
        localChanged = true;
    }
    if (
        syncModelSlot(storage, "gemini", local.geminiModel, nextGeminiModel)
    ) {
        localChanged = true;
    }
    if (nextOpenrouterKey !== local.openrouterKey) {
        setProviderApiKey("openrouter", nextOpenrouterKey);
        localChanged = true;
    }
    if (
        syncModelSlot(
            storage,
            "openrouter",
            local.openrouterModel,
            nextOpenrouterModel,
        )
    ) {
        localChanged = true;
    }
    if (nextProvider && nextProvider !== local.activeProvider) {
        setActiveAiProvider(nextProvider);
        localChanged = true;
    }

    const needsUpload =
        nextGeminiKey !== remoteGeminiKey ||
        nextGeminiModel !== remoteGeminiModel ||
        nextOpenrouterKey !== remoteOpenrouterKey ||
        nextOpenrouterModel !== remoteOpenrouterModel ||
        nextProvider !== remoteProvider;

    if (needsUpload) {
        try {
            await store.saveAiSettings({
                gemini_api_key: nextGeminiKey || null,
                gemini_model: nextGeminiModel || null,
                openrouter_api_key: nextOpenrouterKey || null,
                openrouter_model: nextOpenrouterModel || null,
                active_provider: nextProvider || null,
            });
        } catch {
            return; // Retry on next session load
        }
    }

    storage.setItem(AI_SETTINGS_SYNCED_STORAGE_KEY, "1");
    if (localChanged) {
        window.dispatchEvent(new Event(AI_CONFIG_CHANGED_EVENT));
    }
}
