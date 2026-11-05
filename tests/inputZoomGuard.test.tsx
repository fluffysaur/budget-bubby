/**
 * iOS Safari zooms on focus when a text control's font-size is below 16px.
 * Every raw <input>/<select>/<textarea> outside the ui primitives must use
 * `text-base` (or a larger size) on mobile.
 */
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Input } from "../src/components/ui/Input";
import { Select } from "../src/components/ui/Select";
import { Textarea } from "../src/components/ui/Textarea";

const SRC = path.resolve(__dirname, "../src");
const NON_TEXT_TYPES = ["checkbox", "radio", "range", "file", "hidden"];
const BIG_TEXT = /(?<![:\w-])text-(base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b/;

function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return walk(p);
        return p.endsWith(".tsx") ? [p] : [];
    });
}

function extractTags(src: string): string[] {
    const tags: string[] = [];
    const re = /<(input|textarea|select)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
        let i = m.index + m[0].length;
        let depth = 0;
        let quote: string | null = null;
        for (; i < src.length; i++) {
            const c = src[i];
            if (quote) {
                if (c === quote && src[i - 1] !== "\\") quote = null;
                continue;
            }
            if (depth === 0 && (c === '"' || c === "'")) quote = c;
            else if (c === "`") quote = c;
            else if (c === "{") depth++;
            else if (c === "}") depth--;
            else if (depth === 0 && c === ">" && src[i - 1] !== "=") break;
        }
        tags.push(src.slice(m.index, i + 1));
    }
    return tags;
}

describe("iOS input zoom guard", () => {
    it("raw text controls use 16px text on mobile", () => {
        const offenders: string[] = [];
        for (const file of walk(SRC)) {
            if (file.includes(`${path.sep}components${path.sep}ui${path.sep}`))
                continue;
            for (const tag of extractTags(fs.readFileSync(file, "utf8"))) {
                const type = tag.match(/type=["'{]+\s*["']?(\w+)/)?.[1];
                if (type && NON_TEXT_TYPES.includes(type)) continue;
                if (!BIG_TEXT.test(tag)) {
                    offenders.push(
                        `${path.relative(SRC, file)}: ${tag.slice(0, 60).replace(/\s+/g, " ")}`,
                    );
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});

describe("form primitives", () => {
    it("Input uses text-base on mobile and text-sm from sm", () => {
        const { container } = render(<Input aria-label="x" />);
        const el = container.querySelector("input")!;
        expect(el.className).toContain("text-base");
        expect(el.className).toContain("sm:text-sm");
    });

    it("Select md and sm variants use text-base on mobile", () => {
        const { container, rerender } = render(<Select aria-label="x" />);
        let el = container.querySelector("select")!;
        expect(el.className).toContain("text-base");
        expect(el.className).toContain("sm:text-sm");
        rerender(<Select aria-label="x" sizeVariant="sm" />);
        el = container.querySelector("select")!;
        expect(el.className).toContain("text-base");
        expect(el.className).toContain("sm:text-xs");
    });

    it("Textarea uses text-base on mobile and text-sm from sm", () => {
        const { container } = render(<Textarea aria-label="x" />);
        const el = container.querySelector("textarea")!;
        expect(el.className).toContain("text-base");
        expect(el.className).toContain("sm:text-sm");
    });
});
