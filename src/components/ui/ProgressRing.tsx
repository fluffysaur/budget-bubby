import React from "react";
import { m, useReducedMotion } from "motion/react";
import { getSpendTone, type SpendTone } from "../../lib/spendTone";

export interface ProgressRingProps {
    value: number; // 0–100 or ratio
    max?: number;
    size?: number;
    strokeWidth?: number;
    tone?: SpendTone;
    centerContent?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    "aria-label"?: string;
}

const TONE_STROKE_CLASSES: Record<SpendTone, string> = {
    ok: "stroke-(--tone-ok)",
    near: "stroke-(--tone-near)",
    over: "stroke-(--tone-over)",
};

export const ProgressRing: React.FC<ProgressRingProps> = ({
    value,
    max,
    size = 48,
    strokeWidth = 4,
    tone,
    centerContent,
    children,
    className = "",
    "aria-label": ariaLabel,
}) => {
    const shouldReduceMotion = useReducedMotion();
    const rawPct =
        max !== undefined
            ? max > 0
                ? (value / max) * 100
                : 0
            : value <= 1 && value > 0
              ? value * 100
              : value;

    const fillPct = Math.max(0, Math.min(100, rawPct));
    const computedTone = tone ?? getSpendTone(rawPct);

    const radius = Math.max(0, (size - strokeWidth) / 2);
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (fillPct / 100) * circumference;
    const center = size / 2;

    const content = centerContent ?? children;

    return (
        <div
            role="progressbar"
            aria-valuenow={Math.round(rawPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={ariaLabel ?? "Progress ring"}
            className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
            style={{ width: size, height: size }}
        >
            <svg
                width={size}
                height={size}
                className="-rotate-90 transform overflow-visible"
                viewBox={`0 0 ${size} ${size}`}
            >
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    className="stroke-(--border-subtle)"
                />
                <m.circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    initial={{
                        strokeDashoffset: shouldReduceMotion
                            ? strokeDashoffset
                            : circumference,
                    }}
                    animate={{ strokeDashoffset }}
                    transition={
                        shouldReduceMotion
                            ? { duration: 0 }
                            : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
                    }
                    strokeLinecap="round"
                    className={`stroke-current ${TONE_STROKE_CLASSES[computedTone]}`}
                />
            </svg>
            {content && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {content}
                </div>
            )}
        </div>
    );
};

export default ProgressRing;
