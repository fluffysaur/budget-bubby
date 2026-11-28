import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ExpenseTrendsCard } from "../src/components/expenses/ExpenseTrendsCard";
import { SpendTagChips } from "../src/components/expenses/SpendTagChips";
import { ActiveTagSummary } from "../src/components/expenses/ActiveTagSummary";
import { formatSGD } from "../src/lib/currency";
import type {
    CategoryAverageMetric,
    Category,
    Expense,
    ExpenseTrendsSummary,
} from "../src/types/finance";

vi.mock("recharts", async (importOriginal) => {
    const original = await importOriginal<typeof import("recharts")>();
    return {
        ...original,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
            <div style={{ width: 600, height: 140 }}>{children}</div>
        ),
    };
});

function cat(
    id: string,
    currentMonth: number,
    averageMonthly: number,
): CategoryAverageMetric {
    return {
        categoryId: id,
        categoryName: id,
        color: "#abcdef",
        currentMonth,
        averageMonthly,
    };
}

function trends(
    categoryAverages: CategoryAverageMetric[],
    withHistory = true,
): ExpenseTrendsSummary {
    return {
        monthlySeries: [
            "2026-06",
            "2026-07",
            "2026-08",
            "2026-09",
            "2026-10",
            "2026-11",
        ].map((month, i) => ({
            month,
            label: month,
            totalSpent: withHistory ? 100 * (i + 1) : 0,
            recurringSpent: 0,
            byCategory: {},
        })),
        averageMonthlyTotal: 300,
        rolling3MonthAvg: 400,
        rolling6MonthAvg: 350,
        currentMonthTotal: 600,
        vsAverageDelta: 200,
        categoryAverages,
    };
}

describe("ExpenseTrendsCard", () => {
    it("shows the change vs average as whole-percent text", () => {
        render(<ExpenseTrendsCard trends={trends([cat("a", 110, 100)])} />);
        // vsAverageDelta 200 on a 400 average
        expect(screen.getByTestId("trend-delta")).toHaveTextContent(
            "+50% vs avg S$400",
        );
    });

    it("lists the top 3 over-average categories by overage", () => {
        render(
            <ExpenseTrendsCard
                trends={trends([
                    cat("a", 110, 100), // +10
                    cat("b", 500, 300), // +200
                    cat("c", 260, 200), // +60
                    cat("d", 90, 100), // under
                    cat("e", 150, 100), // +50
                ])}
            />,
        );
        expect(screen.getByText("Over average")).toBeInTheDocument();
        expect(
            screen.getByLabelText("Spend over 6 months"),
        ).toBeInTheDocument();
        const items = screen.getAllByTestId(/^trend-cat-/);
        expect(items.map((i) => i.getAttribute("data-testid"))).toEqual([
            "trend-cat-b",
            "trend-cat-c",
            "trend-cat-e",
        ]);
        fireEvent.click(screen.getByRole("button", { name: "See all" }));
        expect(screen.getAllByTestId(/^trend-cat-/)).toHaveLength(5);
        fireEvent.click(screen.getByRole("button", { name: "Show less" }));
        expect(screen.getAllByTestId(/^trend-cat-/)).toHaveLength(3);
    });

    it("falls back to top categories when none are over", () => {
        render(
            <ExpenseTrendsCard
                trends={trends([
                    cat("a", 10, 100),
                    cat("b", 80, 100),
                    cat("c", 50, 100),
                    cat("d", 20, 100),
                ])}
            />,
        );
        expect(screen.getByText("Top categories")).toBeInTheDocument();
        const items = screen.getAllByTestId(/^trend-cat-/);
        expect(items.map((i) => i.getAttribute("data-testid"))).toEqual([
            "trend-cat-b",
            "trend-cat-c",
            "trend-cat-d",
        ]);
    });

    it("shows an empty state without history and omits categories", () => {
        render(<ExpenseTrendsCard trends={trends([], false)} />);
        expect(screen.getByText("No History")).toBeInTheDocument();
        expect(screen.queryByText("Top categories")).not.toBeInTheDocument();
    });
});

const categories = [
    { id: "food", name: "Food", color: "#111111" },
    { id: "fun", name: "Fun", color: "#222222" },
] as Category[];

function exp(
    id: string,
    date: string,
    amount: number,
    tags: string[],
    category_id = "food",
): Expense {
    return {
        id,
        household_id: "hh",
        payer_id: "m1",
        category_id,
        date,
        item: id,
        amount,
        is_shared: false,
        split_ratio: 0,
        settled: false,
        tags,
    } as Expense;
}

const expenses = [
    exp("1", "2026-09-01", 100, ["Reno"]),
    exp("2", "2026-11-02", 40, ["Trip"]),
    exp("3", "2026-11-03", 60.5, ["Trip"], "fun"),
];

describe("SpendTagChips", () => {
    it("renders recent-first chips and toggles selection", () => {
        const onSelect = vi.fn();
        const { rerender } = render(
            <SpendTagChips
                expenses={expenses}
                categories={categories}
                onSelectTag={onSelect}
            />,
        );
        const chips = screen.getAllByRole("button");
        expect(chips[0]).toHaveTextContent("#Trip");
        expect(chips[0]).toHaveTextContent("S$101");
        expect(chips[1]).toHaveTextContent("#Reno");
        expect(chips[0]).toHaveAttribute("aria-pressed", "false");

        fireEvent.click(chips[1]);
        expect(onSelect).toHaveBeenCalledWith("Reno");

        rerender(
            <SpendTagChips
                expenses={expenses}
                categories={categories}
                activeTag="trip"
                onSelectTag={onSelect}
            />,
        );
        expect(screen.getByTestId("tag-chip-Trip")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
    });

    it("renders nothing without tags", () => {
        const { container } = render(
            <SpendTagChips
                expenses={[exp("x", "2026-11-01", 5, [])]}
                onSelectTag={vi.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });
});

describe("ActiveTagSummary", () => {
    it("shows total, count and top categories, and clears", () => {
        const onClear = vi.fn();
        render(
            <ActiveTagSummary
                tag="trip"
                expenses={expenses}
                categories={categories}
                onClear={onClear}
            />,
        );
        const summary = screen.getByTestId("active-tag-summary");
        expect(within(summary).getByText("#trip")).toBeInTheDocument();
        expect(within(summary).getByText(formatSGD(100.5))).toBeInTheDocument();
        expect(summary).toHaveTextContent("2 expenses");
        expect(within(summary).getByText("Fun")).toBeInTheDocument();
        fireEvent.click(
            within(summary).getByRole("button", { name: "Clear tag filter" }),
        );
        expect(onClear).toHaveBeenCalled();
    });
});
