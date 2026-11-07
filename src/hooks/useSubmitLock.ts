import { useState, useCallback, useRef } from "react";

/**
 * Hook to guard asynchronous actions against double-submits.
 * Prevents multiple in-flight triggers while action is running.
 */
export function useSubmitLock() {
    const [isPending, setIsPending] = useState(false);
    const lockRef = useRef(false);

    const runWithLock = useCallback(
        async <T>(action: () => Promise<T>): Promise<T | undefined> => {
            if (lockRef.current) return undefined;
            lockRef.current = true;
            setIsPending(true);
            try {
                return await action();
            } finally {
                lockRef.current = false;
                setIsPending(false);
            }
        },
        [],
    );

    return { isPending, runWithLock };
}
