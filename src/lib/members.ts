/**
 * Household member helpers shared across features.
 */

import type { HouseholdMember } from "../types/finance";

function squash(value: string): string {
    return value.toLowerCase().replace(/\s+/g, "");
}

/** The member whose display name matches the logged-in partner id (e.g. "yijia" -> "Yi Jia"). */
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
