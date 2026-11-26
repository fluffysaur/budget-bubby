/**
 * Short live status words for the Settings index rows.
 */

export function getGeneralStatus(theme: "light" | "dark"): string {
    return theme === "dark" ? "Dark" : "Light";
}

/** Blocked wins over the saved toggle: the device will not show alerts. */
export function getNotificationsStatus(
    pushEnabled: boolean,
    permission: NotificationPermission | "unsupported",
): "On" | "Off" | "Blocked" {
    if (permission === "denied") return "Blocked";
    return pushEnabled ? "On" : "Off";
}

/** The connected provider's name, or "Off" when no key is saved. */
export function getAiStatus(providerLabel: string, hasKey: boolean): string {
    return hasKey ? providerLabel : "Off";
}

/** "Set up" once at least one capture token exists. */
export function getAutoCaptureStatus(tokenCount: number): "Set up" | "Not set" {
    return tokenCount > 0 ? "Set up" : "Not set";
}
