import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useOptionalHousehold } from "../context/HouseholdContext";
import { resolveLoggedInMember } from "../lib/members";
import type { HouseholdMember } from "../types/finance";

const NO_MEMBERS: HouseholdMember[] = [];

/** The household member using this device, plus the full member list. */
export function useLoggedInMember(): {
    me: HouseholdMember | null;
    members: HouseholdMember[];
} {
    const { loggedInPartner } = useAuth();
    const household = useOptionalHousehold();
    const members = household?.members ?? NO_MEMBERS;
    const activeMember = household?.activeMember ?? null;
    const me = useMemo(
        () => resolveLoggedInMember(members, loggedInPartner, activeMember),
        [members, loggedInPartner, activeMember],
    );
    return { me, members };
}
