import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useReorderAccountsMutation } from "../src/hooks/finance/accounts";
import { financeService } from "../src/services/financeService";
import { keys } from "../src/lib/queryKeys";

describe("useReorderAccountsMutation", () => {
    afterEach(() => vi.restoreAllMocks());

    it("reorders optimistically and rolls back on error", async () => {
        let fail: (error: Error) => void = () => {};
        vi.spyOn(financeService, "reorderAccounts").mockReturnValue(
            new Promise<void>((_resolve, reject) => {
                fail = reject;
            }),
        );
        const client = new QueryClient();
        const key = keys.accounts.list("household");
        client.setQueryData(key, [{ id: "a" }, { id: "b" }]);
        const ids = () =>
            client.getQueryData<{ id: string }[]>(key)?.map((a) => a.id);

        const { result } = renderHook(() => useReorderAccountsMutation(), {
            wrapper: ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={client}>
                    {children}
                </QueryClientProvider>
            ),
        });
        act(() => result.current.mutate(["b", "a"]));
        await waitFor(() => expect(ids()).toEqual(["b", "a"]));

        act(() => fail(new Error("offline")));
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(ids()).toEqual(["a", "b"]);
    });
});

describe("useReorderAccountsMutation queue", () => {
    afterEach(() => vi.restoreAllMocks());

    it("runs saves one at a time", async () => {
        const resolvers: Array<() => void> = [];
        const spy = vi
            .spyOn(financeService, "reorderAccounts")
            .mockImplementation(
                () => new Promise<void>((resolve) => resolvers.push(resolve)),
            );
        const client = new QueryClient();
        const { result } = renderHook(() => useReorderAccountsMutation(), {
            wrapper: ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={client}>
                    {children}
                </QueryClientProvider>
            ),
        });

        act(() => {
            result.current.mutate(["b", "a"]);
            result.current.mutate(["a", "b"]);
        });
        await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
        act(() => resolvers[0]());
        await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
        expect(spy).toHaveBeenLastCalledWith(["a", "b"]);
    });
});
