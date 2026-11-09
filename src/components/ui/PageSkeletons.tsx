/**
 * Page-shaped loading skeletons. Each mirrors the real layout of its page
 * (stat rows, list rows, chart blocks) so content swaps in without layout jumps.
 */

import { Card } from "./Card";
import {
    Skeleton,
    SkeletonCard,
    SkeletonGroup,
    SkeletonListRow,
} from "./Skeleton";

interface PageSkeletonProps {
    className?: string;
}

function SkeletonTile() {
    return (
        <div className="rounded-2xl border-2 border-(--border-subtle) bg-(--bg-cream) p-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-6" />
            </div>
            <Skeleton className="mt-2.5 h-3.5 w-20" />
            <Skeleton className="mt-2.5 h-2 w-full rounded-full" />
        </div>
    );
}

export function DashboardSkeleton({ className = "" }: PageSkeletonProps) {
    return (
        <SkeletonGroup
            label="Loading overview"
            data-testid="dashboard-skeleton"
            className={`space-y-5 ${className}`}
        >
            {/* Left-to-spend hero */}
            <Card>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-9 w-48" />
                <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
                <div className="mt-3.5 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {Array.from({ length: 4 }, (_, i) => (
                        <SkeletonTile key={i} />
                    ))}
                </div>
            </Card>

            {/* Upcoming bills */}
            <SkeletonCard rows={2} />
        </SkeletonGroup>
    );
}

export function BudgetContentSkeleton({ className = "" }: PageSkeletonProps) {
    return (
        <SkeletonGroup
            label="Loading budget"
            data-testid="budget-skeleton"
            className={`space-y-5 ${className}`}
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-3 w-32" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Array.from({ length: 4 }, (_, i) => (
                        <Card key={i} elevation="sm" padding="sm">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                                    <Skeleton className="h-3.5 w-24" />
                                </div>
                                <Skeleton className="h-3.5 w-16 shrink-0" />
                            </div>
                            <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
                            <div className="mt-2 flex justify-between">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-12" />
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
            <SkeletonCard chart />
            <SkeletonCard lines={3} />
        </SkeletonGroup>
    );
}

export function GoalsSkeleton({ className = "" }: PageSkeletonProps) {
    return (
        <SkeletonGroup
            label="Loading goals"
            data-testid="goals-skeleton"
            className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${className}`}
        >
            {Array.from({ length: 4 }, (_, i) => (
                <Card key={i}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/5" />
                                <Skeleton className="h-3 w-2/5" />
                            </div>
                        </div>
                        <Skeleton className="h-5 w-14 rounded-full shrink-0" />
                    </div>
                    <div className="mt-5 flex items-baseline justify-between">
                        <Skeleton className="h-6 w-28" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="mt-3 h-3 w-full rounded-full" />
                    <div className="mt-5 grid grid-cols-2 gap-2.5">
                        <Skeleton className="h-10 w-full rounded-xl" />
                        <Skeleton className="h-10 w-full rounded-xl" />
                    </div>
                </Card>
            ))}
        </SkeletonGroup>
    );
}

export function AccountsContentSkeleton({ className = "" }: PageSkeletonProps) {
    return (
        <SkeletonGroup
            label="Loading accounts"
            data-testid="accounts-skeleton"
            className={`space-y-5 ${className}`}
        >
            <SkeletonCard chart />
            <SkeletonCard rows={4} />
        </SkeletonGroup>
    );
}

export function ExpenseRowsSkeleton({
    className = "",
    rows = 6,
}: PageSkeletonProps & { rows?: number }) {
    return (
        <SkeletonGroup
            label="Loading transactions"
            data-testid="expense-rows-skeleton"
            className={`p-3 sm:p-4 space-y-2.5 ${className}`}
        >
            {Array.from({ length: rows }, (_, i) => (
                <SkeletonListRow key={i} />
            ))}
        </SkeletonGroup>
    );
}

export function RecurringContentSkeleton({
    className = "",
}: PageSkeletonProps) {
    return (
        <SkeletonGroup
            label="Loading policies"
            data-testid="recurring-skeleton"
            className={`space-y-5 ${className}`}
        >
            <Card padding="md">
                <Skeleton className="h-4 w-36" />
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                    {Array.from({ length: 12 }, (_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                    ))}
                </div>
            </Card>
            <div className="space-y-2.5">
                {Array.from({ length: 4 }, (_, i) => (
                    <SkeletonListRow key={i} />
                ))}
            </div>
        </SkeletonGroup>
    );
}

export function CreditCardListSkeleton({ className = "" }: PageSkeletonProps) {
    return (
        <SkeletonGroup
            label="Loading credit cards"
            data-testid="credit-card-skeleton"
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
        >
            {Array.from({ length: 3 }, (_, i) => (
                <Card key={i}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/5" />
                            <Skeleton className="h-3 w-2/5" />
                        </div>
                        <Skeleton className="h-6 w-14 rounded-full shrink-0" />
                    </div>
                    <Skeleton className="mt-4 h-7 w-28" />
                    <Skeleton className="mt-4 h-10 w-full rounded-xl" />
                </Card>
            ))}
        </SkeletonGroup>
    );
}
