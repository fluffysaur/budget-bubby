/**
 * Shared connection state for the Supabase domain stores: the client, the
 * household lookup, and the per-session "does this table exist" probes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import type { FinanceService } from "../financeService";
import type { BonusStore } from "./bonus";

export interface StorePeers {
    /** The assembled service, for calls that cross domains. */
    service: FinanceService;
    bonus: BonusStore;
}

export class SupabaseContext {
    /**
     * Whether the bonus log tables exist. `null` = not checked yet. Cached for
     * the session so budgets don't fire a failing request on every read; the
     * cache resets on reload, so the log appears once the migration is applied.
     */
    bonusTableAvailable: boolean | null = null;
    settleUpsTableAvailable: boolean | null = null;

    constructor(
        private readonly clientOverride?: SupabaseClient,
        /**
         * When true (default), notification log calls fall back to the
         * device-local log on errors. The server sets it false so errors
         * surface instead of being recorded in memory.
         */
        readonly localFallback: boolean = true,
    ) {}

    getClient(): SupabaseClient {
        const client = this.clientOverride ?? supabase;
        if (!client) {
            throw new Error("Supabase client is not configured");
        }
        return client;
    }

    async getHouseholdId(): Promise<string> {
        const client = this.getClient();
        const { data, error } = await client
            .from("households")
            .select("id")
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        if (data?.id) return data.id;

        // Fallback 1: Check household_members to find household_id
        const { data: memberData } = await client
            .from("household_members")
            .select("household_id")
            .limit(1)
            .maybeSingle();
        if (memberData?.household_id) return memberData.household_id;

        // Fallback 2: Check if authenticated user needs their profile claimed
        let currentUserEmail = "unknown";
        try {
            const { data: authData } = await client.auth.getUser();
            if (authData?.user?.email) {
                currentUserEmail = authData.user.email;
                await client.rpc("claim_household_member_profile");

                // Retry after claiming
                const { data: retryHh } = await client
                    .from("households")
                    .select("id")
                    .limit(1)
                    .maybeSingle();
                if (retryHh?.id) return retryHh.id;

                const { data: retryMem } = await client
                    .from("household_members")
                    .select("household_id")
                    .limit(1)
                    .maybeSingle();
                if (retryMem?.household_id) return retryMem.household_id;
            }
        } catch (claimErr) {
            console.warn(
                "Auto-claim fallback in getHouseholdId encountered:",
                claimErr,
            );
        }

        throw new Error(
            `No accessible household found for authenticated user (${currentUserEmail}). Please ensure your user account is linked to a household member profile in the 'household_members' table.`,
        );
    }
}
