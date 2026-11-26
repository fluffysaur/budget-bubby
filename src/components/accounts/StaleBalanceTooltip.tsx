import { Info } from "lucide-react";
import { TooltipPopover } from "../ui/TooltipPopover";

export interface StaleBalanceTooltipProps {
    accountName: string;
    days: number;
    /** "dot" sits on the avatar; "info" follows the card's "Updated" line. */
    trigger: "dot" | "info";
}

/** Explains the amber stale-balance marker. */
export function StaleBalanceTooltip({
    accountName,
    days,
    trigger,
}: StaleBalanceTooltipProps) {
    return (
        <TooltipPopover
            compact
            align="left"
            ariaLabel={`Stale balance for ${accountName}`}
            renderTrigger={(props) => (
                <button
                    type="button"
                    {...props}
                    className={`relative cursor-pointer after:absolute after:content-[''] ${
                        trigger === "dot"
                            ? "block h-2.5 w-2.5 rounded-full border border-(--border-ink) bg-amber-500 after:-inset-4.5"
                            : "inline-flex after:-inset-4"
                    }`}
                >
                    {trigger === "info" && (
                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                </button>
            )}
        >
            <p className="font-black">Updated {days} days ago</p>
            <p className="mt-0.5 font-medium">
                Update the balance so your net worth stays accurate.
            </p>
        </TooltipPopover>
    );
}
