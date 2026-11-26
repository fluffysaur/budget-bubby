/**
 * SettingsSwitch - the pill toggle used by every settings row.
 */

export interface SettingsSwitchProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    testId?: string;
    /** Background token when on, e.g. "bg-(--pastel-mint)". */
    onClassName?: string;
}

export function SettingsSwitch({
    checked,
    onChange,
    label,
    testId,
    onClassName = "bg-(--pastel-lilac)",
}: SettingsSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            data-testid={testId}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
                checked ? onClassName : "bg-(--bg-card)"
            }`}
        >
            <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-(--text-ink) shadow-md ring-0 transition duration-200 ease-in-out ${
                    checked ? "translate-x-5" : "translate-x-0"
                }`}
            />
        </button>
    );
}
