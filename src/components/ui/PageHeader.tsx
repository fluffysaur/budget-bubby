import React from "react";
import { TooltipPopover } from "./TooltipPopover";

export interface PageHeaderProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    tooltip?: React.ReactNode;
    tooltipTitle?: string;
    badge?: React.ReactNode;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}

export function PageHeader({
    title,
    subtitle,
    tooltip,
    tooltipTitle,
    badge,
    icon,
    actions,
    className = "",
}: PageHeaderProps) {
    return (
        <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
        >
            <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                    {icon && <div className="shrink-0">{icon}</div>}
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-(--text-ink) font-display">
                        {title}
                    </h1>
                    {badge && <div className="shrink-0">{badge}</div>}
                    {tooltip && (
                        <TooltipPopover
                            title={tooltipTitle || (typeof title === "string" ? title : "Details")}
                            ariaLabel={`${typeof title === "string" ? title : "Page"} info`}
                            align="left"
                        >
                            {tooltip}
                        </TooltipPopover>
                    )}
                </div>
                {subtitle && (
                    <p className="mt-0.5 text-xs font-medium text-(--text-muted)">
                        {subtitle}
                    </p>
                )}
            </div>

            {actions && (
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    {actions}
                </div>
            )}
        </div>
    );
}

export default PageHeader;
