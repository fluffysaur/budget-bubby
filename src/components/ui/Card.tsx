import React from "react";

export type CardVariant =
    "white" | "cream" | "lilac" | "butter" | "blush" | "mint" | "coral";
export type CardElevation = "tactile" | "sm" | "flat" | "subtle";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: CardVariant;
    elevation?: CardElevation;
    padding?: CardPadding;
    interactive?: boolean;
    children?: React.ReactNode;
}

const variantBgMap: Record<CardVariant, string> = {
    white: "bg-(--bg-card)",
    cream: "bg-(--bg-cream)",
    lilac: "bg-(--pastel-lilac-light) dark:bg-purple-950/40",
    butter: "bg-(--pastel-butter-light) dark:bg-amber-950/40",
    blush: "bg-(--pastel-pink-light) dark:bg-pink-950/40",
    mint: "bg-(--pastel-mint-light) dark:bg-emerald-950/40",
    coral: "bg-(--pastel-coral-light) dark:bg-rose-950/40",
};

const paddingMap: Record<CardPadding, string> = {
    none: "p-0",
    sm: "p-3",
    md: "p-4 sm:p-5",
    lg: "p-6 sm:p-7",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    (
        {
            variant = "white",
            elevation = "tactile",
            padding = "md",
            interactive = false,
            className = "",
            children,
            ...props
        },
        ref,
    ) => {
        let borderAndShadow =
            "border-2 border-(--border-ink) shadow-cute";

        if (elevation === "sm") {
            borderAndShadow =
                "border-2 border-(--border-ink) shadow-cute-sm";
        } else if (elevation === "flat") {
            borderAndShadow = "border-2 border-(--border-ink)";
        } else if (elevation === "subtle") {
            borderAndShadow = "border-2 border-(--border-subtle)";
        }

        const interactiveStyles = interactive
            ? "cursor-pointer transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-cute-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            : "";

        return (
            <div
                ref={ref}
                className={`rounded-2xl ${variantBgMap[variant]} ${borderAndShadow} ${paddingMap[padding]} ${interactiveStyles} ${className}`}
                {...props}
            >
                {children}
            </div>
        );
    },
);

Card.displayName = "Card";
export default Card;
