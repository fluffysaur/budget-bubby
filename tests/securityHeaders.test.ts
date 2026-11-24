import { describe, it, expect } from "vitest";
import vercelJsonRaw from "../vercel.json?raw";

interface VercelHeader {
    key: string;
    value: string;
}

interface VercelConfig {
    headers?: Array<{
        source: string;
        headers: VercelHeader[];
    }>;
}

function loadHeaders(): Record<string, string> {
    const config = JSON.parse(vercelJsonRaw) as VercelConfig;
    const catchAll = config.headers?.find((rule) => rule.source === "/(.*)");
    expect(catchAll).toBeDefined();
    return Object.fromEntries(
        (catchAll?.headers ?? []).map((h) => [h.key, h.value]),
    );
}

describe("vercel.json security headers", () => {
    it("sets required defense-in-depth headers", () => {
        const headers = loadHeaders();
        expect(headers["X-Content-Type-Options"]).toBe("nosniff");
        expect(headers["Referrer-Policy"]).toBe(
            "strict-origin-when-cross-origin",
        );
        expect(headers["Permissions-Policy"]).toContain("camera=()");
        expect(headers["Permissions-Policy"]).toContain("microphone=()");
        expect(headers["Permissions-Policy"]).toContain("geolocation=()");
    });

    it("sets Content-Security-Policy with strict connect-src and frame-ancestors 'none'", () => {
        const headers = loadHeaders();
        const csp = headers["Content-Security-Policy"];
        expect(csp).toBeDefined();

        const directives = Object.fromEntries(
            csp
                .split(";")
                .map((d) => d.trim())
                .filter(Boolean)
                .map((d) => {
                    const [name, ...rest] = d.split(/\s+/);
                    return [name, rest];
                }),
        );

        expect(directives["default-src"]).toEqual(["'self'"]);
        expect(directives["script-src"]).toEqual(["'self'"]);
        expect(directives["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
        expect(directives["font-src"]).toEqual(["'self'"]);
        expect(directives["object-src"]).toEqual(["'none'"]);
        expect(directives["frame-ancestors"]).toEqual(["'none'"]);
        expect(directives["frame-src"]).toEqual(["'none'"]);
        expect(directives["worker-src"]).toEqual(["'self'"]);
        expect(directives["base-uri"]).toEqual(["'self'"]);

        const connectSrc = directives["connect-src"] ?? [];
        expect(connectSrc).toContain("'self'");
        expect(connectSrc).toContain("https://*.supabase.co");
        expect(connectSrc).toContain("wss://*.supabase.co");
        expect(connectSrc).toContain("https://openrouter.ai");
        expect(connectSrc).toContain(
            "https://generativelanguage.googleapis.com",
        );
        expect(connectSrc).toContain("https://api.anthropic.com");
        expect(connectSrc).toContain("https://api.openai.com");
        expect(connectSrc).toContain("https://open.er-api.com");
        expect(connectSrc).not.toContain("*");
        expect(connectSrc).not.toContain("https:");
    });
});
