/**
 * SettingsAbout - compact footer: What's New, Privacy, Terms and the app version.
 */

import { useState, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { WhatsNewModal } from "../whatsNew/WhatsNewModal";
import { MetaRule } from "../ui/MetaList";
import { RELEASE_NOTES } from "../../data/releaseNotes";
import { getVisibleReleaseNotes } from "../../lib/releaseNotes";
import { APP_VERSION, GIT_SHA, formatAppVersion } from "../../lib/appVersion";

const releaseHistory = getVisibleReleaseNotes(RELEASE_NOTES);

const LINK_CLASS =
    "inline-flex min-h-11 items-center gap-1 underline decoration-(--pastel-lilac) decoration-2 underline-offset-2 hover:text-(--text-ink)";

export function SettingsAbout() {
    const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
    const [hasOpenedWhatsNew, setHasOpenedWhatsNew] = useState(false);
    const openWhatsNew = useCallback(() => {
        setHasOpenedWhatsNew(true);
        setIsWhatsNewOpen(true);
    }, []);

    return (
        <footer className="mt-4 flex flex-col items-center gap-0.5">
            <nav
                aria-label="Legal"
                data-testid="settings-legal-links"
                className="flex items-center justify-center gap-2 text-xs font-bold text-(--text-muted)"
            >
                <button
                    type="button"
                    onClick={openWhatsNew}
                    data-testid="settings-whats-new-btn"
                    className={`${LINK_CLASS} cursor-pointer`}
                >
                    <Sparkles
                        className="h-3.5 w-3.5"
                        strokeWidth={2.5}
                        aria-hidden="true"
                    />
                    What's New
                </button>
                <MetaRule />
                <a href="/privacy" className={LINK_CLASS}>
                    Privacy
                </a>
                <MetaRule />
                <a href="/terms" className={LINK_CLASS}>
                    Terms
                </a>
            </nav>
            <div
                data-testid="app-version-label"
                className="text-center text-[11px] font-bold font-mono-num text-(--text-faint)"
            >
                {formatAppVersion(APP_VERSION, GIT_SHA)}
            </div>

            {/* Mounted on first open */}
            {hasOpenedWhatsNew && (
                <WhatsNewModal
                    isOpen={isWhatsNewOpen}
                    onClose={() => setIsWhatsNewOpen(false)}
                    notes={releaseHistory}
                />
            )}
        </footer>
    );
}
