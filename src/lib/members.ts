/**
 * Household member helpers shared across features.
 */

import type { HouseholdMember } from "../types/finance";

function squash(value: string): string {
    return value.toLowerCase().replace(/\s+/g, "");
}

/**
 * Demo members use placeholder display names, so the legacy partner ids map
 * to those names too. Existing name-based matching keeps working unchanged.
 */
export const DEMO_PARTNER_ALIASES: Record<string, string> = {
    yijia: "alex",
    rachel: "sam",
};

/** True when a display name belongs to the given partner id or perspective key. */
export function displayNameMatchesPartner(
    displayName: string,
    partnerId: string,
): boolean {
    const name = squash(displayName);
    const target = squash(partnerId);
    const alias = DEMO_PARTNER_ALIASES[target];
    return name === target || name.includes(target) || (!!alias && name === alias);
}

/** The member whose display name matches the logged-in partner id (e.g. a legacy partner id resolves to its demo placeholder name). */
export function matchPartnerMember(
    members: HouseholdMember[],
    loggedInPartner: string | null | undefined,
): HouseholdMember | null {
    if (!loggedInPartner) return null;
    const target = squash(loggedInPartner);
    return (
        members.find((m) => m.id === loggedInPartner) ??
        members.find((m) => squash(m.display_name) === target) ??
        members.find((m) => squash(m.display_name).includes(target)) ??
        members.find((m) => displayNameMatchesPartner(m.display_name, target)) ??
        null
    );
}

/**
 * The member using this device: the logged-in partner, else the fallback
 * (usually the active perspective member), else the first member (demo mode).
 */
export function resolveLoggedInMember(
    members: HouseholdMember[],
    loggedInPartner: string | null | undefined,
    fallback?: HouseholdMember | null,
): HouseholdMember | null {
    return (
        matchPartnerMember(members, loggedInPartner) ??
        fallback ??
        members[0] ??
        null
    );
}
