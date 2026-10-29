/**
 * PullToRefresh Component
 * Touch-driven pull-down-to-refresh interaction for mobile devices.
 * Shows a tactile neo-brutalist pill indicator and triggers onRefresh when pulled past threshold.
 */

import React, { useState, useRef, useEffect } from "react";
import { RotateCw, ArrowDown } from "lucide-react";
import { haptics } from "../../lib/haptics";

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
    const touchStartX = useRef<number | null>(null);
    const isReadyRef = useRef<boolean>(false);
    const isPullingRef = useRef<boolean>(false);
    const pullDistanceRef = useRef<number>(0);
    const isRefreshingRef = useRef<boolean>(false);

    // Keep latest props in refs to avoid re-binding native DOM touch listeners
    const onRefreshRef = useRef(onRefresh);
    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    const disabledRef = useRef(disabled);
    useEffect(() => {
        disabledRef.current = disabled;
    }, [disabled]);

    const thresholdRef = useRef(threshold);
    useEffect(() => {
        thresholdRef.current = threshold;
    }, [threshold]);

    // Attach non-passive touch listeners directly to DOM container.
    // React synthetic touchmove is passive by default, which prevents calling e.preventDefault()
    // and causes mobile browsers (Chrome / Safari) to trigger their native pull-to-refresh.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleStart = (clientX?: number, clientY?: number) => {
            if (disabledRef.current || isRefreshingRef.current) return;
            // Only initiate pull-to-refresh when container is at the very top
            if (container.scrollTop <= 0 && clientY !== undefined) {
                touchStartY.current = clientY;
                touchStartX.current = clientX ?? 0;
                isReadyRef.current = true;
                isPullingRef.current = false;
            } else {
                isReadyRef.current = false;
            }
        };

        const handleMove = (clientX: number | undefined, clientY: number | undefined, e: TouchEvent) => {
            if (
                disabledRef.current ||
                isRefreshingRef.current ||
                !isReadyRef.current ||
                touchStartY.current === null ||
                clientY === undefined
            ) {
                return;
            }

            const currentX = clientX ?? 0;
            const diffY = clientY - touchStartY.current;
            const diffX = currentX - (touchStartX.current ?? 0);

            // Disambiguate horizontal swipes (carousels, tabs) from vertical pull
            if (!isPullingRef.current && Math.abs(diffX) > Math.abs(diffY) * 0.8) {
                isReadyRef.current = false;
                return;
            }

            if (diffY > 0 && container.scrollTop <= 0) {
                // Prevent browser native pull-to-refresh and overscroll bounce
                if (e.cancelable) {
                    e.preventDefault();
                }

                // Logarithmic / exponential damping for elastic feel
                const damped = Math.min(
                    Math.pow(diffY, 0.85) * 1.5,
                    MAX_PULL_DISTANCE,
                );
                pullDistanceRef.current = damped;
                setPullDistance(damped);
                setIsPulling(true);
                isPullingRef.current = true;
            } else if (isPullingRef.current) {
                pullDistanceRef.current = 0;
                setPullDistance(0);
                setIsPulling(false);
                isPullingRef.current = false;
            }
        };

        const handleEnd = async () => {
            if (!isPullingRef.current || isRefreshingRef.current) {
                touchStartY.current = null;
                touchStartX.current = null;
                isReadyRef.current = false;
                isPullingRef.current = false;
                pullDistanceRef.current = 0;
                setPullDistance(0);
                setIsPulling(false);
                return;
            }

            const currentDist = pullDistanceRef.current;
            const currentThreshold = thresholdRef.current;
            const shouldRefresh = currentDist >= currentThreshold;

            touchStartY.current = null;
            touchStartX.current = null;
            isReadyRef.current = false;
            isPullingRef.current = false;

            if (shouldRefresh) {
                setIsRefreshing(true);
                isRefreshingRef.current = true;
                setPullDistance(currentThreshold * 0.8);
                pullDistanceRef.current = currentThreshold * 0.8;
                const startTime = Date.now();

                try {
                    haptics.lightTap();
                    await onRefreshRef.current();
                } finally {
                    const elapsed = Date.now() - startTime;
                    const remaining = Math.max(0, 400 - elapsed);
                    setTimeout(() => {
                        setIsRefreshing(false);
                        isRefreshingRef.current = false;
                        setPullDistance(0);
                        pullDistanceRef.current = 0;
                        setIsPulling(false);
                    }, remaining);
                }
            } else {
                pullDistanceRef.current = 0;
                setPullDistance(0);
                setIsPulling(false);
            }
        };

        const onTouchStart = (e: TouchEvent) => {
            if (!e.touches || e.touches.length === 0) return;
            handleStart(e.touches[0].clientX, e.touches[0].clientY);
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!e.touches || e.touches.length === 0) return;
            handleMove(e.touches[0].clientX, e.touches[0].clientY, e);
        };

        const onTouchEnd = () => {
            handleEnd();
        };

        container.addEventListener("touchstart", onTouchStart, { passive: true });
        container.addEventListener("touchmove", onTouchMove, { passive: false });
        container.addEventListener("touchend", onTouchEnd, { passive: true });
        container.addEventListener("touchcancel", onTouchEnd, { passive: true });

        return () => {
            container.removeEventListener("touchstart", onTouchStart);
            container.removeEventListener("touchmove", onTouchMove);
            container.removeEventListener("touchend", onTouchEnd);
            container.removeEventListener("touchcancel", onTouchEnd);
            touchStartY.current = null;
            touchStartX.current = null;
            isReadyRef.current = false;
            isPullingRef.current = false;
        };
    }, []);

    const isPastThreshold = pullDistance >= threshold;
    const progress = Math.min(pullDistance / threshold, 1);

    return (
        <Component
            ref={containerRef as unknown as React.RefObject<HTMLDivElement>}
            className={`relative flex-1 overflow-y-auto overscroll-y-contain ${className}`}
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
