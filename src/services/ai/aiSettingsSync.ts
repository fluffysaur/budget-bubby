/**
 * Syncs the Gemini BYOK key and model between the localStorage cache (read
 * synchronously by the AI client) and the owner-only member_ai_settings row.
 * Never logs the key.
 */

import type { FinanceService } from "../financeService";
import {
    AI_CONFIG_CHANGED_EVENT,
    getProviderApiKey,
    getProviderModelStorageKey,
    setProviderApiKey,
    setProviderModel,
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

function readLocalGeminiSettings(): { key: string; model: string } {
    return {
        key: getProviderApiKey("gemini"),
        model:
            getStorage()
                ?.getItem(getProviderModelStorageKey("gemini"))
                ?.trim() ?? "",
    };
}

/** Pushes the local Gemini key and model to the member's remote row. */
export async function pushGeminiSettings(
    store: AiSettingsStore,
): Promise<boolean> {
    const { key, model } = readLocalGeminiSettings();
    try {
        await store.saveAiSettings({
            gemini_api_key: key || null,
            gemini_model: model || null,
        });
        getStorage()?.setItem(AI_SETTINGS_SYNCED_STORAGE_KEY, "1");
        return true;
    } catch {
        return false;
    }
}

/**
 * Hydrates the local cache from the remote row on session load.
 * - First run on a device: any local value is migrated up where the remote is
 *   empty, and remote values win where present.
 * - After the first successful sync the remote is the source of truth, so a
 *   key cleared on another device is cleared here too.
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

    const local = readLocalGeminiSettings();
    const alreadySynced =
        storage.getItem(AI_SETTINGS_SYNCED_STORAGE_KEY) === "1";
    const remoteKey = remote.gemini_api_key?.trim() ?? "";
    const remoteModel = remote.gemini_model?.trim() ?? "";

    const nextKey = alreadySynced ? remoteKey : remoteKey || local.key;
    const nextModel = alreadySynced ? remoteModel : remoteModel || local.model;

    let localChanged = false;
    if (nextKey !== local.key) {
        setProviderApiKey("gemini", nextKey);
        localChanged = true;
    }
    if (nextModel !== local.model) {
        if (nextModel) {
            setProviderModel("gemini", nextModel);
        } else {
            storage.removeItem(getProviderModelStorageKey("gemini"));
        }
        localChanged = true;
    }

    if (nextKey !== remoteKey || nextModel !== remoteModel) {
        try {
            await store.saveAiSettings({
                gemini_api_key: nextKey || null,
                gemini_model: nextModel || null,
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
