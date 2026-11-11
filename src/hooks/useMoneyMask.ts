import { useCallback } from "react";
import { usePrivacy } from "../context/PrivacyContext";
import { maskSGDText } from "../lib/currency";

/** Returns a function that masks SGD amounts in text while privacy mode is on. */
export function useMoneyMask(): (text: string) => string {
    const { isPrivacyMode } = usePrivacy();
    return useCallback(
        (text: string) => (isPrivacyMode ? maskSGDText(text) : text),
        [isPrivacyMode],
    );
}
