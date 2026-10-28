import React from "react";
import { Loader2 } from "lucide-react";
import { Card, type CardVariant } from "./Card";

export interface LoadingCardProps {
    message?: React.ReactNode;
    icon?: React.ReactNode;
    variant?: CardVariant;
    className?: string;
}

export function LoadingCard({
    message = "Loading...",
    icon,
    variant = "white",
    className = "",
}: LoadingCardProps) {
    return (
        <Card
            variant={variant}
            className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-3 ${className}`}
        >
            {icon ? (
                icon
            ) : (
                <Loader2 className="h-8 w-8 text-purple-600 dark:text-purple-400 animate-spin" />
            )}
            <span className="text-sm font-bold text-(--text-ink) tracking-wide font-display">
                {message}
            </span>
        </Card>
    );
}

export default LoadingCard;
