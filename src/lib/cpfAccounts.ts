/**
 * CPF accounts: exactly three per member (OA, SA, MA), identified by
 * `cpf_kind`, never by name. See docs/plans/2026-11-18-roadmap.md, decision 15.
 */

import type {
    Account,
    CpfKind,
    CreateAccountInput,
    HouseholdMember,
} from "../types/finance";

export const CPF_KINDS: readonly CpfKind[] = ["OA", "SA", "MA"];

export const CPF_KIND_NAMES: Record<CpfKind, string> = {
    OA: "CPF OA",
    SA: "CPF SA",
    MA: "CPF MA",
};

/** The account's CPF kind, or null for non-CPF and unmatched accounts. */
export function cpfKindFor(
    account: Pick<Account, "type" | "cpf_kind">,
): CpfKind | null {
    return account.type === "CPF" ? (account.cpf_kind ?? null) : null;
}

/** CPF accounts the migration couldn't match to OA, SA or MA. */
export function unmatchedCpfAccounts(accounts: Account[]): Account[] {
    return accounts.filter((a) => a.type === "CPF" && !a.cpf_kind);
}

/**
 * The CPF accounts to create so each member has OA, SA and MA. A member
 * with an unmatched CPF account is skipped until it is matched, so a
 * legacy account never ends up with a duplicate beside it.
 */
export function missingCpfAccounts(
    members: HouseholdMember[],
    accounts: Account[],
): CreateAccountInput[] {
    const toCreate: CreateAccountInput[] = [];
    for (const m of members) {
        const own = accounts.filter(
            (a) => a.owner_id === m.id && a.type === "CPF",
        );
        if (own.some((a) => !a.cpf_kind)) continue;
        const have = new Set(own.map((a) => a.cpf_kind));
        for (const kind of CPF_KINDS) {
            if (have.has(kind)) continue;
            toCreate.push({
                household_id: m.household_id,
                owner_id: m.id,
                name: CPF_KIND_NAMES[kind],
                type: "CPF",
                balance: 0,
                institution: "CPF",
                is_joint: false,
                cpf_kind: kind,
            });
        }
    }
    return toCreate;
}
