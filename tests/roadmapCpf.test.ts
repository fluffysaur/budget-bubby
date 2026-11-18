import { describe, it, expect } from "vitest";
import {
    computeCpfOa,
    lifeEventsFromRecurring,
    oaEventsFromRecurring,
    projectPool,
    projectRoadmap,
    toRoadmapGoals,
    type RoadmapCpfOa,
    type RoadmapGoalInput,
    type RoadmapInput,
} from "../src/lib/roadmap";
import type {
    Account,
    AccountSnapshot,
    RecurringItem,
    SavingsGoal,
} from "../src/types/finance";

const TODAY = "2026-11-18";

function goal(
    id: string,
    targetAmount: number,
    targetDate: string,
    extra: Partial<RoadmapGoalInput> = {},
): RoadmapGoalInput {
    return {
        id,
        title: id,
        emoji: "🏠",
        targetAmount,
        targetDate,
        createdAt: "2026-01-01T00:00:00.000Z",
        spent: 0,
        done: false,
        ...extra,
    };
}

function oa(over: Partial<RoadmapCpfOa> = {}): RoadmapCpfOa {
    return {
        balance: 30000,
        monthlyGrowth: 0,
        asOf: "2026-11-15",
        changes: [],
        ...over,
    };
}

function input(
    goals: RoadmapGoalInput[],
    over: Partial<RoadmapInput> = {},
): RoadmapInput {
    return {
        today: TODAY,
        pool: { liquid: 50000, investments: 0, asOf: "2026-11-15" },
        monthlySavings: 2000,
        goals,
        ...over,
    };
}

const house = (extra: Partial<RoadmapGoalInput> = {}) =>
    goal("house", 100000, "2028-11-01", extra);

describe("projectRoadmap with CPF OA", () => {
    it("ignores OA for goals without the switch", () => {
        const base = projectRoadmap(input([house()]));
        const withOa = projectRoadmap(input([house()], { cpfOa: oa() }));
        expect(withOa.goals[0].fromCpfOa).toBe(0);
        expect(withOa.goals[0].gap).toBe(base.goals[0].gap);
        expect(base.goals[0].gap).toBeGreaterThan(0);
    });

    it("funds an OA goal from OA first, then the pool", () => {
        const base = projectRoadmap(input([house()]));
        const r = projectRoadmap(
            input([house({ useCpfOa: true })], { cpfOa: oa() }),
        );
        const h = r.goals[0];
        expect(h.fromCpfOa).toBe(30000);
        expect(h.stillNeeded).toBe(100000);
        expect(h.claimEnd).toBe(70000);
        expect(h.margin).toBe(base.goals[0].margin + 30000);
        expect(h.status).toBe("on_track");
        expect(r.verdict).toBe("on_track");
        // Today: OA covers 30k, the pool covers the rest of today's 50k.
        expect(h.fundedToday).toBe(80000);
    });

    it("stops at the cap", () => {
        const r = projectRoadmap(
            input([house({ useCpfOa: true, cpfOaCap: 1000 })], {
                cpfOa: oa(),
            }),
        );
        expect(r.goals[0].fromCpfOa).toBe(1000);
        expect(r.goals[0].claimEnd).toBe(99000);
    });

    it("counts OA growth up to the deadline", () => {
        const r = projectRoadmap(
            input([house({ useCpfOa: true })], {
                cpfOa: oa({ balance: 0, monthlyGrowth: 1000 }),
            }),
        );
        const h = r.goals[0];
        // Nothing in OA today, so today's cover is cash only.
        expect(h.fundedToday).toBe(50000);
        expect(h.fromCpfOa).toBeGreaterThanOrEqual(23000);
        expect(h.fromCpfOa).toBeLessThanOrEqual(25000);
    });

    it("shares OA between OA goals in date order", () => {
        const flat = goal("flat", 20000, "2027-06-01", { useCpfOa: true });
        const r = projectRoadmap(
            input([house({ useCpfOa: true }), flat], { cpfOa: oa() }),
        );
        const [f, h] = r.goals;
        expect(f.goal.id).toBe("flat");
        expect(f.fromCpfOa).toBe(20000);
        expect(h.fromCpfOa).toBe(10000);
        expect(r.cpfOa?.used).toBe(30000);
    });

    it("never draws from OA when there is no OA data", () => {
        const r = projectRoadmap(input([house({ useCpfOa: true })]));
        expect(r.goals[0].fromCpfOa).toBe(0);
        expect(r.cpfOa).toBeNull();
    });

    it("reduces OA growth by an OA-paid mortgage", () => {
        const r = projectRoadmap(
            input([house({ useCpfOa: true })], {
                cpfOa: oa({
                    balance: 0,
                    monthlyGrowth: 1000,
                    changes: [
                        {
                            id: "m-starts",
                            name: "Mortgage",
                            kind: "starts",
                            startMonth: "2026-12",
                            endMonth: null,
                            monthlyDelta: -1000,
                        },
                    ],
                }),
            }),
        );
        expect(r.goals[0].fromCpfOa).toBe(0);
    });

    it("dips the cash projection by the cash share only", () => {
        const points = projectPool(
            input([house({ useCpfOa: true })], { cpfOa: oa() }),
        );
        const at = points.find((p) => p.month === "2028-11");
        expect(at?.milestones[0].amount).toBe(70000);
    });
});

