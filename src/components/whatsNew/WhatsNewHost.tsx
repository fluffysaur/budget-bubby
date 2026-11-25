import { useCallback, useEffect, useState } from "react";
import { WhatsNewModal } from "./WhatsNewModal";
import { RELEASE_NOTES } from "../../data/releaseNotes";
import {
    compareVersions,
    getSeenMarker,
    getUnseenReleaseNotes,
    readLastSeenVersion,
    writeLastSeenVersion,
} from "../../lib/releaseNotes";

/** Pause after the app shell mounts before showing the popup. */
const SHOW_DELAY_MS = 1500;
/** How often to re-check while another modal is open. */
const RETRY_MS = 2000;

function isAnotherModalOpen(): boolean {
    return (
        typeof document !== "undefined" &&
        document.querySelector('[aria-modal="true"]') !== null
    );
}

export interface WhatsNewHostProps {
    /** True while something else (e.g. the Welcome Guide) owns the screen. */
    blocked?: boolean;
}

/**
 * Shows unseen release notes once per device after an update. Mounted in the
 * authenticated app shell only, so it never appears on login or legal pages.
 */
export function WhatsNewHost({ blocked = false }: WhatsNewHostProps) {
    const [unseen] = useState(() =>
        getUnseenReleaseNotes(RELEASE_NOTES, readLastSeenVersion()),
    );
    const [status, setStatus] = useState<"waiting" | "open" | "done">(() =>
        unseen.length > 0 ? "waiting" : "done",
    );

    // Nothing to show: still record the current version for next time
    // (never moving the marker backwards, e.g. after a rollback).
    useEffect(() => {
        if (unseen.length > 0) return;
        const marker = getSeenMarker(RELEASE_NOTES);
        const lastSeen = readLastSeenVersion();
        if (!lastSeen || compareVersions(marker, lastSeen) > 0) {
            writeLastSeenVersion(marker);
        }
    }, [unseen]);

    useEffect(() => {
        if (status !== "waiting" || blocked) return;
        let timer: ReturnType<typeof setTimeout>;
        const tryOpen = () => {
            if (isAnotherModalOpen()) {
                timer = setTimeout(tryOpen, RETRY_MS);
                return;
            }
            setStatus("open");
        };
        timer = setTimeout(tryOpen, SHOW_DELAY_MS);
        return () => clearTimeout(timer);
    }, [status, blocked]);

    const handleClose = useCallback(() => {
        writeLastSeenVersion(getSeenMarker(RELEASE_NOTES));
        setStatus("done");
    }, []);

    if (unseen.length === 0) return null;

    return (
        <WhatsNewModal
            isOpen={status === "open"}
            onClose={handleClose}
            notes={unseen}
        />
    );
}

export default WhatsNewHost;
