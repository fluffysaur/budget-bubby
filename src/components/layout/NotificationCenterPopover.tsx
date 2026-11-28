/**
 * NotificationCenterPopover Component
 *
 * Features:
 * - Bell icon with dynamic badge count of active reminders
 * - Responsive presentation:
 *   - Mobile (< sm): Full-screen dedicated overlay portal (prevents edge-clipping on all devices)
 *   - Desktop (>= sm): Anchored floating popover dropdown
 * - Direct deep-links to appropriate tabs (accounts, expenses, budget, recurring, goals)
 * - Read and dismiss state stored per member in the notification log
 * - Badge counts unread reminders; opening the bell marks them read
 * - PWA push permission opt-in banner
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Bell,
    Fish,
    Landmark,
    CreditCard,
    CheckCircle2,
    X,
    ChevronRight,
    Users,
    AlertTriangle,
    CalendarClock,
    Target,
    BookOpen,
} from "lucide-react";
import {
    computeActiveReminders,
    evaluateAndDispatchReminders,
    migrateLegacyDismissals,
    type AppReminder,
} from "../../lib/notificationScheduler";
import { syncPushSubscription } from "../../lib/pushSubscription";
import { AnimatedModal } from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { TruncatedText } from "../ui/TruncatedText";
import { ScrollArea } from "../ui/ScrollArea";
import { emitAppEvent } from "../../lib/appEvents";
import { financeService } from "../../services/financeService";
import { getTodayDateString } from "../../lib/dateUtils";
import { playChaChingSound } from "../../lib/soundEffects";
import { useHousehold } from "../../context/HouseholdContext";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import { useNotificationPermission } from "../../hooks/useNotificationPermission";

function useIsMobile(breakpoint = 640): boolean {
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return window.innerWidth < breakpoint;
    });

    useEffect(() => {
        if (typeof window === "undefined") return;
        const check = () => {
            setIsMobile(window.innerWidth < breakpoint);
        };
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, [breakpoint]);

    return isMobile;
}

export interface NotificationCenterPopoverProps {
    className?: string;
    onNavigateTab?: (tab: string) => void;
    onOpenUpdateBalances?: () => void;
    onOpenSettings?: () => void;
}

export function NotificationCenterPopover({
    className = "",
    onNavigateTab,
    onOpenUpdateBalances,
}: NotificationCenterPopoverProps) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { refreshData } = useHousehold();
    const { me } = useLoggedInMember();
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [reminders, setReminders] = useState<AppReminder[]>([]);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const [loadError, setLoadError] = useState<string | null>(null);
    const {
        permission,
        needsSystemSettings,
        isRequesting,
        request: requestPermission,
    } = useNotificationPermission();
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const bellButtonRef = useRef<HTMLButtonElement>(null);

    // Reminders belong to the member using this device; none until known
    const activeMemberId = me?.id ?? "";
    const readParam = searchParams.get("read");

    const loadReadIds = useCallback(async () => {
        if (!activeMemberId) return new Set<string>();
        const log = await financeService.getNotificationLog(activeMemberId);
        return new Set(
            log
                .filter((entry) => entry.read_at)
                .map((entry) => entry.reminder_key),
        );
    }, [activeMemberId]);

    // Load active reminders for current member
    const loadReminders = useCallback(async () => {
        if (!activeMemberId) return;
        try {
            setLoadError(null);
            const [active, read] = await Promise.all([
                computeActiveReminders({ memberId: activeMemberId }),
                loadReadIds(),
            ]);
            setReminders(active);
            setReadIds(read);
        } catch (err) {
            setLoadError(
                err instanceof Error && err.message
                    ? err.message
                    : "Could not load reminders.",
            );
        }
    }, [activeMemberId, loadReadIds]);

    // Load reminders and dispatch push notifications cleanly for active member without double-firing
    useEffect(() => {
        let isMounted = true;

        // Reset reminders on active member change to prevent cross-user leak
        setReminders([]);
        setDismissedIds(new Set());
        setReadIds(new Set());
        setLoadError(null);
        if (!activeMemberId) return;

        migrateLegacyDismissals(activeMemberId)
            .then(() =>
                Promise.all([
                    evaluateAndDispatchReminders({ memberId: activeMemberId }),
                    loadReadIds(),
                ]),
            )
            .then(([active, read]) => {
                if (isMounted) {
                    setReminders(active);
                    setReadIds(read);
                }
            })
            .catch((err: unknown) => {
                if (!isMounted) return;
                setLoadError(
                    err instanceof Error && err.message
                        ? err.message
                        : "Could not load reminders.",
                );
            });

        return () => {
            isMounted = false;
        };
    }, [activeMemberId, loadReadIds]);

    // Keep this device's push subscription in line with permission and preferences
    const syncSubscription = useCallback(async () => {
        if (!activeMemberId) return;
        try {
            const prefs =
                await financeService.getNotificationPreferences(activeMemberId);
            if (permission === "unsupported") return;
            await syncPushSubscription(
                activeMemberId,
                prefs.push_enabled,
                permission,
            );
        } catch (err) {
            setLoadError(
                err instanceof Error && err.message
                    ? err.message
                    : "Could not sync alert settings.",
            );
        }
    }, [activeMemberId, permission]);

    useEffect(() => {
        syncSubscription();
    }, [syncSubscription]);

    // A tapped push opens the app with ?read=key1,key2: mark those read, then strip the param
    useEffect(() => {
        if (!readParam || !activeMemberId) return;
        const keys = readParam.split(",").filter(Boolean);
        const known = new Map(reminders.map((r) => [r.id, r.type]));
        const refs = keys.map((key) => ({
            key,
            type: known.get(key) ?? "push",
        }));
        setReadIds((prev) => new Set([...prev, ...keys]));
        financeService
            .markNotificationsRead(activeMemberId, refs)
            .catch((err: unknown) => {
                setReadIds((prev) => {
                    const next = new Set(prev);
                    for (const k of keys) next.delete(k);
                    return next;
                });
                emitAppEvent("app:error", {
                    title: "Update failed",
                    subtitle:
                        err instanceof Error && err.message
                            ? err.message
                            : "Could not mark reminders read.",
                });
            });
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.delete("read");
                return next;
            },
            { replace: true },
        );
    }, [readParam, reminders, activeMemberId, setSearchParams]);

    // Listen for global notification preference updates
    useEffect(() => {
        const handlePreferencesUpdated = () => {
            loadReminders();
            syncSubscription();
        };
        window.addEventListener(
            "notificationPreferencesUpdated",
            handlePreferencesUpdated,
        );
        return () =>
            window.removeEventListener(
                "notificationPreferencesUpdated",
                handlePreferencesUpdated,
            );
    }, [loadReminders, syncSubscription]);

    // Filter out dismissed reminders
    const visibleReminders = reminders.filter((r) => !dismissedIds.has(r.id));
    const count = visibleReminders.length;
    const unreadCount = visibleReminders.filter(
        (r) => !readIds.has(r.id),
    ).length;

    // Opening the bell marks every visible reminder as read
    const handleToggleOpen = () => {
        const opening = !isOpen;
        setIsOpen(opening);
        if (!opening) return;
        const unread = visibleReminders.filter((r) => !readIds.has(r.id));
        if (unread.length === 0) return;
        const unreadIds = unread.map((r) => r.id);
        setReadIds((prev) => new Set([...prev, ...unreadIds]));
        financeService
            .markNotificationsRead(
                activeMemberId,
                unread.map((r) => ({ key: r.id, type: r.type })),
            )
            .catch((err: unknown) => {
                setReadIds((prev) => {
                    const next = new Set(prev);
                    for (const id of unreadIds) next.delete(id);
                    return next;
                });
                emitAppEvent("app:error", {
                    title: "Update failed",
                    subtitle:
                        err instanceof Error && err.message
                            ? err.message
                            : "Could not mark reminders read.",
                });
            });
    };

    const handleDismiss = (reminder: AppReminder) => {
        setDismissedIds((prev) => new Set([...prev, reminder.id]));
        financeService
            .dismissNotification(activeMemberId, {
                key: reminder.id,
                type: reminder.type,
            })
            .catch((err: unknown) => {
                setDismissedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(reminder.id);
                    return next;
                });
                emitAppEvent("app:error", {
                    title: "Dismiss failed",
                    subtitle:
                        err instanceof Error && err.message
                            ? err.message
                            : "Could not dismiss reminder.",
                });
            });
    };

    // Explicit "No Spend" check-in from the daily check-in reminder
    const handleNoSpend = async (reminder: AppReminder) => {
        setIsProcessing(true);
        try {
            await financeService.recordDailyCheckin(
                activeMemberId,
                getTodayDateString(),
                "no_spend",
            );
            playChaChingSound();
            handleDismiss(reminder);
            await refreshData();
            await loadReminders();
        } catch (err) {
            emitAppEvent("app:error", {
                title: "Check-in failed",
                subtitle:
                    err instanceof Error && err.message
                        ? err.message
                        : "Could not record no-spend check-in.",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRequestPermission = async () => {
        await requestPermission();
    };

    // Execute reminder action with deep navigation
    const handleAction = async (reminder: AppReminder) => {
        setIsProcessing(true);
        try {
            if (reminder.actionType === "check_in") {
                setIsOpen(false);
                if (reminder.type === "daily_checkin") {
                    // Open the add-expense flow; never record a check-in silently
                    window.dispatchEvent(new Event("openQuickAdd"));
                } else if (onNavigateTab) {
                    onNavigateTab("dashboard");
                }
            } else if (reminder.actionType === "update_balances") {
                setIsOpen(false);
                if (onOpenUpdateBalances) {
                    onOpenUpdateBalances();
                } else if (onNavigateTab) {
                    onNavigateTab("accounts");
                }
            } else if (reminder.actionType === "view_cc") {
                setIsOpen(false);
                if (onNavigateTab) {
                    onNavigateTab("expenses");
                }
            } else if (reminder.actionType === "view_expenses") {
                setIsOpen(false);
                if (onNavigateTab) {
                    onNavigateTab("expenses");
                }
            } else if (reminder.actionType === "view_inbox") {
                setIsOpen(false);
                if (onNavigateTab) {
                    onNavigateTab("inbox");
                }
            } else if (reminder.actionType === "view_settlement") {
                setIsOpen(false);
                if (onNavigateTab) {
                    onNavigateTab("dashboard");
                }
            } else if (reminder.actionType === "view_budget") {
                setIsOpen(false);
                if (onNavigateTab) {
                    onNavigateTab("budget");
                }
            } else if (reminder.actionType === "view_recurring") {
                setIsOpen(false);
                if (onNavigateTab) {
                    onNavigateTab("plan");
                }
            } else if (reminder.actionType === "view_goals") {
                setIsOpen(false);
                const goalId =
                    typeof reminder.data?.goalId === "string"
                        ? reminder.data.goalId
                        : undefined;
                const query = goalId
                    ? `?goalId=${encodeURIComponent(goalId)}`
                    : "";
                navigate(`/goals${query}`);
                if (onNavigateTab) {
                    onNavigateTab(`goals${query}`);
                }
            }
        } catch (err) {
            emitAppEvent("app:error", {
                title: "Action failed",
                subtitle:
                    err instanceof Error && err.message
                        ? err.message
                        : "Could not open reminder.",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const getReminderIcon = (type: AppReminder["type"]) => {
        switch (type) {
            case "daily_checkin":
                return <Fish className="h-4 w-4 text-sky-500 shrink-0" />;
            case "balance_update":
                return <Landmark className="h-4 w-4 text-blue-500 shrink-0" />;
            case "credit_card_due":
                return (
                    <CreditCard className="h-4 w-4 text-rose-500 shrink-0" />
                );
            case "credit_card_missing_stmt":
                return (
                    <CreditCard className="h-4 w-4 text-amber-500 shrink-0" />
                );
            case "partner_shared_spend":
            case "settlement_due":
                return <Users className="h-4 w-4 text-purple-500 shrink-0" />;
            case "budget_limit":
                return (
                    <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                );
            case "recurring_bill_due":
                return (
                    <CalendarClock className="h-4 w-4 text-emerald-500 shrink-0" />
                );
            case "goal_pacing":
                return <Target className="h-4 w-4 text-emerald-500 shrink-0" />;
            case "monthly_budget_review":
                return (
                    <BookOpen className="h-4 w-4 text-indigo-500 shrink-0" />
                );
            default:
                return <Bell className="h-4 w-4 text-emerald-500 shrink-0" />;
        }
    };

    // Shared list of reminder items
    const renderRemindersList = () => (
        <>
            {loadError && (
                <Alert
                    variant="danger"
                    className="mb-3"
                    onClose={() => setLoadError(null)}
                >
                    {loadError}
                </Alert>
            )}

            {/* Browser Permission Prompt Banner */}
            {permission === "default" && (
                <div
                    data-testid="push-permission-banner"
                    className="mb-3 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-(--pastel-mint)/40 border-2 border-(--border-ink) shadow-cute-sm"
                >
                    <div
                        data-testid="push-permission-banner-text"
                        className="min-w-0 flex-1 text-[11px] text-(--accent-mint-ink) dark:text-(--pastel-mint-dark) font-bold"
                    >
                        {needsSystemSettings
                            ? "Allow alerts in browser or system settings, then reopen."
                            : "Get alerts on this device?"}
                    </div>
                    {!needsSystemSettings && (
                        <button
                            type="button"
                            data-testid="enable-push-notifications-btn"
                            disabled={isRequesting}
                            onClick={handleRequestPermission}
                            className="relative after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] px-2.5 py-1 rounded-lg bg-(--pastel-mint) text-emerald-950 border border-(--border-ink) text-2xs font-black hover:bg-(--pastel-mint-dark) transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isRequesting ? "Enabling..." : "Enable"}
                        </button>
                    )}
                </div>
            )}

            {/* Empty State */}
            {visibleReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--pastel-mint) text-(--accent-mint-ink) border-2 border-(--border-ink) shadow-cute-sm mb-2.5">
                        <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />
                    </div>
                    <p className="text-sm font-black text-(--text-ink)">
                        No Reminders
                    </p>
                    <p className="text-xs text-(--text-muted) font-medium mt-0.5">
                        You're all caught up.
                    </p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {visibleReminders.map((reminder) => (
                        <div
                            key={reminder.id}
                            data-testid={`reminder-card-${reminder.id}`}
                            className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-3.5 shadow-cute-sm transition-colors"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    {getReminderIcon(reminder.type)}
                                    <TruncatedText
                                        text={reminder.title}
                                        className="text-xs font-bold text-(--text-ink)"
                                    />
                                    {!readIds.has(reminder.id) && (
                                        <span
                                            data-testid={`reminder-unread-${reminder.id}`}
                                            aria-label="Unread"
                                            className="h-2 w-2 shrink-0 rounded-full bg-(--accent-coral)"
                                        />
                                    )}
                                </div>

                                <button
                                    type="button"
                                    data-testid={`reminder-dismiss-${reminder.id}`}
                                    aria-label="Dismiss reminder"
                                    onClick={() => handleDismiss(reminder)}
                                    className="shrink-0 text-(--text-muted) hover:text-(--text-ink) p-0.5 cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <p className="mt-1 text-xs text-(--text-muted) font-medium leading-snug">
                                {reminder.message}
                            </p>

                            <div className="mt-3 flex items-center justify-end gap-2">
                                {reminder.type === "daily_checkin" && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        data-testid="reminder-action-no-spend"
                                        disabled={isProcessing}
                                        onClick={() => handleNoSpend(reminder)}
                                    >
                                        No Spend
                                    </Button>
                                )}
                                <Button
                                    variant="primary"
                                    size="sm"
                                    data-testid={`reminder-action-${reminder.actionType}`}
                                    disabled={isProcessing}
                                    onClick={() => handleAction(reminder)}
                                    rightIcon={
                                        <ChevronRight
                                            className="h-3.5 w-3.5"
                                            strokeWidth={2.5}
                                        />
                                    }
                                >
                                    {reminder.actionLabel}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );

    return (
        <div className={`relative inline-block ${className}`}>
            {/* Bell Icon Button */}
            <button
                ref={bellButtonRef}
                type="button"
                data-testid="notification-bell-btn"
                aria-label={`Notifications (${unreadCount} unread)`}
                aria-expanded={isOpen}
                onClick={handleToggleOpen}
                className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl after:absolute after:-inset-1.5 sm:after:-inset-1 after:content-[''] border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm transition-press hover:bg-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus:outline-none cursor-pointer"
            >
                <Bell className="h-4 w-4" strokeWidth={2.5} />

                {unreadCount > 0 && (
                    <span
                        data-testid="notification-badge-count"
                        className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--accent-coral) border border-(--border-ink) px-1 text-2xs font-black text-(--text-on-accent) shadow-cute-sm animate-pop font-mono-num"
                    >
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatedModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                variant={isMobile ? "fullscreen" : "popover"}
                anchorRef={bellButtonRef}
                ariaLabel={
                    isMobile
                        ? "Notifications and reminders"
                        : "Notification center"
                }
                data-testid={
                    isMobile
                        ? "notification-center-mobile-overlay"
                        : "notification-center-popover"
                }
                className={isMobile ? "" : "p-4"}
            >
                {isMobile ? (
                    <>
                        {/* Mobile Sticky Header */}
                        <div className="flex h-14 items-center justify-between px-4 border-b-2 border-(--border-ink) bg-(--bg-card) shrink-0 shadow-cute-sm">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-(--pastel-lilac) text-(--text-on-pastel) border-2 border-(--border-ink) shadow-cute-sm">
                                    <Bell
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-black text-(--text-ink) font-display">
                                        Notifications
                                    </h2>
                                    {count > 0 && (
                                        <span className="rounded-full bg-(--bg-cream) border border-(--border-ink) px-2 py-0.5 text-2xs font-black text-(--text-ink) font-mono-num">
                                            {count}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                aria-label="Close notification center"
                                data-testid="close-notification-overlay-btn"
                                onClick={() => setIsOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) text-(--text-ink) shadow-cute-sm hover:bg-(--bg-card) active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                            >
                                <X className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Mobile Body Content */}
                        <ScrollArea className="flex-1 px-4 py-4 space-y-3 pb-12">
                            {renderRemindersList()}
                        </ScrollArea>
                    </>
                ) : (
                    <>
                        {/* Desktop Header */}
                        <div className="flex items-center justify-between pb-3 border-b-2 border-(--border-subtle)">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-(--pastel-lilac) text-(--text-on-pastel) border-2 border-(--border-ink) shadow-cute-sm">
                                    <Bell
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                </div>

                                <h3 className="text-xs font-black text-(--text-ink) font-display">
                                    Notifications
                                </h3>

                                {count > 0 && (
                                    <span className="rounded-full bg-(--bg-cream) border border-(--border-ink) px-2 py-0.5 text-2xs font-black text-(--text-ink) font-mono-num">
                                        {count}
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                aria-label="Close notification center"
                                onClick={() => setIsOpen(false)}
                                className="rounded-lg p-1 text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) transition-colors cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Reminders List */}
                        <ScrollArea className="mt-3 max-h-80 space-y-2.5 pr-0.5">
                            {renderRemindersList()}
                        </ScrollArea>
                    </>
                )}
            </AnimatedModal>
        </div>
    );
}

export default NotificationCenterPopover;
