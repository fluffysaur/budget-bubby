/**
 * Settings > Notifications: push master row, the nine category toggles, then
 * thresholds and timing (collapsed) and Reset to Defaults.
 */

import {
    CreditCard,
    CalendarClock,
    Flame,
    Landmark,
    Users,
    AlertTriangle,
    Target,
    BookOpen,
    RotateCcw,
} from "lucide-react";
import { DEFAULT_CHECKIN_TIME } from "../../lib/notificationScheduler";
import { formatTime12h } from "../../lib/dateUtils";
import type { NotificationPrefsState } from "../../hooks/useNotificationPrefs";
import type { NotificationPreferences } from "../../types/finance";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { PushNotificationRow } from "./PushNotificationRow";
import { NotificationAdvancedSections } from "./NotificationAdvancedSections";
import { SettingsSwitch } from "./SettingsSwitch";

interface CategoryToggleRowProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    isChecked: boolean;
    testId: string;
    onChange: (val: boolean) => void;
}

function CategoryToggleRow({
    icon,
    title,
    description,
    isChecked,
    testId,
    onChange,
}: CategoryToggleRowProps) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-cute-sm transition-colors hover:bg-(--bg-cream)">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-cute-sm">
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-(--text-ink)">
                        {title}
                    </div>
                    <div className="truncate text-[11px] font-medium text-(--text-muted)">
                        {description}
                    </div>
                </div>
            </div>
            <SettingsSwitch
                checked={isChecked}
                onChange={onChange}
                label={`Toggle ${title}`}
                testId={testId}
            />
        </div>
    );
}

interface CategoryDef {
    key: keyof NotificationPreferences;
    testId: string;
    title: string;
    description: string;
    icon: React.ReactNode;
}

function buildCategories(checkinTime: string): CategoryDef[] {
    return [
        {
            key: "cc_payment_due",
            testId: "toggle-cc-payment-due",
            title: "Card Due",
            description: "Alert before statement due date",
            icon: <CreditCard className="h-4 w-4 shrink-0 text-rose-500" />,
        },
        {
            key: "cc_missing_statement",
            testId: "toggle-cc-missing-statement",
            title: "Card Statement",
            description: "Alert when statement is not yet logged",
            icon: <CreditCard className="h-4 w-4 shrink-0 text-amber-500" />,
        },
        {
            // Bubby nudges are stored as streak_and_logging
            key: "streak_and_logging",
            testId: "toggle-streak-logging",
            title: "Bubby Nudges",
            description: `${formatTime12h(checkinTime)} nudge when Bubby needs a snack`,
            icon: <Flame className="h-4 w-4 shrink-0 text-amber-500" />,
        },
        {
            key: "monthly_balance_updates",
            testId: "toggle-monthly-balances",
            title: "Balances",
            description: "Month-end balance refresh prompt",
            icon: <Landmark className="h-4 w-4 shrink-0 text-blue-500" />,
        },
        {
            key: "partner_shared_spend",
            testId: "toggle-partner-shared-spend",
            title: "Partner Spend",
            description: "Partner spend and split updates",
            icon: <Users className="h-4 w-4 shrink-0 text-purple-500" />,
        },
        {
            key: "budget_limit_alerts",
            testId: "toggle-budget-limit-alerts",
            title: "Budget Limits",
            description: "Warn when categories near budget limit",
            icon: <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />,
        },
        {
            key: "recurring_bills_due",
            testId: "toggle-recurring-bills",
            title: "Recurring",
            description: "Remind before recurring items are due",
            icon: (
                <CalendarClock className="h-4 w-4 shrink-0 text-emerald-500" />
            ),
        },
        {
            key: "goal_pacing_alerts",
            testId: "toggle-goal-pacing",
            title: "Goals",
            description: "Goal pacing and achievement alerts",
            icon: <Target className="h-4 w-4 shrink-0 text-emerald-500" />,
        },
        {
            key: "monthly_budget_review",
            testId: "toggle-monthly-budget-review",
            title: "Budget Review",
            description: "Early month budget review prompt",
            icon: <BookOpen className="h-4 w-4 shrink-0 text-indigo-500" />,
        },
    ];
}

export interface NotificationSettingsSectionProps {
    notif: NotificationPrefsState;
}

export function NotificationSettingsSection({
    notif,
}: NotificationSettingsSectionProps) {
    const { prefs, update, errorMessage, clearError, resetToDefaults } = notif;
    const checkinTime = prefs.checkin_time || DEFAULT_CHECKIN_TIME;
    const categories = buildCategories(checkinTime);

    return (
        <div className="space-y-4" data-testid="settings-notifications">
            {errorMessage && (
                <Alert variant="danger" onClose={clearError}>
                    {errorMessage}
                </Alert>
            )}

            <PushNotificationRow
                pushEnabled={prefs.push_enabled}
                onToggle={(next) => void update({ push_enabled: next })}
            />

            {prefs.push_enabled ? (
                <>
                    <div className="space-y-2.5">
                        {categories.map((c) => (
                            <CategoryToggleRow
                                key={c.key}
                                icon={c.icon}
                                title={c.title}
                                description={c.description}
                                isChecked={Boolean(prefs[c.key])}
                                testId={c.testId}
                                onChange={(val) =>
                                    void update({ [c.key]: val })
                                }
                            />
                        ))}
                    </div>

                    <NotificationAdvancedSections notif={notif} />
                </>
            ) : (
                <div className="rounded-2xl border-2 border-dashed border-(--border-subtle) bg-(--bg-card)/50 p-4 text-center">
                    <p className="text-xs font-bold text-(--text-muted)">
                        Push is off.
                    </p>
                </div>
            )}

            <div className="flex justify-center pt-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void resetToDefaults()}
                    data-testid="reset-notification-defaults-btn"
                    leftIcon={
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.5} />
                    }
                >
                    Reset to Defaults
                </Button>
            </div>
        </div>
    );
}
