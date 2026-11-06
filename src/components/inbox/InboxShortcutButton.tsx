/** Expenses header: "Inbox (3)" when there is something to sort. */

import { Inbox } from "lucide-react";
import { useInRouterContext, useNavigate } from "react-router-dom";
import { useInboxSummary } from "../../hooks/useInboxQueries";
import { Button } from "../ui/Button";

function InboxShortcutButtonInner() {
    const navigate = useNavigate();
    const { data } = useInboxSummary();
    const count = data?.available ? data.pendingCount : 0;
    if (count === 0) return null;
    return (
        <Button
            variant="butter"
            size="sm"
            className="shrink-0"
            leftIcon={<Inbox className="h-3.5 w-3.5" strokeWidth={2.5} />}
            onClick={() => navigate("/inbox")}
        >
            {`Inbox (${count})`}
        </Button>
    );
}

export function InboxShortcutButton() {
    // Some screens render outside a router (tests, embedded previews)
    return useInRouterContext() ? <InboxShortcutButtonInner /> : null;
}

export default InboxShortcutButton;
