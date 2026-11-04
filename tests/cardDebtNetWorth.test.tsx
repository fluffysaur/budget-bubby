import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { toSingaporeMonth } from "../src/lib/dateUtils";
import {
    isStatementOwedAt,
    calculateCardDebt,
    filterStatementsForPerspective,
    calculateMonthlyBalanceTrends,
} from "../src/lib/financialFormulas";
import { NetWorthChart } from "../src/components/accounts/NetWorthChart";
import { AccountsPage } from "../src/pages/AccountsPage";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { mockFinanceService } from "../src/services/mockFinanceService";
import { queryClient } from "../src/lib/queryClient";
import { formatSGD } from "../src/lib/currency";
import type {
    Account,
    AccountSnapshot,
    CreditCard,
    CreditCardStatement,
} from "../src/types/finance";

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver;

vi.mock("recharts", async (importOriginal) => {
    const original = await importOriginal<typeof import("recharts")>();
    return {
        ...original,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
            <div style={{ width: 600, height: 300 }}>{children}</div>
        ),
    };
});

function makeCard(
    id: string,
    ownerId: string,
    isActive: boolean = true,
): CreditCard {
    return {
        id,
        household_id: "hh-1",
        owner_id: ownerId,
        name: `Card ${id}`,
        bank: "DBS",
        billing_day: 15,
        due_day: 5,
        color: "#0284c7",
        is_active: isActive,
    };
}

function makeStmt(
    overrides: Partial<CreditCardStatement> & {
        id: string;
        month: string;
        statement_amount: number;
    },
): CreditCardStatement {
    return {
        card_id: "cc-1",
        household_id: "hh-1",
        due_date: `${overrides.month}-25`,
        is_paid: false,
        paid_at: null,
        ...overrides,
    };
}

function makeAccount(
    id: string,
    balance: number,
    type: Account["type"] = "Cash",
): Account {
    return {
        id,
        household_id: "hh-1",
        owner_id: "mem-1",
        name: id,
        type,
        balance,
        currency: "SGD",
        is_joint: false,
    };
}

function makeSnap(
    accountId: string,
    date: string,
    balance: number,
): AccountSnapshot {
    return {
        id: `${accountId}-${date}`,
        account_id: accountId,
        household_id: "hh-1",
        balance,
        snapshot_date: date,
    };
}

describe("toSingaporeMonth", () => {
    it("converts UTC timestamps across the midnight SGT boundary into Asia/Singapore YYYY-MM", () => {
        // 2026-10-31 17:30 UTC = 2026-11-01 01:30 SGT
        expect(toSingaporeMonth("2026-10-31T17:30:00Z")).toBe("2026-11");
        // 2026-10-31 15:59 UTC = 2026-10-31 23:59 SGT
        expect(toSingaporeMonth("2026-10-31T15:59:00Z")).toBe("2026-10");
    });
});

describe("isStatementOwedAt", () => {
    it("marks an unpaid statement as owed in its own month and every later month, but not before", () => {
        const stmt = makeStmt({
            id: "s1",
            month: "2026-10",
            statement_amount: 842.5,
            is_paid: false,
        });
        expect(isStatementOwedAt(stmt, "2026-09")).toBe(false);
        expect(isStatementOwedAt(stmt, "2026-10")).toBe(true);
        expect(isStatementOwedAt(stmt, "2026-11")).toBe(true);
    });

    it("marks a statement paid in the same month as not owed at that month-end", () => {
        const stmt = makeStmt({
            id: "s2",
            month: "2026-10",
            statement_amount: 620,
            is_paid: true,
            paid_at: "2026-10-25T10:00:00.000Z",
        });
        expect(isStatementOwedAt(stmt, "2026-10")).toBe(false);
        expect(isStatementOwedAt(stmt, "2026-11")).toBe(false);
    });

    it("marks a statement paid the next month as owed at the end of its own month, not after", () => {
        const stmt = makeStmt({
            id: "s3",
            month: "2026-10",
            statement_amount: 842.5,
            due_date: "2026-11-05",
            is_paid: true,
            paid_at: "2026-11-04T03:00:00.000Z",
        });
        expect(isStatementOwedAt(stmt, "2026-10")).toBe(true);
        expect(isStatementOwedAt(stmt, "2026-11")).toBe(false);
    });

    it("falls back to due_date when is_paid is true but paid_at is null", () => {
        const stmt = makeStmt({
            id: "s4",
            month: "2026-10",
            statement_amount: 500,
            due_date: "2026-11-05",
            is_paid: true,
            paid_at: null,
        });
        expect(isStatementOwedAt(stmt, "2026-10")).toBe(true);
        expect(isStatementOwedAt(stmt, "2026-11")).toBe(false);
    });
});

