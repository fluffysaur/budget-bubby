import { useEffect, useSyncExternalStore } from "react";
import {
    FX_RATES_UPDATED_EVENT,
    getRateStatus,
    getRatesVersion,
    refreshExchangeRates,
    type FxRateStatus,
} from "../lib/currencyConverter";

function subscribe(onChange: () => void): () => void {
    window.addEventListener(FX_RATES_UPDATED_EVENT, onChange);
    return () => window.removeEventListener(FX_RATES_UPDATED_EVENT, onChange);
}

/**
 * Re-renders when fresh FX rates land. Fetches rates (24h cache) while `enabled`.
 */
export function useFxRates(enabled: boolean): FxRateStatus {
    // Subscribing re-renders callers when the cached rates change.
    useSyncExternalStore(subscribe, getRatesVersion, () => "");

    useEffect(() => {
        if (enabled) void refreshExchangeRates();
    }, [enabled]);

    return getRateStatus();
}
