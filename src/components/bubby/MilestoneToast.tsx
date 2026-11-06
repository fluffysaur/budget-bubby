/**
 * Shared milestone toast (full belly, weekly treat, body change, reunion,
 * inbox zero, goal reached).
 * Non-modal: only its own box takes taps. Dual explicit actions instead of
 * a passive X: an optional primary (e.g. "Meet Bubby") and "Nice!".
 */

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { Bubby } from "./Bubby";
import type { BubbyBody } from "../../lib/bubby/body";

export interface MilestoneToastProps {
    title: string;
    subtitle?: string;
    body: BubbyBody;
    primaryLabel?: string;
    onPrimary?: () => void;
    /** "Nice!": acknowledge and close. */
    onAcknowledge: () => void;
    /** Auto-close without acknowledging. */
    onTimeout: () => void;
    durationMs?: number;
}

export function MilestoneToast({
    title,
    subtitle,
    body,
    primaryLabel,
    onPrimary,
    onAcknowledge,
    onTimeout,
    durationMs = 6000,
}: MilestoneToastProps) {
    useEffect(() => {
        const timer = window.setTimeout(onTimeout, durationMs);
        return () => window.clearTimeout(timer);
    }, [onTimeout, durationMs]);

    return (
        <div className="pointer-events-none fixed inset-x-0 top-16 sm:top-20 z-9999 flex justify-center px-4">
            <div
                role="status"
                aria-live="polite"
                data-testid="milestone-toast"
                className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-(--shadow-cute) animate-toast-in"
            >
                <div className="relative flex h-12 w-12 shrink-0 items-end justify-center overflow-hidden rounded-xl border-2 border-(--border-ink) bg-(--pastel-butter-light) pt-0.5">
                    <Bubby
                        body={body}
                        reaction="celebrate"
                        size="sm"
                        className="h-11 w-11"
                        decorative
                    />
                    <Sparkles
                        aria-hidden="true"
                        className="absolute right-0.5 top-0.5 h-3.5 w-3.5 text-amber-500 fill-amber-300"
                        strokeWidth={2.5}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-(--text-ink) font-display">{title}</p>
                    {subtitle && (
                        <p className="truncate text-xs font-semibold text-(--text-muted)">{subtitle}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                        {primaryLabel && onPrimary && (
                            <Button variant="primary" size="sm" onClick={onPrimary}>
                                {primaryLabel}
                            </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={onAcknowledge}>
                            Nice!
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MilestoneToast;
