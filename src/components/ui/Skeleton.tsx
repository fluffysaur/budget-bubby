import React from "react";
import { Card, type CardVariant } from "./Card";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

/**
 * Base skeleton block. Decorative only (aria-hidden); wrap groups of
 * skeletons in <SkeletonGroup> so screen readers announce "Loading".
 * Pulse animation only runs when the user has not requested reduced motion.
 */
export function Skeleton({ className = "", ...props }: SkeletonProps) {
    return (
        <div
            aria-hidden="true"
            data-skeleton=""
            className={`rounded-lg bg-(--border-subtle) motion-safe:animate-pulse ${className}`}
            {...props}
        />
    );
}

export interface SkeletonGroupProps {
    label?: string;
    className?: string;
    children?: React.ReactNode;
    "data-testid"?: string;
}

/**
 * Accessible loading region: role="status" + aria-busy with sr-only label.
 */
export function SkeletonGroup({
    label = "Loading",
    className = "",
    children,
    "data-testid": testId,
}: SkeletonGroupProps) {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid={testId}
            className={className}
        >
            <span className="sr-only">{label}</span>
            {children}
        </div>
    );
}

/**
 * Placeholder for a StatCard value. Matches StatCard value line heights
 * (text-base / sm:text-xl / xl:text-2xl) so the card height does not jump.
 */
export function SkeletonStatValue({
    className = "w-24",
}: {
    className?: string;
}) {
    return (
        <span className="flex h-6 sm:h-7 xl:h-8 items-center">
            <Skeleton className={`h-4 sm:h-5 xl:h-6 ${className}`} />
        </span>
    );
}

/**
 * Placeholder for a short single-line caption (StatCard subtitle, list meta).
 */
export function SkeletonLine({ className = "w-16" }: { className?: string }) {
    return (
        <span className="flex h-4 items-center">
            <Skeleton className={`h-3 ${className}`} />
        </span>
    );
}

export interface SkeletonStatCardProps {
    variant?: CardVariant;
    footer?: boolean;
    className?: string;
}

/**
 * Mirrors StatCard's padding, title row, icon chip, value and subtitle lines.
 */
export function SkeletonStatCard({
    variant = "white",
    footer = false,
    className = "",
}: SkeletonStatCardProps) {
    return (
        <Card
            variant={variant}
            padding="none"
            className={`overflow-hidden ${className}`}
        >
            <div className="p-3 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3 w-16 sm:w-20" />
                    <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl shrink-0" />
                </div>
                <div className="mt-1.5 sm:mt-2.5">
                    <SkeletonStatValue />
                </div>
                <div className="mt-1">
                    <SkeletonLine />
                </div>
            </div>
            {footer && (
                <div className="border-t-2 border-(--border-ink) bg-(--bg-cream) px-4 py-2">
                    <SkeletonLine className="w-full" />
                </div>
            )}
        </Card>
    );
}

export interface SkeletonListRowProps {
    className?: string;
}

/**
 * List row: icon chip, title + meta lines (min-w-0 flex-1), amount (shrink-0).
 */
export function SkeletonListRow({ className = "" }: SkeletonListRowProps) {
    return (
        <div
            className={`flex items-center justify-between gap-3 rounded-xl border-2 border-(--border-subtle) bg-(--bg-cream) p-3.5 ${className}`}
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                </div>
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
        </div>
    );
}

export interface SkeletonCardProps {
    variant?: CardVariant;
    lines?: number;
    rows?: number;
    chart?: boolean;
    className?: string;
}

/**
 * Generic content card: header (icon + title), optional chart block,
 * optional list rows and text lines.
 */
export function SkeletonCard({
    variant = "white",
    lines = 0,
    rows = 0,
    chart = false,
    className = "",
}: SkeletonCardProps) {
    return (
        <Card variant={variant} className={className}>
            <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                <Skeleton className="h-4 w-32" />
            </div>
            {chart && <Skeleton className="mt-4 h-56 w-full rounded-xl" />}
            {rows > 0 && (
                <div className="mt-4 space-y-2.5">
                    {Array.from({ length: rows }, (_, i) => (
                        <SkeletonListRow key={i} />
                    ))}
                </div>
            )}
            {lines > 0 && (
                <div className="mt-4 space-y-2.5">
                    {Array.from({ length: lines }, (_, i) => (
                        <Skeleton
                            key={i}
                            className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
                        />
                    ))}
                </div>
            )}
        </Card>
    );
}

export default Skeleton;
