/**
 * Partner Realtime Sync Hook
 *
 * Subscribes to Supabase Realtime postgres_changes for expenses and inbox_items
 * in the active household. Debounces rapid change bursts (~150ms) and invalidates
 * relevant TanStack Query keys so both partners stay in sync without manual refresh.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useOptionalHousehold } from "../context/HouseholdContext";
import { useSafeQueryClient } from "./useFinanceQueries";
import { keys } from "../lib/queryKeys";
import { isSupabaseConfigured, supabase } from "../services/supabaseClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

export interface UsePartnerRealtimeSyncOptions {
    householdId?: string | null;
    isDemoMode?: boolean;
    isConfigured?: boolean;
    supabaseClient?: SupabaseClient | null;
    queryClient?: QueryClient;
}

export function usePartnerRealtimeSync(
    optionsOrHouseholdId?: UsePartnerRealtimeSyncOptions | string | null,
) {
    const auth = useAuth();
    const household = useOptionalHousehold();
    const fallbackQueryClient = useSafeQueryClient();

    const expensesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inboxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const options =
        typeof optionsOrHouseholdId === "string"
            ? { householdId: optionsOrHouseholdId }
            : optionsOrHouseholdId;

    const queryClient = options?.queryClient ?? fallbackQueryClient;
    const isDemo = options?.isDemoMode ?? auth.isDemoMode;
    const isConfigured = options?.isConfigured ?? isSupabaseConfigured();
    const client =
        options?.supabaseClient !== undefined
            ? options.supabaseClient
            : supabase;

    const resolvedHouseholdId =
        options?.householdId ??
        household?.overview?.household?.id ??
        household?.members?.[0]?.household_id ??
        null;

    const shouldSubscribe =
        isConfigured &&
        client !== null &&
        !isDemo &&
        Boolean(resolvedHouseholdId);

    useEffect(() => {
        if (!shouldSubscribe || !client || !resolvedHouseholdId) {
            return;
        }

        const channel = client
            .channel(`partner-sync-${resolvedHouseholdId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "expenses",
                    filter: `household_id=eq.${resolvedHouseholdId}`,
                },
                () => {
                    if (expensesTimerRef.current) {
                        clearTimeout(expensesTimerRef.current);
                    }
                    expensesTimerRef.current = setTimeout(() => {
                        void queryClient.invalidateQueries({
                            queryKey: keys.expenses.all,
                        });
                        void queryClient.invalidateQueries({
                            queryKey: keys.expenses.every,
                        });
                        void queryClient.invalidateQueries({
                            queryKey: keys.budget.monthlyAll,
                        });
                        void queryClient.invalidateQueries({
                            queryKey: keys.dailyCheckins.all,
                        });
                        void queryClient.invalidateQueries({
                            queryKey: keys.overview.all,
                        });
                    }, 150);
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "inbox_items",
                    filter: `household_id=eq.${resolvedHouseholdId}`,
                },
                () => {
                    if (inboxTimerRef.current) {
                        clearTimeout(inboxTimerRef.current);
                    }
                    inboxTimerRef.current = setTimeout(() => {
                        void queryClient.invalidateQueries({
                            queryKey: keys.inbox.all,
                        });
                    }, 150);
                },
            )
            .subscribe();

        return () => {
            if (expensesTimerRef.current) {
                clearTimeout(expensesTimerRef.current);
                expensesTimerRef.current = null;
            }
            if (inboxTimerRef.current) {
                clearTimeout(inboxTimerRef.current);
                inboxTimerRef.current = null;
            }
            void client.removeChannel(channel);
        };
    }, [shouldSubscribe, client, resolvedHouseholdId, queryClient]);
}
