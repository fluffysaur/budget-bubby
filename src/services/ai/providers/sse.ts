/**
 * Shared Server-Sent Events (SSE) stream reader supporting both
 * ReadableStream bodies and fallback full-text responses.
 */

export interface SseEvent {
    event?: string;
    data: string;
}

export async function readSseStream(
    res: Response,
    onEvent: (event: SseEvent) => void,
): Promise<void> {
    let currentEvent: string | undefined;

    const processLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line) {
            currentEvent = undefined;
            return;
        }
        if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
            return;
        }
        if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") return;
            onEvent({ event: currentEvent, data });
        }
    };

    if (res.body && typeof res.body.getReader === "function") {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                processLine(line);
            }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
            for (const line of buffer.split(/\r?\n/)) {
                processLine(line);
            }
        }
        return;
    }

    const rawText = await res.text();
    for (const line of rawText.split(/\r?\n/)) {
        processLine(line);
    }
}
