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
    /** Emoji string (e.g. "👩", "👨", "👥") or an image URL. */
    avatarUrl?: string | null;
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

    const content = isImageUrl ? (
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

export interface AvatarDotItem {
    id?: string;
    name: string;
    avatarUrl?: string | null;
    tone?: AvatarDotTone;
}

export interface AvatarDotGroupProps {
    /** List of members to display. */
    members: AvatarDotItem[];
    /** Size of each dot. Defaults to "sm". */
    size?: AvatarDotSize;
    /** Maximum number of avatars before showing overflow badge "+N". Defaults to 2. */
    max?: number;
    /** Optional label displayed next to the group. */
    label?: ReactNode;
    /** Optional accessible label. */
    ariaLabel?: string;
    className?: string;
}

export function AvatarDotGroup({
    members,
    size = "sm",
    max = 2,
    label,
    ariaLabel,
    className = "",
}: AvatarDotGroupProps) {
    const visibleMembers = members.slice(0, max);
    const overflowCount = members.length - max;
    const sizeCls = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;

    const groupAriaLabel =
        ariaLabel ||
        (members.length > 0
            ? members.map((m) => m.name).join(", ")
            : "Member avatars");

    return (
        <div
            role="group"
            aria-label={groupAriaLabel}
            className={`inline-flex items-center gap-1.5 ${className}`}
        >
            <div className="flex items-center -space-x-1 sm:-space-x-1.5">
                {visibleMembers.map((m, idx) => (
                    <AvatarDot
                        key={m.id || `${m.name}-${idx}`}
                        name={m.name}
                        avatarUrl={m.avatarUrl}
                        size={size}
                        tone={m.tone}
                        className="relative z-10 hover:z-20 ring-1 ring-(--bg-card)"
                    />
                ))}
                {overflowCount > 0 && (
                    <span
                        className={`relative z-0 inline-flex shrink-0 items-center justify-center rounded-full font-black bg-(--bg-cream) text-(--text-muted) border border-(--border-ink) sm:border-2 ring-1 ring-(--bg-card) select-none ${sizeCls}`}
                        title={`${overflowCount} more`}
                    >
                        +{overflowCount}
                    </span>
                )}
            </div>
            {label && (
                <span className="text-xs font-semibold text-(--text-ink) truncate">
                    {label}
                </span>
            )}
        </div>
    );
}

export default AvatarDot;
