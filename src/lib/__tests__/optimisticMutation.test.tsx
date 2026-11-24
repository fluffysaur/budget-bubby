import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createOptimisticMutation } from "../optimisticMutation";

const KEY = ["finance", "things"] as const;

function setup(mutationFn: (n: number) => Promise<number>, settle = vi.fn()) {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData<number[]>(KEY, [1, 2]);
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
        () =>
            useMutation(
                createOptimisticMutation<number, number, string>(qc, {
                    mutationFn,
                    keys: () => [KEY],
                    apply: (client, n) => {
                        client.setQueryData<number[]>(KEY, (old) => [
                            ...(old ?? []),
                            n,
                        ]);
                        return "extra";
                    },
                    settle,
                }),
                qc,
            ),
        { wrapper },
    );
    return { qc, result, settle };
}

describe("createOptimisticMutation", () => {
    it("applies the optimistic change before the request resolves", async () => {
        let resolve!: (n: number) => void;
        const { qc, result } = setup(
            () => new Promise<number>((r) => (resolve = r)),
        );
        act(() => result.current.mutate(3));
        await waitFor(() => expect(qc.getQueryData(KEY)).toEqual([1, 2, 3]));
        await act(async () => resolve(3));
    });

    it("rolls back the cache when the request fails", async () => {
        const { qc, result } = setup(() => Promise.reject(new Error("boom")));
        await act(async () => {
            await result.current.mutateAsync(3).catch(() => undefined);
        });
        expect(qc.getQueryData(KEY)).toEqual([1, 2]);
    });

    it("calls settle after success with the apply result", async () => {
        const { result, settle } = setup(async (n) => n);
        await act(async () => {
            await result.current.mutateAsync(3);
        });
        expect(settle).toHaveBeenCalledWith(3, 3, null, "extra");
    });

    it("calls settle after failure with the error", async () => {
        const { result, settle } = setup(() => Promise.reject(new Error("x")));
        await act(async () => {
            await result.current.mutateAsync(3).catch(() => undefined);
        });
        expect(settle).toHaveBeenCalledTimes(1);
        expect(settle.mock.calls[0][2]).toBeInstanceOf(Error);
        expect(settle.mock.calls[0][3]).toBe("extra");
    });
});
