/**
 * Household member identity helpers shared across features.
 *
 * Members are identified by their `household_members.id`. The member using
 * this device is resolved from the signed-in auth user: the member linked to
 * that auth user id first, then the member whose email matches. Never by
 * display name, and never by position in the member list.
 */

import type { HouseholdMember, Perspective } from "../types/finance";

/** Who is signed in on this device, as known to the auth layer. */
export interface MemberIdentity {
    userId?: string | null;
    email?: string | null;
}

export const HOUSEHOLD_PERSPECTIVE = "household";

function normaliseEmail(email: string | null | undefined): string {
    return (email ?? "").trim().toLowerCase();
}

/** Case- and whitespace-insensitive email match. Empty emails never match. */
export function emailsMatch(
    a: string | null | undefined,
    b: string | null | undefined,
): boolean {
    const left = normaliseEmail(a);
    return left !== "" && left === normaliseEmail(b);
}

/** The member with this id, if any. */
export function findMemberById(
    members: readonly HouseholdMember[],
    memberId: string | null | undefined,
): HouseholdMember | null {
    if (!memberId) return null;
    return members.find((m) => m.id === memberId) ?? null;
}

/**
 * The member using this device: the member linked to the auth user id,
 * else the member whose email matches the signed-in email.
 */
export function findCurrentMember(
    members: readonly HouseholdMember[],
    identity: MemberIdentity | null | undefined,
): HouseholdMember | null {
    if (!identity) return null;
    if (identity.userId) {
        const linked = members.find((m) => m.user_id === identity.userId);
        if (linked) return linked;
    }
    if (identity.email) {
        return (
            members.find((m) => emailsMatch(m.email, identity.email)) ?? null
        );
    }
    return null;
}

/** The member a perspective shows, or null for the household view. */
export function resolvePerspectiveMember(
    members: readonly HouseholdMember[],
    perspective: Perspective | null | undefined,
): HouseholdMember | null {
    if (!perspective || perspective === HOUSEHOLD_PERSPECTIVE) return null;
    return findMemberById(members, perspective);
}

/**
 * A perspective that is safe to use: the household view or a known member
 * id. Anything else (e.g. a legacy partner slot or name-based id left in
 * stored state) falls back to the household view once members have loaded.
 */
export function normalisePerspective(
    perspective: Perspective | null | undefined,
    members: readonly HouseholdMember[],
): Perspective {
    if (!perspective || perspective === HOUSEHOLD_PERSPECTIVE) {
        return HOUSEHOLD_PERSPECTIVE;
    }
    if (members.length === 0) return perspective;
    return findMemberById(members, perspective)
        ? perspective
        : HOUSEHOLD_PERSPECTIVE;
}

/**
 * The two members a shared-expense settlement is between, ordered by when
 * they joined (oldest first) so the pair is stable across fetches. Null
 * unless the household has at least two members.
 */
export function getSettlementMembers(
    members: readonly HouseholdMember[],
): [HouseholdMember, HouseholdMember] | null {
    if (members.length < 2) return null;
    const ordered = [...members].sort((a, b) => {
        const byDate = (a.created_at ?? "").localeCompare(b.created_at ?? "");
        return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    });
    return [ordered[0], ordered[1]];
}
