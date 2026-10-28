import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

export type ButtonVariant = "primary" | "secondary" | "butter" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary:
        "bg-[#dfc2ff] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) hover:bg-[#1a1a1a] hover:text-[#fbf7f1] dark:hover:bg-[#fbf7f1] dark:hover:text-[#1a1a1a]",
    secondary:
        "bg-(--bg-card) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) hover:bg-[#fffdf2] dark:hover:bg-[#2f2b28]",
    butter:
        "bg-[#ffe999] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) hover:bg-[#fde047]",
    outline:
        "bg-transparent border-[1.5px] border-(--border-subtle) text-(--text-ink) hover:bg-(--bg-cream)",
    ghost:
        "bg-transparent text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) border-transparent",
    danger:
        "bg-[#f76b57] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) hover:bg-[#ff5733] hover:text-white",
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs font-bold rounded-xl gap-1.5",
    md: "px-4 py-2 text-xs sm:text-sm font-bold rounded-xl gap-2",
    lg: "px-5 py-2.5 text-sm sm:text-base font-bold rounded-2xl gap-2.5",
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
                    "inline-flex items-center justify-center transition-all cursor-pointer select-none active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:pointer-events-none",
                    variantStyles[variant],
                    sizeStyles[size],
                    className,
                )}
                {...props}
            >
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                    leftIcon && <span className="shrink-0">{leftIcon}</span>
                )}
                {children && <span>{children}</span>}
                {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
            </button>
        );
    },
);

Button.displayName = "Button";
export default Button;
