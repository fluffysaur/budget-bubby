/**
 * Last known inbox pending count, fed by the inbox events (see
 * docs/plans/capture-inbox.md). Zero until the inbox ships.
 */

let pending = 0;

export function getInboxPending(): number {
    return pending;
}

export function setInboxPending(count: number): void {
    pending = Math.max(0, Math.floor(count) || 0);
}
