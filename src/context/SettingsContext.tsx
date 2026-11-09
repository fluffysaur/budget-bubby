/**
 * SettingsContext - Owns the open/closed state of the Settings modal so any
 * screen can open it without depending on the header being mounted.
 */

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import { NotificationSettingsModal } from "../components/layout/NotificationSettingsModal";

export interface SettingsContextValue {
    isSettingsOpen: boolean;
    openSettings: () => void;
    closeSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
    undefined,
);

export interface SettingsProviderProps {
    children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const openSettings = useCallback(() => setIsSettingsOpen(true), []);
    const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

    const value = useMemo(
        () => ({ isSettingsOpen, openSettings, closeSettings }),
        [isSettingsOpen, openSettings, closeSettings],
    );

    return (
        <SettingsContext.Provider value={value}>
            {children}
            <NotificationSettingsModal
                isOpen={isSettingsOpen}
                onClose={closeSettings}
            />
        </SettingsContext.Provider>
    );
}

export function useSettings(): SettingsContextValue {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
}
