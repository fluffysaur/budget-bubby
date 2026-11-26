/**
 * SettingsIndexList - the four settings groups as rows (icon, title, live
 * status word, chevron). On desktop it is the left pane and marks the group
 * shown on the right.
 */

import { Link } from "react-router-dom";
import {
    Bell,
    ChevronRight,
    SlidersHorizontal,
    Smartphone,
    Sparkles,
} from "lucide-react";
import {
    SETTINGS_SECTIONS,
    settingsPath,
    type SettingsSection,
} from "../../lib/settingsRoutes";

const SECTION_ICONS: Record<SettingsSection, React.ReactNode> = {
    general: <SlidersHorizontal className="h-4 w-4" strokeWidth={2.5} />,
    notifications: <Bell className="h-4 w-4" strokeWidth={2.5} />,
    ai: <Sparkles className="h-4 w-4" strokeWidth={2.5} />,
    "auto-capture": <Smartphone className="h-4 w-4" strokeWidth={2.5} />,
};

const SECTION_COLORS: Record<SettingsSection, string> = {
    general: "bg-(--pastel-lilac)",
    notifications: "bg-(--pastel-mint)",
    ai: "bg-(--pastel-butter)",
    "auto-capture": "bg-(--pastel-pink)",
};

export interface SettingsIndexListProps {
    statuses: Record<SettingsSection, string>;
    /** The group shown in the detail pane (desktop); highlights its row. */
    activeSection?: SettingsSection | null;
}

export function SettingsIndexList({
    statuses,
    activeSection = null,
}: SettingsIndexListProps) {
    return (
        <nav aria-label="Settings groups" className="space-y-2.5">
            {SETTINGS_SECTIONS.map(({ id, title }) => {
                const isActive = activeSection === id;
                return (
                    <Link
                        key={id}
                        to={settingsPath(id)}
                        state={{ fromIndex: true }}
                        replace={activeSection !== null}
                        data-testid={`settings-row-${id}`}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 border-(--border-ink) p-3 shadow-cute-sm transition-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                            isActive
                                ? "bg-(--pastel-lilac-light)"
                                : "bg-(--bg-card) hover:bg-(--bg-cream)"
                        }`}
                    >
                        <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) text-(--text-ink) shadow-cute-sm ${SECTION_COLORS[id]}`}
                        >
                            {SECTION_ICONS[id]}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-(--text-ink)">
                            {title}
                        </span>
                        <span
                            data-testid={`settings-status-${id}`}
                            className="shrink-0 text-xs font-bold text-(--text-muted)"
                        >
                            {statuses[id]}
                        </span>
                        <ChevronRight
                            className="h-4 w-4 shrink-0 text-(--text-muted)"
                            strokeWidth={2.5}
                            aria-hidden="true"
                        />
                    </Link>
                );
            })}
        </nav>
    );
}