describe("calculateCardDebt", () => {
    it("sums owed statements and ignores amounts <= 0", () => {
        const statements: CreditCardStatement[] = [
            makeStmt({
                id: "s1",
                month: "2026-10",
                statement_amount: 842.5,
                is_paid: false,
            }),
            makeStmt({
                id: "s2",
                month: "2026-10",
                statement_amount: 350.2,
                is_paid: false,
            }),
            makeStmt({
                id: "s3",
                month: "2026-10",
                statement_amount: 620,
                is_paid: true,
                paid_at: "2026-10-25T10:00:00.000Z",
            }),
            makeStmt({
                id: "s4",
                month: "2026-10",
                statement_amount: 0,
                is_paid: false,
            }),
            makeStmt({
                id: "s5",
                month: "2026-10",
                statement_amount: -50,
                is_paid: false,
            }),
        ];

        expect(calculateCardDebt(statements, "2026-10")).toBe(1192.7);
        expect(calculateCardDebt(statements, "2026-11")).toBe(1192.7);
        expect(calculateCardDebt(statements, "2026-09")).toBe(0);
    });
});

describe("filterStatementsForPerspective", () => {
    const yijiaCard = makeCard("cc-yj", "mem-yj", true);
    const yijiaInactiveCard = makeCard("cc-yj-old", "mem-yj", false);
    const rachelCard = makeCard("cc-rc", "mem-rc", true);

    const statements: CreditCardStatement[] = [
        makeStmt({
            id: "s-yj",
            card_id: yijiaCard.id,
            month: "2026-10",
            statement_amount: 842.5,
            card: yijiaCard,
        }),
        makeStmt({
            id: "s-yj-inactive",
            card_id: yijiaInactiveCard.id,
            month: "2026-10",
            statement_amount: 100,
            card: yijiaInactiveCard,
        }),
        makeStmt({
            id: "s-rc",
            card_id: rachelCard.id,
            month: "2026-10",
            statement_amount: 620,
            card: rachelCard,
        }),
        makeStmt({
            id: "s-orphan",
            card_id: "cc-missing",
            month: "2026-10",
            statement_amount: 50,
            card: undefined,
        }),
    ];

    it("keeps all statements in Combined (household) perspective", () => {
        expect(
            filterStatementsForPerspective(statements, "household", undefined),
        ).toHaveLength(4);
    });

    it("keeps only the active member's cards (including inactive cards) and drops unresolved owners in personal views", () => {
        const yijiaFiltered = filterStatementsForPerspective(
            statements,
            "yijia",
            "mem-yj",
        );
        expect(yijiaFiltered.map((s) => s.id)).toEqual([
            "s-yj",
            "s-yj-inactive",
        ]);

        const rachelFiltered = filterStatementsForPerspective(
            statements,
            "rachel",
            "mem-rc",
        );
        expect(rachelFiltered.map((s) => s.id)).toEqual(["s-rc"]);
    });
});

describe("calculateMonthlyBalanceTrends with statements", () => {
    it("subtracts cardDebt from totalAssets and nonCpfAssets per month and exposes cardDebt", () => {
        const accounts = [
            makeAccount("cash-1", 10000, "Cash"),
            makeAccount("cpf-1", 5000, "CPF"),
        ];
        const snapshots = [
            makeSnap("cash-1", "2026-09-30", 8000),
            makeSnap("cpf-1", "2026-09-30", 5000),
            makeSnap("cash-1", "2026-10-31", 9000),
            makeSnap("cpf-1", "2026-10-31", 5000),
        ];
        const statements: CreditCardStatement[] = [
            // Owed at end of Oct, paid in Nov
            makeStmt({
                id: "s-oct-paid-nov",
                month: "2026-10",
                statement_amount: 400,
                is_paid: true,
                paid_at: "2026-11-02T04:00:00.000Z",
            }),
            // Unpaid Oct statement (owed in Oct and Nov)
            makeStmt({
                id: "s-oct-unpaid",
                month: "2026-10",
                statement_amount: 600,
                is_paid: false,
            }),
        ];

        const points = calculateMonthlyBalanceTrends(
            accounts,
            snapshots,
            6,
            "2026-11",
            statements,
        );

        expect(points.map((p) => p.month)).toEqual([
            "2026-09",
            "2026-10",
            "2026-11",
        ]);
        // Sep: assets 13,000, debt 0
        expect(points[0].totalAssets).toBe(13000);
        expect(points[0].cardDebt).toBe(0);
        expect(points[0].netWorth).toBe(13000);
        expect(points[0].nonCpfNetWorth).toBe(8000);

        // Oct: assets 14,000, debt 400 + 600 = 1,000
        expect(points[1].totalAssets).toBe(14000);
        expect(points[1].cardDebt).toBe(1000);
        expect(points[1].netWorth).toBe(13000);
        expect(points[1].nonCpfNetWorth).toBe(8000);

        // Nov (current): live assets 15,000, debt 600
        expect(points[2].totalAssets).toBe(15000);
        expect(points[2].cardDebt).toBe(600);
        expect(points[2].netWorth).toBe(14400);
        expect(points[2].nonCpfNetWorth).toBe(9400);
    });
});

