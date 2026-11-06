import type { Category } from "../types/finance";

export interface CategoryKeywordRule {
    keywords: string[];
    /** Substring matched (case-insensitive) against category names. */
    categoryKey: string;
}

/** Category keyword matching rules for smart auto-detection. */
export const KEYWORD_CATEGORY_MAP: readonly CategoryKeywordRule[] = [
    {
        keywords: [
            "grab",
            "gojek",
            "mrt",
            "bus",
            "taxi",
            "comfortdelgro",
            "parking",
            "petrol",
            "ez-link",
            "ezlink",
            "simplygo",
            "transit",
            "fuel",
            "tada",
        ],
        categoryKey: "transport",
    },
    {
        keywords: [
            "lunch",
            "dinner",
            "breakfast",
            "coffee",
            "cafe",
            "hawker",
            "food",
            "groceries",
            "fairprice",
            "cold storage",
            "sheng siong",
            "shengsiong",
            "breadtalk",
            "toast box",
            "yakun",
            "starbucks",
            "kfc",
            "mcdonalds",
            "macdonalds",
            "bubble tea",
            "koi",
            "liho",
            "snack",
            "restaurant",
            "subway",
        ],
        categoryKey: "food",
    },
    {
        keywords: [
            "shopping",
            "movie",
            "cinema",
            "gym",
            "netflix",
            "spotify",
            "date night",
            "personal care",
            "gifts",
            "uniqlo",
            "zara",
            "shopee",
            "lazada",
            "entertainment",
            "games",
            "haircut",
        ],
        categoryKey: "lifestyle",
    },
    {
        keywords: [
            "clinic",
            "pharmacy",
            "doctor",
            "hospital",
            "panadol",
            "watsons",
            "guardian",
            "utilities",
            "repair",
            "sp services",
            "maintenance",
            "dentist",
        ],
        categoryKey: "buffer",
    },
];

/**
 * Guess a category from free text (expense description, merchant name, ...).
 * Returns the first rule whose keyword appears in the text AND whose
 * categoryKey matches an existing category name; undefined when nothing fits.
 */
export function guessCategory(
    text: string,
    categories: readonly Category[],
): Category | undefined {
    const lower = text.toLowerCase();
    if (!lower.trim()) return undefined;
    for (const rule of KEYWORD_CATEGORY_MAP) {
        if (!rule.keywords.some((kw) => lower.includes(kw))) continue;
        const match = categories.find((c) =>
            c.name.toLowerCase().includes(rule.categoryKey),
        );
        if (match) return match;
    }
    return undefined;
}

/** Same as guessCategory but returns only the category id. */
export function guessCategoryId(
    text: string,
    categories: readonly Category[],
): string | undefined {
    return guessCategory(text, categories)?.id;
}
