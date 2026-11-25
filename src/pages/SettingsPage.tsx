/**
 * SettingsPage - routed settings: /settings (index) and /settings/<section>.
 *
 * Mobile: the index and each section are separate screens with their own slim
 * header (the app header and tab bar are hidden on /settings*).
 * Desktop (md+): two panes, group list on the left, selected section on the right.
 */

import { useCallback } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useLoggedInMember } from "../hooks/useLoggedInMember";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useNotificationPrefs } from "../hooks/useNotificationPrefs";
import {
    getSettingsSectionTitle,
    parseSettingsSection,
    settingsPath,
    type SettingsSection,
} from "../lib/settingsRoutes";
import { AiSettingsSection } from "../components/settings/AiSettingsSection";
import { AutoCaptureSection } from "../components/settings/AutoCaptureSection";
import { GeneralSettingsSection } from "../components/settings/GeneralSettingsSection";
import { NotificationSettingsSection } from "../components/settings/NotificationSettingsSection";
import { SettingsAbout } from "../components/settings/SettingsAbout";
import { SettingsIndexList } from "../components/settings/SettingsIndexList";
import { SettingsSubHeader } from "../components/settings/SettingsSubHeader";
import { useSettingsStatuses } from "../components/settings/useSettingsStatuses";

const DESKTOP_QUERY = "(min-width: 768px)";

const MOBILE_HEADER_CLASS =
    "sticky -top-6 z-30 -mx-4 -mt-6 mb-4 border-b-2 border-(--border-subtle) bg-(--bg-canvas) px-4 py-1 sm:-mx-6 sm:px-6";

export default function SettingsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const isDesktop = useMediaQuery(DESKTOP_QUERY);
    const { me } = useLoggedInMember();
    const memberId = me?.id ?? "";
    const notif = useNotificationPrefs(memberId);
    const statuses = useSettingsStatuses(notif.prefs.push_enabled, memberId);
    const section = parseSettingsSection(location.pathname);

    // Index back: previous in-app page when there is one, else the dashboard
    const goBackFromIndex = useCallback(() => {
        if (location.key !== "default") {
            navigate(-1);
        } else {
            navigate("/dashboard");
        }
    }, [location.key, navigate]);
    const goToIndex = useCallback(() => navigate(settingsPath()), [navigate]);

    if (section === "unknown") {
        return <Navigate to={settingsPath()} replace />;
    }

    const renderSection = (id: SettingsSection) => {
        switch (id) {
            case "general":
                return <GeneralSettingsSection notif={notif} />;
            case "notifications":
                return <NotificationSettingsSection notif={notif} />;
            case "ai":
                return <AiSettingsSection startOpen />;
            case "auto-capture":
                return <AutoCaptureSection memberId={memberId} hideHeading />;
        }
    };

    if (isDesktop) {
        const activeSection = section ?? "general";
        return (
            <div data-testid="settings-page" className="flex items-start gap-6">
                <aside className="w-72 shrink-0 space-y-4">
                    <SettingsSubHeader title="Settings" />
                    <SettingsIndexList
                        statuses={statuses}
                        activeSection={activeSection}
                    />
                    <SettingsAbout />
                </aside>
                <section
                    key={activeSection}
                    aria-label={getSettingsSectionTitle(activeSection)}
                    className="min-w-0 flex-1 space-y-4"
                >
                    <SettingsSubHeader
                        title={getSettingsSectionTitle(activeSection)}
                        as="h2"
                    />
                    {renderSection(activeSection)}
                </section>
            </div>
        );
    }

    if (section === null) {
        return (
            <div data-testid="settings-page">
                <SettingsSubHeader
                    title="Settings"
                    onBack={goBackFromIndex}
                    className={MOBILE_HEADER_CLASS}
                />
                <SettingsIndexList statuses={statuses} />
                <SettingsAbout />
            </div>
        );
    }

    return (
        <div data-testid="settings-page">
            <SettingsSubHeader
                title={getSettingsSectionTitle(section)}
                onBack={goToIndex}
                className={MOBILE_HEADER_CLASS}
            />
            {renderSection(section)}
        </div>
    );
}
