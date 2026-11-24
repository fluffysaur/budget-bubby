/** Supabase queries for the household domain. */

import { normalizeHouseholdSettings } from "../../lib/roadmap/goalSettings";
import type {
    Account,
    Expense,
    Household,
    HouseholdMember,
    HouseholdOverview,
    HouseholdSettingsInput,
    RecurringItem,
    SavingsGoal,
} from "../../types/finance";
import { calculateHouseholdSettlement } from "../../lib/financialFormulas";

import type { SupabaseContext } from "./context";

export class HouseholdStore {
    constructor(private readonly ctx: SupabaseContext) {}

    async updateHouseholdSettings(
        settings: HouseholdSettingsInput,
    ): Promise<Household> {
        const client = this.ctx.getClient();
        const householdId = await this.ctx.getHouseholdId();
        const { data, error } = await client
            .from("households")
            .update(normalizeHouseholdSettings(settings))
            .eq("id", householdId)
            .select()
            .single();
        if (error) throw error;
        return data as Household;
    }

    async getHouseholdOverview(): Promise<HouseholdOverview> {
        const client = this.ctx.getClient();

        // 1. Fetch household
        const { data: householdData, error: hhError } = await client
            .from("households")
            .select("*")
            .limit(1)
            .maybeSingle();
        if (hhError) throw hhError;

        let household = householdData as Household;
        if (!household) {
            // Create or fallback
            household = {
                id: "00000000-0000-0000-0000-000000000001",
                name: "Household",
                currency: "SGD",
                created_at: new Date().toISOString(),
            };
        }

        // 2. Fetch members
        const { data: membersData, error: memError } = await client
            .from("household_members")
            .select("*")
            .eq("household_id", household.id)
            .order("created_at", { ascending: true });
        if (memError) throw memError;
        const members = (membersData || []) as HouseholdMember[];

        // 3. Fetch accounts for total assets
        const { data: accountsData, error: accError } = await client
            .from("accounts")
            .select("*")
            .eq("household_id", household.id);
        if (accError) throw accError;
        const accounts = (accountsData || []) as Account[];
        const totalAssets =
            Math.round(
                accounts.reduce((sum, a) => sum + Number(a.balance), 0) * 100,
            ) / 100;

        const trueNetWorth = totalAssets;

        // 5. Fetch unsettled shared expenses for couple settlement
        const { data: expensesData, error: expError } = await client
            .from("expenses")
            .select("*")
            .eq("household_id", household.id)
            .eq("is_shared", true)
            .eq("settled", false);
        if (expError) throw expError;
        const expenses = (expensesData || []) as Expense[];

        const settlementSummary = calculateHouseholdSettlement(
            expenses,
            members,
        );

        // 6. Savings Goals
        const { data: goalsData, error: goalError } = await client
            .from("savings_goals")
            .select("*")
            .eq("household_id", household.id)
            .neq("status", "achieved");
        if (goalError) throw goalError;
        const activeGoals = (goalsData || []) as SavingsGoal[];

        // 7. Recurring Items
        const { data: recurringItemsData, error: polError } = await client
            .from("recurring_items")
            .select("*")
            .eq("household_id", household.id);
        if (polError) throw polError;
        const upcomingBills = (recurringItemsData || []) as RecurringItem[];

        return {
            household,
            members,
            totalAssets,
            trueNetWorth,
            settlementSummary,
            activeGoals,
            upcomingBills,
        };
    }

    async hatchMemberBubby(memberId: string): Promise<string> {
        const now = new Date().toISOString();
        try {
            const { error } = await this.ctx
                .getClient()
                .from("household_members")
                .update({ bubby_hatched_at: now })
                .eq("id", memberId);
            if (error) {
                console.warn(
                    "Failed to persist bubby_hatched_at to Supabase:",
                    error,
                );
            }
        } catch (err) {
            console.warn(
                "Failed to persist bubby_hatched_at to Supabase:",
                err,
            );
        }
        return now;
    }
}
