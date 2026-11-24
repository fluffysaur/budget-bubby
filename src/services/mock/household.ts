/** In-memory mock of the household domain. */

import { normalizeHouseholdSettings } from "../../lib/roadmap/goalSettings";
import type {
    Household,
    HouseholdOverview,
    HouseholdSettingsInput,
} from "../../types/finance";
import { calculateHouseholdSettlement } from "../../lib/financialFormulas";
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

        const settlementSummary = calculateHouseholdSettlement(
            this.ctx.state.expenses,
            this.ctx.state.members,
        );

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
