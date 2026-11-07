import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    WifiOff,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    RotateCcw,
    Trash2,
} from "lucide-react";
import { useOptionalHousehold } from "../../context/HouseholdContext";
import {
    getPendingSyncCount,
    getFailedMutations,
    flushOutbox,
    flushIfOnline,
    retryFailedMutation,
    discardFailedMutation,
    type QueuedMutation,
    type OfflineSyncStatusDetail,
} from "../../services/offlineSyncQueue";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Card,
    Button,
    TruncatedText,
} from "../ui";
import { formatSGD } from "../../lib/currency";
import { m, AnimatePresence } from "motion/react";
import { collapse } from "../../lib/motion";

function formatMutationLabel(mutation: QueuedMutation): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = mutation.payload as any;
    switch (mutation.type) {
        case "addExpense": {
            const input = payload?.input || payload;
            const item = input?.item || "Expense";
            const amount =
                typeof input?.amount === "number"
                    ? ` (${formatSGD(input.amount)})`
                    : "";
            return `${item}${amount}`;
        }
        case "updateExpense": {
            const updates = payload?.updates;
            if (updates?.item) {
                return `Update ${updates.item}`;
            }
            if (typeof updates?.amount === "number") {
                return `Update expense (${formatSGD(updates.amount)})`;
            }
            return "Update expense";
        }
        case "deleteExpense":
            return "Delete expense";
        case "bulkAddExpenses": {
            const items = payload?.expenses || payload || [];
            const count = Array.isArray(items) ? items.length : 0;
            return `${count} ${count === 1 ? "expense" : "expenses"}`;
        }
        case "recordDailyCheckin":
            return "Daily check-in";
        case "confirmInboxItem":
            return payload?.expense?.item || "Confirm inbox item";
        case "resolveInboxItem":
            return "Resolve inbox item";
        default:
            return "Offline change";
    }
}

