import { describe, it, expect } from "vitest";
import {
    toggleAccountType,
    filterAccountsByTypes,
    includesCardDebt,
    getAccountFilterLabel,
    calculateFilteredNetWorth,
} from "../accountTypeFilter";
import type { Account, AccountType } from "../../types/finance";

function acc(id: string, type: AccountType, balance: number): Account {
    return { id, type, balance, name: id } as Account;
}

const ACCOUNTS = [
    acc("a", "Cash", 1000),
    acc("b", "Investment", 2000),
    acc("c", "CPF", 4000),
    acc("d", "Other", 500),
];

describe("toggleAccountType", () => {
    it("adds a type in canonical order", () => {
        expect(toggleAccountType(["CPF"], "Cash")).toEqual(["Cash", "CPF"]);
    });
    it("selecting a type from All selects only that type", () => {
        expect(toggleAccountType([], "Investment")).toEqual(["Investment"]);
    });
    it("removes a selected type", () => {
        expect(toggleAccountType(["Cash", "CPF"], "Cash")).toEqual(["CPF"]);
    });
    it("deselecting the last type reverts to All", () => {
        expect(toggleAccountType(["CPF"], "CPF")).toEqual([]);
    });
});

describe("filterAccountsByTypes", () => {
    it("returns everything for All (empty selection)", () => {
        expect(filterAccountsByTypes(ACCOUNTS, [])).toHaveLength(4);
    });
    it("returns only selected types", () => {
        expect(
            filterAccountsByTypes(ACCOUNTS, ["Cash", "CPF"]).map((a) => a.id),
        ).toEqual(["a", "c"]);
    });
});

describe("includesCardDebt", () => {
    it("is true for All", () => {
        expect(includesCardDebt([])).toBe(true);
    });
    it("is true when Cash is selected", () => {
        expect(includesCardDebt(["Cash", "CPF"])).toBe(true);
    });
    it("is false otherwise", () => {
        expect(includesCardDebt(["Investment"])).toBe(false);
        expect(includesCardDebt(["CPF", "Other"])).toBe(false);
    });
});

describe("getAccountFilterLabel", () => {
    it("reads Net Worth for All", () => {
        expect(getAccountFilterLabel([])).toBe("Net Worth");
    });
    it("uses the single type name", () => {
        expect(getAccountFilterLabel(["CPF"])).toBe("CPF");
        expect(getAccountFilterLabel(["Investment"])).toBe("Investments");
    });
    it("joins two types with &", () => {
        expect(getAccountFilterLabel(["Cash", "CPF"])).toBe("Cash & CPF");
    });
    it("joins three types with commas and &", () => {
        expect(getAccountFilterLabel(["Cash", "Investment", "CPF"])).toBe(
            "Cash, Investments & CPF",
        );
    });
});

describe("calculateFilteredNetWorth", () => {
    it("subtracts card debt for All", () => {
        expect(calculateFilteredNetWorth(ACCOUNTS, [], 300)).toBe(7200);
    });
    it("subtracts card debt when Cash is included", () => {
        expect(calculateFilteredNetWorth(ACCOUNTS, ["Cash", "CPF"], 300)).toBe(
            4700,
        );
    });
    it("shows gross total without Cash", () => {
        expect(calculateFilteredNetWorth(ACCOUNTS, ["Investment"], 300)).toBe(
            2000,
        );
    });
    it("rounds to cents", () => {
        expect(
            calculateFilteredNetWorth(
                [acc("x", "Cash", 0.1), acc("y", "Cash", 0.2)],
                [],
                0,
            ),
        ).toBe(0.3);
    });
});
