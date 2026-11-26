/**
 * useSettings - navigate shim for the routed Settings page. Any screen can
 * deep-link into a section: `openSettings("ai")` goes to `/settings/ai`, no
 * argument goes to `/settings`. Anything that is not a section id (such as a
 * click event passed straight to `onClick`) is ignored.
 */

import { useCallback } from "react";
import { useOptionalNavigate } from "./useOptionalNavigate";
import {
    isSettingsSection,
    settingsPath,
    type SettingsSection,
} from "../lib/settingsRoutes";

export interface UseSettingsResult {
    openSettings: (section?: SettingsSection) => void;
}

export function useSettings(): UseSettingsResult {
    const navigate = useOptionalNavigate();
    const openSettings = useCallback(
        (section?: SettingsSection) => {
            navigate?.(
                settingsPath(isSettingsSection(section) ? section : undefined),
            );
        },
        [navigate],
    );
    return { openSettings };
}
