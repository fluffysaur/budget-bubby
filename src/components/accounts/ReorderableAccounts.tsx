/**
 * ReorderableAccounts
 * Edit-mode list for one type group: drag from the handle, or use the Move
 * up/down buttons that appear on keyboard focus.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { LazyMotion, Reorder, domMax, useDragControls } from "motion/react";
import type { Account } from "../../types/finance";
import { moveItem } from "../../lib/accountOrder";
import { prefersReducedMotion } from "../../lib/motion";

export interface ReorderableAccountsProps {
    accounts: Account[];
    onReorder: (ids: string[]) => Promise<unknown>;
    /** Text for the screen-reader live region. */
    onAnnounce: (message: string) => void;
    className?: string;
    itemClassName?: string;
    children: (account: Account, dragHandle: ReactNode) => ReactNode;
}

export function ReorderableAccounts({
    accounts,
    onReorder,
    onAnnounce,
    className = "",
    itemClassName = "",
    children,
}: ReorderableAccountsProps) {
    const ids = accounts.map((a) => a.id);
    // Local order while dragging or saving; null means "as given".
    const [pending, setPending] = useState<string[] | null>(null);
    const pendingRef = useRef<string[] | null>(null);
    const refocusRef = useRef<HTMLElement | null>(null);
    // Saves still running; the local order is kept until the last one ends.
    const inFlightRef = useRef(0);
    const order =
        pending &&
        pending.length === ids.length &&
        pending.every((id) => ids.includes(id))
            ? pending
            : ids;
    const byId = new Map(accounts.map((a) => [a.id, a]));

    const setOrder = (next: string[] | null) => {
        pendingRef.current = next;
        setPending(next);
    };

    const commit = (next: string[], movedId: string) => {
        const name = byId.get(movedId)?.name ?? "Account";
        onAnnounce(
            `${name} moved to position ${next.indexOf(movedId) + 1} of ${next.length}`,
        );
        setOrder(next);
        inFlightRef.current += 1;
        // Failures roll back in the mutation, which also reports the error.
        void onReorder(next)
            .catch(() => undefined)
            .finally(() => {
                inFlightRef.current -= 1;
                if (inFlightRef.current === 0) setOrder(null);
            });
    };

    // Moving a row in the DOM can drop focus from its Move button.
    useLayoutEffect(() => {
        const element = refocusRef.current;
        if (element?.isConnected && document.activeElement !== element) {
            element.focus();
        }
        refocusRef.current = null;
    });

    return (
        // Reorder renders full `motion` components with drag and layout, which
        // the app-wide strict, animation-only provider doesn't allow.
        <LazyMotion features={domMax}>
            <Reorder.Group
                as="div"
                axis="y"
                values={order}
                onReorder={setOrder}
                className={className}
            >
                {order.map((id, index) => {
                    const account = byId.get(id);
                    if (!account) return null;
                    return (
                        <SortableAccount
                            key={id}
                            id={id}
                            name={account.name}
                            isFirst={index === 0}
                            isLast={index === order.length - 1}
                            className={itemClassName}
                            onMove={(step, button) => {
                                const next = moveItem(order, id, step);
                                if (next[index] === id) return;
                                refocusRef.current = button;
                                commit(next, id);
                            }}
                            onDrop={() => {
                                const next = pendingRef.current;
                                if (next && next.join() !== ids.join()) {
                                    commit(next, id);
                                } else if (inFlightRef.current === 0) {
                                    setOrder(null);
                                }
                            }}
                        >
                            {(handle) => children(account, handle)}
                        </SortableAccount>
                    );
                })}
            </Reorder.Group>
        </LazyMotion>
    );
}

interface SortableAccountProps {
    id: string;
    name: string;
    isFirst: boolean;
    isLast: boolean;
    className: string;
    onMove: (step: -1 | 1, button: HTMLElement) => void;
    onDrop: () => void;
    children: (dragHandle: ReactNode) => ReactNode;
}

const MOVE_BUTTON_CLASSES =
    "sr-only cursor-pointer items-center justify-center rounded-lg border-2 border-(--border-ink) bg-(--pastel-butter-light) text-(--text-ink) shadow-cute-sm focus:not-sr-only focus:flex focus:h-11 focus:w-11 aria-disabled:opacity-50";

function SortableAccount({
    id,
    name,
    isFirst,
    isLast,
    className,
    onMove,
    onDrop,
    children,
}: SortableAccountProps) {
    const controls = useDragControls();
    const [isDragging, setIsDragging] = useState(false);

    const handle = (
        <span className="relative flex items-center">
            {/* Pointer only; keyboard and screen readers use the Move buttons */}
            <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                data-testid="account-drag-handle"
                onPointerDown={(event) => {
                    event.preventDefault();
                    controls.start(event);
                }}
                className="relative flex h-11 w-6 cursor-grab touch-none items-center justify-center text-(--text-muted) after:absolute after:-inset-x-2.5 after:inset-y-0 after:content-[''] active:cursor-grabbing"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <span className="absolute top-1/2 left-full z-20 flex -translate-y-1/2 gap-1">
                <button
                    type="button"
                    aria-label={`Move ${name} up`}
                    aria-disabled={isFirst}
                    onClick={(e) => onMove(-1, e.currentTarget)}
                    className={MOVE_BUTTON_CLASSES}
                >
                    <ArrowUp className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    aria-label={`Move ${name} down`}
                    aria-disabled={isLast}
                    onClick={(e) => onMove(1, e.currentTarget)}
                    className={MOVE_BUTTON_CLASSES}
                >
                    <ArrowDown className="h-4 w-4" />
                </button>
            </span>
        </span>
    );

    return (
        <Reorder.Item
            as="div"
            value={id}
            dragListener={false}
            dragControls={controls}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => {
                setIsDragging(false);
                onDrop();
            }}
            whileDrag={prefersReducedMotion() ? undefined : { rotate: 1.5 }}
            className={`relative ${className} ${isDragging ? "shadow-cute-lg" : ""}`}
        >
            {children(handle)}
        </Reorder.Item>
    );
}
