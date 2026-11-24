/** In-memory mock of the household domain. */

import { normalizeHouseholdSettings } from "../../lib/roadmap/goalSettings";
import type {
    Household,
    HouseholdOverview,
    HouseholdSettingsInput,
} from "../../types/finance";
import { calculateSharedExpenseSettlement } from "../../lib/financialFormulas";
import { cloneDeep } from "./context";
import type { MockContext } from "./context";

export class HouseholdStore {
    constructor(private readonly ctx: MockContext) {}

    async updateHouseholdSettings(
        settings: HouseholdSettingsInput,
    ): Promise<Household> {
        Object.assign(
            this.ctx.state.household,
            normalizeHouseholdSettings(settings),
        );
        this.ctx.persist();
        return cloneDeep(this.ctx.state.household);
    }

    async getHouseholdOverview(): Promise<HouseholdOverview> {
        const accounts = this.ctx.state.accounts;
        const totalAssets =
            Math.round(accounts.reduce((sum, a) => sum + a.balance, 0) * 100) /
            100;

        const trueNetWorth = totalAssets;

        const m1 = this.ctx.state.members[0];
        const m2 = this.ctx.state.members[1];

        const settlementSummary =
            m1 && m2
                ? calculateSharedExpenseSettlement(
                      this.ctx.state.expenses,
                      m1.id,
                      m2.id,
                      m1.display_name,
                      m2.display_name,
                  )
                : {
                      netBalance: 0,
                      debtorId: null,
                      creditorId: null,
                      settlementText: "All settled up",
                      member1OwesMember2: 0,
                      member2OwesMember1: 0,
                  };

        const activeGoals = this.ctx.state.savingsGoals.filter(
            (g) => g.status !== "achieved",
        );

        return {
            household: cloneDeep(this.ctx.state.household),
            members: cloneDeep(this.ctx.state.members),
            totalAssets,
            trueNetWorth,
            settlementSummary,
            activeGoals: cloneDeep(activeGoals),
            upcomingBills: cloneDeep(this.ctx.state.recurringItems),
        };
    }

    async hatchMemberBubby(memberId: string): Promise<string> {
        const now = new Date().toISOString();
        const member = this.ctx.state.members.find((m) => m.id === memberId);
        if (member && !member.bubby_hatched_at) {
            member.bubby_hatched_at = now;
            this.ctx.persist();
        }
        return member?.bubby_hatched_at ?? now;
    }
}
