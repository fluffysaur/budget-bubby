import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { keys } from "../queryKeys";
import {
    render,
    screen,
    renderHook,
    act,
    waitFor,
} from "@testing-library/react";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { LazyMotion, domAnimation } from "motion/react";
import type { ReactNode } from "react";
import { createAppQueryClient } from "../queryClient";
import { onAppEvent, type ErrorToastDetail } from "../appEvents";
import { useBulkUpdateAccountBalancesMutation } from "../../hooks/finance/accounts";
import { financeService } from "../../services/financeService";
import { DelightHost } from "../../components/bubby/DelightHost";
import type { Account } from "../../types/finance";

vi.mock("../../hooks/useActivityCheckins", () => ({
    useActivityCheckins: () => undefined,
}));

vi.mock("../../hooks/useBubby", () => ({
    useBubby: () => ({
        isReady: false,
        weeklyQuestsReady: false,
        monthlyQuestsReady: false,
        body: "regular",
        mood: "calm",
        penguins: [],
        sleepy: false,
        fedToday: false,
        dailyQuests: [],
        weeklyQuests: [],
        monthlyQuests: [],
        today: "2026-11-24",
        me: null,
        members: [],
    }),
}));

const INITIAL_ACCOUNTS: Account[] = [
    {
        id: "acc-1",
        household_id: "hh-1",
        name: "DBS Multiplier",
        type: "Cash",
        balance: 5000,
        currency: "SGD",
        owner_id: "mem-1",
        is_joint: false,
        updated_at: "2026-11-20T00:00:00.000Z",
    },
    {
        id: "acc-2",
        household_id: "hh-1",
        name: "OCBC 360",
        type: "Cash",
        balance: 2500,
        currency: "SGD",
        owner_id: "mem-1",
        is_joint: false,
        updated_at: "2026-11-20T00:00:00.000Z",
    },
];

describe("MutationCache error toast and optimistic rollback", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("fires the error toast and rolls back cached balances when bulkUpdateAccountBalances fails", async () => {
        const testClient = createAppQueryClient();
        testClient.setQueryData(
            keys.accounts.list("household"),
            INITIAL_ACCOUNTS,
        );

        let rejectMutation!: (err: Error) => void;
        vi.spyOn(
            financeService,
            "bulkUpdateAccountBalances",
        ).mockImplementation(
            () =>
                new Promise<Account[]>((_resolve, reject) => {
                    rejectMutation = reject;
                }),
        );

        const firedEvents: ErrorToastDetail[] = [];
        const off = onAppEvent("app:error", (detail) => {
            firedEvents.push(detail);
        });

        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={testClient}>
                <LazyMotion features={domAnimation}>
                    <DelightHost />
                    {children}
                </LazyMotion>
            </QueryClientProvider>
        );

        const { result } = renderHook(
            () => useBulkUpdateAccountBalancesMutation(),
            { wrapper },
        );

        let caughtError: Error | null = null;
        act(() => {
            void result.current
                .mutateAsync({
                    updates: [
                        { accountId: "acc-1", balance: 9999 },
                        { accountId: "acc-2", balance: 8888 },
                    ],
                })
                .catch((err: Error) => {
                    caughtError = err;
                });
        });

        await waitFor(() => {
            const optimistic = testClient.getQueryData<Account[]>(
                keys.accounts.list("household"),
            );
            expect(optimistic?.[0]?.balance).toBe(9999);
            expect(optimistic?.[1]?.balance).toBe(8888);
        });

        await act(async () => {
            rejectMutation(new Error("Network timeout"));
        });

        await waitFor(() => {
            expect(caughtError?.message).toBe("Network timeout");
        });

        const restored = testClient.getQueryData<Account[]>(
            keys.accounts.list("household"),
        );
        expect(restored).toEqual(INITIAL_ACCOUNTS);

        expect(firedEvents).toEqual([
            { title: "Save failed", subtitle: "Network timeout" },
        ]);

        const alert = await screen.findByTestId("error-toast");
        expect(alert).toHaveAttribute("role", "alert");
        expect(alert).toHaveTextContent("Save failed");
        expect(alert).toHaveTextContent("Network timeout");

        off();
        testClient.clear();
    });

    it("supports per-mutation opt-out via meta.skipErrorToast", async () => {
        const testClient = createAppQueryClient();
        const firedEvents: ErrorToastDetail[] = [];
        const off = onAppEvent("app:error", (detail) => {
            firedEvents.push(detail);
        });

        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={testClient}>
                {children}
            </QueryClientProvider>
        );

        const { result } = renderHook(
            () =>
                useMutation({
                    mutationFn: async () => {
                        throw new Error("Handled locally");
                    },
                    meta: { skipErrorToast: true },
                }),
            { wrapper },
        );

        await expect(
            act(async () => {
                await result.current.mutateAsync();
            }),
        ).rejects.toThrow("Handled locally");

        expect(firedEvents).toEqual([]);

        render(
            <LazyMotion features={domAnimation}>
                <DelightHost />
            </LazyMotion>,
        );
        expect(screen.queryByTestId("error-toast")).not.toBeInTheDocument();

        off();
        testClient.clear();
    });
});
