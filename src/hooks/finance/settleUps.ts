/** settleUps hooks. */

import { useQuery } from "@tanstack/react-query";
import { financeService } from "../../services/financeService";
import { keys } from "../../lib/queryKeys";
import type {
    BonusEventsResult,
    SettleUpsResult,
    BonusSplitShare,
} from "../../types/finance";

/** Bonus log entries plus whether the bonus tables exist yet. */
export function useBonusEventsQuery() {
    return useQuery<BonusEventsResult>({
        queryKey: keys.bonus.events,
        queryFn: () => financeService.getBonusEvents(),
    });
}

/** A member's default bonus split (seeded default when none is saved). */
export function useBonusSplitDefaultQuery(memberId?: string) {
    return useQuery<BonusSplitShare[]>({
        queryKey: keys.bonus.splitDefault(memberId),
        queryFn: () => financeService.getBonusSplitDefault(memberId as string),
        enabled: Boolean(memberId),
    });
}

/** Past settle-ups, newest first. `available: false` until the migration is applied. */
export function useSettleUpsQuery() {
    return useQuery<SettleUpsResult>({
        queryKey: keys.settleUps.all,
        queryFn: () => financeService.getSettleUps(),
    });
}
