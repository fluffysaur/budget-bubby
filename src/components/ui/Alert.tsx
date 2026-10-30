import React from "react";
import {
    AlertTriangle,
    AlertCircle,
    Info,
    CheckCircle2,
    X,
} from "lucide-react";

export type AlertVariant = "danger" | "warning" | "info" | "success";

export interface AlertProps {
    variant?: AlertVariant;
    title?: React.ReactNode;
    children: React.ReactNode;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    onClose?: () => void;
    className?: string;
}

const variantStyles: Record<
    AlertVariant,
    {
        container: string;
        title: string;
        icon: string;
        defaultIcon: React.FC<{ className?: string }>;
    }
> = {
    danger: {
        container:
            "border-2 border-(--border-ink) bg-(--pastel-coral-light) text-rose-900 dark:bg-rose-950/40 dark:text-rose-200 shadow-(--shadow-cute-sm)",
        title: "text-rose-950 dark:text-rose-100",
        icon: "text-rose-600 dark:text-rose-400",
        defaultIcon: AlertTriangle,
    },
    warning: {
        container:
            "border-2 border-(--border-ink) bg-(--pastel-butter-light) text-amber-950 dark:bg-amber-950/40 dark:text-amber-200 shadow-(--shadow-cute-sm)",
        title: "text-amber-950 dark:text-amber-100",
        icon: "text-amber-700 dark:text-amber-400",
        defaultIcon: AlertCircle,
    },
    info: {
        container:
            "border-2 border-(--border-ink) bg-(--pastel-lilac-light) text-purple-950 dark:bg-purple-950/40 dark:text-purple-200 shadow-(--shadow-cute-sm)",
        title: "text-purple-950 dark:text-purple-100",
        icon: "text-purple-700 dark:text-purple-400",
        defaultIcon: Info,
    },
    success: {
        container:
            "border-2 border-(--border-ink) bg-(--pastel-mint-light) text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-(--shadow-cute-sm)",
        title: "text-emerald-950 dark:text-emerald-100",
        icon: "text-emerald-700 dark:text-emerald-400",
        defaultIcon: CheckCircle2,
    },
};

export function Alert({
    variant = "danger",
    title,
    children,
    icon,
    action,
    onClose,
    className = "",
}: AlertProps) {
    const config = variantStyles[variant];
    const DefaultIconComponent = config.defaultIcon;

    return (
        <div
            role="alert"
            className={`flex items-start gap-3 rounded-xl p-3 text-xs sm:text-sm font-semibold transition-all ${config.container} ${className}`}
        >
            <div className={`shrink-0 mt-0.5 ${config.icon}`}>
                {icon !== undefined ? (
                    icon
                ) : (
                    <DefaultIconComponent className="h-4.5 w-4.5 stroke-[2.2]" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                {title && (
                    <h4
                        className={`font-bold mb-0.5 tracking-tight ${config.title}`}
                    >
                        {title}
                    </h4>
                )}
                <div className="leading-relaxed wrap-break-word">
                    {children}
                </div>
                {action && (
                    <div className="mt-2 flex items-center gap-2">{action}</div>
                )}
            </div>

            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Dismiss alert"
                    className="shrink-0 -mr-1 -mt-1 p-1 rounded-lg text-inherit opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

export default Alert;
