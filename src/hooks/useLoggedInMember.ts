import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useOptionalHousehold } from "../context/HouseholdContext";
import { findCurrentMember } from "../lib/members";
import type { HouseholdMember } from "../types/finance";

const NO_MEMBERS: HouseholdMember[] = [];

/**
 * The household member using this device (resolved from the signed-in user,
 * or the demo member), plus the full member list. `me` is null when the
 * signed-in user matches no member: callers must not guess one.
 */
export function useLoggedInMember(fallbackMembers?: HouseholdMember[]): {
    me: HouseholdMember | null;
    members: HouseholdMember[];
} {
    const { memberIdentity } = useAuth();
    const household = useOptionalHousehold();
    const ctxMembers = household?.members;
    const members =
        ctxMembers && ctxMembers.length > 0
            ? ctxMembers
            : fallbackMembers && fallbackMembers.length > 0
              ? fallbackMembers
              : NO_MEMBERS;
    const me = useMemo(
        () => findCurrentMember(members, memberIdentity),
        [members, memberIdentity],
    );
    return { me, members };
}
