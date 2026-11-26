/**
 * useNotificationPrefs - loads and saves one member's notification preferences
 * (sound, haptics, push, categories, thresholds, timing). The Settings page
 * owns one instance and shares it with the index list and the sub-pages so
 * status words stay live.
 */

import { useState, useEffect, useCallback } from "react";
import { financeService } from "../services/financeService";
import { feedback } from "../lib/delight/feedback";
import { getDefaultNotificationPreferences } from "../lib/notificationDefaults";
import type {
    NotificationPreferences,
    UpdateNotificationPreferencesInput,
} from "../types/finance";

export interface NotificationPrefsState {
    memberId: string;
    prefs: NotificationPreferences;
    errorMessage: string | null;
    clearError: () => void;
    update: (updates: UpdateNotificationPreferencesInput) => Promise<void>;
    budgetWarningDraft: string;
    setBudgetWarningDraft: (value: string) => void;
    settlementThresholdDraft: string;
    setSettlementThresholdDraft: (value: string) => void;
    commitBudgetWarningPct: () => void;
    commitSettlementThreshold: () => void;
    resetToDefaults: () => Promise<void>;
}

function errorText(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback;
}

export function useNotificationPrefs(memberId: string): NotificationPrefsState {
    const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
        getDefaultNotificationPreferences(memberId),
    );
    const [budgetWarningDraft, setBudgetWarningDraft] = useState<string>(() =>
        String(getDefaultNotificationPreferences(memberId).budget_warning_pct),
    );
    const [settlementThresholdDraft, setSettlementThresholdDraft] =
        useState<string>(() =>
            String(
                getDefaultNotificationPreferences(memberId)
                    .settlement_threshold_sgd,
            ),
        );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadPreferences = useCallback(async () => {
        if (!memberId) return;
        try {
            setErrorMessage(null);
            const data =
                await financeService.getNotificationPreferences(memberId);
            setPrefs(data);
            setBudgetWarningDraft(String(data.budget_warning_pct));
            setSettlementThresholdDraft(String(data.settlement_threshold_sgd));
        } catch (err) {
            setErrorMessage(
                errorText(err, "Could not load notification settings."),
            );
        }
    }, [memberId]);

    useEffect(() => {
        void loadPreferences();
    }, [loadPreferences]);

    const restore = useCallback((previous: NotificationPreferences) => {
        setPrefs(previous);
        setBudgetWarningDraft(String(previous.budget_warning_pct));
        setSettlementThresholdDraft(String(previous.settlement_threshold_sgd));
    }, []);

    const update = useCallback(
        async (updates: UpdateNotificationPreferencesInput) => {
            if (!memberId) return;
            const previousPrefs = prefs;
            setErrorMessage(null);
            setPrefs((prev) => ({ ...prev, ...updates }));
            try {
                await financeService.updateNotificationPreferences(
                    memberId,
                    updates,
                );
                feedback.routine("save");
            } catch (err) {
                restore(previousPrefs);
                setErrorMessage(
                    errorText(err, "Could not save notification preference."),
                );
            }
        },
        [memberId, prefs, restore],
    );

    const commitBudgetWarningPct = () => {
        const trimmed = budgetWarningDraft.trim();
        const parsed = Number(trimmed);
        const val =
            trimmed === "" || !Number.isFinite(parsed)
                ? 80
                : Math.max(50, Math.min(99, Math.round(parsed)));
        setBudgetWarningDraft(String(val));
        void update({ budget_warning_pct: val });
    };

    const commitSettlementThreshold = () => {
        const trimmed = settlementThresholdDraft.trim();
        const parsed = Number(trimmed);
        const val =
            trimmed === "" || !Number.isFinite(parsed)
                ? 200
                : Math.max(10, Math.round(parsed));
        setSettlementThresholdDraft(String(val));
        void update({ settlement_threshold_sgd: val });
    };

    const resetToDefaults = async () => {
        if (!memberId) return;
        const previousPrefs = prefs;
        const defaults = getDefaultNotificationPreferences(memberId);
        setErrorMessage(null);
        setPrefs(defaults);
        setBudgetWarningDraft(String(defaults.budget_warning_pct));
        setSettlementThresholdDraft(String(defaults.settlement_threshold_sgd));
        try {
            await financeService.updateNotificationPreferences(
                memberId,
                defaults,
            );
        } catch (err) {
            restore(previousPrefs);
            setErrorMessage(
                errorText(err, "Could not reset notification settings."),
            );
        }
    };

    return {
        memberId,
        prefs,
        errorMessage,
        clearError: () => setErrorMessage(null),
        update,
        budgetWarningDraft,
        setBudgetWarningDraft,
        settlementThresholdDraft,
        setSettlementThresholdDraft,
        commitBudgetWarningPct,
        commitSettlementThreshold,
        resetToDefaults,
    };
}
