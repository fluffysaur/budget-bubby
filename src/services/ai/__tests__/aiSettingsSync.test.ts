import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
    AI_SETTINGS_SYNCED_STORAGE_KEY,
    hydrateAiSettings,
    pushGeminiSettings,
} from "../aiSettingsSync";
import {
    AI_CONFIG_CHANGED_EVENT,
    getProviderApiKey,
    getProviderModelStorageKey,
    setProviderApiKey,
    setProviderModel,
} from "../providers";
import { SupabaseFinanceServiceImpl } from "../../supabaseFinanceService";
import { mockFinanceService } from "../../mockFinanceService";
import type { MemberAiSettings } from "../../../types/finance";

const USER_ID = "00000000-0000-0000-0000-0000000000aa";

function fakeStore(remote: MemberAiSettings) {
    return {
        getAiSettings: vi.fn().mockResolvedValue(remote),
        saveAiSettings: vi.fn().mockResolvedValue(undefined),
    };
}

function localModel(): string {
    return localStorage.getItem(getProviderModelStorageKey("gemini")) ?? "";
}

function fakeSupabaseClient(row: MemberAiSettings | null) {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select, upsert }));
    const client = {
        from,
        auth: {
            getUser: vi
                .fn()
                .mockResolvedValue({ data: { user: { id: USER_ID } } }),
        },
    };
    return { client: client as unknown as SupabaseClient, from, eq, upsert };
}

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("hydrateAiSettings", () => {
    it("pulls the remote key and model into the local cache", async () => {
        const store = fakeStore({
            gemini_api_key: "remote-key",
            gemini_model: "gemini-pro",
        });
        const changed = vi.fn();
        window.addEventListener(AI_CONFIG_CHANGED_EVENT, changed);

        await hydrateAiSettings(store);

        window.removeEventListener(AI_CONFIG_CHANGED_EVENT, changed);
        expect(getProviderApiKey("gemini")).toBe("remote-key");
        expect(localModel()).toBe("gemini-pro");
        expect(store.saveAiSettings).not.toHaveBeenCalled();
        expect(localStorage.getItem(AI_SETTINGS_SYNCED_STORAGE_KEY)).toBe("1");
        expect(changed).toHaveBeenCalledTimes(1);
    });

    it("migrates a local-only key up on first sync", async () => {
        setProviderApiKey("gemini", "local-key");
        setProviderModel("gemini", "gemini-flash");
        const store = fakeStore({ gemini_api_key: null, gemini_model: null });

        await hydrateAiSettings(store);

        expect(store.saveAiSettings).toHaveBeenCalledWith({
            gemini_api_key: "local-key",
            gemini_model: "gemini-flash",
        });
        expect(getProviderApiKey("gemini")).toBe("local-key");
    });

    it("clears the local key when it was cleared remotely after a sync", async () => {
        setProviderApiKey("gemini", "stale-key");
        localStorage.setItem(AI_SETTINGS_SYNCED_STORAGE_KEY, "1");
        const store = fakeStore({ gemini_api_key: null, gemini_model: null });

        await hydrateAiSettings(store);

        expect(getProviderApiKey("gemini")).toBe("");
        expect(store.saveAiSettings).not.toHaveBeenCalled();
    });

    it("keeps the local cache when the remote is unreachable", async () => {
        setProviderApiKey("gemini", "local-key");
        const store = {
            getAiSettings: vi.fn().mockRejectedValue(new Error("offline")),
            saveAiSettings: vi.fn(),
        };

        await hydrateAiSettings(store);

        expect(getProviderApiKey("gemini")).toBe("local-key");
        expect(store.saveAiSettings).not.toHaveBeenCalled();
        expect(localStorage.getItem(AI_SETTINGS_SYNCED_STORAGE_KEY)).toBeNull();
    });

    it("does not mark synced when the migration upload fails", async () => {
        setProviderApiKey("gemini", "local-key");
        const store = {
            getAiSettings: vi
                .fn()
                .mockResolvedValue({ gemini_api_key: null, gemini_model: null }),
            saveAiSettings: vi.fn().mockRejectedValue(new Error("offline")),
        };

        await hydrateAiSettings(store);

        expect(localStorage.getItem(AI_SETTINGS_SYNCED_STORAGE_KEY)).toBeNull();
        expect(getProviderApiKey("gemini")).toBe("local-key");
    });
});

describe("pushGeminiSettings", () => {
    it("pushes the local key and model, sending null when cleared", async () => {
        const store = fakeStore({ gemini_api_key: null, gemini_model: null });
        setProviderApiKey("gemini", "new-key");

        expect(await pushGeminiSettings(store)).toBe(true);
        expect(store.saveAiSettings).toHaveBeenLastCalledWith({
            gemini_api_key: "new-key",
            gemini_model: null,
        });

        setProviderApiKey("gemini", "");
        await pushGeminiSettings(store);
        expect(store.saveAiSettings).toHaveBeenLastCalledWith({
            gemini_api_key: null,
            gemini_model: null,
        });
    });

    it("returns false when the save fails", async () => {
        const store = {
            getAiSettings: vi.fn(),
            saveAiSettings: vi.fn().mockRejectedValue(new Error("offline")),
        };
        expect(await pushGeminiSettings(store)).toBe(false);
    });
});

describe("SupabaseFinanceServiceImpl AI settings", () => {
    it("reads the signed-in member's row", async () => {
        const { client, from, eq } = fakeSupabaseClient({
            gemini_api_key: "k",
            gemini_model: "m",
        });
        const service = new SupabaseFinanceServiceImpl(client);

        expect(await service.getAiSettings()).toEqual({
            gemini_api_key: "k",
            gemini_model: "m",
        });
        expect(from).toHaveBeenCalledWith("member_ai_settings");
        expect(eq).toHaveBeenCalledWith("user_id", USER_ID);
    });

    it("returns empty settings when no row exists", async () => {
        const { client } = fakeSupabaseClient(null);
        const service = new SupabaseFinanceServiceImpl(client);

        expect(await service.getAiSettings()).toEqual({
            gemini_api_key: null,
            gemini_model: null,
        });
    });

    it("upserts on user_id", async () => {
        const { client, upsert } = fakeSupabaseClient(null);
        const service = new SupabaseFinanceServiceImpl(client);

        await service.saveAiSettings({
            gemini_api_key: "k",
            gemini_model: null,
        });

        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: USER_ID,
                gemini_api_key: "k",
                gemini_model: null,
                updated_at: expect.any(String),
            }),
            { onConflict: "user_id" },
        );
    });
});

describe("mockFinanceService AI settings", () => {
    it("round-trips through localStorage", async () => {
        expect(await mockFinanceService.getAiSettings()).toEqual({
            gemini_api_key: null,
            gemini_model: null,
        });

        await mockFinanceService.saveAiSettings({
            gemini_api_key: "demo-key",
            gemini_model: "gemini-flash",
        });

        expect(await mockFinanceService.getAiSettings()).toEqual({
            gemini_api_key: "demo-key",
            gemini_model: "gemini-flash",
        });
    });
});
