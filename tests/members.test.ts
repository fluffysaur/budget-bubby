import { describe, expect, it } from "vitest";
import {
    emailsMatch,
    findCurrentMember,
    findMemberById,
    getSettlementMembers,
    normalisePerspective,
    resolvePerspectiveMember,
} from "../src/lib/members";
import { calculateHouseholdSettlement } from "../src/lib/financialFormulas";
import type { Expense, HouseholdMember } from "../src/types/finance";

const memberA: HouseholdMember = {
    id: "mem-a",
    household_id: "hh",
    display_name: "Alex",
    email: "alex@example.com",
    role: "owner",
    created_at: "2026-01-01T00:00:00.000Z",
};
const memberB: HouseholdMember = {
    id: "mem-b",
    household_id: "hh",
    display_name: "Sam",
    email: "Sam@Example.com",
    user_id: "auth-b",
    role: "member",
    created_at: "2026-01-02T00:00:00.000Z",
};
const members = [memberA, memberB];

function sharedExpense(id: string, payer_id: string, amount: number): Expense {
    return {
        id,
        household_id: "hh",
        payer_id,
        amount,
        item: "Groceries",
        category_id: "cat",
        date: "2026-02-01",
        is_shared: true,
        split_ratio: 0.5,
        settled: false,
    } as Expense;
}

describe("emailsMatch", () => {
    it("ignores case and surrounding spaces, never matching empty emails", () => {
        expect(emailsMatch(" A@x.com", "a@x.com ")).toBe(true);
        expect(emailsMatch("", "")).toBe(false);
        expect(emailsMatch(null, undefined)).toBe(false);
    });
});

describe("findCurrentMember", () => {
    it("matches the signed-in email, ignoring case", () => {
        expect(
            findCurrentMember(members, { email: "SAM@example.com" })?.id,
        ).toBe("mem-b");
        expect(
            findCurrentMember(members, { email: "alex@example.com" })?.id,
        ).toBe("mem-a");
    });

    it("prefers the member linked to the auth user id", () => {
        const noEmails = members.map((m) => ({ ...m, email: null }));
        expect(findCurrentMember(noEmails, { userId: "auth-b" })?.id).toBe(
            "mem-b",
        );
        expect(
            findCurrentMember(members, {
                userId: "auth-b",
                email: "alex@example.com",
            })?.id,
        ).toBe("mem-b");
    });

    it("returns null when nobody matches, never guessing the first member", () => {
        expect(
            findCurrentMember(members, { email: "stranger@example.com" }),
        ).toBeNull();
        expect(findCurrentMember(members, { userId: "auth-x" })).toBeNull();
        expect(findCurrentMember(members, null)).toBeNull();
        expect(findCurrentMember([], { email: "alex@example.com" })).toBeNull();
    });

    it("never matches by display name", () => {
        expect(findCurrentMember(members, { email: "Alex" })).toBeNull();
        expect(findMemberById(members, "Sam")).toBeNull();
    });
});

describe("perspective resolution", () => {
    it("resolves member ids and the household view", () => {
        expect(resolvePerspectiveMember(members, "mem-b")?.id).toBe("mem-b");
        expect(resolvePerspectiveMember(members, "household")).toBeNull();
    });

    it("falls back to the household view for a legacy stored perspective", () => {
        expect(normalisePerspective("partner1", members)).toBe("household");
        expect(normalisePerspective("alex", members)).toBe("household");
        expect(resolvePerspectiveMember(members, "partner2")).toBeNull();
        expect(normalisePerspective(undefined, members)).toBe("household");
    });

    it("keeps known member ids, and any value while members are loading", () => {
        expect(normalisePerspective("mem-a", members)).toBe("mem-a");
        expect(normalisePerspective("mem-a", [])).toBe("mem-a");
    });
});

describe("settlement members", () => {
    it("orders the pair by join date, whatever the list order", () => {
        const pair = getSettlementMembers([memberB, memberA]);
        expect(pair?.map((m) => m.id)).toEqual(["mem-a", "mem-b"]);
        expect(getSettlementMembers([memberA])).toBeNull();
    });

    it("settles between explicit member ids", () => {
        const expenses = [
            sharedExpense("e1", "mem-a", 100),
            sharedExpense("e2", "mem-b", 40),
        ];
        const summary = calculateHouseholdSettlement(expenses, [
            memberB,
            memberA,
        ]);
        expect(summary.debtorId).toBe("mem-b");
        expect(summary.creditorId).toBe("mem-a");
        expect(summary.netBalance).toBe(30);
        expect(summary.expenseIds).toEqual(["e1", "e2"]);
    });

    it("is all settled for a one-member household", () => {
        const summary = calculateHouseholdSettlement(
            [sharedExpense("e1", "mem-a", 100)],
            [memberA],
        );
        expect(summary.netBalance).toBe(0);
        expect(summary.debtorId).toBeNull();
    });
});
