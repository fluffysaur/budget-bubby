import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fullText } from "./helpers/fullText";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreditCardTrackerSection } from "../src/components/accounts/CreditCardTrackerSection";
import { CreditCardPaymentsWidget } from "../src/components/dashboard/CreditCardPaymentsWidget";
import {
    useCreditCardsQuery,
    useCreditCardStatementsQuery,
} from "../src/hooks/finance/cards";
import { useInvalidateFinance } from "../src/hooks/finance/shared";
import { financeService } from "../src/services/financeService";
import { mockFinanceService } from "../src/services/mockFinanceService";
import type { HouseholdMember } from "../src/types/finance";

const testMembers: HouseholdMember[] = [
    {
        id: "mem-00000000-0011",
        household_id: "hh-00000000-0001",
        display_name: "Alex",
        role: "owner",
    },
];

function HomePaymentsHarness({ today }: { today: string }) {
    const { data: cards = [] } = useCreditCardsQuery();
    const { data: statements = [] } = useCreditCardStatementsQuery();
    const { invalidateCreditCards } = useInvalidateFinance();

    return (
        <CreditCardPaymentsWidget
            cards={cards}
            statements={statements}
            today={today}
            onPaid={invalidateCreditCards}
        />
    );
}

describe("Credit Card Active Cycle & Bidirectional Sync", () => {
    beforeEach(() => {
        mockFinanceService.resetData();
        vi.useFakeTimers({ toFake: ["Date"] });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("aligns each card to its latest closed billing cycle in Active Cycle mode and toggles to month history", async () => {
        vi.setSystemTime(new Date("2026-10-15T04:00:00.000Z"));
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        render(
            <QueryClientProvider client={queryClient}>
                <CreditCardTrackerSection
                    members={testMembers}
                    perspective="household"
                />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText("DBS Altitude Visa")).toBeInTheDocument();
        });

        // On 2026-10-15: DBS (billing_day 15) closed 2026-10; UOB (20) & OCBC (28) are on 2026-09
        expect(
            screen.getByTestId("credit-card-period-label"),
        ).toHaveTextContent("Current");
        expect(
            screen.getByText(fullText(/^Statement Oct 2026$/)),
        ).toBeInTheDocument();
        expect(
            screen.getAllByText(fullText(/^Pending Sept? 2026$/)),
        ).toHaveLength(2);

        // Step < into October 2026 month history -> all 3 show October statements
        fireEvent.click(screen.getByRole("button", { name: "Previous Month" }));
        expect(
            screen.getByTestId("credit-card-period-label"),
        ).toHaveTextContent("October 2026");
        expect(
            screen.queryByText(fullText(/^Pending Sept? 2026$/)),
        ).not.toBeInTheDocument();
        expect(screen.getAllByText("Statement")).toHaveLength(3);

        // Step > back to Current
        fireEvent.click(screen.getByRole("button", { name: "Next Month" }));
        expect(
            screen.getByTestId("credit-card-period-label"),
        ).toHaveTextContent("Current");
        expect(
            screen.getByText(fullText(/^Statement Oct 2026$/)),
        ).toBeInTheDocument();
        expect(
            screen.getAllByText(fullText(/^Pending Sept? 2026$/)),
        ).toHaveLength(2);
    });

    it("syncs paid and unpaid status bidirectionally between Credit Cards tab and Home widget across different billing days", async () => {
        vi.setSystemTime(new Date("2026-11-12T04:00:00.000Z"));

        // Clear seed cards/statements by marking or adding fresh cards with distinct billing_days
        const existingCards = await financeService.getCreditCards();
        for (const c of existingCards) {
            await financeService.deleteCreditCard(c.id);
        }

        const cardEarly = await financeService.addCreditCard({
            owner_id: testMembers[0].id,
            name: "Early Cycle Card",
            bank: "DBS",
            billing_day: 10,
            due_day: 28,
        });
        const cardLate = await financeService.addCreditCard({
            owner_id: testMembers[0].id,
            name: "Late Cycle Card",
            bank: "OCBC",
            billing_day: 25,
            due_day: 10,
        });

        // Log unpaid statements for each card's latest closed cycle on 2026-11-12:
        // Early (billing_day 10) -> 2026-11; Late (billing_day 25) -> 2026-10
        await financeService.upsertCreditCardStatement({
            card_id: cardEarly.id,
            month: "2026-11",
            statement_amount: 150,
            due_date: "2026-11-28",
            is_paid: false,
        });
        await financeService.upsertCreditCardStatement({
            card_id: cardLate.id,
            month: "2026-10",
            statement_amount: 240,
            due_date: "2026-11-10",
            is_paid: false,
        });

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        render(
            <QueryClientProvider client={queryClient}>
                <HomePaymentsHarness today="2026-11-12" />
                <CreditCardTrackerSection
                    members={testMembers}
                    perspective="household"
                />
            </QueryClientProvider>,
        );

        // Both cards appear in Home widget & Credit Cards tab on their respective cycles
        await waitFor(() => {
            expect(
                screen.getByTestId(`cc-cycle-${cardEarly.id}:2026-11`),
            ).toBeInTheDocument();
            expect(
                screen.getByTestId(`cc-cycle-${cardLate.id}:2026-10`),
            ).toBeInTheDocument();
        });
        expect(
            screen.getByText(fullText(/^Statement Nov 2026$/)),
        ).toBeInTheDocument();
        expect(
            screen.getByText(fullText(/^Statement Oct 2026$/)),
        ).toBeInTheDocument();

        // 1. Mark Late Cycle Card paid in Credit Cards tab -> disappears from Home widget
        fireEvent.click(
            screen.getByRole("button", {
                name: /Mark Late Cycle Card statement as Paid/i,
            }),
        );
        fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

        await waitFor(() => {
            expect(
                screen.queryByTestId(`cc-cycle-${cardLate.id}:2026-10`),
            ).not.toBeInTheDocument();
            expect(
                screen.getByRole("button", {
                    name: /Mark Late Cycle Card statement as Unpaid/i,
                }),
            ).toBeInTheDocument();
        });

        // 2. Mark Late Cycle Card unpaid in Credit Cards tab -> reappears in Home widget
        fireEvent.click(
            screen.getByRole("button", {
                name: /Mark Late Cycle Card statement as Unpaid/i,
            }),
        );

        await waitFor(() => {
            expect(
                screen.getByTestId(`cc-cycle-${cardLate.id}:2026-10`),
            ).toBeInTheDocument();
        });

        // 3. Mark both cards paid from Home widget -> Credit Cards tab updates & Home shows settled state
        fireEvent.click(
            screen.getByRole("button", { name: /Mark Early Cycle Card paid/i }),
        );
        fireEvent.click(
            await screen.findByRole("button", { name: "Mark Paid" }),
        );

        await waitFor(() => {
            expect(
                screen.getByRole("button", {
                    name: /Mark Early Cycle Card statement as Unpaid/i,
                }),
            ).toBeInTheDocument();
        });

        fireEvent.click(
            screen.getByRole("button", { name: /Mark Late Cycle Card paid/i }),
        );
        fireEvent.click(
            await screen.findByRole("button", { name: "Mark Paid" }),
        );

        await waitFor(() => {
            expect(
                screen.getByRole("button", {
                    name: /Mark Late Cycle Card statement as Unpaid/i,
                }),
            ).toBeInTheDocument();
            expect(screen.getByText("Paid for cycle")).toBeInTheDocument();
            expect(
                within(screen.getByTestId("cc-cycle-settled")).getByText(
                    "2 cards",
                ),
            ).toBeInTheDocument();
        });
    });
});
