import { describe, it, expect } from "vitest";
import {
    cpfKindFor,
    missingCpfAccounts,
    unmatchedCpfAccounts,
} from "../src/lib/cpfAccounts";
import type { Account, HouseholdMember } from "../src/types/finance";

const member = (id: string): HouseholdMember => ({
    id,
    household_id: "h",
    display_name: `Member ${id}`,
    role: "member",
});

const cpf = (over: Partial<Account>): Account => ({
    id: "a",
    household_id: "h",
    owner_id: "m1",
    name: "CPF",
    type: "CPF",
    balance: 0,
    currency: "SGD",
    is_joint: false,
    ...over,
});

describe("missingCpfAccounts", () => {
    it("creates OA, SA and MA for a member with none", () => {
        const r = missingCpfAccounts([member("m1")], []);
        expect(r.map((a) => a.cpf_kind)).toEqual(["OA", "SA", "MA"]);
        expect(r.every((a) => a.owner_id === "m1" && a.type === "CPF")).toBe(
            true,
        );
        expect(r.every((a) => a.balance === 0 && !a.is_joint)).toBe(true);
    });

    it("only fills the kinds a member is missing", () => {
        const r = missingCpfAccounts(
            [member("m1"), member("m2")],
            [
                cpf({ id: "1", cpf_kind: "OA" }),
                cpf({ id: "2", cpf_kind: "SA" }),
                cpf({ id: "3", cpf_kind: "MA", owner_id: "m2" }),
            ],
        );
        expect(r.map((a) => `${a.owner_id}:${a.cpf_kind}`)).toEqual([
            "m1:MA",
            "m2:OA",
            "m2:SA",
        ]);
    });

    it("skips a member with an unmatched CPF account", () => {
        const r = missingCpfAccounts(
            [member("m1")],
            [cpf({ id: "1", cpf_kind: null, name: "CPF old" })],
        );
        expect(r).toEqual([]);
    });
});

describe("unmatchedCpfAccounts", () => {
    it("lists CPF accounts without a kind", () => {
        const r = unmatchedCpfAccounts([
            cpf({ id: "1", cpf_kind: "OA" }),
            cpf({ id: "2", cpf_kind: null }),
            cpf({ id: "3", type: "Cash", cpf_kind: null }),
        ]);
        expect(r.map((a) => a.id)).toEqual(["2"]);
    });
});

describe("cpfKindFor", () => {
    it("uses cpf_kind only, never the name", () => {
        expect(cpfKindFor(cpf({ name: "CPF OA", cpf_kind: null }))).toBeNull();
        expect(cpfKindFor(cpf({ name: "Mine", cpf_kind: "SA" }))).toBe("SA");
        expect(cpfKindFor(cpf({ type: "Cash", cpf_kind: "OA" }))).toBeNull();
    });
});
