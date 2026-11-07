/**
 * NotificationSettingsModal Component
 * Full-featured notification settings and threshold configuration modal.
 * 
 * Features:
 * - Master delivery channels: PWA Push Notifications & Audio Chimes
 * - Per-category toggles for all 8 notification domains
 * - Configurable thresholds: CC due reminder days, Budget warning %, Settlement cap
 * - Timing: daily check-in time and quiet hours
 * - Interactive test push notification and audio preview
 * - Persistent per-member synchronization
 */

import { useState, useEffect, useCallback } from "react";
import { AutoCaptureSection } from "../settings/AutoCaptureSection";
import {
    Bell,
    Volume2,
    Vibrate,
    CreditCard,
    CalendarClock,
    Flame,
    Landmark,
    Users,
    AlertTriangle,
    Target,
    BookOpen,
    RotateCcw,
    Check,
    Send,
    Settings,
    Clock,
    Moon,
} from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { financeService } from "../../services/financeService";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import {
    requestNotificationPermission,
    dispatchPWANotification,
    getCcDueReminderDays,
    DEFAULT_CHECKIN_TIME,
    DEFAULT_QUIET_HOURS_START,
    DEFAULT_QUIET_HOURS_END,
} from "../../lib/notificationScheduler";
import { formatTime12h } from "../../lib/dateUtils";
import { playChaChingSound } from "../../lib/soundEffects";
import { haptics } from "../../lib/haptics";
import { getDefaultNotificationPreferences } from "../../data/mockSeedData";
import type { NotificationPreferences, UpdateNotificationPreferencesInput } from "../../types/finance";

/** CC due reminder chips: days before due (0 = due day). */
const CC_DUE_DAY_OPTIONS: { day: number; label: string }[] = [
    { day: 7, label: "7d" },
    { day: 3, label: "3d" },
    { day: 1, label: "1d" },
    { day: 0, label: "Due day" },
];

export interface NotificationSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    memberId?: string;
}

