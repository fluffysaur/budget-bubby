/**
 * OpenRouter OAuth PKCE authentication service for client-side BYOK setup.
 * Never logs or persists PKCE verifiers beyond the single callback exchange.
 */

import type { FinanceService } from "../financeService";
import { pushAiSettings } from "./aiSettingsSync";
import {
    AI_CONFIG_CHANGED_EVENT,
    setActiveAiProvider,
    setProviderApiKey,
} from "./providers";

export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
export const OPENROUTER_KEYS_ENDPOINT =
    "https://openrouter.ai/api/v1/auth/keys";
export const OPENROUTER_CALLBACK_PATH = "/auth/openrouter/callback";
export const OPENROUTER_PKCE_STORAGE_KEY = "budget_bubby_openrouter_pkce";
export const OPENROUTER_FEEDBACK_STORAGE_KEY =
    "budget_bubby_openrouter_feedback";
export const OPENROUTER_PKCE_TTL_MS = 10 * 60 * 1000;

export type OpenRouterReturnTarget = "chat" | "settings";

export interface OpenRouterOAuthFeedback {
    target: OpenRouterReturnTarget;
    variant: "success" | "danger";
    message: string;
}

export interface OpenRouterCallbackResult {
    ok: boolean;
    returnTo: OpenRouterReturnTarget;
    returnPath: string;
    error?: string;
}

interface StoredPkceState {
    verifier: string;
    returnTo: OpenRouterReturnTarget;
    returnPath: string;
    createdAt: number;
}

type AiSettingsStore = Pick<FinanceService, "getAiSettings" | "saveAiSettings">;

let inMemoryFeedback: OpenRouterOAuthFeedback | null = null;

function getLocalStorage(): Storage | null {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            return window.localStorage;
        }
    } catch {
        // Storage unavailable
    }
    return null;
}

function getSessionStorage(): Storage | null {
    try {
        if (typeof window !== "undefined" && window.sessionStorage) {
            return window.sessionStorage;
        }
    } catch {
        // Storage unavailable
    }
    return null;
}

export function base64UrlEncode(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

export async function deriveCodeChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return base64UrlEncode(new Uint8Array(digest));
}

function sanitizeReturnPath(path?: string): string {
    if (
        !path ||
        !path.startsWith("/") ||
        path.startsWith("//") ||
        path.startsWith(OPENROUTER_CALLBACK_PATH)
    ) {
        return "/";
    }
    return path;
}

export function setPendingOpenRouterFeedback(
    feedback: OpenRouterOAuthFeedback,
): void {
    inMemoryFeedback = feedback;
    const storage = getSessionStorage();
    if (!storage) return;
    try {
        storage.setItem(
            OPENROUTER_FEEDBACK_STORAGE_KEY,
            JSON.stringify(feedback),
        );
    } catch {
        // Fallback to inMemoryFeedback
    }
}

export function consumePendingOpenRouterFeedback(
    target: OpenRouterReturnTarget,
): OpenRouterOAuthFeedback | null {
    let candidate: OpenRouterOAuthFeedback | null = inMemoryFeedback;
    const storage = getSessionStorage();
    if (!candidate && storage) {
        try {
            const raw = storage.getItem(OPENROUTER_FEEDBACK_STORAGE_KEY);
            if (raw) {
                candidate = JSON.parse(raw) as OpenRouterOAuthFeedback;
            }
        } catch {
            candidate = null;
        }
    }
    if (!candidate || candidate.target !== target) {
        return null;
    }
    inMemoryFeedback = null;
    storage?.removeItem(OPENROUTER_FEEDBACK_STORAGE_KEY);
    return candidate;
}

