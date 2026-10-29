/**
 * NotificationSettingsModal Component
 * Full-featured notification settings and threshold configuration modal.
 * 
 * Features:
 * - Master delivery channels: PWA Push Notifications & Audio Chimes
 * - Per-category toggles for all 8 notification domains
 * - Configurable thresholds: CC lead days, Budget warning %, Settlement cap
 * - Interactive test push notification and audio preview
 * - Persistent per-member synchronization
 */

import { useState, useEffect, useCallback } from "react";
import {
    Bell,
    Volume2,
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
} from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { financeService } from "../../services/financeService";
import { useHousehold } from "../../context/HouseholdContext";
import {
    requestNotificationPermission,
    dispatchPWANotification,
} from "../../lib/notificationScheduler";
import { playChaChingSound } from "../../lib/soundEffects";
import { getDefaultNotificationPreferences } from "../../data/mockSeedData";
import type { NotificationPreferences, UpdateNotificationPreferencesInput } from "../../types/finance";

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
    const { activeMember, members } = useHousehold();
    const activeMemberId = propMemberId || activeMember?.id || members?.[0]?.id || "mem-00000000-0011";

    const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
        getDefaultNotificationPreferences(activeMemberId),
    );
    const [, setIsLoading] = useState<boolean>(true);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [testPushSent, setTestPushSent] = useState<boolean>(false);

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

    // Reset to defaults
    const handleResetDefaults = async () => {
        const defaults = getDefaultNotificationPreferences(activeMemberId);
        setPrefs(defaults);
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

    return (
        <AnimatedModal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-xl"
        >
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    title="Settings"
                    subtitle="Customize sound effects, push notifications &amp; alert thresholds"
                    icon={<Settings className="h-5 w-5 stroke-[2.5] text-(--text-ink)" />}
                    iconBgColor="bg-[#dfc2ff]"
                    onClose={onClose}
                />

                <ModalBody className="p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    {/* Sound Effects Section */}
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-(--text-muted) mb-3 font-display">
                            Sound Effects
                        </h4>

                        <div className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-(--shadow-cute-sm)">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffe999] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) shrink-0">
                                    <Volume2 className="h-4 w-4 stroke-[2.5]" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-(--text-ink)">
                                        Sound Effects
                                    </span>
                                    <p className="text-[11px] text-(--text-muted) font-medium mt-0.5">
                                        Cha-ching spend logging chime &amp; budget warning sounds
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleTestSound}
                                    title="Play test audio chime"
                                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-(--bg-card) hover:bg-(--bg-canvas) text-(--text-ink) border-[1.5px] border-(--border-ink) text-[11px] font-bold shadow-(--shadow-cute-sm) transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                >
                                    <Volume2 className="h-3 w-3 stroke-[2.5]" />
                                    <span>Play</span>
                                </button>

                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={prefs.sound_enabled}
                                    aria-label="Toggle sound effects"
                                    data-testid="toggle-sound-enabled"
                                    onClick={() => handleUpdate({ sound_enabled: !prefs.sound_enabled })}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-[1.5px] border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
                                        prefs.sound_enabled ? "bg-[#ffe999]" : "bg-(--bg-card)"
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

                    {/* Push Notifications Section */}
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-(--text-muted) mb-3 font-display">
                            Notifications
                        </h4>

                        <div className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-(--shadow-cute-sm)">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#bbf7d0] text-[#14532d] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) shrink-0">
                                    <Bell className="h-4 w-4 stroke-[2.5]" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-(--text-ink)">
                                            Push Notifications
                                        </span>
                                        <span
                                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                permission === "granted"
                                                    ? "bg-[#bbf7d0] text-[#14532d] border-[#14532d]/40"
                                                    : permission === "denied"
                                                    ? "bg-[#fff1ee] text-[#9a1b1b] border-[#9a1b1b]/40"
                                                    : "bg-[#ffe999] text-[#78350f] border-[#78350f]/40"
                                            }`}
                                        >
                                            {permission}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-(--text-muted) font-medium mt-0.5">
                                        Receive native system notifications on this device
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleTestPush}
                                    title="Send test push notification"
                                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-(--bg-card) hover:bg-(--bg-canvas) text-(--text-ink) border-[1.5px] border-(--border-ink) text-[11px] font-bold shadow-(--shadow-cute-sm) transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                >
                                    <Send className="h-3 w-3 stroke-[2.5]" />
                                    <span>{testPushSent ? "Sent!" : "Test"}</span>
                                </button>

                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={prefs.push_enabled}
                                    aria-label="Toggle push notifications"
                                    data-testid="toggle-push-enabled"
                                    onClick={() => handleUpdate({ push_enabled: !prefs.push_enabled })}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-[1.5px] border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
                                        prefs.push_enabled ? "bg-[#bbf7d0]" : "bg-(--bg-card)"
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
                                        title="Credit Card Payment Due"
                                        description="Reminds you when an unpaid CC statement is due within lead time"
                                        isChecked={prefs.cc_payment_due}
                                        testId="toggle-cc-payment-due"
                                        onChange={(val) => handleUpdate({ cc_payment_due: val })}
                                    />

                                    {/* CC Missing Statement */}
                                    <CategoryToggleRow
                                        icon={<CreditCard className="h-4 w-4 text-amber-500 shrink-0" />}
                                        title="Missing Credit Card Statement"
                                        description="Alerts when a card billing cycle closed with no statement logged yet"
                                        isChecked={prefs.cc_missing_statement}
                                        testId="toggle-cc-missing-statement"
                                        onChange={(val) => handleUpdate({ cc_missing_statement: val })}
                                    />

                                    {/* Streak & Spend Logging */}
                                    <CategoryToggleRow
                                        icon={<Flame className="h-4 w-4 text-amber-500 shrink-0" />}
                                        title="Daily Streak &amp; Spend Check-in"
                                        description="Daily reminder (and evening nudge) to log spend and keep your streak"
                                        isChecked={prefs.streak_and_logging}
                                        testId="toggle-streak-logging"
                                        onChange={(val) => handleUpdate({ streak_and_logging: val })}
                                    />

                                    {/* Monthly Balance Updates */}
                                    <CategoryToggleRow
                                        icon={<Landmark className="h-4 w-4 text-blue-500 shrink-0" />}
                                        title="Monthly Balance Updates"
                                        description="Prompts on 1st and end of month to refresh account balances &amp; net worth"
                                        isChecked={prefs.monthly_balance_updates}
                                        testId="toggle-monthly-balances"
                                        onChange={(val) => handleUpdate({ monthly_balance_updates: val })}
                                    />

                                    {/* Partner & Shared Spend */}
                                    <CategoryToggleRow
                                        icon={<Users className="h-4 w-4 text-purple-500 shrink-0" />}
                                        title="Partner &amp; Shared Spend Alerts"
                                        description="Partner logged spend, unsettled balance reminders, and couple streak alert"
                                        isChecked={prefs.partner_shared_spend}
                                        testId="toggle-partner-shared-spend"
                                        onChange={(val) => handleUpdate({ partner_shared_spend: val })}
                                    />

                                    {/* Budget Limit Warnings */}
                                    <CategoryToggleRow
                                        icon={<AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />}
                                        title="Category Budget Limits"
                                        description="Warning alerts when spendable categories near or exceed monthly caps"
                                        isChecked={prefs.budget_limit_alerts}
                                        testId="toggle-budget-limit-alerts"
                                        onChange={(val) => handleUpdate({ budget_limit_alerts: val })}
                                    />

                                    {/* Recurring Bills Due */}
                                    <CategoryToggleRow
                                        icon={<CalendarClock className="h-4 w-4 text-emerald-500 shrink-0" />}
                                        title="Recurring Bills &amp; Policy Renewals"
                                        description="Insurance premiums, IRAS annual taxes, and subscriptions due this month"
                                        isChecked={prefs.recurring_bills_due}
                                        testId="toggle-recurring-bills"
                                        onChange={(val) => handleUpdate({ recurring_bills_due: val })}
                                    />

                                    {/* Savings Goals Pacing */}
                                    <CategoryToggleRow
                                        icon={<Target className="h-4 w-4 text-emerald-500 shrink-0" />}
                                        title="Savings Goal Pacing"
                                        description="Alerts when a goal falls behind target pacing or hits 100% achieved"
                                        isChecked={prefs.goal_pacing_alerts}
                                        testId="toggle-goal-pacing"
                                        onChange={(val) => handleUpdate({ goal_pacing_alerts: val })}
                                    />

                                    {/* Monthly Budget Review */}
                                    <CategoryToggleRow
                                        icon={<BookOpen className="h-4 w-4 text-indigo-500 shrink-0" />}
                                        title="Monthly Budget Review"
                                        description="Early month prompt to review allocations and lock in target budgets"
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

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* CC Due Days */}
                                    <div className="p-3 rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute-sm)">
                                        <label
                                            htmlFor="cc-lead-days-input"
                                            className="block text-[11px] font-black text-(--text-ink) mb-1"
                                        >
                                            CC Due Lead Time
                                        </label>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                id="cc-lead-days-input"
                                                type="number"
                                                min={1}
                                                max={14}
                                                value={prefs.cc_due_days_before}
                                                data-testid="input-cc-lead-days"
                                                onChange={(e) => {
                                                    const val = Math.max(1, Math.min(14, Number(e.target.value) || 5));
                                                    handleUpdate({ cc_due_days_before: val });
                                                }}
                                                className="w-16 px-2.5 py-1 text-xs font-bold font-mono-num rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-cream) text-(--text-ink) focus:outline-none"
                                            />
                                            <span className="text-[11px] font-bold text-(--text-muted)">days before</span>
                                        </div>
                                    </div>

                                    {/* Budget Warning % */}
                                    <div className="p-3 rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute-sm)">
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
                                                value={prefs.budget_warning_pct}
                                                data-testid="input-budget-warning-pct"
                                                onChange={(e) => {
                                                    const val = Math.max(50, Math.min(99, Number(e.target.value) || 80));
                                                    handleUpdate({ budget_warning_pct: val });
                                                }}
                                                className="w-16 px-2.5 py-1 text-xs font-bold font-mono-num rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-cream) text-(--text-ink) focus:outline-none"
                                            />
                                            <span className="text-[11px] font-bold text-(--text-muted)">% of cap</span>
                                        </div>
                                    </div>

                                    {/* Shared Settlement Cap */}
                                    <div className="p-3 rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute-sm)">
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
                                                value={prefs.settlement_threshold_sgd}
                                                data-testid="input-settlement-threshold"
                                                onChange={(e) => {
                                                    const val = Math.max(10, Number(e.target.value) || 200);
                                                    handleUpdate({ settlement_threshold_sgd: val });
                                                }}
                                                className="w-20 px-2.5 py-1 text-xs font-bold font-mono-num rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-cream) text-(--text-ink) focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border-2 border-dashed border-(--border-subtle) bg-(--bg-card)/50 p-4 text-center">
                            <p className="text-xs font-bold text-(--text-muted)">
                                Push notifications are turned off. Turn on Push Notifications above to customize alert types and thresholds.
                            </p>
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="flex items-center justify-between border-t-[1.5px] border-(--border-subtle) p-4">
                    <button
                        type="button"
                        onClick={handleResetDefaults}
                        data-testid="reset-notification-defaults-btn"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) transition-colors cursor-pointer"
                    >
                        <RotateCcw className="h-3.5 w-3.5 stroke-[2.5]" />
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
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute-sm) transition-colors hover:bg-(--bg-cream)">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-(--bg-cream) border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) shrink-0">
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
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-[1.5px] border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
                    isChecked ? "bg-[#dfc2ff]" : "bg-(--bg-cream)"
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