export function NotificationSettingsModal({
    isOpen,
    onClose,
    memberId: propMemberId,
}: NotificationSettingsModalProps) {
    const { me, members } = useLoggedInMember();
    const activeMemberId = propMemberId || me?.id || members?.[0]?.id || "mem-00000000-0011";

    const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
        getDefaultNotificationPreferences(activeMemberId),
    );
    const [budgetWarningDraft, setBudgetWarningDraft] = useState<string>(() =>
        String(getDefaultNotificationPreferences(activeMemberId).budget_warning_pct),
    );
    const [settlementThresholdDraft, setSettlementThresholdDraft] = useState<string>(() =>
        String(getDefaultNotificationPreferences(activeMemberId).settlement_threshold_sgd),
    );
    const [, setIsLoading] = useState<boolean>(true);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [testPushSent, setTestPushSent] = useState<boolean>(false);
    const hasVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

    // Sync browser permission status
    useEffect(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            setPermission(Notification.permission);
        }
    }, [isOpen]);

    // Load preferences
    const loadPreferences = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await financeService.getNotificationPreferences(activeMemberId);
            setPrefs(data);
            setBudgetWarningDraft(String(data.budget_warning_pct));
            setSettlementThresholdDraft(String(data.settlement_threshold_sgd));
        } catch (err) {
            console.error("Failed to load notification preferences:", err);
        } finally {
            setIsLoading(false);
        }
    }, [activeMemberId]);

    useEffect(() => {
        if (isOpen) {
            loadPreferences();
        }
    }, [isOpen, loadPreferences]);

    // Update single preference
    const handleUpdate = async (updates: UpdateNotificationPreferencesInput) => {
        setPrefs((prev) => ({ ...prev, ...updates }));
        try {
            await financeService.updateNotificationPreferences(activeMemberId, updates);
        } catch (err) {
            console.error("Failed to save notification preference update:", err);
        }
    };

    const commitBudgetWarningPct = () => {
        const trimmed = budgetWarningDraft.trim();
        const parsed = Number(trimmed);
        const val =
            trimmed === "" || !Number.isFinite(parsed)
                ? 80
                : Math.max(50, Math.min(99, Math.round(parsed)));
        setBudgetWarningDraft(String(val));
        handleUpdate({ budget_warning_pct: val });
    };

    const commitSettlementThreshold = () => {
        const trimmed = settlementThresholdDraft.trim();
        const parsed = Number(trimmed);
        const val =
            trimmed === "" || !Number.isFinite(parsed)
                ? 200
                : Math.max(10, Math.round(parsed));
        setSettlementThresholdDraft(String(val));
        handleUpdate({ settlement_threshold_sgd: val });
    };

    const ccDueDays = getCcDueReminderDays(prefs);
    const checkinTime = prefs.checkin_time || DEFAULT_CHECKIN_TIME;

    const handleToggleCcDueDay = (day: number) => {
        const next = ccDueDays.includes(day)
            ? ccDueDays.filter((d) => d !== day)
            : [...ccDueDays, day].sort((a, b) => b - a);
        // Keep the legacy lead time in sync for the previously deployed frontend
        const legacyLeadDays = Math.max(1, Math.min(14, next.length ? Math.max(...next) : 1));
        handleUpdate({ cc_due_reminder_days: next, cc_due_days_before: legacyLeadDays });
    };

    const handleTimeUpdate = (
        key: "checkin_time" | "quiet_hours_start" | "quiet_hours_end",
        value: string,
    ) => {
        if (/^\d{2}:\d{2}$/.test(value)) handleUpdate({ [key]: value });
    };

    // Reset to defaults
    const handleResetDefaults = async () => {
        const defaults = getDefaultNotificationPreferences(activeMemberId);
        setPrefs(defaults);
        setBudgetWarningDraft(String(defaults.budget_warning_pct));
        setSettlementThresholdDraft(String(defaults.settlement_threshold_sgd));
        try {
            await financeService.updateNotificationPreferences(activeMemberId, defaults);
        } catch (err) {
            console.error("Failed to reset notification preferences:", err);
        }
    };

    // Test Push Notification
    const handleTestPush = async () => {
        let currentPerm = permission;
        if (currentPerm !== "granted") {
            currentPerm = await requestNotificationPermission();
            setPermission(currentPerm);
        }
        if (currentPerm === "granted") {
            const success = await dispatchPWANotification("Budget Bubby Test Notification 🔔", {
                body: "Notifications are working smoothly on your device! ✨",
                tag: "test-notification",
            });
            if (success) {
                setTestPushSent(true);
                setTimeout(() => setTestPushSent(false), 3000);
            }
        }
    };

    // Test Audio
    const handleTestSound = () => {
        playChaChingSound();
    };

    // Test Haptics
    const handleTestHaptic = () => {
        haptics.celebrate();
    };

    return (
        <AnimatedModal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-xl"
        >
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    title="Settings"
                    icon={<Settings className="h-5 w-5 text-(--text-ink)" strokeWidth={2.5} />}
                    iconBgColor="bg-(--pastel-lilac)"
                    onClose={onClose}
                />

                <ModalBody className="p-4 sm:p-6 space-y-6">
                    {/* Sound Effects Section */}
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-(--text-muted) mb-3 font-display">
                            Sound Effects
                        </h4>

                        <div className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-cute-sm">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--pastel-butter) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm shrink-0">
                                    <Volume2 className="h-4 w-4" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-(--text-ink)">
                                        Sound Effects
                                    </span>
                                    <p className="text-[11px] text-(--text-muted) font-medium mt-0.5">
                                        Chime on log, alert sounds
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleTestSound}
                                    title="Play test audio chime"
                                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-(--bg-card) hover:bg-(--bg-canvas) text-(--text-ink) border-2 border-(--border-ink) text-[11px] font-bold shadow-cute-sm transition-press active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                >
                                    <Volume2 className="h-3 w-3" strokeWidth={2.5} />
                                    <span>Play</span>
                                </button>

                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={prefs.sound_enabled}
                                    aria-label="Toggle sound effects"
                                    data-testid="toggle-sound-enabled"
                                    onClick={() => handleUpdate({ sound_enabled: !prefs.sound_enabled })}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
                                        prefs.sound_enabled ? "bg-(--pastel-butter)" : "bg-(--bg-card)"
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-(--text-ink) shadow-md ring-0 transition duration-200 ease-in-out ${
                                            prefs.sound_enabled ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Haptic Feedback Section */}
                    {hasVibrate && (
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-(--text-muted) mb-3 font-display">
                                Haptic Feedback
                            </h4>

                            <div className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-cute-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm shrink-0">
                                        <Vibrate className="h-4 w-4" strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-(--text-ink)">
                                            Haptic Feedback
                                        </span>
                                        <p className="text-[11px] text-(--text-muted) font-medium mt-0.5">
                                            Vibrate on actions
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleTestHaptic}
                                        title="Test haptic vibration"
                                        className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-(--bg-card) hover:bg-(--bg-canvas) text-(--text-ink) border-2 border-(--border-ink) text-[11px] font-bold shadow-cute-sm transition-press active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                    >
                                        <Vibrate className="h-3 w-3" strokeWidth={2.5} />
                                        <span>Vibrate</span>
                                    </button>

                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={prefs.haptics_enabled ?? true}
                                        aria-label="Toggle haptic feedback"
                                        data-testid="toggle-haptics-enabled"
                                        onClick={() => handleUpdate({ haptics_enabled: !(prefs.haptics_enabled ?? true) })}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
                                            (prefs.haptics_enabled ?? true) ? "bg-(--pastel-lilac)" : "bg-(--bg-card)"
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-(--text-ink) shadow-md ring-0 transition duration-200 ease-in-out ${
                                                (prefs.haptics_enabled ?? true) ? "translate-x-5" : "translate-x-0"
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Auto Capture (phone purchase capture tokens) */}
                    <AutoCaptureSection memberId={activeMemberId} />

                    {/* Push Notifications Section */}
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-(--text-muted) mb-3 font-display">
                            Notifications
                        </h4>

                        <div className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-cute-sm">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--pastel-mint) text-(--accent-mint-ink) border-2 border-(--border-ink) shadow-cute-sm shrink-0">
                                    <Bell className="h-4 w-4" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-(--text-ink)">
                                            Push Notifications
                                        </span>
                                        <span
                                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                permission === "granted"
                                                    ? "bg-(--pastel-mint) text-(--accent-mint-ink) border-(--accent-mint-ink)/40"
                                                    : permission === "denied"
                                                    ? "bg-(--pastel-coral-light) text-(--accent-coral-ink) border-(--accent-coral-ink)/40"
                                                    : "bg-(--pastel-butter) text-amber-900 border-amber-900/40"
                                            }`}
                                        >
                                            {permission}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-(--text-muted) font-medium mt-0.5">
                                        System alerts on this device
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleTestPush}
                                    title="Send test push notification"
                                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-(--bg-card) hover:bg-(--bg-canvas) text-(--text-ink) border-2 border-(--border-ink) text-[11px] font-bold shadow-cute-sm transition-press active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                >
                                    <Send className="h-3 w-3" strokeWidth={2.5} />
                                    <span>{testPushSent ? "Sent!" : "Test"}</span>
                                </button>

                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={prefs.push_enabled}
                                    aria-label="Toggle push notifications"
                                    data-testid="toggle-push-enabled"
                                    onClick={() => handleUpdate({ push_enabled: !prefs.push_enabled })}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
                                        prefs.push_enabled ? "bg-(--pastel-mint)" : "bg-(--bg-card)"
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-(--text-ink) shadow-md ring-0 transition duration-200 ease-in-out ${
                                            prefs.push_enabled ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Conditional Notification Categories & Custom Thresholds Section */}
                    {prefs.push_enabled ? (
                        <>
                            {/* Notification Categories Section */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-(--text-muted) mb-3 font-display">
                                    Notification Types
                                </h4>

                                <div className="space-y-2.5">
                                    {/* CC Payment Due */}
                                    <CategoryToggleRow
                                        icon={<CreditCard className="h-4 w-4 text-rose-500 shrink-0" />}
                                        title="Card Due"
                                        description="Alert before statement due date"
                                        isChecked={prefs.cc_payment_due}
                                        testId="toggle-cc-payment-due"
                                        onChange={(val) => handleUpdate({ cc_payment_due: val })}
                                    />

                                    {/* CC Missing Statement */}
                                    <CategoryToggleRow
                                        icon={<CreditCard className="h-4 w-4 text-amber-500 shrink-0" />}
                                        title="Card Statement"
                                        description="Alert when statement is not yet logged"
                                        isChecked={prefs.cc_missing_statement}
                                        testId="toggle-cc-missing-statement"
                                        onChange={(val) => handleUpdate({ cc_missing_statement: val })}
                                    />

                                    {/* Bubby nudges (stored as streak_and_logging) */}
                                    <CategoryToggleRow
                                        icon={<Flame className="h-4 w-4 text-amber-500 shrink-0" />}
                                        title="Bubby Nudges"
                                        description={`${formatTime12h(checkinTime)} nudge when Bubby needs a snack`}
                                        isChecked={prefs.streak_and_logging}
                                        testId="toggle-streak-logging"
                                        onChange={(val) => handleUpdate({ streak_and_logging: val })}
                                    />

                                    {/* Monthly Balance Updates */}
                                    <CategoryToggleRow
                                        icon={<Landmark className="h-4 w-4 text-blue-500 shrink-0" />}
                                        title="Balances"
                                        description="Month-end balance refresh prompt"
                                        isChecked={prefs.monthly_balance_updates}
                                        testId="toggle-monthly-balances"
                                        onChange={(val) => handleUpdate({ monthly_balance_updates: val })}
                                    />

                                    {/* Partner & Shared Spend */}
                                    <CategoryToggleRow
                                        icon={<Users className="h-4 w-4 text-purple-500 shrink-0" />}
                                        title="Partner Spend"
                                        description="Partner spend and split updates"
                                        isChecked={prefs.partner_shared_spend}
                                        testId="toggle-partner-shared-spend"
                                        onChange={(val) => handleUpdate({ partner_shared_spend: val })}
                                    />

                                    {/* Budget Limit Warnings */}
                                    <CategoryToggleRow
                                        icon={<AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />}
                                        title="Budget Limits"
                                        description="Warn when categories near budget limit"
                                        isChecked={prefs.budget_limit_alerts}
                                        testId="toggle-budget-limit-alerts"
                                        onChange={(val) => handleUpdate({ budget_limit_alerts: val })}
                                    />

                                    {/* Recurring Bills Due */}
                                    <CategoryToggleRow
                                        icon={<CalendarClock className="h-4 w-4 text-emerald-500 shrink-0" />}
                                        title="Recurring"
                                        description="Remind before recurring items are due"
                                        isChecked={prefs.recurring_bills_due}
                                        testId="toggle-recurring-bills"
                                        onChange={(val) => handleUpdate({ recurring_bills_due: val })}
                                    />

                                    {/* Savings Goals Pacing */}
                                    <CategoryToggleRow
                                        icon={<Target className="h-4 w-4 text-emerald-500 shrink-0" />}
                                        title="Goals"
                                        description="Goal pacing and achievement alerts"
                                        isChecked={prefs.goal_pacing_alerts}
                                        testId="toggle-goal-pacing"
                                        onChange={(val) => handleUpdate({ goal_pacing_alerts: val })}
                                    />

                                    {/* Monthly Budget Review */}
                                    <CategoryToggleRow
                                        icon={<BookOpen className="h-4 w-4 text-indigo-500 shrink-0" />}
                                        title="Budget Review"
                                        description="Early month budget review prompt"
                                        isChecked={prefs.monthly_budget_review}
                                        testId="toggle-monthly-budget-review"
                                        onChange={(val) => handleUpdate({ monthly_budget_review: val })}
                                    />
                                </div>
                            </div>

                            {/* Custom Thresholds Section */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-(--text-muted) mb-3 font-display">
                                    Custom Thresholds
                                </h4>

                                {/* CC Due Reminder Days */}
                                <div className="mb-3 p-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-cute-sm">
                                    <div
                                        id="cc-due-days-label"
                                        className="text-[11px] font-black text-(--text-ink) mb-2"
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
                                                    onClick={() => handleToggleCcDueDay(day)}
                                                    className={`h-10 min-w-14 px-3 rounded-xl border-2 border-(--border-ink) text-xs font-black shadow-cute-sm transition-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer ${
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

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                    {/* Budget Warning % */}
                                    <div className="p-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-cute-sm">
                                        <label
                                            htmlFor="budget-warning-pct-input"
                                            className="block text-[11px] font-black text-(--text-ink) mb-1"
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
                                                onChange={(e) => setBudgetWarningDraft(e.target.value)}
                                                onBlur={commitBudgetWarningPct}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        commitBudgetWarningPct();
                                                    }
                                                }}
                                                className="w-16 px-2.5 py-1 text-base sm:text-xs font-bold font-mono-num rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) text-(--text-ink) focus:outline-none"
                                            />
                                            <span className="text-[11px] font-bold text-(--text-muted)">% of cap</span>
                                        </div>
                                    </div>

                                    {/* Shared Settlement Cap */}
                                    <div className="p-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-cute-sm">
                                        <label
                                            htmlFor="settlement-threshold-input"
                                            className="block text-[11px] font-black text-(--text-ink) mb-1"
                                        >
                                            Settlement Cap
                                        </label>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-(--text-muted)">SGD</span>
                                            <input
                                                id="settlement-threshold-input"
                                                type="number"
                                                min={50}
                                                step={50}
                                                value={settlementThresholdDraft}
                                                data-testid="input-settlement-threshold"
                                                onChange={(e) => setSettlementThresholdDraft(e.target.value)}
                                                onBlur={commitSettlementThreshold}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        commitSettlementThreshold();
                                                    }
                                                }}
                                                className="w-20 px-2.5 py-1 text-base sm:text-xs font-bold font-mono-num rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) text-(--text-ink) focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Timing Section */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-(--text-muted) mb-3 font-display">
                                    Timing
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <TimeField
                                        id="checkin-time-input"
                                        label="Check-in Time"
                                        icon={<Clock className="h-3.5 w-3.5" strokeWidth={2.5} />}
                                        value={checkinTime}
                                        testId="input-checkin-time"
                                        onChange={(val) => handleTimeUpdate("checkin_time", val)}
                                    />
                                    <TimeField
                                        id="quiet-start-input"
                                        label="Quiet From"
                                        icon={<Moon className="h-3.5 w-3.5" strokeWidth={2.5} />}
                                        value={prefs.quiet_hours_start || DEFAULT_QUIET_HOURS_START}
                                        testId="input-quiet-start"
                                        onChange={(val) => handleTimeUpdate("quiet_hours_start", val)}
                                    />
                                    <TimeField
                                        id="quiet-end-input"
                                        label="Quiet Until"
                                        icon={<Moon className="h-3.5 w-3.5" strokeWidth={2.5} />}
                                        value={prefs.quiet_hours_end || DEFAULT_QUIET_HOURS_END}
                                        testId="input-quiet-end"
                                        onChange={(val) => handleTimeUpdate("quiet_hours_end", val)}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border-2 border-dashed border-(--border-subtle) bg-(--bg-card)/50 p-4 text-center">
                            <p className="text-xs font-bold text-(--text-muted)">
                                Push is off.
                            </p>
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="flex items-center justify-between border-t-2 border-(--border-subtle) p-4">
                    <button
                        type="button"
                        onClick={handleResetDefaults}
                        data-testid="reset-notification-defaults-btn"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) transition-colors cursor-pointer"
                    >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.5} />
                        <span>Reset to Defaults</span>
                    </button>

                    <Button
                        variant="primary"
                        size="sm"
                        onClick={onClose}
                        leftIcon={<Check className="h-4 w-4 stroke-3" />}
                    >
                        Done
                    </Button>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
}

