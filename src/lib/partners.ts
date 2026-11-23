/**
 * Partner identity for PIN sign-in.
 *
 * The two household partners are identified by a neutral slot id
 * (`partner1` / `partner2`) and the email configured for that slot, never by
 * display name.
 */

export type PartnerId = "partner1" | "partner2";

export const PARTNER_IDS: readonly PartnerId[] = ["partner1", "partner2"];

/** Neutral env var per partner slot, plus the legacy name read during rollout. */
const PARTNER_EMAIL_ENV: Record<
    PartnerId,
    { name: string; legacy: string; fallback: string }
> = {
    partner1: {
        name: "VITE_PARTNER1_EMAIL",
        // TODO(#219): drop once prod env uses VITE_PARTNER1_EMAIL.
        legacy: "VITE_YIJIA_EMAIL",
        fallback: "alex@example.com",
    },
    partner2: {
        name: "VITE_PARTNER2_EMAIL",
        // TODO(#219): drop once prod env uses VITE_PARTNER2_EMAIL.
        legacy: "VITE_RACHEL_EMAIL",
        fallback: "sam@example.com",
    },
};

export function isPartnerId(value: unknown): value is PartnerId {
    return value === "partner1" || value === "partner2";
}

function normaliseEmail(email: string | null | undefined): string {
    return (email ?? "").trim().toLowerCase();
}

function readEnv(name: string): string {
    const env = import.meta.env as Record<string, string | undefined>;
    return (env[name] ?? "").trim();
}

/** Configured sign-in email for a partner slot (demo seed email when unset). */
export function getPartnerEmail(partner: PartnerId): string {
    const { name, legacy, fallback } = PARTNER_EMAIL_ENV[partner];
    return readEnv(name) || readEnv(legacy) || fallback;
}

/** The partner slot whose configured email matches, if any. */
export function partnerFromEmail(
    email: string | null | undefined,
): PartnerId | null {
    const clean = normaliseEmail(email);
    if (!clean) return null;
    return (
        PARTNER_IDS.find((p) => normaliseEmail(getPartnerEmail(p)) === clean) ??
        null
    );
}

export function emailsMatch(
    a: string | null | undefined,
    b: string | null | undefined,
): boolean {
    const left = normaliseEmail(a);
    return left !== "" && left === normaliseEmail(b);
}
