/**
 * Settings route map: one place for the section ids, titles and paths used by
 * the settings page, the deep links (`openSettings("ai")`) and the router.
 */

export const SETTINGS_BASE_PATH = "/settings";

export type SettingsSection =
    "general" | "notifications" | "ai" | "auto-capture";

export interface SettingsSectionMeta {
    id: SettingsSection;
    title: string;
}

export const SETTINGS_SECTIONS: readonly SettingsSectionMeta[] = [
    { id: "general", title: "General" },
    { id: "notifications", title: "Notifications" },
    { id: "ai", title: "Bubby AI" },
    { id: "auto-capture", title: "Auto-capture" },
];

export function isSettingsSection(value: unknown): value is SettingsSection {
    return SETTINGS_SECTIONS.some((s) => s.id === value);
}

/** `/settings` for no section, `/settings/<section>` otherwise. */
export function settingsPath(section?: SettingsSection): string {
    return section ? `${SETTINGS_BASE_PATH}/${section}` : SETTINGS_BASE_PATH;
}

export function isSettingsPath(pathname: string): boolean {
    return (
        pathname === SETTINGS_BASE_PATH ||
        pathname.startsWith(`${SETTINGS_BASE_PATH}/`)
    );
}

/**
 * Reads the section from a pathname. `null` is the index (or a non-settings
 * path); `"unknown"` is a `/settings/<junk>` path the page redirects away from.
 */
export function parseSettingsSection(
    pathname: string,
): SettingsSection | null | "unknown" {
    if (!isSettingsPath(pathname)) return null;
    const segment = pathname
        .slice(SETTINGS_BASE_PATH.length)
        .replace(/^\/+|\/+$/g, "");
    if (!segment) return null;
    return isSettingsSection(segment) ? segment : "unknown";
}

export function getSettingsSectionTitle(section: SettingsSection): string {
    return SETTINGS_SECTIONS.find((s) => s.id === section)?.title ?? "Settings";
}
