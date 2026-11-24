/** Supabase queries for the bonus domain. */

import type {
    BonusEvent,
    BonusEventsResult,
    BonusSplitShare,
    SaveBonusEventInput,
} from "../../types/finance";
import { addMonths } from "../../lib/dateUtils";
import {
    BonusLogUnavailableError,
    isMissingRelationError,
} from "../../lib/supabaseErrors";
import {
    cloneDefaultSplit,
    normalizeBonusSplit,
} from "../../lib/bonusFormulas";
import { mapBonusEventRow } from "./shared";
import type { SupabaseContext } from "./context";

export class BonusStore {
    constructor(private readonly ctx: SupabaseContext) {}

    // Bonus Log
    async getBonusEvents(): Promise<BonusEventsResult> {
        if (this.ctx.bonusTableAvailable === false)
            return { available: false, events: [] };
        const { data, error } = await this.ctx
            .getClient()
            .from("bonus_events")
            .select("*")
            .order("received_on", { ascending: false });
        if (error) {
            if (isMissingRelationError(error)) {
                this.ctx.bonusTableAvailable = false;
                return { available: false, events: [] };
            }
            throw error;
        }
        this.ctx.bonusTableAvailable = true;
        return {
            available: true,
            events: ((data || []) as Record<string, unknown>[]).map(
                mapBonusEventRow,
            ),
        };
    }

    /**
     * One member's bonuses received in a month, or null when the bonus log is
     * unavailable. Never throws: the monthly budget must load without it.
     */

    async getMonthBonusEvents(
        month: string,
        ownerId: string,
    ): Promise<BonusEvent[] | null> {
        if (this.ctx.bonusTableAvailable === false || !ownerId) return null;
        try {
            const nextMonth = addMonths(month, 1);
            const { data, error } = await this.ctx
                .getClient()
                .from("bonus_events")
                .select("*")
                .eq("recipient_id", ownerId)
                .gte("received_on", `${month}-01`)
                .lt("received_on", `${nextMonth}-01`);
            if (error) {
                if (isMissingRelationError(error)) {
                    this.ctx.bonusTableAvailable = false;
                } else {
                    console.warn(
                        "Failed to load bonus events for budget:",
                        error,
                    );
                }
                return null;
            }
            this.ctx.bonusTableAvailable = true;
            return ((data || []) as Record<string, unknown>[]).map(
                mapBonusEventRow,
            );
        } catch (err) {
            console.warn("Failed to load bonus events for budget:", err);
            return null;
        }
    }

    private async getCurrentMemberId(): Promise<string | null> {
        try {
            const client = this.ctx.getClient();
            const { data: authData } = await client.auth.getUser();
            const userId = authData?.user?.id;
            if (!userId) return null;
            const { data } = await client
                .from("household_members")
                .select("id")
                .eq("user_id", userId)
                .maybeSingle();
            return (data?.id as string | undefined) ?? null;
        } catch {
            return null;
        }
    }

    private throwBonusError(error: unknown): never {
        if (isMissingRelationError(error)) {
            this.ctx.bonusTableAvailable = false;
            throw new BonusLogUnavailableError();
        }
        throw error;
    }

    async saveBonusEvent(input: SaveBonusEventInput): Promise<BonusEvent> {
        const client = this.ctx.getClient();
        const householdId = await this.ctx.getHouseholdId();
        const createdBy = input.id ? null : await this.getCurrentMemberId();
        const fields = {
            recipient_id: input.recipient_id,
            type: input.type,
            received_on: input.received_on,
            gross: Math.round(input.gross * 100) / 100,
            cpf: Math.round(input.cpf * 100) / 100,
            note: input.note || null,
            split: input.split,
        };

        const { data, error } = input.id
            ? await client
                  .from("bonus_events")
                  .update({ ...fields, updated_at: new Date().toISOString() })
                  .eq("id", input.id)
                  .select()
                  .maybeSingle()
            : await client
                  .from("bonus_events")
                  .insert({
                      ...fields,
                      household_id: householdId,
                      ...(createdBy ? { created_by: createdBy } : {}),
                  })
                  .select()
                  .single();
        if (error) this.throwBonusError(error);
        if (!data) throw new Error("Bonus not found");
        this.ctx.bonusTableAvailable = true;
        return mapBonusEventRow(data as Record<string, unknown>);
    }

    async deleteBonusEvent(id: string): Promise<void> {
        const { error } = await this.ctx
            .getClient()
            .from("bonus_events")
            .delete()
            .eq("id", id);
        if (error) this.throwBonusError(error);
    }

    async getBonusSplitDefault(memberId: string): Promise<BonusSplitShare[]> {
        if (this.ctx.bonusTableAvailable === false) return cloneDefaultSplit();
        try {
            const { data, error } = await this.ctx
                .getClient()
                .from("bonus_split_defaults")
                .select("split")
                .eq("member_id", memberId)
                .maybeSingle();
            if (error) {
                if (!isMissingRelationError(error)) {
                    console.warn("Failed to load bonus split default:", error);
                }
                return cloneDefaultSplit();
            }
            return data?.split
                ? normalizeBonusSplit(data.split)
                : cloneDefaultSplit();
        } catch (err) {
            console.warn("Failed to load bonus split default:", err);
            return cloneDefaultSplit();
        }
    }

    async saveBonusSplitDefault(
        memberId: string,
        split: BonusSplitShare[],
    ): Promise<void> {
        const householdId = await this.ctx.getHouseholdId();
        const clean = normalizeBonusSplit(split).map(({ key, pct }) => ({
            key,
            pct,
        }));
        const { error } = await this.ctx
            .getClient()
            .from("bonus_split_defaults")
            .upsert(
                {
                    household_id: householdId,
                    member_id: memberId,
                    split: clean,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "member_id" },
            );
        if (error) this.throwBonusError(error);
    }
}
