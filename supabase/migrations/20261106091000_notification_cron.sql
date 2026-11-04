-- ==============================================================================
-- Budget Bubby: Notification Cron Jobs
--   1. send-reminders: hourly POST to the send-reminders Edge Function.
--   2. prune-notification-log: daily delete of log rows older than 90 days.
--
-- Prerequisites (run once before applying; values are not stored in git):
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-reminders', 'send_reminders_url');
--   select vault.create_secret('<same value as the function CRON_SECRET>', 'send_reminders_secret');
--
-- pg_cron runs in UTC. Singapore is UTC+8 with no DST, so on-the-hour UTC
-- runs are on-the-hour in Singapore too.
-- ==============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-runnable: drop existing jobs before scheduling
select cron.unschedule(jobid)
from cron.job
where jobname in ('send-reminders', 'prune-notification-log');

select cron.schedule(
    'send-reminders',
    '0 * * * *',
    $$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'send_reminders_url'),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
                select decrypted_secret from vault.decrypted_secrets where name = 'send_reminders_secret'
            )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
    );
    $$
);

select cron.schedule(
    'prune-notification-log',
    '30 19 * * *', -- 03:30 Singapore time
    $$ delete from public.notification_log where created_at < now() - interval '90 days' $$
);
