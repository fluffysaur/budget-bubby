/**
 * App loading screen: the household's penguins waddle side by side with a
 * synchronised bounce while the session is checked. Data has not loaded
 * yet, so it shows the household last seen on this device (pair or solo,
 * with their scarves); a first visit shows two plain penguins. Under
 * reduced motion they stand still.
 */

import { readBubbyStore } from "../../lib/bubby/storage";
import { Bubby } from "./Bubby";

/** Two plain penguins until a household has been seen here. */
const FIRST_VISIT: (string | null)[] = [null, null];
const MAX_PENGUINS = 4;

function lastRoster(): (string | null)[] {
    const roster = readBubbyStore().roster;
    return Array.isArray(roster) && roster.length > 0
        ? roster.slice(0, MAX_PENGUINS)
        : FIRST_VISIT;
}

export function BubbyLoadingScreen() {
    const roster = lastRoster();
    return (
        <div className="flex h-dvh w-full items-center justify-center bg-(--bg-canvas) text-(--text-ink)">
            <div
                role="status"
                className="flex flex-col items-center gap-3"
                data-testid="bubby-loading"
            >
                <div className="flex items-end" aria-hidden="true">
                    {roster.map((scarf, i) => (
                        <Bubby
                            key={i}
                            scarf={scarf ?? undefined}
                            size="md"
                            loop="waddle"
                            className={i > 0 ? "-ml-4" : ""}
                            decorative
                        />
                    ))}
                </div>
                <span className="text-xs font-bold text-(--text-muted) tracking-wider uppercase font-mono-num">
                    Loading Budget Bubby...
                </span>
            </div>
        </div>
    );
}

export default BubbyLoadingScreen;