describe("NetWorthChart with statements", () => {
    it("displays latest net worth as assets minus unpaid card debt in the legend", () => {
        const accounts = [makeAccount("a1", 10000)];
        const snapshots = [
            makeSnap("a1", "2026-09-30", 9000),
            makeSnap("a1", "2026-10-31", 9500),
        ];
        const statements = [
            makeStmt({
                id: "s1",
                month: "2026-10",
                statement_amount: 842.5,
                is_paid: false,
            }),
        ];

        render(
            <NetWorthChart
                accounts={accounts}
                snapshots={snapshots}
                statements={statements}
            />,
        );

        // 10,000 - 842.50 = 9,157.50
        expect(screen.getByText(formatSGD(9157.5))).toBeInTheDocument();
    });
});

describe("AccountsPage card debt integration", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        window.sessionStorage.setItem("budget_bubby_demo_pin", "true");
        mockFinanceService.resetData();
        queryClient.clear();
    });

    it("shows Combined net worth minus unpaid demo statements with card debt subtitle, and updates when DBS statement is marked paid", async () => {
        // Total demo accounts = 544,200.00 (Yi Jia 206,700 + Rachel 337,500)
        // Unpaid demo statements = 842.50 (DBS) + 350.20 (OCBC) = 1,192.70
        // Combined Net Worth = 544,200.00 - 1,192.70 = 543,007.30
        render(
            <HouseholdProvider initialPerspective="household">
                <AccountsPage />
            </HouseholdProvider>,
        );

        await waitFor(() => {
            expect(
                screen.getAllByText(formatSGD(543007.3)).length,
            ).toBeGreaterThanOrEqual(1);
        });
        expect(
            screen.getByText(`${formatSGD(1192.7)} card debt`),
        ).toBeInTheDocument();

        // Mark Yi Jia's DBS statement (S$842.50) paid via the Credit Cards tab
        fireEvent.click(screen.getByRole("tab", { name: /credit cards/i }));

        // Navigate from Nov 2026 back to Oct 2026 where demo statements live
        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "Previous Month" }),
            ).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole("button", { name: "Previous Month" }));

        const markPaidBtn = await screen.findByRole("button", {
            name: /Mark DBS Altitude Visa statement as Paid/i,
        });
        fireEvent.click(markPaidBtn);

        await waitFor(() => {
            expect(
                screen.getByRole("button", {
                    name: /Mark DBS Altitude Visa statement as Unpaid/i,
                }),
            ).toBeInTheDocument();
        });

        // Switch back to Accounts tab -> Net Worth increases by S$842.50 to S$543,849.80, debt drops to S$350.20
        fireEvent.click(screen.getByRole("tab", { name: /^accounts$/i }));

        await waitFor(() => {
            expect(
                screen.getAllByText(formatSGD(543849.8)).length,
            ).toBeGreaterThanOrEqual(1);
        });
        expect(
            screen.getByText(`${formatSGD(350.2)} card debt`),
        ).toBeInTheDocument();
    });

    it("excludes Yi Jia's card debt in Rachel's view", async () => {
        // Rachel's accounts = 190,000 + 50,000 + 60,000 + 17,000 + 20,500 = 337,500
        // Rachel's only card statement (UOB One S$620) is already paid
        render(
            <HouseholdProvider initialPerspective="rachel">
                <AccountsPage />
            </HouseholdProvider>,
        );

        await waitFor(() => {
            expect(
                screen.getAllByText(formatSGD(337500)).length,
            ).toBeGreaterThanOrEqual(1);
        });
        expect(screen.getByText("5 accounts")).toBeInTheDocument();
        expect(screen.queryByText(/card debt/i)).not.toBeInTheDocument();
    });
});