const account = (over: Partial<Account>): Account => ({
    id: "a",
    household_id: "h",
    owner_id: "m1",
    name: "CPF OA",
    type: "CPF",
    balance: 0,
    currency: "SGD",
    is_joint: false,
    ...over,
});

const snap = (
    account_id: string,
    snapshot_date: string,
    balance: number,
): AccountSnapshot => ({
    id: `${account_id}-${snapshot_date}`,
    account_id,
    household_id: "h",
    balance,
    snapshot_date,
});

describe("computeCpfOa", () => {
    const accounts = [
        account({ id: "oa1", cpf_kind: "OA", balance: 13000 }),
        account({
            id: "oa2",
            owner_id: "m2",
            cpf_kind: "OA",
            balance: 7000,
        }),
        account({ id: "sa1", name: "CPF SA", cpf_kind: "SA", balance: 9999 }),
        account({ id: "cash", type: "Cash", name: "Bank", balance: 5000 }),
    ];

    it("sums OA across members and ignores SA, MA and cash", () => {
        const r = computeCpfOa(accounts, [], [], TODAY);
        expect(r?.balance).toBe(20000);
    });

    it("has no growth with fewer than 3 OA snapshots", () => {
        const r = computeCpfOa(
            accounts,
            [
                snap("oa1", "2026-09-30", 11000),
                snap("oa1", "2026-10-31", 12000),
            ],
            [],
            TODAY,
        );
        expect(r?.monthlyGrowth).toBe(0);
    });

    it("averages growth over the OA snapshots", () => {
        const snapshots = [
            snap("oa1", "2026-08-31", 10000),
            snap("oa2", "2026-08-31", 6000),
            snap("oa1", "2026-09-30", 11000),
            snap("oa2", "2026-09-30", 6500),
            snap("oa1", "2026-10-31", 12000),
            snap("oa2", "2026-10-31", 7000),
        ];
        const r = computeCpfOa(accounts, snapshots, [], TODAY);
        expect(r?.monthlyGrowth).toBe(1500);
        expect(r?.asOf).toBe("2026-10-31");
    });

    it("skips the $0 opening snapshot of an auto-created account", () => {
        const snapshots = [
            snap("oa1", "2026-07-31", 0),
            snap("oa1", "2026-08-31", 10000),
            snap("oa1", "2026-09-30", 11000),
            snap("oa1", "2026-10-31", 12000),
        ];
        const r = computeCpfOa([accounts[0]], snapshots, [], TODAY);
        expect(r?.monthlyGrowth).toBe(1000);
    });

    it("returns null without OA accounts", () => {
        expect(computeCpfOa([accounts[3]], [], [], TODAY)).toBeNull();
    });

    it("does not match OA by name", () => {
        const unmatched = account({ id: "x", name: "CPF OA", balance: 500 });
        expect(computeCpfOa([unmatched], [], [], TODAY)).toBeNull();
    });
});

const item = (over: Partial<RecurringItem>): RecurringItem => ({
    id: "r",
    household_id: "h",
    owner_id: "m1",
    type: "bill",
    name: "Mortgage",
    amount: 1500,
    frequency: "monthly",
    monthly_amortized_amount: 1500,
    due_day: 1,
    start_date: "2027-03-01",
    end_date: null,
    ...over,
});

describe("OA-paid recurring items", () => {
    it("moves an OA-paid item out of cash life events", () => {
        const items = [item({ paid_from_cpf_oa: true })];
        expect(lifeEventsFromRecurring(items, "2026-11")).toEqual([]);
        const oaEvents = oaEventsFromRecurring(items, "2026-11");
        expect(oaEvents).toHaveLength(1);
        expect(oaEvents[0].monthlyDelta).toBe(-1500);
        expect(oaEvents[0].startMonth).toBe("2027-03");
    });

    it("drops an OA item already inside the OA snapshot window", () => {
        const items = [
            item({ paid_from_cpf_oa: true, start_date: "2026-06-01" }),
        ];
        expect(oaEventsFromRecurring(items, "2026-10")).toEqual([]);
    });

    it("feeds OA changes into computeCpfOa", () => {
        const accounts = [account({ id: "oa1", cpf_kind: "OA" })];
        const r = computeCpfOa(
            accounts,
            [],
            [item({ paid_from_cpf_oa: true })],
            TODAY,
        );
        expect(r?.changes).toHaveLength(1);
    });
});

describe("toRoadmapGoals", () => {
    it("reads the OA switch and cap", () => {
        const g: SavingsGoal = {
            id: "g",
            household_id: "h",
            title: "House",
            target_amount: 100000,
            saved_so_far: 0,
            target_date: "2028-11-01",
            emoji: "🏠",
            status: "on_track",
            use_cpf_oa: true,
            cpf_oa_cap: 40000,
        };
        const [r] = toRoadmapGoals([g], []);
        expect(r.useCpfOa).toBe(true);
        expect(r.cpfOaCap).toBe(40000);
    });
});
