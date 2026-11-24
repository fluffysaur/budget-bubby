/** In-memory mock of the bonus domain. */

import type {
    BonusEvent,
    BonusEventsResult,
    BonusSplitShare,
    SaveBonusEventInput,
} from "../../types/finance";
import {
    cloneDefaultSplit,
    normalizeBonusSplit,
} from "../../lib/bonusFormulas";
import { cloneDeep } from "./context";
import type { MockContext } from "./context";

export class BonusStore {
    constructor(private readonly ctx: MockContext) {}

    // Push Subscriptions: no server in mock mode, so nothing to store
    // Bonus Log
    async getBonusEvents(): Promise<BonusEventsResult> {
        const events = [...(this.ctx.state.bonusEvents ?? [])].sort((a, b) =>
            b.received_on.localeCompare(a.received_on),
        );
        return { available: true, events: cloneDeep(events) };
    }

    async saveBonusEvent(input: SaveBonusEventInput): Promise<BonusEvent> {
        const events = (this.ctx.state.bonusEvents ??= []);
        const existingIdx = input.id
            ? events.findIndex((e) => e.id === input.id)
            : -1;
        if (input.id && existingIdx < 0) {
            throw new Error("Bonus not found");
        }
        const existing = existingIdx >= 0 ? events[existingIdx] : undefined;

        const gross = Math.round(input.gross * 100) / 100;
        const cpf = Math.round(input.cpf * 100) / 100;
        const now = new Date().toISOString();
        const event: BonusEvent = {
            id:
                existing?.id ??
                `bonus-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            household_id: this.ctx.state.household.id,
            recipient_id: input.recipient_id,
            type: input.type,
            received_on: input.received_on,
            gross,
            cpf,
            net: Math.round((gross - cpf) * 100) / 100,
            note: input.note || null,
            split: cloneDeep(input.split),
            created_by: existing?.created_by ?? null,
            created_at: existing?.created_at ?? now,
            updated_at: now,
        };
        if (existing) {
            events[existingIdx] = event;
        } else {
            events.push(event);
        }
        this.ctx.persist();
        return cloneDeep(event);
    }

    async deleteBonusEvent(id: string): Promise<void> {
        const events = this.ctx.state.bonusEvents ?? [];
        const existing = events.find((e) => e.id === id);
        if (!existing) return;
        this.ctx.state.bonusEvents = events.filter((e) => e.id !== id);
        this.ctx.persist();
    }

    async getBonusSplitDefault(memberId: string): Promise<BonusSplitShare[]> {
        const stored = this.ctx.state.bonusSplitDefaults?.[memberId];
        return stored ? normalizeBonusSplit(stored) : cloneDefaultSplit();
    }

    async saveBonusSplitDefault(
        memberId: string,
        split: BonusSplitShare[],
    ): Promise<void> {
        this.ctx.state.bonusSplitDefaults = {
            ...(this.ctx.state.bonusSplitDefaults ?? {}),
            [memberId]: normalizeBonusSplit(split).map(({ key, pct }) => ({
                key,
                pct,
            })),
        };
        this.ctx.persist();
    }
}
