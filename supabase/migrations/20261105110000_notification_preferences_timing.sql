-- ==============================================================================
-- Budget Bubby: Notification Timing Preferences
--   1. cc_due_reminder_days: which days before a CC due date to remind
--      (0 = due day). Replaces cc_due_days_before, which stays for the
--      deployed frontend and will be dropped in a later migration.
--   2. checkin_time: when the daily check-in reminder starts.
--   3. quiet_hours_start / quiet_hours_end: no pushes in this window.
--   4. haptics_enabled: already sent by the frontend but never added, which
--      made every preference save fail.
-- Additive only.
-- ==============================================================================

alter table notification_preferences
    add column if not exists cc_due_reminder_days integer[] not null default '{7,3,1,0}',
    add column if not exists checkin_time time not null default '18:00',
    add column if not exists quiet_hours_start time not null default '22:00',
    add column if not exists quiet_hours_end time not null default '08:00',
    add column if not exists haptics_enabled boolean not null default true;

alter table notification_preferences
    drop constraint if exists notification_preferences_cc_due_reminder_days_check;
alter table notification_preferences
    add constraint notification_preferences_cc_due_reminder_days_check
    check (cc_due_reminder_days <@ array[0, 1, 2, 3, 4, 5, 6, 7, 14]);
