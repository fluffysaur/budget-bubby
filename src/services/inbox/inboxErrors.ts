/** Thrown by inbox writes before the capture inbox migration is applied. */
export class InboxUnavailableError extends Error {
    constructor() {
        super("The Inbox needs a database update.");
        this.name = "InboxUnavailableError";
    }
}

/** Each member can hold this many active capture tokens. */
export const MAX_ACTIVE_CAPTURE_TOKENS = 3;

export class CaptureTokenLimitError extends Error {
    constructor() {
        super(`You can have up to ${MAX_ACTIVE_CAPTURE_TOKENS} active tokens.`);
        this.name = "CaptureTokenLimitError";
    }
}
