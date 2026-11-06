/** Public URL of the capture-expense Edge Function, or null without Supabase. */
export function getCaptureEndpointUrl(): string | null {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!base) return null;
    return `${base.replace(/\/+$/, "")}/functions/v1/capture-expense`;
}

/** "Used 2h ago" style label. */
export function formatLastUsed(iso: string | null | undefined, now: number = Date.now()): string {
    if (!iso) return "Never used";
    const ms = now - new Date(iso).getTime();
    if (Number.isNaN(ms)) return "Never used";
    const minutes = Math.max(0, Math.round(ms / 60_000));
    if (minutes < 1) return "Used just now";
    if (minutes < 60) return `Used ${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Used ${hours}h ago`;
    return `Used ${Math.round(hours / 24)}d ago`;
}
