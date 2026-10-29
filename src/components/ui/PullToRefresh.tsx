/**
 * PullToRefresh Component
 * Touch-driven pull-down-to-refresh interaction for mobile devices.
 * Shows a tactile neo-brutalist pill indicator and triggers onRefresh when pulled past threshold.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { RotateCw, ArrowDown } from "lucide-react";

export interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
    className?: string;
    threshold?: number;
    disabled?: boolean;
    as?: "main" | "div";
}

const DEFAULT_THRESHOLD = 64;
const MAX_PULL_DISTANCE = 110;

export function PullToRefresh({
    onRefresh,
    children,
    className = "",
    threshold = DEFAULT_THRESHOLD,
    disabled = false,
    as: Component = "main",
}: PullToRefreshProps) {
    const [pullDistance, setPullDistance] = useState<number>(0);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [isPulling, setIsPulling] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const touchStartY = useRef<number | null>(null);
    const isReadyRef = useRef<boolean>(false);

    // Clean up if unmounted while pulling
    useEffect(() => {
        return () => {
            touchStartY.current = null;
        };
    }, []);

    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (disabled || isRefreshing) return;

            const target = containerRef.current;
            // Only initiate pull-to-refresh when the container is scrolled to the very top
            if (target && target.scrollTop <= 0) {
                touchStartY.current = e.touches[0].clientY;
                isReadyRef.current = true;
            } else {
                isReadyRef.current = false;
            }
        },
        [disabled, isRefreshing],
    );

    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (disabled || isRefreshing || !isReadyRef.current || touchStartY.current === null) {
                return;
            }

            const currentY = e.touches[0].clientY;
            const diffY = currentY - touchStartY.current;

            // Only track downward pull
            if (diffY > 0) {
                const target = containerRef.current;
                if (target && target.scrollTop <= 0) {
                    // Logarithmic / exponential damping for elastic feel
                    const damped = Math.min(
                        Math.pow(diffY, 0.85) * 1.5,
                        MAX_PULL_DISTANCE,
                    );
                    setPullDistance(damped);
                    setIsPulling(true);

                    // Prevent overscroll browser behavior if available
                    if (e.cancelable && damped > 10) {
                        e.preventDefault();
                    }
                } else {
                    setPullDistance(0);
                    setIsPulling(false);
                }
            } else {
                setPullDistance(0);
                setIsPulling(false);
            }
        },
        [disabled, isRefreshing],
    );

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling || isRefreshing) {
            touchStartY.current = null;
            isReadyRef.current = false;
            setPullDistance(0);
            setIsPulling(false);
            return;
        }

        const shouldRefresh = pullDistance >= threshold;
        touchStartY.current = null;
        isReadyRef.current = false;

        if (shouldRefresh) {
            setIsRefreshing(true);
            setPullDistance(threshold * 0.8); // Hold indicator in view while refreshing
            const startTime = Date.now();

            try {
                // Tactile haptic feedback on devices supporting it
                if (typeof window !== "undefined" && "navigator" in window && navigator.vibrate) {
                    navigator.vibrate(15);
                }
                await onRefresh();
            } finally {
                // Keep spinning for at least 400ms for clean visual feedback
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, 400 - elapsed);
                setTimeout(() => {
                    setIsRefreshing(false);
                    setPullDistance(0);
                    setIsPulling(false);
                }, remaining);
            }
        } else {
            setPullDistance(0);
            setIsPulling(false);
        }
    }, [isPulling, isRefreshing, pullDistance, threshold, onRefresh]);

    const isPastThreshold = pullDistance >= threshold;
    const progress = Math.min(pullDistance / threshold, 1);

    return (
        <Component
            ref={containerRef as unknown as React.RefObject<HTMLDivElement>}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`relative flex-1 overflow-y-auto ${className}`}
        >
            {/* Visual Pull Indicator Pill (Visible during pull or refresh) */}
            {(isPulling || isRefreshing) && (
                <div
                    aria-live="polite"
                    className="pointer-events-none absolute left-0 right-0 top-2 z-30 flex justify-center transition-transform duration-75"
                    style={{
                        transform: `translateY(${Math.max(0, pullDistance - 28)}px)`,
                        opacity: isRefreshing ? 1 : Math.max(0.2, progress),
                    }}
                >
                    <div className="flex items-center gap-2 rounded-full border-2 border-(--border-ink) bg-(--bg-card) px-3.5 py-1.5 shadow-(--shadow-cute-sm)">
                        {isRefreshing ? (
                            <RotateCw
                                className="h-4 w-4 animate-spin text-[#7e22ce] dark:text-[#dfc2ff]"
                                strokeWidth={2.5}
                            />
                        ) : isPastThreshold ? (
                            <RotateCw
                                className="h-4 w-4 text-[#14532d] dark:text-[#86efac] transition-transform duration-150 rotate-180"
                                strokeWidth={2.5}
                            />
                        ) : (
                            <ArrowDown
                                className="h-4 w-4 text-(--text-muted) transition-transform duration-150"
                                strokeWidth={2.5}
                                style={{ transform: `rotate(${progress * 180}deg)` }}
                            />
                        )}

                        <span className="text-xs font-bold text-(--text-ink)">
                            {isRefreshing
                                ? "Refreshing..."
                                : isPastThreshold
                                ? "Release to refresh"
                                : "Pull down to refresh"}
                        </span>
                    </div>
                </div>
            )}

            {/* Main Content with smooth transform during active pull */}
            <div
                style={{
                    transform: isPulling || isRefreshing ? `translateY(${pullDistance * 0.4}px)` : "none",
                    transition: isPulling ? "none" : "transform 200ms ease-out",
                }}
            >
                {children}
            </div>
        </Component>
    );
}

export default PullToRefresh;