interface TimeFieldProps {
    id: string;
    label: string;
    icon: React.ReactNode;
    value: string;
    testId: string;
    onChange: (val: string) => void;
}

function TimeField({ id, label, icon, value, testId, onChange }: TimeFieldProps) {
    return (
        <div className="p-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-cute-sm">
            <label
                htmlFor={id}
                className="flex items-center gap-1 text-[11px] font-black text-(--text-ink) mb-1"
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
                className="w-full h-10 px-2.5 text-base sm:text-xs font-bold font-mono-num rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) text-(--text-ink) focus:outline-none"
            />
        </div>
    );
}

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
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-cute-sm transition-colors hover:bg-(--bg-cream)">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-(--bg-cream) border-2 border-(--border-ink) shadow-cute-sm shrink-0">
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-(--text-ink)">{title}</div>
                    <div className="text-[11px] text-(--text-muted) font-medium truncate">
                        {description}
                    </div>
                </div>
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={isChecked}
                aria-label={`Toggle ${title}`}
                data-testid={testId}
                onClick={() => onChange(!isChecked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
                    isChecked ? "bg-(--pastel-lilac)" : "bg-(--bg-cream)"
                }`}
            >
                <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-(--text-ink) shadow-md ring-0 transition duration-200 ease-in-out ${
                        isChecked ? "translate-x-5" : "translate-x-0"
                    }`}
                />
            </button>
        </div>
    );
}

export default NotificationSettingsModal;
