import { describe, it, expect } from "vitest";
// @ts-expect-error node:fs is available in vitest environment
import { readFileSync } from "node:fs";

const env = globalThis as unknown as { process: { cwd: () => string } };
const indexCss: string = readFileSync(
    `${env.process.cwd()}/src/index.css`,
    "utf8",
);

type Theme = Record<string, string>;

function readBlock(selector: string): Theme {
    const start = indexCss.search(new RegExp(`^${selector} \\{`, "m"));
    expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
    const end = indexCss.indexOf("\n}", start);
    const tokens: Theme = {};
    for (const m of indexCss
        .slice(start, end)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
        tokens[m[1]] = m[2].trim();
    }
    return tokens;
}

const light = readBlock(":root");
const dark = { ...light, ...readBlock("\\.dark") };

function resolve(theme: Theme, name: string): string {
    let value = theme[name];
    for (let i = 0; value?.startsWith("var(") && i < 5; i++) {
        value = theme[value.slice(4, -1).trim()];
    }
    expect(value, `${name} resolves to a hex colour`).toMatch(
        /^#[0-9a-f]{6}$/i,
    );
    return value;
}

function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(theme: Theme, fg: string, bg: string): number {
    const [a, b] = [
        luminance(resolve(theme, fg)),
        luminance(resolve(theme, bg)),
    ];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const PASTEL_FILLS = [
    "--pastel-lilac",
    "--pastel-lilac-dark",
    "--pastel-butter",
    "--pastel-mint",
    "--pastel-mint-dark",
    "--pastel-pink",
    "--pastel-coral",
    "--accent-lilac",
    "--accent-butter",
    "--accent-mint",
    "--accent-pink",
];

describe("theme contrast tokens", () => {
    it.each(PASTEL_FILLS)(
        "on-pastel ink reaches 4.5:1 on %s in both themes",
        (fill) => {
            expect(
                contrast(light, "--text-on-pastel", fill),
            ).toBeGreaterThanOrEqual(4.5);
            expect(
                contrast(dark, "--text-on-pastel", fill),
            ).toBeGreaterThanOrEqual(4.5);
        },
    );

    it.each(["--pastel-lilac", "--pastel-butter", "--pastel-mint", "--pastel-pink"])(
        "muted on-pastel ink reaches 4.5:1 on %s in dark mode",
        (fill) => {
            expect(
                contrast(dark, "--text-on-pastel-muted", fill),
            ).toBeGreaterThanOrEqual(4.5);
        },
    );

    it("on-accent text reaches 4.5:1 on coral in dark mode", () => {
        expect(
            contrast(dark, "--text-on-accent", "--accent-coral"),
        ).toBeGreaterThanOrEqual(4.5);
    });

    it("keeps light mode colours unchanged", () => {
        expect(resolve(light, "--text-on-pastel")).toBe(
            resolve(light, "--text-ink"),
        );
        expect(resolve(light, "--text-on-pastel-muted")).toBe(
            resolve(light, "--text-muted"),
        );
        expect(resolve(light, "--text-on-accent").toLowerCase()).toBe(
            "#ffffff",
        );
    });

    it("declares a colour scheme per theme so native picker icons follow it", () => {
        expect(indexCss).toMatch(/:root \{[^}]*color-scheme: light;/);
        expect(indexCss).toMatch(/\.dark \{[^}]*color-scheme: dark;/);
    });
});
