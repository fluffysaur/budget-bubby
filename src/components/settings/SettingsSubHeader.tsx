/**
 * SettingsSubHeader - slim title bar for a settings screen. On mobile the app
 * header is hidden, so it carries the back button; on desktop it is a plain
 * title above the detail pane.
 */

import { ArrowLeft } from "lucide-react";

export interface SettingsSubHeaderProps {
    title: string;
    /** Shows the back button when provided (mobile screens). */
    onBack?: () => void;
    /** `h1` for the page title, `h2` when another heading already is the h1. */
    as?: "h1" | "h2";
    className?: string;
}

export function SettingsSubHeader({
    title,
    onBack,
    as: Heading = "h1",
    className = "",
}: SettingsSubHeaderProps) {
    return (
        <div
            data-testid="settings-subheader"
            className={`flex items-center gap-2 ${className}`}
        >
            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Back"
                    data-testid="settings-back-btn"
                    className="-ml-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-(--text-ink) transition-colors hover:bg-(--bg-cream)"
                >
                    <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
                </button>
            )}
            <Heading className="min-w-0 flex-1 truncate font-display text-lg font-black text-(--text-ink)">
                {title}
            </Heading>
        </div>
    );
}
