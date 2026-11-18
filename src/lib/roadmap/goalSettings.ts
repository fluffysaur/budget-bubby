/**
 * Goal tags, the buffer goal and the household haircut settings (Roadmap
 * Phase 4). See docs/plans/2026-11-18-roadmap.md, decisions 3, 20-21.
 */

import type {
    Household,
    HouseholdSettingsInput,
    SavingsGoal,
} from "../../types/finance";

/** Stored haircut defaults, as the DB holds them (percent and months). */
export const DEFAULT_HAIRCUT_PERCENT = 20;
export const DEFAULT_HAIRCUT_WINDOW_MONTHS = 24;
export const MAX_HAIRCUT_WINDOW_MONTHS = 120;

export const BUFFER_MIN_MONTHS = 1;
export const BUFFER_MAX_MONTHS = 24;
export const DEFAULT_BUFFER_MONTHS = 6;

export const MAX_GOAL_TAGS = 6;
const MAX_TAG_LENGTH = 24;

/**
 * Suggested tags. A tag sets the default emoji and template label only;
 * tags carry no rules.
 */
export const GOAL_TAG_SUGGESTIONS = [
    { emoji: "💍", label: "Wedding" },
    { emoji: "🏠", label: "Housing" },
    { emoji: "👶", label: "Child" },
    { emoji: "🎓", label: "Education" },
    { emoji: "✈️", label: "Travel" },
    { emoji: "🚗", label: "Car" },
] as const;

export const BUFFER_EMOJI = "🛟";

/** Trims, de-duplicates (case-insensitive) and caps a tag list. */
export function normalizeGoalTags(tags: readonly string[] | null | undefined) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tags ?? []) {
        const tag = raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
        const key = tag.toLowerCase();
        if (!tag || seen.has(key)) continue;
        seen.add(key);
        out.push(tag);
        if (out.length >= MAX_GOAL_TAGS) break;
    }
    return out;
}

/** The default emoji a tag suggests, if it matches a suggestion. */
export function emojiForTag(tag: string): string | undefined {
    const key = tag.trim().toLowerCase();
    return GOAL_TAG_SUGGESTIONS.find((s) => s.label.toLowerCase() === key)
        ?.emoji;
}

export function isBufferGoal(goal: Pick<SavingsGoal, "goal_type">): boolean {
    return goal.goal_type === "buffer";
}

export function clampBufferMonths(months: number): number {
    if (!Number.isFinite(months)) return DEFAULT_BUFFER_MONTHS;
    return Math.min(
        BUFFER_MAX_MONTHS,
        Math.max(BUFFER_MIN_MONTHS, Math.round(months)),
    );
}

/** Buffer target: N months of average monthly spending, to the dollar. */
export function bufferTarget(months: number, averageMonthlySpend: number) {
    return Math.max(
        0,
        Math.round(
            clampBufferMonths(months) * Math.max(0, averageMonthlySpend),
        ),
    );
}

const clamp = (n: number, min: number, max: number) =>
    Math.min(max, Math.max(min, n));

/** Clamps edited haircut settings to valid ranges; drops missing fields. */
export function normalizeHouseholdSettings(
    settings: HouseholdSettingsInput,
): HouseholdSettingsInput {
    const out: HouseholdSettingsInput = {};
    const pct = Number(settings.investment_haircut_pct);
    if (settings.investment_haircut_pct != null && Number.isFinite(pct)) {
        out.investment_haircut_pct = Math.round(clamp(pct, 0, 100) * 100) / 100;
    }
    const months = Number(settings.investment_haircut_months);
    if (settings.investment_haircut_months != null && Number.isFinite(months)) {
        out.investment_haircut_months = Math.round(
            clamp(months, 0, MAX_HAIRCUT_WINDOW_MONTHS),
        );
    }
    return out;
}

/** The household haircut as the engine wants it (0-1 fraction, months). */
export function haircutFromHousehold(
    household:
        | Pick<
              Household,
              "investment_haircut_pct" | "investment_haircut_months"
          >
        | null
        | undefined,
): { haircutPct: number; haircutMonths: number } {
    const n = normalizeHouseholdSettings({
        investment_haircut_pct: household?.investment_haircut_pct,
        investment_haircut_months: household?.investment_haircut_months,
    });
    return {
        haircutPct: (n.investment_haircut_pct ?? DEFAULT_HAIRCUT_PERCENT) / 100,
        haircutMonths:
            n.investment_haircut_months ?? DEFAULT_HAIRCUT_WINDOW_MONTHS,
    };
}
