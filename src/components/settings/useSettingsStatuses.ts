/**
 * useSettingsStatuses - the live status word shown beside each settings group.
 */

import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "../../context/HouseholdContext";
import { useCaptureTokensQuery } from "../../hooks/finance/inbox";
import { useNotificationPermission } from "../../hooks/useNotificationPermission";
import {
    AI_CONFIG_CHANGED_EVENT,
    AI_PROVIDER_META,
    getActiveAiProvider,
    getProviderApiKey,
} from "../../services/ai/providers";
import {
    getAiStatus,
    getAutoCaptureStatus,
    getGeneralStatus,
    getNotificationsStatus,
} from "../../lib/settingsStatus";
import type { SettingsSection } from "../../lib/settingsRoutes";

function readAiStatus(): string {
    const provider = getActiveAiProvider();
    return getAiStatus(
        AI_PROVIDER_META[provider].label,
        getProviderApiKey(provider).length > 0,
    );
}

export function useSettingsStatuses(
    pushEnabled: boolean,
    memberId: string,
): Record<SettingsSection, string> {
    const { theme } = useHousehold();
    const { permission } = useNotificationPermission();
    const { data: tokensData } = useCaptureTokensQuery(memberId || undefined);
    const [aiStatus, setAiStatus] = useState<string>(readAiStatus);

    const refreshAi = useCallback(() => setAiStatus(readAiStatus()), []);

    useEffect(() => {
        window.addEventListener(AI_CONFIG_CHANGED_EVENT, refreshAi);
        return () =>
            window.removeEventListener(AI_CONFIG_CHANGED_EVENT, refreshAi);
    }, [refreshAi]);

    return {
        general: getGeneralStatus(theme),
        notifications: getNotificationsStatus(pushEnabled, permission),
        ai: aiStatus,
        "auto-capture": getAutoCaptureStatus(tokensData?.tokens.length ?? 0),
    };
}
