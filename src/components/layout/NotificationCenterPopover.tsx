/**
 * NotificationCenterPopover Component
 * 
 * Features:
 * - Bell icon with dynamic badge count of active reminders
 * - Flippable view: Active Reminders list <-> Quick Notification Settings
 * - Persistent dismissal per member (persisted in localStorage)
 * - Deep-links to appropriate tabs (accounts, expenses, budget, recurring, goals)
 * - Quick action handling and permission opt-in for Service Worker PWA notifications
 * - Trigger for full NotificationSettingsModal
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  Flame,
  Landmark,
  CreditCard,
  CheckCircle2,
  X,
  ChevronRight,
  Settings,
  ArrowLeft,
  Users,
  AlertTriangle,
  CalendarClock,
  Target,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react';
import {
  computeActiveReminders,
  requestNotificationPermission,
  dismissReminderId,
  getDismissedReminderIds,
  checkAndPromptInitialNotificationPermission,
  evaluateAndDispatchReminders,
  type AppReminder,
} from '../../lib/notificationScheduler';
import { financeService } from '../../services/financeService';
import { getTodayDateString } from '../../lib/dateUtils';
import { playChaChingSound } from '../../lib/soundEffects';
import { useHousehold } from '../../context/HouseholdContext';
import { getDefaultNotificationPreferences } from '../../data/mockSeedData';
import type { NotificationPreferences, UpdateNotificationPreferencesInput } from '../../types/finance';

export interface NotificationCenterPopoverProps {
  className?: string;
  onNavigateTab?: (tab: string) => void;
  onOpenUpdateBalances?: () => void;
  onOpenSettings?: () => void;
}

export function NotificationCenterPopover({
  className = '',
  onNavigateTab,
  onOpenUpdateBalances,
  onOpenSettings,
}: NotificationCenterPopoverProps) {
  const { activeMember, members, refreshData } = useHousehold();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'reminders' | 'settings'>('reminders');
  const [reminders, setReminders] = useState<AppReminder[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeMemberId = activeMember?.id || members?.[0]?.id || 'mem-00000000-0011';
  const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
    getDefaultNotificationPreferences(activeMemberId)
  );

  // Sync browser notification permission state
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Sync initial dismissed IDs from localStorage
  useEffect(() => {
    setDismissedIds(getDismissedReminderIds(activeMemberId));
  }, [activeMemberId]);

  // Load preferences
  const loadPreferences = useCallback(async () => {
    try {
      const data = await financeService.getNotificationPreferences(activeMemberId);
      setPrefs(data);
    } catch (err) {
      console.debug('Failed to load notification preferences in popover:', err);
    }
  }, [activeMemberId]);

  // Load reminders
  const loadReminders = useCallback(async () => {
    try {
      const active = await computeActiveReminders({ memberId: activeMemberId });
      setReminders(active);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    }
  }, [activeMemberId]);

  useEffect(() => {
    loadReminders();
    loadPreferences();
  }, [loadReminders, loadPreferences]);

  // First-launch prompt and dispatch on mount
  useEffect(() => {
    checkAndPromptInitialNotificationPermission().then((res) => {
      if (res) setPermission(res);
    });
    evaluateAndDispatchReminders({ memberId: activeMemberId });
  }, [activeMemberId]);

  // Listen for global notification preference updates
  useEffect(() => {
    const handlePreferencesUpdated = () => {
      loadReminders();
      loadPreferences();
    };
    window.addEventListener('notificationPreferencesUpdated', handlePreferencesUpdated);
    return () => window.removeEventListener('notificationPreferencesUpdated', handlePreferencesUpdated);
  }, [loadReminders, loadPreferences]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveView('reminders');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setActiveView('reminders');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filter out dismissed reminders
  const visibleReminders = reminders.filter((r) => !dismissedIds.has(r.id));
  const count = visibleReminders.length;

  const handleDismiss = (id: string) => {
    dismissReminderId(activeMemberId, id);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
  };

  const handleUpdatePreference = async (updates: UpdateNotificationPreferencesInput) => {
    setPrefs((prev) => ({ ...prev, ...updates }));
    try {
      await financeService.updateNotificationPreferences(activeMemberId, updates);
      await loadReminders();
    } catch (err) {
      console.error('Failed to update preference:', err);
    }
  };

  // Execute reminder action with deep navigation
  const handleAction = async (reminder: AppReminder) => {
    setIsProcessing(true);
    try {
      if (reminder.actionType === 'check_in') {
        const today = getTodayDateString();
        await financeService.recordDailyCheckin(activeMemberId, today, 'no_spend');
        playChaChingSound();
        handleDismiss(reminder.id);
        await refreshData();
        await loadReminders();
      } else if (reminder.actionType === 'update_balances') {
        setIsOpen(false);
        if (onOpenUpdateBalances) {
          onOpenUpdateBalances();
        } else if (onNavigateTab) {
          onNavigateTab('accounts');
        }
      } else if (reminder.actionType === 'view_cc') {
        setIsOpen(false);
        if (onNavigateTab) {
          onNavigateTab('expenses');
        }
      } else if (reminder.actionType === 'view_expenses') {
        setIsOpen(false);
        if (onNavigateTab) {
          onNavigateTab('expenses');
        }
      } else if (reminder.actionType === 'view_settlement') {
        setIsOpen(false);
        if (onNavigateTab) {
          onNavigateTab('dashboard');
        }
      } else if (reminder.actionType === 'view_budget') {
        setIsOpen(false);
        if (onNavigateTab) {
          onNavigateTab('budget');
        }
      } else if (reminder.actionType === 'view_recurring' || reminder.actionType === 'view_goals') {
        setIsOpen(false);
        if (onNavigateTab) {
          onNavigateTab('plan');
        }
      }
    } catch (err) {
      console.error('Failed to execute reminder action:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getReminderIcon = (type: AppReminder['type']) => {
    switch (type) {
      case 'daily_checkin':
      case 'couple_streak_risk':
        return <Flame className="h-4 w-4 text-amber-500 shrink-0" />;
      case 'balance_update':
        return <Landmark className="h-4 w-4 text-blue-500 shrink-0" />;
      case 'credit_card_due':
        return <CreditCard className="h-4 w-4 text-rose-500 shrink-0" />;
      case 'credit_card_missing_stmt':
        return <CreditCard className="h-4 w-4 text-amber-500 shrink-0" />;
      case 'partner_shared_spend':
      case 'settlement_due':
        return <Users className="h-4 w-4 text-purple-500 shrink-0" />;
      case 'budget_limit':
        return <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />;
      case 'recurring_bill_due':
        return <CalendarClock className="h-4 w-4 text-emerald-500 shrink-0" />;
      case 'goal_pacing':
        return <Target className="h-4 w-4 text-emerald-500 shrink-0" />;
      case 'monthly_budget_review':
        return <BookOpen className="h-4 w-4 text-indigo-500 shrink-0" />;
      default:
        return <Bell className="h-4 w-4 text-emerald-500 shrink-0" />;
    }
  };

  return (
    <div ref={popoverRef} className={`relative inline-block ${className}`}>
      {/* Bell Icon Button */}
      <button
        type="button"
        data-testid="notification-bell-btn"
        aria-label={`Notifications and reminders (${count} active)`}
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) setActiveView('reminders');
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-(--shadow-cute-sm) transition-all hover:bg-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus:outline-none cursor-pointer"
      >
        <Bell className="h-4 w-4 stroke-[2.2]" />

        {count > 0 && (
          <span
            data-testid="notification-badge-count"
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f76b57] border border-(--border-ink) px-1 text-[10px] font-black text-white shadow-(--shadow-cute-sm) animate-in zoom-in-75 font-mono-num"
          >
            {count}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          data-testid="notification-center-popover"
          role="region"
          aria-label="Notification center"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 shadow-(--shadow-cute-lg) z-50 animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b-[1.5px] border-(--border-subtle)">
            <div className="flex items-center gap-2">
              {activeView === 'settings' ? (
                <button
                  type="button"
                  aria-label="Back to reminders"
                  onClick={() => setActiveView('reminders')}
                  className="flex h-7 w-7 items-center justify-center rounded-xl bg-(--bg-cream) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) hover:bg-(--bg-card) transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5]" />
                </button>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#dfc2ff] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)">
                  <Bell className="h-4 w-4 stroke-[2.2]" />
                </div>
              )}

              <h3 className="text-xs font-black text-(--text-ink) font-display">
                {activeView === 'settings' ? 'Notification Settings' : 'Notifications & Reminders'}
              </h3>

              {activeView === 'reminders' && count > 0 && (
                <span className="rounded-full bg-(--bg-cream) border border-(--border-ink) px-2 py-0.5 text-[10px] font-black text-(--text-ink) font-mono-num">
                  {count}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Settings / Reminders Flip Toggle */}
              <button
                type="button"
                aria-label={activeView === 'settings' ? 'View active reminders' : 'Quick notification settings'}
                data-testid="toggle-popover-settings-btn"
                onClick={() => setActiveView((prev) => (prev === 'reminders' ? 'settings' : 'reminders'))}
                className={`rounded-lg p-1 transition-colors cursor-pointer ${
                  activeView === 'settings'
                    ? 'bg-[#dfc2ff] text-[#1a1a1a] border border-(--border-ink)'
                    : 'text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream)'
                }`}
              >
                <Settings className="h-4 w-4 stroke-[2.2]" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                aria-label="Close notification center"
                onClick={() => {
                  setIsOpen(false);
                  setActiveView('reminders');
                }}
                className="rounded-lg p-1 text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Settings View */}
          {activeView === 'settings' ? (
            <div className="mt-3 space-y-2.5" data-testid="popover-quick-settings-view">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-(--text-muted) px-1">
                <span>Quick Toggles</span>
                <span className="text-[10px] lowercase text-(--text-muted)/70">auto-saved</span>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
                {/* Push Notifications */}
                <QuickToggleItem
                  label="PWA Push Notifications"
                  isChecked={prefs.push_enabled}
                  testId="popover-toggle-push"
                  onChange={(val) => handleUpdatePreference({ push_enabled: val })}
                />

                {/* Sound Chimes */}
                <QuickToggleItem
                  label="Sound Effects &amp; Audio"
                  isChecked={prefs.sound_enabled}
                  testId="popover-toggle-sound"
                  onChange={(val) => handleUpdatePreference({ sound_enabled: val })}
                />

                {/* CC Payment Due */}
                <QuickToggleItem
                  label="Credit Card Payment Due"
                  isChecked={prefs.cc_payment_due}
                  testId="popover-toggle-cc-due"
                  onChange={(val) => handleUpdatePreference({ cc_payment_due: val })}
                />

                {/* CC Missing Statement */}
                <QuickToggleItem
                  label="Missing CC Statement"
                  isChecked={prefs.cc_missing_statement}
                  testId="popover-toggle-cc-missing"
                  onChange={(val) => handleUpdatePreference({ cc_missing_statement: val })}
                />

                {/* Daily Streak & Logging */}
                <QuickToggleItem
                  label="Daily Spend &amp; Streak Check-in"
                  isChecked={prefs.streak_and_logging}
                  testId="popover-toggle-streak"
                  onChange={(val) => handleUpdatePreference({ streak_and_logging: val })}
                />

                {/* Monthly Balances */}
                <QuickToggleItem
                  label="Monthly Balance Updates"
                  isChecked={prefs.monthly_balance_updates}
                  testId="popover-toggle-balances"
                  onChange={(val) => handleUpdatePreference({ monthly_balance_updates: val })}
                />

                {/* Partner / Shared Spend */}
                <QuickToggleItem
                  label="Partner &amp; Shared Spend"
                  isChecked={prefs.partner_shared_spend}
                  testId="popover-toggle-partner-spend"
                  onChange={(val) => handleUpdatePreference({ partner_shared_spend: val })}
                />

                {/* Category Budget Limits */}
                <QuickToggleItem
                  label="Category Budget Limits"
                  isChecked={prefs.budget_limit_alerts}
                  testId="popover-toggle-budget-limits"
                  onChange={(val) => handleUpdatePreference({ budget_limit_alerts: val })}
                />

                {/* Recurring Bills */}
                <QuickToggleItem
                  label="Recurring Bills &amp; Renewals"
                  isChecked={prefs.recurring_bills_due}
                  testId="popover-toggle-recurring"
                  onChange={(val) => handleUpdatePreference({ recurring_bills_due: val })}
                />

                {/* Goal Pacing */}
                <QuickToggleItem
                  label="Savings Goal Pacing"
                  isChecked={prefs.goal_pacing_alerts}
                  testId="popover-toggle-goals"
                  onChange={(val) => handleUpdatePreference({ goal_pacing_alerts: val })}
                />

                {/* Monthly Budget Review */}
                <QuickToggleItem
                  label="Monthly Budget Review"
                  isChecked={prefs.monthly_budget_review}
                  testId="popover-toggle-budget-review"
                  onChange={(val) => handleUpdatePreference({ monthly_budget_review: val })}
                />
              </div>

              {/* Configure Thresholds & Channels Footer Link */}
              <div className="pt-2 border-t-[1.5px] border-(--border-subtle)">
                <button
                  type="button"
                  data-testid="open-full-settings-from-popover-btn"
                  onClick={() => {
                    setIsOpen(false);
                    setActiveView('reminders');
                    onOpenSettings?.();
                  }}
                  className="flex w-full items-center justify-between p-2.5 rounded-xl bg-(--bg-cream) hover:bg-(--bg-canvas) border-[1.5px] border-(--border-ink) text-xs font-bold text-(--text-ink) shadow-(--shadow-cute-sm) transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Thresholds &amp; Channel Settings...</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          ) : (
            /* Reminders List View */
            <>
              {/* Browser Permission Prompt Banner */}
              {permission === 'default' && (
                <div className="mt-3 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#bbf7d0]/40 border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)">
                  <div className="text-[11px] text-[#14532d] dark:text-[#86efac] font-bold">
                    Enable PWA reminders on this device?
                  </div>
                  <button
                    type="button"
                    data-testid="enable-push-notifications-btn"
                    onClick={handleRequestPermission}
                    className="px-2.5 py-1 rounded-lg bg-[#bbf7d0] text-[#14532d] border border-(--border-ink) text-[10px] font-black hover:bg-[#86efac] transition-colors cursor-pointer"
                  >
                    Enable
                  </button>
                </div>
              )}

              {/* Reminders List */}
              <div className="mt-3 max-h-72 overflow-y-auto space-y-2.5 pr-0.5">
                {visibleReminders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#bbf7d0] text-[#14532d] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) mb-2">
                      <CheckCircle2 className="h-5 w-5 stroke-[2.2]" />
                    </div>
                    <p className="text-xs font-black text-(--text-ink)">
                      All caught up!
                    </p>
                    <p className="text-[11px] text-(--text-muted) font-medium mt-0.5">
                      No pending check-ins or due reminders today.
                    </p>
                  </div>
                ) : (
                  visibleReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      data-testid={`reminder-card-${reminder.id}`}
                      className="rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-cream) p-3 shadow-(--shadow-cute-sm) transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getReminderIcon(reminder.type)}
                          <h4 className="text-xs font-bold text-(--text-ink)">
                            {reminder.title}
                          </h4>
                        </div>

                        <button
                          type="button"
                          data-testid={`reminder-dismiss-${reminder.id}`}
                          aria-label="Dismiss reminder"
                          onClick={() => handleDismiss(reminder.id)}
                          className="text-(--text-muted) hover:text-(--text-ink) p-0.5 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <p className="mt-1 text-[11px] text-(--text-muted) font-medium leading-snug">
                        {reminder.message}
                      </p>

                      <div className="mt-2.5 flex items-center justify-end">
                        <button
                          type="button"
                          data-testid={`reminder-action-${reminder.actionType}`}
                          disabled={isProcessing}
                          onClick={() => handleAction(reminder)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#dfc2ff] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none text-[11px] font-black transition-all cursor-pointer disabled:opacity-50"
                        >
                          <span>{reminder.actionLabel}</span>
                          <ChevronRight className="h-3 w-3 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface QuickToggleItemProps {
  label: string;
  isChecked: boolean;
  testId: string;
  onChange: (val: boolean) => void;
}

function QuickToggleItem({ label, isChecked, testId, onChange }: QuickToggleItemProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded-xl border border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute-sm)">
      <span className="text-xs font-bold text-(--text-ink)">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-label={`Toggle ${label}`}
        data-testid={testId}
        onClick={() => onChange(!isChecked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
          isChecked ? 'bg-[#dfc2ff]' : 'bg-(--bg-cream)'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-(--text-ink) shadow-sm ring-0 transition duration-200 ease-in-out ${
            isChecked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default NotificationCenterPopover;
