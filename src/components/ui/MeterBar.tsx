import React from "react";
import { getSpendTone, type SpendTone } from "../../lib/spendTone";

export interface MeterBarProps {
    value: number;
    max: number;
    marker?: number;
    size?: "sm" | "md" | "lg";
    tone?: SpendTone;
    className?: string;
    "aria-label"?: string;
}

const SIZE_CLASSES = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-3.5",
} as const;

const TONE_FILL_CLASSES: Record<SpendTone, string> = {
    ok: "bg-(--tone-ok)",
    near: "bg-(--tone-near)",
    over: "bg-(--tone-over)",
};

export const MeterBar: React.FC<MeterBarProps> = ({
    value,
    max,
    marker,
    size = "md",
    tone,
    className = "",
    "aria-label": ariaLabel,
}) => {
    const rawPct = max > 0 ? (value / max) * 100 : 0;
    const computedTone = tone ?? getSpendTone(rawPct);
    const fillPct = Math.max(0, Math.min(100, rawPct));
    const markerPct =
        marker !== undefined && max > 0
            ? Math.max(0, Math.min(100, (marker / max) * 100))
            : undefined;

    return (
        <div
            role="progressbar"
            aria-valuenow={Math.round(rawPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={ariaLabel ?? "Spending progress"}
            className={`relative w-full rounded-full bg-(--bg-canvas) border border-(--border-ink)/30 overflow-hidden ${SIZE_CLASSES[size]} ${className}`}
        >
            <div
                className={`h-full rounded-full progress-fill ${TONE_FILL_CLASSES[computedTone]}`}
                style={{ width: `${fillPct}%` }}
            />
            {markerPct !== undefined && (
                <div
                    data-testid="meter-marker"
                    className="absolute top-0 bottom-0 w-0.5 bg-(--text-ink) -translate-x-1/2 pointer-events-none"
                    style={{ left: `${markerPct}%` }}
                    aria-hidden="true"
                />
            )}
        </div>
    );
};

export default MeterBar;
