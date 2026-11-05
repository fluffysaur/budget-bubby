import { useEffect, useRef } from "react";
import { onAppEvent } from "../lib/appEvents";
import { recordActivityCheckin } from "../lib/bubby/activity";
import { useLoggedInMember } from "./useLoggedInMember";

/**
 * Checks in the logged-in member for today after every add, bulk add,
 * inbox confirm and inbox clear. Mount once (in the app shell).
 */
export function useActivityCheckins(): void {
    const { me } = useLoggedInMember();
    const meIdRef = useRef<string | null>(null);

    useEffect(() => {
        meIdRef.current = me?.id ?? null;
    }, [me]);

    useEffect(() => {
        const offs = [
            onAppEvent("expenseAdded", (detail) => {
                recordActivityCheckin(
                    meIdRef.current,
                    detail?.source === "inbox" ? "inbox" : "expense",
                );
            }),
            onAppEvent("inbox:item-confirmed", () => {
                recordActivityCheckin(meIdRef.current, "inbox");
            }),
            onAppEvent("inbox:cleared", () => {
                recordActivityCheckin(meIdRef.current, "inbox");
            }),
        ];
        return () => offs.forEach((off) => off());
    }, []);
}
