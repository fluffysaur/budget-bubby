/** In-memory mock of the goals domain. */

import {
    normalizeGoalTags,
    sortGoalsByDate,
} from "../../lib/roadmap/goalSettings";
import type { CreateGoalInput, SavingsGoal } from "../../types/finance";
import { normalizeGoalStatus } from "../../lib/financialFormulas";
import { resolveGoalLinkedStartDate } from "../../lib/recurringItems";
import { cloneDeep, roundCpfCap } from "./context";
import type { MockContext } from "./context";

export class GoalsStore {
    constructor(private readonly ctx: MockContext) {}

    async getGoals(): Promise<SavingsGoal[]> {
        return sortGoalsByDate(
            cloneDeep(this.ctx.state.savingsGoals.map(normalizeGoalStatus)),
        );
    }

    async getGoal(id: string): Promise<SavingsGoal | null> {
        const goal = this.ctx.state.savingsGoals.find((g) => g.id === id);
        return goal ? cloneDeep(normalizeGoalStatus(goal)) : null;
    }

    async addGoal(input: CreateGoalInput): Promise<SavingsGoal> {
        const newGoal: SavingsGoal = {
            id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            household_id: input.household_id || this.ctx.state.household.id,
            owner_id: input.owner_id || null,
            title: input.title,
            target_amount: Math.round(input.target_amount * 100) / 100,
            target_date: input.target_date,
            emoji: input.emoji || "🎯",
            status: "on_track",
            created_at: new Date().toISOString(),
            use_cpf_oa: input.use_cpf_oa ?? false,
            cpf_oa_cap: input.use_cpf_oa ? roundCpfCap(input.cpf_oa_cap) : null,
            tags: normalizeGoalTags(input.tags),
            goal_type: input.goal_type ?? "standard",
            buffer_months:
                input.goal_type === "buffer"
                    ? (input.buffer_months ?? null)
                    : null,
        };
        if (
            newGoal.goal_type === "buffer" &&
            this.ctx.state.savingsGoals.some((g) => g.goal_type === "buffer")
        ) {
            throw new Error("This household already has a buffer goal");
        }

        this.ctx.state.savingsGoals.push(newGoal);
        this.ctx.persist();
        return cloneDeep(newGoal);
    }

    /** Progress is computed by the Roadmap, so only the given fields change. */
    async updateGoal(
        id: string,
        updates: Partial<SavingsGoal>,
    ): Promise<SavingsGoal> {
        const goal = this.ctx.state.savingsGoals.find((g) => g.id === id);
        if (!goal) {
            throw new Error(`Savings goal with id "${id}" not found`);
        }
        const rest = { ...updates };
        if (rest.cpf_oa_cap !== undefined) {
            rest.cpf_oa_cap = roundCpfCap(rest.cpf_oa_cap);
        }
        if (rest.tags !== undefined) {
            rest.tags = normalizeGoalTags(rest.tags);
        }
        Object.assign(goal, rest);

        // Keep start_date synced on any recurring items linked to this goal
        if (rest.target_date !== undefined && goal.target_date) {
            let syncedAny = false;
            for (const item of this.ctx.state.recurringItems) {
                if (item.goal_id === id) {
                    item.start_date = resolveGoalLinkedStartDate(
                        goal.target_date,
                        item.goal_offset_months,
                    );
                    syncedAny = true;
                }
            }
            if (syncedAny) {
                this.ctx.syncUnlockedBudgetsForOwner();
            }
        }

        this.ctx.persist();
        return (await this.getGoal(id)) as SavingsGoal;
    }
}
