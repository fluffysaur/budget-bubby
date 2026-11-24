/**
 * Creates any missing CPF OA/SA/MA account for each household member, so
 * every member has exactly three. Runs once per member and kind per session;
 * a unique index on (owner_id, cpf_kind) stops two devices adding a duplicate.
 */

import { useEffect } from "react";
import { useHousehold } from "../context/HouseholdContext";
import { missingCpfAccounts } from "../lib/cpfAccounts";
import { financeService } from "../services/financeService";
import { useAccountsQuery } from "./finance/accounts";
import { useInvalidateFinance } from "./finance/shared";

const attempted = new Set<string>();

export function useEnsureCpfAccounts(): void {
    const { members } = useHousehold();
    const {
        data: accounts,
        isSuccess,
        isPlaceholderData,
    } = useAccountsQuery("household");
    const { invalidateAccounts } = useInvalidateFinance();

    useEffect(() => {
        if (!isSuccess || isPlaceholderData || !accounts) return;
        if (members.length === 0) return;
        const toCreate = missingCpfAccounts(members, accounts).filter(
            (a) => !attempted.has(`${a.owner_id}:${a.cpf_kind}`),
        );
        if (toCreate.length === 0) return;
        for (const a of toCreate) attempted.add(`${a.owner_id}:${a.cpf_kind}`);

        void Promise.allSettled(
            toCreate.map((a) => financeService.createAccount(a)),
        ).then((results) => {
            if (results.some((r) => r.status === "fulfilled")) {
                invalidateAccounts();
            }
        });
    }, [accounts, isSuccess, isPlaceholderData, members, invalidateAccounts]);
}