export const OfflineBanner: React.FC = () => {
    const [isOnline, setIsOnline] = useState<boolean>(
        typeof navigator !== "undefined" ? navigator.onLine : true,
    );
    const [pendingCount, setPendingCount] = useState<number>(() =>
        getPendingSyncCount(),
    );
    const [failedMutations, setFailedMutations] = useState<QueuedMutation[]>(
        () => getFailedMutations(),
    );
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [showSyncedConfirmation, setShowSyncedConfirmation] =
        useState<boolean>(false);
    const [isFailedModalOpen, setIsFailedModalOpen] = useState<boolean>(false);

    const household = useOptionalHousehold();
    const householdRef = useRef(household);
    useEffect(() => {
        householdRef.current = household;
    }, [household]);

    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleRetry = useCallback(async (mutationId: string) => {
        await retryFailedMutation(mutationId);
        const remainingFailed = getFailedMutations();
        setFailedMutations(remainingFailed);
        setPendingCount(getPendingSyncCount());
        if (remainingFailed.length === 0) {
            setIsFailedModalOpen(false);
        }
    }, []);

    const handleDiscard = useCallback(async (mutationId: string) => {
        await discardFailedMutation(mutationId);
        const remainingFailed = getFailedMutations();
        setFailedMutations(remainingFailed);
        setPendingCount(getPendingSyncCount());
        if (remainingFailed.length === 0) {
            setIsFailedModalOpen(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        // Flush any pending items if starting up online
        flushIfOnline().catch(console.error);

        const handleSyncStatus = (event: Event) => {
            if (!isMounted) return;
            const customEvent = event as CustomEvent<OfflineSyncStatusDetail>;
            if (customEvent.detail) {
                setPendingCount(customEvent.detail.pendingCount);
                const currentFailed = getFailedMutations();
                setFailedMutations(currentFailed);
                if (currentFailed.length === 0) {
                    setIsFailedModalOpen(false);
                }
                if (customEvent.detail.isSyncing !== undefined) {
                    setIsSyncing(customEvent.detail.isSyncing);
                }
                if (
                    !customEvent.detail.isSyncing &&
                    customEvent.detail.lastSyncedCount !== undefined &&
                    customEvent.detail.lastSyncedCount > 0
                ) {
                    setShowSyncedConfirmation(true);
                    if (hideTimerRef.current) {
                        clearTimeout(hideTimerRef.current);
                    }
                    hideTimerRef.current = setTimeout(() => {
                        if (isMounted) setShowSyncedConfirmation(false);
                    }, 3500);
                }
            }
        };

        const handleOnline = () => {
            if (!isMounted) return;
            setIsOnline(true);
            const count = getPendingSyncCount();
            if (count > 0) {
                setIsSyncing(true);
                flushOutbox()
                    .then(() => {
                        if (isMounted && householdRef.current?.refreshData) {
                            return householdRef.current.refreshData();
                        }
                    })
                    .catch(console.error);
            } else {
                setShowSyncedConfirmation(true);
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                hideTimerRef.current = setTimeout(() => {
                    if (isMounted) setShowSyncedConfirmation(false);
                }, 3500);

                if (householdRef.current?.refreshData) {
                    householdRef.current.refreshData().catch(console.error);
                }
            }
        };

        const handleOffline = () => {
            if (!isMounted) return;
            setIsOnline(false);
            setIsSyncing(false);
            setShowSyncedConfirmation(false);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            setPendingCount(getPendingSyncCount());
            setFailedMutations(getFailedMutations());
        };

        window.addEventListener("offlineSyncStatusChanged", handleSyncStatus);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            isMounted = false;
            window.removeEventListener(
                "offlineSyncStatusChanged",
                handleSyncStatus,
            );
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, []);

    const failedCount = failedMutations.length;

    return (
        <>
            <AnimatePresence>
                {!isOnline ? (
                    <m.div key="offline" {...collapse}>
                        <div
                            role="status"
                            aria-live="polite"
                            className="w-full py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-2 transition-colors z-40 bg-(--pastel-butter) text-(--text-ink) border-b-2 border-(--border-ink)"
                        >
                            <WifiOff className="w-3.5 h-3.5 shrink-0" />
                            <span>
                                {pendingCount > 0
                                    ? `Offline · ${pendingCount} queued`
                                    : "Offline"}
                            </span>
                            {failedCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setIsFailedModalOpen(true)}
                                    className="font-bold underline underline-offset-2 cursor-pointer shrink-0"
                                >
                                    {failedCount} not synced
                                </button>
                            )}
                        </div>
                    </m.div>
                ) : isSyncing ? (
                    <m.div key="syncing" {...collapse}>
                        <div
                            role="status"
                            aria-live="polite"
                            className="w-full py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-2 transition-colors z-40 bg-(--pastel-lilac) text-(--text-ink) border-b-2 border-(--border-ink)"
                        >
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                            <span>Syncing...</span>
                        </div>
                    </m.div>
                ) : failedCount > 0 ? (
                    <m.div key="failed" {...collapse}>
                        <div
                            role="status"
                            aria-live="polite"
                            className="w-full py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-2 transition-colors z-40 bg-(--pastel-coral-light) text-(--text-ink) border-b-2 border-(--border-ink)"
                        >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-(--accent-coral)" />
                            <button
                                type="button"
                                onClick={() => setIsFailedModalOpen(true)}
                                className="font-bold underline underline-offset-2 cursor-pointer"
                            >
                                {failedCount} not synced
                            </button>
                        </div>
                    </m.div>
                ) : showSyncedConfirmation ? (
                    <m.div key="synced" {...collapse}>
                        <div
                            role="status"
                            aria-live="polite"
                            className="w-full py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-2 transition-colors z-40 bg-(--pastel-mint) text-(--accent-mint-ink) border-b-2 border-(--border-ink)"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-(--accent-mint-ink)" />
                            <span>✓ All changes synced to Supabase</span>
                        </div>
                    </m.div>
                ) : null}
            </AnimatePresence>

            <AnimatedModal
                isOpen={isFailedModalOpen && failedCount > 0}
                onClose={() => setIsFailedModalOpen(false)}
                maxWidth="max-w-md"
            >
                <ModalHeader
                    title="Not Synced"
                    subtitle={`${failedCount} not synced`}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    iconBgColor="bg-(--pastel-coral-light)"
                    onClose={() => setIsFailedModalOpen(false)}
                />
                <ModalBody className="space-y-3">
                    {failedMutations.map((mutation) => (
                        <Card
                            key={mutation.id}
                            elevation="sm"
                            className="p-3 flex items-center justify-between gap-3"
                        >
                            <div className="min-w-0 flex-1">
                                <TruncatedText
                                    text={formatMutationLabel(mutation)}
                                    className="text-sm font-bold text-(--text-ink)"
                                />
                                {mutation.lastError && (
                                    <p className="text-xs text-(--text-muted) mt-0.5 wrap-break-word">
                                        {mutation.lastError}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={
                                        <RotateCcw className="h-3.5 w-3.5" />
                                    }
                                    onClick={() => handleRetry(mutation.id)}
                                >
                                    Retry
                                </Button>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    leftIcon={
                                        <Trash2 className="h-3.5 w-3.5" />
                                    }
                                    onClick={() => handleDiscard(mutation.id)}
                                >
                                    Discard
                                </Button>
                            </div>
                        </Card>
                    ))}
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsFailedModalOpen(false)}
                    >
                        Close
                    </Button>
                </ModalFooter>
            </AnimatedModal>
        </>
    );
};
