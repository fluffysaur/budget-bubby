/**
 * send-reminders Edge Function (Deno).
 *
 * Called hourly by pg_cron (see migration 20261106091000_notification_cron).
 * Thin wrapper: checks the cron secret, builds a service-role client and a
 * Web Push sender, and runs the shared runner bundled from
 * src/server/sendReminders.ts by `npm run build:functions`.
 *
 * POST body (optional): { "dryRun": true } computes and reports only.
 *
 * Secrets: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 */

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { createSupabaseSendDeps, runSendReminders } from "../_shared/dist/send-reminders.js";

function env(name: string): string {
    const value = Deno.env.get(name);
    if (!value) throw new Error(`Missing secret: ${name}`);
    return value;
}

Deno.serve(async (req: Request) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }
    if (req.headers.get("Authorization") !== `Bearer ${env("CRON_SECRET")}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    let dryRun = false;
    try {
        const body = await req.json();
        dryRun = body?.dryRun === true;
    } catch {
        // empty body
    }

    webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));

    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
        const deps = createSupabaseSendDeps(client, {
            now: new Date(),
            dryRun,
            async sendPush(target, message) {
                try {
                    await webpush.sendNotification(
                        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
                        JSON.stringify(message),
                        { TTL: 6 * 60 * 60, urgency: "normal" },
                    );
                    return { ok: true };
                } catch (err) {
                    const status = (err as { statusCode?: number }).statusCode;
                    console.error("Push failed", status, (err as Error).message);
                    return { ok: false, gone: status === 404 || status === 410 };
                }
            },
        });
        const result = await runSendReminders(deps);
        return Response.json(result);
    } catch (err) {
        console.error("send-reminders failed", err);
        return Response.json({ error: (err as Error).message }, { status: 500 });
    }
});
