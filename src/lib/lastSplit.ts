/** The last Personal / Shared choice, remembered across expense entries. */

const LAST_SPLIT_STORAGE_KEY = "budget_bubby_last_split_v1";

export function getStoredLastSplit(): boolean | undefined {
    try {
        const raw = window.localStorage.getItem(LAST_SPLIT_STORAGE_KEY);
        if (raw === "shared") return true;
        if (raw === "personal") return false;
    } catch {
        // Ignore localStorage errors
    }
    return undefined;
}

export function storeLastSplit(isShared: boolean): void {
    try {
        window.localStorage.setItem(LAST_SPLIT_STORAGE_KEY, isShared ? "shared" : "personal");
    } catch {
        // Ignore localStorage errors
    }
}
