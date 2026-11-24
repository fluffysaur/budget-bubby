import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    OPENROUTER_AUTH_URL,
    OPENROUTER_CALLBACK_PATH,
    OPENROUTER_KEYS_ENDPOINT,
    OPENROUTER_PKCE_STORAGE_KEY,
    OPENROUTER_PKCE_TTL_MS,
    completeOpenRouterOAuthCallback,
    consumePendingOpenRouterFeedback,
    deriveCodeChallenge,
    generateCodeVerifier,
    hasPendingOpenRouterFeedback,
    setPendingOpenRouterFeedback,
    startOpenRouterOAuth,
} from "../openrouterAuth";
import {
    AI_CONFIG_CHANGED_EVENT,
    getActiveAiProvider,
    getProviderApiKey,
} from "../providers";
import type { MemberAiSettings } from "../../../types/finance";

function fakeStore(initial?: Partial<MemberAiSettings>) {
    return {
        getAiSettings: vi.fn().mockResolvedValue({
            gemini_api_key: null,
            gemini_model: null,
            openrouter_api_key: null,
            openrouter_model: null,
            active_provider: null,
            ...initial,
        }),
        saveAiSettings: vi.fn().mockResolvedValue(undefined),
    };
}

describe("openrouterAuth", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it("generates valid PKCE verifiers and S256 challenges without padding", async () => {
        const verifier = generateCodeVerifier();
        expect(verifier.length).toBeGreaterThanOrEqual(43);
        expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);

        const challenge = await deriveCodeChallenge(verifier);
        expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(challenge).not.toContain("=");
        expect(challenge).not.toBe(verifier);
    });

    it("stores PKCE state and navigates to OpenRouter auth URL", async () => {
        const navigate = vi.fn();

        await startOpenRouterOAuth("chat", "/spend?tab=budget", navigate);

        expect(navigate).toHaveBeenCalledTimes(1);
        const targetUrl = new URL(navigate.mock.calls[0][0] as string);
        expect(`${targetUrl.origin}${targetUrl.pathname}`).toBe(
            OPENROUTER_AUTH_URL,
        );
        expect(targetUrl.searchParams.get("code_challenge_method")).toBe("S256");
        expect(targetUrl.searchParams.get("code_challenge")).toBeTruthy();
        expect(targetUrl.searchParams.get("callback_url")).toBe(
            `${window.location.origin}${OPENROUTER_CALLBACK_PATH}`,
        );

        const storedRaw = localStorage.getItem(OPENROUTER_PKCE_STORAGE_KEY);
        expect(storedRaw).toBeTruthy();
        const stored = JSON.parse(storedRaw!) as {
            verifier: string;
            returnTo: string;
            returnPath: string;
        };
        expect(stored.returnTo).toBe("chat");
        expect(stored.returnPath).toBe("/spend?tab=budget");
        expect(await deriveCodeChallenge(stored.verifier)).toBe(
            targetUrl.searchParams.get("code_challenge"),
        );
    });

    it("exchanges callback code, stores OpenRouter key, switches active provider, and syncs", async () => {
        const navigate = vi.fn();
        await startOpenRouterOAuth("chat", "/accounts", navigate);

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ key: "sk-or-v1-oauth-key" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );
        const changedSpy = vi.fn();
        window.addEventListener(AI_CONFIG_CHANGED_EVENT, changedSpy);
        const store = fakeStore();

        const result = await completeOpenRouterOAuthCallback(
            "?code=auth_code_123",
            store,
        );
        window.removeEventListener(AI_CONFIG_CHANGED_EVENT, changedSpy);

        expect(result).toEqual({
            ok: true,
            returnTo: "chat",
            returnPath: "/accounts",
        });
        expect(fetchSpy).toHaveBeenCalledWith(
            OPENROUTER_KEYS_ENDPOINT,
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
            }),
        );
        expect(getProviderApiKey("openrouter")).toBe("sk-or-v1-oauth-key");
        expect(getActiveAiProvider()).toBe("openrouter");
        expect(localStorage.getItem(OPENROUTER_PKCE_STORAGE_KEY)).toBeNull();
        expect(changedSpy).toHaveBeenCalledTimes(1);
        expect(store.saveAiSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                openrouter_api_key: "sk-or-v1-oauth-key",
                active_provider: "openrouter",
            }),
        );
    });

    it("handles cancelled OAuth callbacks cleanly", async () => {
        await startOpenRouterOAuth("settings", "/plan", vi.fn());

        const result = await completeOpenRouterOAuthCallback(
            "?error=access_denied",
        );

        expect(result).toEqual({
            ok: false,
            returnTo: "settings",
            returnPath: "/plan",
            error: "OpenRouter connection was cancelled.",
        });
        expect(localStorage.getItem(OPENROUTER_PKCE_STORAGE_KEY)).toBeNull();
    });

    it("rejects missing or expired PKCE sessions", async () => {
        const missing = await completeOpenRouterOAuthCallback("?code=abc");
        expect(missing.ok).toBe(false);
        expect(missing.error).toMatch(/expired/i);

        localStorage.setItem(
            OPENROUTER_PKCE_STORAGE_KEY,
            JSON.stringify({
                verifier: "verifier-123",
                returnTo: "chat",
                returnPath: "/",
                createdAt: Date.now() - OPENROUTER_PKCE_TTL_MS - 1000,
            }),
        );
        const expired = await completeOpenRouterOAuthCallback("?code=abc");
        expect(expired.ok).toBe(false);
        expect(expired.returnTo).toBe("chat");
        expect(expired.error).toMatch(/expired/i);
    });

    it("returns an error when OpenRouter rejects the code exchange", async () => {
        await startOpenRouterOAuth("settings", "/", vi.fn());
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({ error: { message: "Invalid code" } }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            ),
        );

        const result = await completeOpenRouterOAuthCallback("?code=bad");

        expect(result).toEqual({
            ok: false,
            returnTo: "settings",
            returnPath: "/",
            error: "Invalid code",
        });
        expect(getProviderApiKey("openrouter")).toBe("");
    });

    it("persists and consumes pending feedback scoped by target", () => {
        setPendingOpenRouterFeedback({
            target: "chat",
            variant: "success",
            message: "OpenRouter connected and synced.",
        });

        expect(hasPendingOpenRouterFeedback("settings")).toBe(false);
        expect(hasPendingOpenRouterFeedback("chat")).toBe(true);
        expect(consumePendingOpenRouterFeedback("settings")).toBeNull();
        expect(consumePendingOpenRouterFeedback("chat")).toEqual({
            target: "chat",
            variant: "success",
            message: "OpenRouter connected and synced.",
        });
        expect(consumePendingOpenRouterFeedback("chat")).toBeNull();
    });
});
