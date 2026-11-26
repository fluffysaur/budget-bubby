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
import { Input } from "../ui/Input";
import { CurrencyInput } from "../ui/CurrencyInput";
import { FilterChip } from "../ui/FilterChip";

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
            <Input
                id={id}
                sizeVariant="sm"
                type="time"
                value={value}
                data-testid={testId}
                onChange={(e) => onChange(e.target.value)}
                className="font-mono-num font-bold"
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
                                    <FilterChip
                                        key={day}
                                        selected={isOn}
                                        data-testid={`chip-cc-due-${day}`}
                                        onClick={() =>
                                            handleToggleCcDueDay(day)
                                        }
                                        className="h-10 min-w-14"
                                    >
                                        {label}
                                    </FilterChip>
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
                                <div className="w-20 shrink-0">
                                    <Input
                                        id="budget-warning-pct-input"
                                        sizeVariant="sm"
                                        type="number"
                                        min={50}
                                        max={99}
                                        value={budgetWarningDraft}
                                        data-testid="input-budget-warning-pct"
                                        onChange={(e) =>
                                            setBudgetWarningDraft(
                                                e.target.value,
                                            )
                                        }
                                        onBlur={commitBudgetWarningPct}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                commitBudgetWarningPct();
                                            }
                                        }}
                                    />
                                </div>
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
                                <div className="w-32 shrink-0">
                                    <CurrencyInput
                                        id="settlement-threshold-input"
                                        sizeVariant="sm"
                                        currencySymbol="SGD"
                                        min={50}
                                        step={50}
                                        placeholder=""
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
                                    />
                                </div>
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
