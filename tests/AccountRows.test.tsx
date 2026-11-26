import {
    render,
    screen,
    fireEvent,
    within,
    waitFor,
} from "@testing-library/react";
import { LazyMotion, domAnimation } from "motion/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AccountGroupList } from "../src/components/accounts/AccountGroupList";
import { TruncatedText } from "../src/components/ui/TruncatedText";
import { ACCOUNT_CHANGE_MODE_KEY } from "../src/hooks/useAccountChangeMode";
import { getAmountColumn } from "../src/lib/accountChange";
import { getTodayDateString, addMonths } from "../src/lib/dateUtils";
import type { Account, AccountSnapshot } from "../src/types/finance";

const base = {
    household_id: "h1",
    owner_id: "m1",
    type: "Cash",
    currency: "SGD",
    is_joint: false,
} as const;

const accounts: Account[] = [
    {
        ...base,
        id: "a",
        name: "Alpha",
        institution: "OCBC",
        balance: 1500,
        updated_at: new Date().toISOString(),
    },
    {
        ...base,
        id: "b",
        name: "Bravo",
        institution: "Demo Bank",
        balance: 500,
        updated_at: new Date(Date.now() - 41 * 86_400_000).toISOString(),
    },
];

const today = getTodayDateString();
const snap = (
    account_id: string,
    monthsAgo: number,
    balance: number,
): AccountSnapshot => ({
    id: `${account_id}-${monthsAgo}`,
    account_id,
    household_id: "h1",
    balance,
    snapshot_date: addMonths(today, -monthsAgo),
});
const snapshots = [
    snap("a", 3, 1000),
    snap("a", 0, 1500),
    snap("b", 3, 0),
    snap("b", 0, 500),
];

const renderList = (
    props: Partial<Parameters<typeof AccountGroupList>[0]> = {},
) =>
    render(
        // Same strict, animation-only provider as the app
        <LazyMotion features={domAnimation} strict>
            <AccountGroupList
                accounts={accounts}
                snapshots={snapshots}
                onEditAccount={() => {}}
                onReorderAccounts={() => Promise.resolve()}
                {...props}
            />
        </LazyMotion>,
    );

const changes = () =>
    screen.getAllByTestId("account-trend-change").map((e) => e.textContent);

beforeEach(() => localStorage.clear());

describe("$ / % toggle", () => {
    it("applies to rows and cards, and is remembered", () => {
        const first = renderList();
        expect(changes()).toEqual(["+S$500 6m", "+S$500 6m"]);

        fireEvent.click(
            screen.getByRole("button", { name: "Show change in percent" }),
        );
        // A zero starting balance has no percentage
        expect(changes()).toEqual(["+50.0% 6m", "— 6m"]);

        fireEvent.click(screen.getByRole("button", { name: "Cards View" }));
        expect(changes()).toEqual(["+50.0% 6m", "— 6m"]);
        expect(localStorage.getItem(ACCOUNT_CHANGE_MODE_KEY)).toBe("percent");

        first.unmount();
        renderList();
        expect(changes()).toEqual(["+50.0% 6m", "— 6m"]);
    });

    it("still works when storage throws", () => {
        const spy = vi
            .spyOn(Storage.prototype, "setItem")
            .mockImplementation(() => {
                throw new Error("blocked");
            });
        renderList();
        fireEvent.click(
            screen.getByRole("button", { name: "Show change in percent" }),
        );
        expect(changes()[0]).toBe("+50.0% 6m");
        spy.mockRestore();
    });
});

