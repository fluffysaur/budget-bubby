/**
 * Settings > General: theme, sound effects and haptic feedback.
 */

import { Moon, Sun, Vibrate, Volume2 } from "lucide-react";
import { useHousehold } from "../../context/HouseholdContext";
import { playChaChingSound } from "../../lib/soundEffects";
import { haptics } from "../../lib/haptics";
import type { NotificationPrefsState } from "../../hooks/useNotificationPrefs";
import { Alert } from "../ui/Alert";
import { SettingsSwitch } from "./SettingsSwitch";

const ROW_CLASS =
    "flex items-center justify-between gap-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-3.5 shadow-cute-sm";
const ICON_CLASS =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) text-(--text-ink) shadow-cute-sm";
const TEST_BTN_CLASS =
    "hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-(--bg-card) hover:bg-(--bg-canvas) text-(--text-ink) border-2 border-(--border-ink) text-[11px] font-bold shadow-cute-sm transition-press active:translate-x-0.5 active:translate-y-0.5 cursor-pointer";

export interface GeneralSettingsSectionProps {
    notif: NotificationPrefsState;
}

export function GeneralSettingsSection({ notif }: GeneralSettingsSectionProps) {
    const { theme, toggleTheme } = useHousehold();
    const { prefs, update, errorMessage, clearError } = notif;
    const hasVibrate =
        typeof navigator !== "undefined" && "vibrate" in navigator;
    const hapticsOn = prefs.haptics_enabled ?? true;
    const isDark = theme === "dark";

    return (
        <div className="space-y-3" data-testid="settings-general">
            {errorMessage && (
                <Alert variant="danger" onClose={clearError}>
                    {errorMessage}
                </Alert>
            )}

            <div className={ROW_CLASS}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={`${ICON_CLASS} bg-(--pastel-lilac)`}>
                        {isDark ? (
                            <Moon className="h-4 w-4" strokeWidth={2.5} />
                        ) : (
                            <Sun className="h-4 w-4" strokeWidth={2.5} />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-(--text-ink)">
                            Dark Mode
                        </span>
                        <p className="mt-0.5 text-[11px] font-medium text-(--text-muted)">
                            {isDark ? "Dark" : "Light"} theme
                        </p>
                    </div>
                </div>
                <SettingsSwitch
                    checked={isDark}
                    onChange={() => toggleTheme()}
                    label="Toggle dark mode"
                    testId="toggle-theme"
                />
            </div>

            <div className={ROW_CLASS}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={`${ICON_CLASS} bg-(--pastel-butter)`}>
                        <Volume2 className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-(--text-ink)">
                            Sound Effects
                        </span>
                        <p className="mt-0.5 text-[11px] font-medium text-(--text-muted)">
                            Chime on log, alert sounds
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => playChaChingSound()}
                        title="Play test audio chime"
                        className={TEST_BTN_CLASS}
                    >
                        <Volume2 className="h-3 w-3" strokeWidth={2.5} />
                        <span>Play</span>
                    </button>
                    <SettingsSwitch
                        checked={prefs.sound_enabled}
                        onChange={(next) =>
                            void update({ sound_enabled: next })
                        }
                        label="Toggle sound effects"
                        testId="toggle-sound-enabled"
                        onClassName="bg-(--pastel-butter)"
                    />
                </div>
            </div>

            {hasVibrate && (
                <div className={ROW_CLASS}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className={`${ICON_CLASS} bg-(--pastel-lilac)`}>
                            <Vibrate className="h-4 w-4" strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-(--text-ink)">
                                Haptic Feedback
                            </span>
                            <p className="mt-0.5 text-[11px] font-medium text-(--text-muted)">
                                Vibrate on actions
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => haptics.celebrate()}
                            title="Test haptic vibration"
                            className={TEST_BTN_CLASS}
                        >
                            <Vibrate className="h-3 w-3" strokeWidth={2.5} />
                            <span>Vibrate</span>
                        </button>
                        <SettingsSwitch
                            checked={hapticsOn}
                            onChange={(next) =>
                                void update({ haptics_enabled: next })
                            }
                            label="Toggle haptic feedback"
                            testId="toggle-haptics-enabled"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
