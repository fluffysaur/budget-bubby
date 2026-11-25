import type { SelectGroup, SelectItem, SelectOption } from "./types";

/** Search turns on automatically above this many enabled options. */
export const SEARCH_THRESHOLD = 8;

export function isSelectGroup(item: SelectItem): item is SelectGroup {
    return Array.isArray((item as SelectGroup).options);
}

/** Every option in display order, groups expanded. */
export function flattenOptions(items: readonly SelectItem[]): SelectOption[] {
    const out: SelectOption[] = [];
    for (const item of items) {
        if (isSelectGroup(item)) out.push(...item.options);
        else out.push(item);
    }
    return out;
}

export function countEnabledOptions(items: readonly SelectItem[]): number {
    return flattenOptions(items).filter((o) => !o.disabled).length;
}

/** `searchable` overrides; otherwise search shows above {@link SEARCH_THRESHOLD}. */
export function shouldShowSearch(
    items: readonly SelectItem[],
    searchable?: boolean,
): boolean {
    if (searchable !== undefined) return searchable;
    return countEnabledOptions(items) > SEARCH_THRESHOLD;
}

function matches(option: SelectOption, needle: string): boolean {
    if (option.label.toLowerCase().includes(needle)) return true;
    return Boolean(option.description?.toLowerCase().includes(needle));
}

/**
 * Case-insensitive match on label and description. Groups keep their
 * heading only while at least one of their options matches.
 */
export function filterItems(
    items: readonly SelectItem[],
    query: string,
): SelectItem[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [...items];
    const out: SelectItem[] = [];
    for (const item of items) {
        if (isSelectGroup(item)) {
            const options = item.options.filter((o) => matches(o, needle));
            if (options.length > 0) out.push({ ...item, options });
        } else if (matches(item, needle)) {
            out.push(item);
        }
    }
    return out;
}

export function findOption(
    items: readonly SelectItem[],
    value: string | null | undefined,
): SelectOption | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    return flattenOptions(items).find((o) => o.value === value);
}

/** Next enabled index from `from` in `direction`, or `from` when none. */
export function nextEnabledIndex(
    options: readonly SelectOption[],
    from: number,
    direction: 1 | -1,
): number {
    for (
        let i = from + direction;
        i >= 0 && i < options.length;
        i += direction
    ) {
        if (!options[i].disabled) return i;
    }
    return from;
}

export function firstEnabledIndex(options: readonly SelectOption[]): number {
    return options.findIndex((o) => !o.disabled);
}

export function lastEnabledIndex(options: readonly SelectOption[]): number {
    for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) return i;
    }
    return -1;
}
