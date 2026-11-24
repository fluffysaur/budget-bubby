/**
 * Sign-in emails for PIN login.
 *
 * A PIN is the password of one member's Supabase auth account, so sign-in
 * tries each household member's email in turn. Members are not readable
 * before sign-in, so the emails come from the build env.
 */

type Env = Record<string, string | boolean | undefined>;

/** Comma- or whitespace-separated list of the members' sign-in emails. */
export const MEMBER_EMAILS_ENV = "VITE_MEMBER_EMAILS";

/**
 * Fallback for hosts with one env var per member, tried in this order.
 * TODO: remove once VITE_MEMBER_EMAILS is live in the host env.
 */
const LEGACY_MEMBER_EMAIL_ENV: readonly string[] = [
    "VITE_PARTNER1_EMAIL",
    "VITE_PARTNER2_EMAIL",
];

function splitEmails(value: string): string[] {
    return value
        .split(/[\s,;]+/)
        .map((email) => email.trim())
        .filter(Boolean);
}

function dedupe(emails: string[]): string[] {
    const seen = new Set<string>();
    return emails.filter((email) => {
        const key = email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function readVar(env: Env, name: string): string {
    const value = env[name];
    return typeof value === "string" ? value.trim() : "";
}

/** The emails to try, in order, when signing in with a PIN. */
export function getMemberSignInEmails(
    env: Env = import.meta.env as Env,
): string[] {
    const list = readVar(env, MEMBER_EMAILS_ENV);
    if (list) return dedupe(splitEmails(list));
    const legacy = LEGACY_MEMBER_EMAIL_ENV.flatMap((name) =>
        splitEmails(readVar(env, name)),
    );
    return dedupe(legacy);
}
