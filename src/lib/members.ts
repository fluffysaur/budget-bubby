/**
 * Household member helpers shared across features.
 */

import type { HouseholdMember } from "../types/finance";
import { emailsMatch, getPartnerEmail, isPartnerId } from "./partners";

/**
 * The member a partner slot or member id refers to: a member id first, then
 * the member linked to the signed-in auth user (when given), then the member
 * whose email matches the partner's configured email. Never by display name.
 */
export function matchPartnerMember(
    members: HouseholdMember[],
    partnerOrMemberId: string | null | undefined,
    authUserId?: string | null,
): HouseholdMember | null {
    if (!partnerOrMemberId) return null;
    const byId = members.find((m) => m.id === partnerOrMemberId);
    if (byId) return byId;
    if (!isPartnerId(partnerOrMemberId)) return null;
    if (authUserId) {
        const linked = members.find((m) => m.user_id === authUserId);
        if (linked) return linked;
    }
    const email = getPartnerEmail(partnerOrMemberId);
    return members.find((m) => emailsMatch(m.email, email)) ?? null;
}

/**
 * The member using this device: the logged-in partner, else the fallback
 * (usually the active perspective member), else the first member (demo mode).
 */
export function resolveLoggedInMember(
    members: HouseholdMember[],
    loggedInPartner: string | null | undefined,
    fallback?: HouseholdMember | null,
    authUserId?: string | null,
): HouseholdMember | null {
    return (
        matchPartnerMember(members, loggedInPartner, authUserId) ??
        fallback ??
        members[0] ??
        null
    );
}
