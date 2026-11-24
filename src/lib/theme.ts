/** Shared theme helpers, used by HouseholdContext and the public legal pages. */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "budget_buddy_theme";

export function readStoredTheme(): Theme {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") return stored;
    } catch {
        // Storage unavailable in restricted environments
    }
    return "light";
}

export function applyThemeClass(theme: Theme): void {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
}
