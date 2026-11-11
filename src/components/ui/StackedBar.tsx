import { usePrivacy } from "../../context/PrivacyContext";
import { maskSGDText } from "../../lib/currency";

export type StackedBarTone =
    | "ok"
    | "near"
    | "over"
    | "lilac"
    | "mint"
    | "butter"
    | "coral"
    | "pink"
    | "neutral"
    | "brand";

export interface StackedBarSegment {
    id: string;
    label: string;
    value: number;
    /** Direct Tailwind background class or custom CSS token (e.g. "bg-(--pastel-mint)"). */
    color?: string;
    /** Preset pastel or status tone. */
    tone?: StackedBarTone;
    /** Custom tooltip text. Defaults to "${label}: ${value} (${pct}%)". */
    tooltip?: string;
}

export interface StackedBarProps {
    /** Segments to render in the stacked bar. */
    segments: StackedBarSegment[];
    /** Optional explicit total. Defaults to sum of segment values. */
    total?: number;
    /** Bar height: "xs" (6px), "sm" (10px), "md" (16px), "lg" (24px). Defaults to "sm". */
    size?: "xs" | "sm" | "md" | "lg";
    /** Optional accessible label. */
    ariaLabel?: string;
    className?: string;
}

const BAR_SIZE_CLASSES: Record<"xs" | "sm" | "md" | "lg", string> = {
    xs: "h-1.5",
    sm: "h-2.5",
    md: "h-4",
    lg: "h-6",
};

const TONE_CLASSES: Record<StackedBarTone, string> = {
    ok: "bg-(--tone-ok)",
    near: "bg-(--tone-near)",
    over: "bg-(--tone-over)",
    mint: "bg-(--pastel-mint)",
    lilac: "bg-(--pastel-lilac)",
    butter: "bg-(--pastel-butter)",
    coral: "bg-(--pastel-coral)",
    pink: "bg-(--pastel-pink)",
    neutral: "bg-(--bg-cream)",
    brand: "bg-(--pastel-lilac)",
};

const FALLBACK_TONES: StackedBarTone[] = [
    "lilac",
    "mint",
    "butter",
    "coral",
    "pink",
    "neutral",
];

export function StackedBar({
    segments,
    total,
    size = "sm",
    ariaLabel,
    className = "",
}: StackedBarProps) {
    const { isPrivacyMode } = usePrivacy();
    const positiveSegments = segments.filter((s) => s.value > 0);
    const sumValues = positiveSegments.reduce((acc, s) => acc + s.value, 0);
    const effectiveTotal = total && total > 0 ? total : sumValues;
    const heightCls = BAR_SIZE_CLASSES[size] ?? BAR_SIZE_CLASSES.sm;

    const defaultAriaLabel = isPrivacyMode
        ? maskSGDText(ariaLabel || "Stacked breakdown")
        : ariaLabel ||
          `Stacked breakdown: ${positiveSegments.map((s) => `${s.label} (${s.value})`).join(", ")}`;

    return (
        <div className={`w-full ${className}`}>
            <div
                role="img"
                aria-label={defaultAriaLabel}
                className={`flex w-full overflow-hidden rounded-full border border-(--border-ink) bg-(--meter-track) select-none ${heightCls}`}
            >
                {positiveSegments.map((seg, idx) => {
                    const pct =
                        effectiveTotal > 0
                            ? (seg.value / effectiveTotal) * 100
                            : 0;
                    if (pct <= 0) return null;

                    const toneKey =
                        seg.tone ?? FALLBACK_TONES[idx % FALLBACK_TONES.length];
                    const bgClass =
                        seg.color ||
                        (TONE_CLASSES[toneKey] ?? TONE_CLASSES.lilac);
                    const tooltipText =
                        seg.tooltip ||
                        `${seg.label}: ${seg.value.toLocaleString()} (${Math.round(pct)}%)`;

                    return (
                        <div
                            key={seg.id || `${seg.label}-${idx}`}
                            style={{ width: `${pct}%` }}
                            title={tooltipText}
                            className={`h-full border-r border-(--border-ink)/30 last:border-r-0 ${bgClass}`}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export default StackedBar;
