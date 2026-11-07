import React from "react";
import type { SpendTone } from "../../lib/spendTone";

export interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    tone?: SpendTone | "neutral";
    className?: string;
    "aria-label"?: string;
}

const TONE_CLASSES: Record<
    SpendTone | "neutral",
    { stroke: string; dot: string }
> = {
    ok: {
        stroke: "stroke-(--tone-ok)",
        dot: "fill-(--tone-ok)",
    },
    near: {
        stroke: "stroke-(--tone-near)",
        dot: "fill-(--tone-near)",
    },
    over: {
        stroke: "stroke-(--tone-over)",
        dot: "fill-(--tone-over)",
    },
    neutral: {
        stroke: "stroke-(--text-muted)",
        dot: "fill-(--text-ink)",
    },
};

export const Sparkline: React.FC<SparklineProps> = ({
    data,
    width = 96,
    height = 28,
    tone = "neutral",
    className = "",
    "aria-label": ariaLabel,
}) => {
    if (!data || data.length === 0) {
        return (
            <svg
                width={width}
                height={height}
                className={`shrink-0 ${className}`}
                aria-hidden="true"
            />
        );
    }

    const padX = 4;
    const padY = 4;
    const innerWidth = Math.max(1, width - padX * 2);
    const innerHeight = Math.max(1, height - padY * 2);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;

    const getX = (index: number) => {
        if (data.length <= 1) return padX + innerWidth / 2;
        return padX + (index / (data.length - 1)) * innerWidth;
    };

    const getY = (val: number) => {
        if (range === 0) return padY + innerHeight / 2;
        return padY + innerHeight - ((val - min) / range) * innerHeight;
    };

    const points = data
        .map((val, i) => `${getX(i).toFixed(1)},${getY(val).toFixed(1)}`)
        .join(" ");

    const lastIndex = data.length - 1;
    const lastX = getX(lastIndex);
    const lastY = getY(data[lastIndex]);

    const toneStyles = TONE_CLASSES[tone];

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={`shrink-0 overflow-visible ${className}`}
            role="img"
            aria-label={ariaLabel ?? "Sparkline trend"}
        >
            <polyline
                fill="none"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                className={toneStyles.stroke}
            />
            <circle
                cx={lastX}
                cy={lastY}
                r={3}
                strokeWidth={1.5}
                className={`${toneStyles.dot} stroke-(--border-ink)`}
            />
        </svg>
    );
};

export default Sparkline;
