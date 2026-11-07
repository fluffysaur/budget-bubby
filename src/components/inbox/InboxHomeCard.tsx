/**
 * Home: unsorted captures, so budget pacing gaps are visible. Shown only
 * when the household Inbox has pending items.
 */

import { Inbox } from "lucide-react";
import { useInRouterContext, useNavigate } from "react-router-dom";
import { m, AnimatePresence } from "motion/react";
import { collapse } from "../../lib/motion";
import { useInboxSummary } from "../../hooks/useInboxQueries";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { CurrencyText } from "../ui/CurrencyText";

function InboxHomeCardInner() {
    const navigate = useNavigate();
    const { data } = useInboxSummary();
    const isVisible = Boolean(data?.available && (data.pendingCount ?? 0) > 0);

    return (
        <AnimatePresence>
            {isVisible && data && (
                <m.div key="inbox-home-card" {...collapse}>
                    <Card role="region" aria-label="Inbox" variant="butter" elevation="sm" padding="md">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--bg-card) shadow-cute-sm">
                                <Inbox className="h-5 w-5 text-(--text-ink)" strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-2xl font-black font-display tracking-tight text-(--text-ink)">
                                    {data.pendingCount} to sort
                                </div>
                                <div className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                    <CurrencyText amount={data.pendingTotalSgd} /> unsorted
                                </div>
                            </div>
                            <Button type="button" variant="primary" size="sm" className="shrink-0" onClick={() => navigate("/inbox")}>
                                Sort Now
                            </Button>
                        </div>
                    </Card>
                </m.div>
            )}
        </AnimatePresence>
    );
}

export function InboxHomeCard() {
    return useInRouterContext() ? <InboxHomeCardInner /> : null;
}

export default InboxHomeCard;
