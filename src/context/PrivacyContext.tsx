/**
 * PrivacyContext - Global "mask amounts" switch. Persisted per device so the
 * choice survives reloads. Press `H` (outside text fields) to toggle.
 */

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

export const PRIVACY_STORAGE_KEY = "budget-bubby:privacy-mode";
export const PRIVACY_MASK = "••••";

export interface PrivacyContextValue {
    isPrivacyMode: boolean;
    togglePrivacy: () => void;
}

// Safe default so components render unmasked when no provider is mounted.
const PrivacyContext = createContext<PrivacyContextValue>({
    isPrivacyMode: false,
    togglePrivacy: () => {},
});

function readStored(): boolean {
    try {
        return localStorage.getItem(PRIVACY_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
    );
}

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
    const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(readStored);

    const togglePrivacy = useCallback(() => {
        setIsPrivacyMode((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(PRIVACY_STORAGE_KEY, next ? "1" : "0");
            } catch {
                // Storage unavailable; the toggle still works for this session.
            }
            return next;
        });
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== "h") return;
            if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
            if (isTypingTarget(e.target)) return;
            togglePrivacy();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [togglePrivacy]);

    const value = useMemo(
        () => ({ isPrivacyMode, togglePrivacy }),
        [isPrivacyMode, togglePrivacy],
    );

    return (
        <PrivacyContext.Provider value={value}>
            {children}
        </PrivacyContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePrivacy(): PrivacyContextValue {
    return useContext(PrivacyContext);
}
