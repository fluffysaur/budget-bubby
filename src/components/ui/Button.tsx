import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

export type ButtonVariant =
    "primary" | "secondary" | "butter" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon-sm" | "icon-md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary:
        "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm hover:bg-(--text-ink) hover:text-(--bg-cream) dark:hover:bg-(--bg-cream) dark:hover:text-(--text-ink)",
    secondary:
        "bg-(--bg-card) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm hover:bg-(--bg-cream) dark:hover:bg-(--bg-cream)",
    butter: "bg-(--pastel-butter) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm hover:bg-(--accent-butter)",
    outline:
        "bg-transparent border-2 border-(--border-subtle) text-(--text-ink) hover:bg-(--bg-cream)",
    ghost: "bg-transparent text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) border-transparent",
    danger: "bg-(--accent-coral) text-white border-2 border-(--border-ink) shadow-cute-sm hover:bg-(--pastel-coral)",
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: "relative after:absolute after:-inset-2 after:content-[''] px-3 py-1.5 text-xs font-bold rounded-xl gap-1.5",
    md: "px-4 py-2 text-xs sm:text-sm font-bold rounded-xl gap-2",
    lg: "px-5 py-2.5 text-sm sm:text-base font-bold rounded-2xl gap-2.5",
    "icon-sm":
        "relative after:absolute after:-inset-2 after:content-[''] p-1.5 text-xs font-bold rounded-xl",
    "icon-md": "p-2 text-sm font-bold rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            children,
            variant = "primary",
            size = "md",
            isLoading = false,
            leftIcon,
            rightIcon,
            className = "",
            disabled,
            type = "button",
            ...props
        },
        ref,
    ) => {
        const isDisabled = disabled || isLoading;

        return (
            <button
                ref={ref}
                type={type}
                disabled={isDisabled}
                className={twMerge(
                    "inline-flex items-center justify-center transition-press cursor-pointer select-none active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:pointer-events-none",
                    variantStyles[variant],
                    sizeStyles[size],
                    className,
                )}
                {...props}
            >
                {isLoading ? (
                    <span className="shrink-0 flex items-center justify-center w-4 h-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                    </span>
                ) : (
                    leftIcon && <span className="shrink-0">{leftIcon}</span>
                )}
                {children && <span>{children}</span>}
                {!isLoading && rightIcon && (
                    <span className="shrink-0">{rightIcon}</span>
                )}
            </button>
        );
    },
);

Button.displayName = "Button";
export default Button;
