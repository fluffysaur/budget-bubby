import { describe, it, expect } from "vitest";
import indexHtml from "../index.html?raw";

describe("Font Loading Optimization & Self-Hosting", () => {
    it("does not load fonts from external Google Fonts CDN in index.html", () => {
        expect(indexHtml).not.toContain("fonts.googleapis.com");
        expect(indexHtml).not.toContain("fonts.gstatic.com");
    });

    it("preloads critical self-hosted fonts in index.html head", () => {
        expect(indexHtml).toMatch(
            /<link\s+rel=["']preload["']\s+href=["']\/fonts\/plus-jakarta-sans-latin\.woff2["']\s+as=["']font["']\s+type=["']font\/woff2["']\s+crossorigin\s*\/?>/i,
        );
        expect(indexHtml).toMatch(
            /<link\s+rel=["']preload["']\s+href=["']\/fonts\/bricolage-grotesque-latin\.woff2["']\s+as=["']font["']\s+type=["']font\/woff2["']\s+crossorigin\s*\/?>/i,
        );
    });

    it("defines local @font-face rules with font-display: optional for Bricolage Grotesque in index.css", async () => {
        // @ts-expect-error node:fs is available in vitest environment
        const { readFileSync } = await import("node:fs");
        // @ts-expect-error node:path is available in vitest environment
        const { resolve } = await import("node:path");

        const env = globalThis as unknown as {
            process?: { cwd: () => string };
        };
        const root = env.process ? env.process.cwd() : "";
        const cssPath = resolve(root, "src/index.css");
        const indexCss = readFileSync(cssPath, "utf-8");

        expect(indexCss).toContain("Plus Jakarta Sans");
        expect(indexCss).toContain("Bricolage Grotesque");
        expect(indexCss).toContain("JetBrains Mono");

        // Verify local woff2 URLs are referenced
        expect(indexCss).toContain(
            'url("/fonts/plus-jakarta-sans-latin.woff2")',
        );
        expect(indexCss).toContain(
            'url("/fonts/bricolage-grotesque-latin.woff2")',
        );
        expect(indexCss).toContain('url("/fonts/jetbrains-mono-latin.woff2")');

        // Verify font-display: optional on Bricolage Grotesque to avoid FOUT layout shifts
        const bricolageIndex = indexCss.indexOf('"Bricolage Grotesque"');
        expect(bricolageIndex).toBeGreaterThan(-1);
        const bricolageBlock = indexCss.slice(
            bricolageIndex,
            bricolageIndex + 300,
        );
        expect(bricolageBlock).toMatch(/font-display:\s*optional/);
    });
});
