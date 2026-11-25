/**
 * Notification thresholds (card due days, budget warning %, settlement cap)
 * and timing (check-in time, quiet hours), each in a collapsed section.
 */

import { Clock, Moon, SlidersHorizontal } from "lucide-react";
import {
    getCcDueReminderDays,
    DEFAULT_CHECKIN_TIME,
    DEFAULT_QUIET_HOURS_START,
    DEFAULT_QUIET_HOURS_END,
} from "../../lib/notificationScheduler";
import type { NotificationPrefsState } from "../../hooks/useNotificationPrefs";
import { CollapsibleSection } from "../ui/CollapsibleSection";

/** CC due reminder chips: days before due (0 = due day). */
const CC_DUE_DAY_OPTIONS: { day: number; label: string }[] = [
    { day: 7, label: "7d" },
    { day: 3, label: "3d" },
    { day: 1, label: "1d" },
    { day: 0, label: "Due day" },
];

interface TimeFieldProps {
    id: string;
    label: string;
    icon: React.ReactNode;
    value: string;
    testId: string;
    onChange: (val: string) => void;
}

function TimeField({
    id,
    label,
    icon,
    value,
    testId,
    onChange,
}: TimeFieldProps) {
    return (
        <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-cute-sm">
            <label
                htmlFor={id}
                className="mb-1 flex items-center gap-1 text-[11px] font-black text-(--text-ink)"
            >
                {icon}
                {label}
            </label>
            <input
                id={id}
                type="time"
                value={value}
                data-testid={testId}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) px-2.5 text-base font-bold font-mono-num text-(--text-ink) focus:outline-none sm:text-xs"
            />
        </div>
    );
}

export interface NotificationAdvancedSectionsProps {
    notif: NotificationPrefsState;
}

export function NotificationAdvancedSections({
    notif,
}: NotificationAdvancedSectionsProps) {
    const {
        prefs,
        update,
        budgetWarningDraft,
        setBudgetWarningDraft,
        settlementThresholdDraft,
        setSettlementThresholdDraft,
        commitBudgetWarningPct,
        commitSettlementThreshold,
    } = notif;

    const ccDueDays = getCcDueReminderDays(prefs);
    const checkinTime = prefs.checkin_time || DEFAULT_CHECKIN_TIME;

    const handleToggleCcDueDay = (day: number) => {
        const next = ccDueDays.includes(day)
            ? ccDueDays.filter((d) => d !== day)
            : [...ccDueDays, day].sort((a, b) => b - a);
        // Keep the legacy lead time in sync for the previously deployed frontend
        const legacyLeadDays = Math.max(
            1,
            Math.min(14, next.length ? Math.max(...next) : 1),
        );
        void update({
            cc_due_reminder_days: next,
            cc_due_days_before: legacyLeadDays,
        });
    };

    const handleTimeUpdate = (
        key: "checkin_time" | "quiet_hours_start" | "quiet_hours_end",
        value: string,
    ) => {
        if (/^\d{2}:\d{2}$/.test(value)) void update({ [key]: value });
    };

    return (
        <div className="space-y-3">
            <CollapsibleSection
                title="Custom Thresholds"
                icon={
                    <SlidersHorizontal className="h-4 w-4" strokeWidth={2.5} />
                }
            >
                <div className="space-y-3">
                    <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-cute-sm">
                        <div
                            id="cc-due-days-label"
                            className="mb-2 text-[11px] font-black text-(--text-ink)"
                        >
                            CC Due Reminders
                        </div>
                        <div
                            role="group"
                            aria-labelledby="cc-due-days-label"
                            className="flex flex-wrap gap-2"
                        >
                            {CC_DUE_DAY_OPTIONS.map(({ day, label }) => {
                                const isOn = ccDueDays.includes(day);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        aria-pressed={isOn}
                                        data-testid={`chip-cc-due-${day}`}
                                        onClick={() =>
                                            handleToggleCcDueDay(day)
                                        }
                                        className={`h-10 min-w-14 cursor-pointer rounded-xl border-2 border-(--border-ink) px-3 text-xs font-black shadow-cute-sm transition-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                                            isOn
                                                ? "bg-(--pastel-lilac) text-(--text-ink)"
                                                : "bg-(--bg-cream) text-(--text-muted)"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-cute-sm">
                            <label
                                htmlFor="budget-warning-pct-input"
                                className="mb-1 block text-[11px] font-black text-(--text-ink)"
                            >
                                Budget Warning %
                            </label>
                            <div className="flex items-center gap-1.5">
                                <input
                                    id="budget-warning-pct-input"
                                    type="number"
                                    min={50}
                                    max={99}
                                    value={budgetWarningDraft}
                                    data-testid="input-budget-warning-pct"
                                    onChange={(e) =>
                                        setBudgetWarningDraft(e.target.value)
                                    }
                                    onBlur={commitBudgetWarningPct}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            commitBudgetWarningPct();
                                        }
                                    }}
                                    className="w-16 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) px-2.5 py-1 text-base font-bold font-mono-num text-(--text-ink) focus:outline-none sm:text-xs"
                                />
                                <span className="text-[11px] font-bold text-(--text-muted)">
                                    % of cap
                                </span>
                            </div>
                        </div>

                        <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-cute-sm">
                            <label
                                htmlFor="settlement-threshold-input"
                                className="mb-1 block text-[11px] font-black text-(--text-ink)"
                            >
                                Settlement Cap
                            </label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-(--text-muted)">
                                    SGD
                                </span>
                                <input
                                    id="settlement-threshold-input"
                                    type="number"
                                    min={50}
                                    step={50}
                                    value={settlementThresholdDraft}
                                    data-testid="input-settlement-threshold"
                                    onChange={(e) =>
                                        setSettlementThresholdDraft(
                                            e.target.value,
                                        )
                                    }
                                    onBlur={commitSettlementThreshold}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            commitSettlementThreshold();
                                        }
                                    }}
                                    className="w-20 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) px-2.5 py-1 text-base font-bold font-mono-num text-(--text-ink) focus:outline-none sm:text-xs"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                title="Timing"
                icon={<Clock className="h-4 w-4" strokeWidth={2.5} />}
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <TimeField
                        id="checkin-time-input"
                        label="Check-in Time"
                        icon={
                            <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
                        }
                        value={checkinTime}
                        testId="input-checkin-time"
                        onChange={(val) =>
                            handleTimeUpdate("checkin_time", val)
                        }
                    />
                    <TimeField
                        id="quiet-start-input"
                        label="Quiet From"
                        icon={
                            <Moon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        }
                        value={
                            prefs.quiet_hours_start || DEFAULT_QUIET_HOURS_START
                        }
                        testId="input-quiet-start"
                        onChange={(val) =>
                            handleTimeUpdate("quiet_hours_start", val)
                        }
                    />
                    <TimeField
                        id="quiet-end-input"
                        label="Quiet Until"
                        icon={
                            <Moon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        }
                        value={prefs.quiet_hours_end || DEFAULT_QUIET_HOURS_END}
                        testId="input-quiet-end"
                        onChange={(val) =>
                            handleTimeUpdate("quiet_hours_end", val)
                        }
                    />
                </div>
            </CollapsibleSection>
        </div>
    );
}
