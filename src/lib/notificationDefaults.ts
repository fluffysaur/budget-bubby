import type { NotificationPreferences } from "../types/finance";

export function getDefaultNotificationPreferences(
    memberId: string,
    householdId: string = "hh-00000000-0001",
): NotificationPreferences {
    return {
        household_id: householdId,
        member_id: memberId,
        push_enabled: true,
        sound_enabled: true,
        haptics_enabled: true,
        cc_payment_due: true,
        cc_missing_statement: true,
        streak_and_logging: true,
        monthly_balance_updates: true,
        partner_shared_spend: true,
        budget_limit_alerts: true,
        recurring_bills_due: true,
        goal_pacing_alerts: true,
        monthly_budget_review: true,
        cc_due_days_before: 5,
        cc_due_reminder_days: [7, 3, 1, 0],
        budget_warning_pct: 80,
        settlement_threshold_sgd: 200,
        checkin_time: "18:00",
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
        updated_at: new Date().toISOString(),
    };
}