export function hasPendingOpenRouterFeedback(
    target: OpenRouterReturnTarget,
): boolean {
    if (inMemoryFeedback?.target === target) return true;
    const storage = getSessionStorage();
    if (!storage) return false;
    try {
        const raw = storage.getItem(OPENROUTER_FEEDBACK_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as Partial<OpenRouterOAuthFeedback>;
        return parsed.target === target;
    } catch {
        return false;
    }
}

export async function startOpenRouterOAuth(
    returnTo: OpenRouterReturnTarget,
    returnPath?: string,
    navigate?: (url: string) => void,
): Promise<void> {
    const verifier = generateCodeVerifier();
    const challenge = await deriveCodeChallenge(verifier);
    const state: StoredPkceState = {
        verifier,
        returnTo,
        returnPath: sanitizeReturnPath(returnPath),
        createdAt: Date.now(),
    };

    const storage = getLocalStorage();
    storage?.setItem(OPENROUTER_PKCE_STORAGE_KEY, JSON.stringify(state));

    const origin =
        typeof window !== "undefined" ? window.location.origin : "";
    const callbackUrl = `${origin}${OPENROUTER_CALLBACK_PATH}`;
    const params = new URLSearchParams({
        callback_url: callbackUrl,
        code_challenge: challenge,
        code_challenge_method: "S256",
    });
    const authUrl = `${OPENROUTER_AUTH_URL}?${params.toString()}`;

    if (navigate) {
        navigate(authUrl);
    } else if (typeof window !== "undefined") {
        window.location.assign(authUrl);
    }
}

export async function exchangeOpenRouterCode(
    code: string,
    codeVerifier: string,
): Promise<string> {
    const response = await fetch(OPENROUTER_KEYS_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            code,
            code_verifier: codeVerifier,
            code_challenge_method: "S256",
        }),
    });

    let data: { key?: unknown; error?: { message?: string }; message?: string } =
        {};
    try {
        data = (await response.json()) as typeof data;
    } catch {
        // Non-JSON response
    }

    if (!response.ok) {
        const detail = data.error?.message || data.message;
        throw new Error(
            detail ||
                `OpenRouter code exchange failed (HTTP ${response.status}).`,
        );
    }

    if (typeof data.key !== "string" || !data.key.trim()) {
        throw new Error("OpenRouter did not return an API key.");
    }

    return data.key.trim();
}

export async function completeOpenRouterOAuthCallback(
    search: string,
    store?: AiSettingsStore,
): Promise<OpenRouterCallbackResult> {
    const storage = getLocalStorage();
    const rawState = storage?.getItem(OPENROUTER_PKCE_STORAGE_KEY) ?? null;
    storage?.removeItem(OPENROUTER_PKCE_STORAGE_KEY);

    let parsedState: Partial<StoredPkceState> | null = null;
    if (rawState) {
        try {
            parsedState = JSON.parse(rawState) as Partial<StoredPkceState>;
        } catch {
            parsedState = null;
        }
    }

    const returnTo: OpenRouterReturnTarget =
        parsedState?.returnTo === "chat" ? "chat" : "settings";
    const returnPath = sanitizeReturnPath(parsedState?.returnPath);

    const params = new URLSearchParams(search);
    const errorParam = params.get("error");
    const errorDescription = params.get("error_description");
    if (errorParam) {
        return {
            ok: false,
            returnTo,
            returnPath,
            error:
                errorDescription ||
                (errorParam === "access_denied"
                    ? "OpenRouter connection was cancelled."
                    : `OpenRouter sign-in failed: ${errorParam}`),
        };
    }

    const isExpired =
        typeof parsedState?.createdAt !== "number" ||
        Date.now() - parsedState.createdAt > OPENROUTER_PKCE_TTL_MS;

    if (!parsedState?.verifier || isExpired) {
        return {
            ok: false,
            returnTo,
            returnPath,
            error: "OpenRouter sign-in session expired. Please try again.",
        };
    }

    const code = params.get("code")?.trim();
    if (!code) {
        return {
            ok: false,
            returnTo,
            returnPath,
            error: "Missing authorization code from OpenRouter.",
        };
    }

    try {
        const key = await exchangeOpenRouterCode(code, parsedState.verifier);
        setProviderApiKey("openrouter", key);
        setActiveAiProvider("openrouter");
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(AI_CONFIG_CHANGED_EVENT));
        }
        if (store) {
            await pushAiSettings(store);
        }
        return {
            ok: true,
            returnTo,
            returnPath,
        };
    } catch (err) {
        return {
            ok: false,
            returnTo,
            returnPath,
            error:
                err instanceof Error
                    ? err.message
                    : "Failed to connect OpenRouter.",
        };
    }
}