describe("rows", () => {
    it("shows a dashed placeholder and no change without history", () => {
        renderList({ snapshots: [] });
        expect(screen.getAllByTestId("account-trend-empty")).toHaveLength(2);
        expect(screen.queryByTestId("account-trend-change")).toBeNull();
    });

    it("shows a logo or an initial instead of the institution tag", () => {
        renderList();
        expect(screen.getByRole("img", { name: "OCBC" })).toHaveAttribute(
            "src",
            expect.stringContaining("logos/ocbc.png"),
        );
        expect(
            screen.getByRole("img", { name: "Demo Bank" }),
        ).toHaveTextContent("D");
        expect(screen.queryByText("Demo Bank")).toBeNull();
    });

    it("hides settings until edit mode", () => {
        renderList();
        expect(screen.queryByRole("button", { name: "Edit Alpha" })).toBeNull();
        expect(screen.queryByTestId("account-drag-handle")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Edit" }));

        expect(
            screen.getByRole("button", { name: "Edit Alpha" }),
        ).toBeInTheDocument();
        expect(screen.getAllByTestId("account-drag-handle")).toHaveLength(2);
        expect(screen.queryByTestId("account-trend-change")).toBeNull();
        expect(
            screen.queryByRole("button", { name: /update balance for/i }),
        ).toBeNull();
        // Faded out but still taking its space, so the toolbar doesn't shift
        expect(
            screen.queryByRole("button", { name: "Show change in percent" }),
        ).toBeNull();
        expect(
            screen.getByRole("button", {
                name: "Show change in percent",
                hidden: true,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Done" }),
        ).toBeInTheDocument();
    });

    it("sizes the amount column to the widest balance", () => {
        const short = getAmountColumn(accounts, new Map(), false);
        const long = getAmountColumn(
            [...accounts, { id: "c", balance: 12_345_678 }],
            new Map(),
            false,
        );
        expect(short).toEqual({ ch: "S$1,500.00".length, size: "regular" });
        expect(long).toEqual({
            ch: "S$12,345,678.00".length,
            size: "smallest",
        });
    });
});

describe("stale balances", () => {
    it.each(["Compact Table View", "Cards View"])(
        "explains the amber marker in %s",
        async (view) => {
            renderList();
            fireEvent.click(screen.getByRole("button", { name: view }));
            const triggers = screen.getAllByRole("button", {
                name: "Stale balance for Bravo",
            });
            // Rows: the avatar dot. Cards: only the (i) beside "Updated …"
            expect(triggers).toHaveLength(1);
            expect(
                screen.queryByRole("button", {
                    name: "Stale balance for Alpha",
                }),
            ).toBeNull();

            for (const trigger of triggers) {
                fireEvent.click(trigger);
                const tip = await screen.findByRole("tooltip");
                expect(
                    within(tip).getByText("Updated 41 days ago"),
                ).toBeInTheDocument();
                fireEvent.click(trigger);
                await waitFor(() =>
                    expect(screen.queryByRole("tooltip")).toBeNull(),
                );
            }
        },
    );
});

describe("reorder", () => {
    const move = (name: string) =>
        fireEvent.click(screen.getByRole("button", { name }));

    it("moves with the keyboard buttons and announces the position", () => {
        const onReorder = vi.fn(() => new Promise<void>(() => {}));
        renderList({ onReorderAccounts: onReorder });
        move("Edit");

        move("Move Bravo up");

        expect(onReorder).toHaveBeenCalledExactlyOnceWith(["b", "a"]);
        expect(
            screen.getByText("Bravo moved to position 1 of 2"),
        ).toHaveAttribute("aria-live", "polite");
    });

    it("does nothing at the ends", () => {
        const onReorder = vi.fn(() => Promise.resolve());
        renderList({ onReorderAccounts: onReorder });
        move("Edit");
        move("Move Alpha up");
        move("Move Bravo down");
        expect(onReorder).not.toHaveBeenCalled();
    });
});

describe("TruncatedText info button", () => {
    let scrollWidth = 0;
    beforeEach(() => {
        vi.spyOn(
            HTMLElement.prototype,
            "scrollWidth",
            "get",
        ).mockImplementation(() => scrollWidth);
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
            100,
        );
    });
    afterEach(() => vi.restoreAllMocks());

    it("is absent when the text fits", () => {
        scrollWidth = 90;
        render(<TruncatedText text="Short" infoButton />);
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("opens the full name without triggering the parent", async () => {
        scrollWidth = 300;
        const parent = vi.fn();
        render(
            <div onClick={parent}>
                <TruncatedText text="A very long account name" infoButton />
            </div>,
        );
        fireEvent.click(
            screen.getByRole("button", { name: /show full name/i }),
        );
        expect(await screen.findByRole("tooltip")).toHaveTextContent(
            "A very long account name",
        );
        expect(parent).not.toHaveBeenCalled();
    });

    it("stays off unless asked for", () => {
        scrollWidth = 300;
        render(<TruncatedText text="A very long account name" />);
        expect(screen.queryByRole("button")).toBeNull();
    });
});
