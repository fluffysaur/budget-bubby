/** cards hooks. */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { financeService } from "../../services/financeService";
import { keys } from "../../lib/queryKeys";
import type {
    CreditCard,
    CreditCardStatement,
    DailyCheckin,
} from "../../types/finance";
import { useSafeQueryClient } from "./shared";

export function useCreditCardsQuery() {
    const queryClient = useSafeQueryClient();
    return useQuery<CreditCard[]>(
        {
            queryKey: keys.cards.all,
            queryFn: () => financeService.getCreditCards(),
        },
        queryClient,
    );
}

export function useCreditCardStatementsQuery(month?: string) {
    const queryClient = useSafeQueryClient();
    return useQuery<CreditCardStatement[]>(
        {
            queryKey: keys.cards.statements(month),
            queryFn: () => financeService.getCreditCardStatements(month),
            placeholderData: keepPreviousData,
        },
        queryClient,
    );
}

export function useDailyCheckinsQuery(memberId?: string) {
    const queryClient = useSafeQueryClient();
    return useQuery<DailyCheckin[]>(
        {
            queryKey: keys.dailyCheckins.list(memberId),
            queryFn: () => financeService.getDailyCheckins(memberId),
            placeholderData: keepPreviousData,
        },
        queryClient,
    );
}
