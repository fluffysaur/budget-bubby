/**
 * A new table must be classified for the send-reminders household scoping
 * (household_id-scoped or child) before CI passes.
 */

import { describe, expect, it } from "vitest";
import {
    CHILD_TABLES,
    HOUSEHOLD_ID_TABLES,
} from "../src/server/householdScopedClient";

const MIGRATIONS = import.meta.glob("../supabase/migrations/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

function stripComments(sql: string): string {
    return sql.replace(/--.*$/gm, "");
}

/** Live public tables after replaying creates, drops and renames in order. */
function loadSchema(): Map<string, string> {
    const bodies = new Map<string, string>();
    const files = Object.keys(MIGRATIONS).sort();
    const name = '(?:public\\.)?"?([a-z_]+)"?';
    for (const file of files) {
        const sql = stripComments(MIGRATIONS[file]);
        for (const m of sql.matchAll(
            new RegExp(
                `create table(?: if not exists)?\\s+${name}\\s*\\(([\\s\\S]*?)\\n\\s*\\);`,
                "gi",
            ),
        )) {
            bodies.set(m[1], (bodies.get(m[1]) ?? "") + m[2]);
        }
        for (const m of sql.matchAll(
            new RegExp(
                `alter table(?: if exists)?\\s+${name}\\s+add column(?: if not exists)?\\s+"?household_id"?`,
                "gi",
            ),
        )) {
            bodies.set(m[1], (bodies.get(m[1]) ?? "") + " household_id");
        }
        for (const m of sql.matchAll(
            new RegExp(
                `alter table(?: if exists)?\\s+${name}\\s+rename to\\s+${name}`,
                "gi",
            ),
        )) {
            bodies.set(m[2], bodies.get(m[1]) ?? "");
            bodies.delete(m[1]);
        }
        for (const m of sql.matchAll(
            new RegExp(`drop table(?: if exists)?\\s+${name}`, "gi"),
        )) {
            bodies.delete(m[1]);
        }
    }
    return bodies;
}

describe("migration table classification", () => {
    const schema = loadSchema();

    it("finds the tables", () => {
        expect(schema.size).toBeGreaterThan(15);
        expect(schema.has("households")).toBe(true);
    });

    it("classifies every public table", () => {
        const unclassified = [...schema.keys()].filter(
            (t) =>
                t !== "households" &&
                !HOUSEHOLD_ID_TABLES.has(t) &&
                !CHILD_TABLES.has(t),
        );
        expect(unclassified).toEqual([]);
    });

    it("lists no table that does not exist", () => {
        const all = [...HOUSEHOLD_ID_TABLES, ...CHILD_TABLES];
        expect(all.filter((t) => !schema.has(t))).toEqual([]);
    });

    it("household_id tables really have a household_id column", () => {
        const missing = [...HOUSEHOLD_ID_TABLES].filter(
            (t) => !/\bhousehold_id\b/.test(schema.get(t) ?? ""),
        );
        expect(missing).toEqual([]);
    });

    it("child tables have no household_id column", () => {
        const wrong = [...CHILD_TABLES].filter((t) =>
            /\bhousehold_id\b/.test(schema.get(t) ?? ""),
        );
        expect(wrong).toEqual([]);
    });
});
