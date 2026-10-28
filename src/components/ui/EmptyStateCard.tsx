import React from "react";
import { Card, type CardVariant } from "./Card";

export interface EmptyStateCardProps {
    icon?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    variant?: CardVariant;
    className?: string;
}

export function EmptyStateCard({
    icon,
    title,
    description,
    action,
    variant = "cream",
    className = "",
}: EmptyStateCardProps) {
    return (
        <Card
            variant={variant}
            className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center ${className}`}
        >
            {icon && (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dfc2ff] dark:bg-[#342445] text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm) mb-3 shrink-0">
                    {icon}
                </div>
            )}
            <h3 className="text-base sm:text-lg font-bold text-(--text-ink) font-display">
                {title}
            </h3>
            {description && (
                <p className="mt-1.5 text-xs sm:text-sm text-(--text-muted) max-w-sm mx-auto leading-relaxed">
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </Card>
    );
}

export default EmptyStateCard;
