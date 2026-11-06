/**
 * capture-expense Edge Function (Deno).
 *
 * Receives purchases from phone automations (iPhone Shortcuts Wallet
 * trigger, Android MacroDroid/Tasker, a manual Shortcut) and puts them in
 * the Inbox. Thin wrapper around src/server/captureExpense.ts, bundled by
 * `npm run build:functions`.
 *
 * Deployed with --no-verify-jwt: auth is the member's bb_cap_ bearer token.
 * No CORS headers, so browsers can't call it cross-origin.
 *
 * Secrets: none new. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
 * provided by Supabase.
 */

import { createClient } from "@supabase/supabase-js";
import {
    createSupabaseCaptureDeps,
    handleCapture,
    MAX_BODY_BYTES,
} from "../_shared/dist/capture-expense.js";

function env(name: string): string {
    const value = Deno.env.get(name);
    if (!value) throw new Error(`Missing secret: ${name}`);
    return value;
}

const client = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
});
const deps = createSupabaseCaptureDeps(client);

Deno.serve(async (req: Request) => {
    const contentLength = Number(req.headers.get("Content-Length") ?? 0) || null;
    let bodyText = "";
    if (req.method === "POST" && (contentLength ?? 0) <= MAX_BODY_BYTES) {
        // Keep a little over the cap so oversized bodies still get 413
        bodyText = (await req.text()).slice(0, MAX_BODY_BYTES + 1);
    }

    const result = await handleCapture(deps, {
        method: req.method,
        authorization: req.headers.get("Authorization"),
        contentLength,
        bodyText,
    });
    return Response.json(result.body, { status: result.status });
});
