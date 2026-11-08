/**
 * Capture token helpers. A token is "bb_cap_" + 32 random bytes in base64url
 * (43 chars). Only its SHA-256 hex digest is stored. Works in browsers, Node
 * and Deno (Web Crypto).
 */

export const CAPTURE_TOKEN_PREFIX = "bb_cap_";
export const CAPTURE_TOKEN_PATTERN = /^bb_cap_[A-Za-z0-9_-]{43}$/;

function base64url(bytes: Uint8Array): string {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/** Lowercase hex SHA-256 of a UTF-8 string. */
export async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text),
    );
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export interface GeneratedCaptureToken {
    /** Plaintext. Shown once, never stored. */
    token: string;
    hash: string;
    /** Last 4 characters, for display. */
    hint: string;
}

export async function generateCaptureToken(): Promise<GeneratedCaptureToken> {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = CAPTURE_TOKEN_PREFIX + base64url(bytes);
    return { token, hash: await sha256Hex(token), hint: token.slice(-4) };
}

/** Pulls a well-formed token out of an Authorization header. */
export function readBearerToken(
    header: string | null | undefined,
): string | null {
    const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
    const token = match?.[1];
    return token && CAPTURE_TOKEN_PATTERN.test(token) ? token : null;
}
