import React from "react";
import { getCategoryIconComponent } from "../../lib/categoryPresets";
import { TruncatedText } from "./TruncatedText";

export interface CategoryBadgeProps {
    name: string;
    color?: string;
    icon?: string;
    size?: "sm" | "md";
    className?: string;
}

export function CategoryBadge({
    name,
    color = "#dfc2ff",
    icon,
    size = "sm",
    className = "",
}: CategoryBadgeProps) {
    const sizeStyles =
        size === "sm"
            ? "px-2 py-0.5 text-[10px] sm:text-[11px] gap-1.5"
            : "px-2.5 py-1 text-xs gap-2";

    const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

    const renderIcon = () => {
        if (!icon) {
            return (
                <span
                    className={`${dotSize} rounded-full shrink-0 border border-black/20`}
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                />
            );
        }
        const IconFn = getCategoryIconComponent(icon);
        return React.createElement(IconFn, {
            className: `${dotSize} shrink-0`,
            style: { color },
        });
    };

    return (
        <span
            className={`inline-flex items-center font-bold rounded-lg bg-(--bg-canvas) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm) max-w-full ${sizeStyles} ${className}`}
        >
            {renderIcon()}
            <span className="min-w-0 truncate">
                <TruncatedText text={name} />
            </span>
        </span>
    );
}

export default CategoryBadge;
