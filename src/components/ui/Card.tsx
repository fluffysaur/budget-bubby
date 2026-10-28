import React from "react";

export type CardVariant = "white" | "cream" | "lilac" | "butter" | "blush" | "mint" | "coral";
export type CardElevation = "tactile" | "flat" | "subtle";
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
    lilac: "bg-[#f5ecff] dark:bg-[#342445]",
    butter: "bg-[#fffbeb] dark:bg-[#382f18]",
    blush: "bg-[#fff0fa] dark:bg-[#3d1f39]",
    mint: "bg-[#f0fdf4] dark:bg-[#1a3825]",
    coral: "bg-[#fff1ee] dark:bg-[#3b1c19]",
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
        let borderAndShadow = "border-2 border-(--border-ink) shadow-(--shadow-cute)";

        if (elevation === "flat") {
            borderAndShadow = "border-2 border-(--border-ink)";
        } else if (elevation === "subtle") {
            borderAndShadow = "border-2 border-(--border-subtle)";
        }

        const interactiveStyles = interactive
            ? "cursor-pointer transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-(--shadow-cute-lg) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
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
