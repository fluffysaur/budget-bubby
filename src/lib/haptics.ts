/**
 * Haptic Feedback Engine for Budget Bubby.
 * Provides tactile vibration patterns for:
 * - Pull-to-refresh trigger (lightTap: 12ms)
 * - Expense logged (success: 25ms)
 * - Daily streak check-in (celebrate: [30, 45, 50]ms)
 * - Surplus sweep to goals (sweep: [35, 50, 65]ms)
 * - Budget cap warning 80% (warning: [35, 45, 35]ms)
 * - Budget cap exceeded 100%+ (alert: [65, 45, 65]ms)
 * - Goal milestone or deposit (goalMilestone: [30, 40, 50]ms)
 * - Destructive action confirmation (destructive: [50, 50]ms)
 *
 * Checks device capability, user settings (`bb_notif_prefs_`),
 * and respects system 'prefers-reduced-motion'.
 */

export type HapticPattern = number | number[] | readonly number[];

export const HAPTIC_PATTERNS = {
    lightTap: 12,
    success: 25,
    celebrate: [30, 45, 50],
    sweep: [35, 50, 65],
    goalMilestone: [30, 40, 50],
    warning: [35, 45, 35],
    alert: [65, 45, 65],
    destructive: [50, 50],
} as const;

/**
 * Check if the current browser and platform support navigator.vibrate.
 */
export function isHapticsSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "navigator" in window &&
        typeof navigator.vibrate === "function"
    );
}

/**
 * Check if haptic feedback is allowed according to user preferences
 * and system accessibility settings (prefers-reduced-motion).
 */
export function isHapticsEnabled(): boolean {
    if (typeof window === "undefined") return false;

    // Respect system accessibility setting for reduced motion
    try {
        if (
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            return false;
        }
    } catch {
        // Ignore matchMedia evaluation failures in test or restricted environments
    }

    // Check saved notification & feedback preferences in localStorage
    if (!window.localStorage) return true;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("bb_notif_prefs_")) {
                const item = localStorage.getItem(key);
                if (item) {
                    const parsed = JSON.parse(item);
                    if (parsed && typeof parsed.haptics_enabled === "boolean") {
                        return parsed.haptics_enabled;
                    }
                }
            }
        }
    } catch {
        // Fallback to enabled
    }

    return true;
}

/**
 * Triggers a vibration pattern if supported and enabled.
 * Returns true if vibration was accepted, false otherwise.
 */
export function triggerHaptic(pattern: HapticPattern): boolean {
    if (!isHapticsSupported() || !isHapticsEnabled()) return false;
    try {
        return navigator.vibrate(pattern as number | number[]);
    } catch (err) {
        console.debug("Haptic feedback skipped:", err);
        return false;
    }
}

/**
 * High-level semantic haptic triggers for Budget Bubby.
 */
export const haptics = {
    lightTap: () => triggerHaptic(HAPTIC_PATTERNS.lightTap),
    success: () => triggerHaptic(HAPTIC_PATTERNS.success),
    celebrate: () => triggerHaptic(HAPTIC_PATTERNS.celebrate),
    sweep: () => triggerHaptic(HAPTIC_PATTERNS.sweep),
    goalMilestone: () => triggerHaptic(HAPTIC_PATTERNS.goalMilestone),
    warning: () => triggerHaptic(HAPTIC_PATTERNS.warning),
    alert: () => triggerHaptic(HAPTIC_PATTERNS.alert),
    destructive: () => triggerHaptic(HAPTIC_PATTERNS.destructive),
    trigger: triggerHaptic,
    isSupported: isHapticsSupported,
    isEnabled: isHapticsEnabled,
};
