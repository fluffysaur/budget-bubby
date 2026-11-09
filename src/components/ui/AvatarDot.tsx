import type { ReactNode } from "react";

export type AvatarDotSize = "xs" | "sm" | "md" | "lg";
export type AvatarDotTone =
    | "lilac"
    | "mint"
    | "butter"
    | "coral"
    | "pink"
    | "neutral";

export interface AvatarDotProps {
    /** Display name or label of the person/group. */
    name?: string;
    /** Emoji string (e.g. "👩", "👨") or an image URL. */
    avatarUrl?: string | null;
    /** Icon shown instead of avatar/initial, e.g. for a joint account. */
    icon?: ReactNode;
    /** Dot size: xs (16px), sm (20px), md (28px), lg (36px). Defaults to "sm". */
    size?: AvatarDotSize;
    /** Pastel accent tone. Defaults to "lilac". */
    tone?: AvatarDotTone;
    /** Whether to render the signature Budget Bubby border. Defaults to true. */
    border?: boolean;
    /** Optional accessible label. Defaults to name or "Avatar". */
    ariaLabel?: string;
    /** Optional tooltip title. Defaults to name. */
    title?: string;
    /** Hide from assistive tech when the name is already visible next to it. */
    decorative?: boolean;
    className?: string;
}

const SIZE_CLASSES: Record<AvatarDotSize, string> = {
    xs: "h-4 w-4 text-[9px]",
    sm: "h-5 w-5 text-[11px]",
    md: "h-7 w-7 text-sm",
    lg: "h-9 w-9 text-base",
};

const TONE_CLASSES: Record<AvatarDotTone, string> = {
    lilac: "bg-(--pastel-lilac-light) text-purple-800 dark:bg-purple-950/40 dark:text-(--pastel-lilac)",
    mint: "bg-(--pastel-mint-light) text-emerald-800 dark:bg-emerald-950/40 dark:text-(--pastel-mint)",
    butter: "bg-(--pastel-butter-light) text-amber-800 dark:bg-amber-950/40 dark:text-(--pastel-butter)",
    coral: "bg-(--pastel-coral-light) text-rose-800 dark:bg-rose-950/40 dark:text-(--pastel-coral)",
    pink: "bg-(--pastel-pink-light) text-pink-800 dark:bg-pink-950/40 dark:text-(--pastel-pink)",
    neutral:
        "bg-(--bg-cream) text-(--text-ink) dark:bg-neutral-800 dark:text-(--text-ink)",
};

export function AvatarDot({
    name,
    avatarUrl,
    icon,
    size = "sm",
    tone = "lilac",
    border = true,
    ariaLabel,
    title,
    decorative = false,
    className = "",
}: AvatarDotProps) {
    const label = ariaLabel || name || "Avatar";
    const tooltipTitle = title ?? (name ? name : undefined);
    const sizeCls = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;
    const toneCls = TONE_CLASSES[tone] ?? TONE_CLASSES.lilac;
    const borderCls = border ? "border border-(--border-ink) sm:border-2" : "";

    const isImageUrl =
        avatarUrl &&
        (avatarUrl.startsWith("http://") ||
            avatarUrl.startsWith("https://") ||
            avatarUrl.startsWith("/"));

    const content = icon ? (
        <span className="inline-flex items-center justify-center leading-none">
            {icon}
        </span>
    ) : isImageUrl ? (
        <img
            src={avatarUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full rounded-full object-cover"
        />
    ) : avatarUrl ? (
        <span className="leading-none select-none">{avatarUrl}</span>
    ) : name && name.trim().length > 0 ? (
        <span className="font-black leading-none select-none">
            {name.trim().charAt(0).toUpperCase()}
        </span>
    ) : (
        <span className="leading-none select-none">👤</span>
    );

    return (
        <span
            role={decorative ? undefined : "img"}
            aria-label={decorative ? undefined : label}
            aria-hidden={decorative ? true : undefined}
            title={decorative ? undefined : tooltipTitle}
            className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold overflow-hidden transition-transform select-none ${sizeCls} ${toneCls} ${borderCls} ${className}`}
        >
            {content}
        </span>
    );
}

export default AvatarDot;
