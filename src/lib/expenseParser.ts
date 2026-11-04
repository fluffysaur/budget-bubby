import { SUPPORTED_CURRENCIES } from "./currencyConverter";
import { getCurrentSingaporeTime } from "./dateUtils";
import type { Category, SavingsGoal } from "../types/finance";

// Currency symbols (e.g. RM, ₫, NT$), longest first so "US$" isn't read as "S$".
const CURRENCY_ALIASES = SUPPORTED_CURRENCIES.flatMap((c) =>
    (c.aliases ?? []).map((alias) => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return {
            code: c.code,
            length: alias.length,
            // Symbol right before or after a number, not inside a word.
            regex: new RegExp(
                `(?<![A-Za-z])${escaped}\\s?(?=\\d)|(?<=\\d)\\s?${escaped}(?![A-Za-z])`,
                "i",
            ),
        };
    }),
).sort((a, b) => b.length - a.length);

export interface BulkExpenseDraftRow {
    id: string;
    date: string;
    time?: string;
    amount: number | "";
    currency: string;
    categoryId: string;
    goalId?: string | null;
    item: string;
    isShared: boolean;
    tags: string[];
}

/**
 * Intelligent parser that extracts amount, date, tags, description, and auto-detects category
 */
export function parseBulkExpenseText(
    text: string,
    defaultDate: string,
    categories: Category[] = [],
    goals: SavingsGoal[] = [],
    defaultShared: boolean = true,
): BulkExpenseDraftRow[] {
    const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    // Helper to find category by keyword
    const findCategoryByKeyword = (kw: string): Category | undefined => {
        const lower = kw.toLowerCase();
        return categories.find((c) => {
            const cName = c.name.toLowerCase();
            if (
                lower.includes("food") ||
                lower.includes("lunch") ||
                lower.includes("dinner") ||
                lower.includes("coffee") ||
                lower.includes("grocer") ||
                lower.includes("hawker") ||
                lower.includes("breakfast")
            ) {
                return cName.includes("food");
            }
            if (
                lower.includes("grab") ||
                lower.includes("gojek") ||
                lower.includes("taxi") ||
                lower.includes("mrt") ||
                lower.includes("bus") ||
                lower.includes("transport") ||
                lower.includes("petrol")
            ) {
                return cName.includes("transport");
            }
            if (
                lower.includes("shop") ||
                lower.includes("movie") ||
                lower.includes("date") ||
                lower.includes("lifestyle") ||
                lower.includes("gym")
            ) {
                return cName.includes("lifestyle");
            }
            if (
                lower.includes("clinic") ||
                lower.includes("doctor") ||
                lower.includes("pharmacy") ||
                lower.includes("utility") ||
                lower.includes("bill") ||
                lower.includes("buffer")
            ) {
                return cName.includes("buffer");
            }
            return false;
        });
    };

    // Helper to find goal by keyword
    const findGoalByKeyword = (kw: string): SavingsGoal | undefined => {
        const cleanKw = kw.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!cleanKw) return undefined;
        return goals.find((g) => {
            const cleanTitle = g.title.toLowerCase().replace(/[^a-z0-9]/g, "");
            return (
                cleanTitle &&
                (cleanKw.includes(cleanTitle) || cleanTitle.includes(cleanKw))
            );
        });
    };

    const defaultCategory = categories[0]?.id || "";

    return lines.map((line, index) => {
        let working = line;

        // 1. Extract hashtags (#VietnamTrip, #Dinner, etc.)
        const tags: string[] = [];
        const hashRegex = /#([\w\d_-]+)/g;
        let match: RegExpExecArray | null;
        while ((match = hashRegex.exec(working)) !== null) {
            tags.push(match[1]);
        }
        working = working.replace(hashRegex, " ").trim();

        // 2. Extract date if present (e.g. 2026-10-27 or 2026/10/27)
        let date = defaultDate;
        const dateMatch = working.match(/\b(\d{4}[-/]\d{2}[-/]\d{2})\b/);
        if (dateMatch) {
            date = dateMatch[1].replace(/\//g, "-");
            working = working.replace(dateMatch[0], " ").trim();
        }

        // 3. Extract time if specified (e.g. 14:30, 2:30pm, 09:15 AM, 9am)
        let time: string = getCurrentSingaporeTime();
        const timeMatch24 = working.match(
            /\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\s*(am|pm)?\b/i,
        );
        const timeMatch12 = !timeMatch24
            ? working.match(/\b(1[0-2]|0?[1-9])\s*(am|pm)\b/i)
            : null;

        if (timeMatch24) {
            let hours = parseInt(timeMatch24[1], 10);
            const minutes = timeMatch24[2];
            const ampm = timeMatch24[3]?.toLowerCase();
            if (ampm === "pm" && hours < 12) hours += 12;
            if (ampm === "am" && hours === 12) hours = 0;
            time = `${String(hours).padStart(2, "0")}:${minutes}`;
            working = working.replace(timeMatch24[0], " ").trim();
        } else if (timeMatch12) {
            let hours = parseInt(timeMatch12[1], 10);
            const ampm = timeMatch12[2].toLowerCase();
            if (ampm === "pm" && hours < 12) hours += 12;
            if (ampm === "am" && hours === 12) hours = 0;
            time = `${String(hours).padStart(2, "0")}:00`;
            working = working.replace(timeMatch12[0], " ").trim();
        }

        // 4. Extract currency: a code (VND, CNY) wins over a symbol (₫, ¥ = JPY).
        // A plain "$" stays SGD.
        let currency = "SGD";
        let codeFound = false;
        for (const c of SUPPORTED_CURRENCIES) {
            const codeRegex = new RegExp(`\\b${c.code}\\b`, "i");
            if (codeRegex.test(working)) {
                currency = c.code;
                codeFound = true;
                working = working.replace(codeRegex, " ").trim();
                break;
            }
        }
        const symbolMatch = CURRENCY_ALIASES.find((a) => a.regex.test(working));
        if (symbolMatch) {
            if (!codeFound) currency = symbolMatch.code;
            working = working.replace(symbolMatch.regex, " ").trim();
        }

        // 5. Extract amount (e.g. 12.50, 4.20, $35.00, S$12.50)
        let amount: number = 0;
        const amountMatch = working.match(
            /(?:S\$|\$|RM|₫|¥|฿|€|£)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?|\d+)/i,
        );
        if (amountMatch) {
            const rawNum = amountMatch[1].replace(/,/g, "");
            amount = parseFloat(rawNum) || 0;
            working = working.replace(amountMatch[0], " ").trim();
        }

        // 6. Clean up remaining description
        let item = working
            .replace(/^[-–—:]+/, "")
            .replace(/[-–—:]+$/, "")
            .trim();

        if (!item) {
            item = tags.length > 0 ? tags.join(" ") : `Expense ${index + 1}`;
        }

        // 7. Detect Savings Goal or Category from description & tags
        const detectedGoal =
            findGoalByKeyword(tags.join(" ")) || findGoalByKeyword(item);

        const goalId = detectedGoal ? detectedGoal.id : null;

        let categoryId = "";
        if (!goalId) {
            const detectedCat =
                findCategoryByKeyword(item) ||
                findCategoryByKeyword(tags.join(" "));
            categoryId = detectedCat ? detectedCat.id : defaultCategory;
        }

        // Determine shared status: check tags first (#shared, #5050, #solo, #personal)
        let isShared = defaultShared;
        const lowerTags = tags.map((t) => t.toLowerCase());
        if (lowerTags.includes("shared") || lowerTags.includes("5050")) {
            isShared = true;
        } else if (
            lowerTags.includes("solo") ||
            lowerTags.includes("personal")
        ) {
            isShared = false;
        }

        return {
            id: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
            date,
            time,
            amount: amount > 0 ? amount : "",
            currency,
            categoryId,
            goalId,
            item,
            isShared,
            tags,
        };
    });
}
