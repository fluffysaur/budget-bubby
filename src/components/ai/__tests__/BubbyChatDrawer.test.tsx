import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, domAnimation } from "motion/react";
import { HouseholdProvider } from "../../../context/HouseholdContext";
import { SettingsProvider } from "../../../context/SettingsContext";
import { PrivacyProvider } from "../../../context/PrivacyContext";
import { AuthProvider } from "../../../context/AuthContext";
import { BubbyChatDrawer } from "../BubbyChatDrawer";
import * as geminiClient from "../../../services/ai/geminiClient";
import { financeService } from "../../../services/financeService";

function renderDrawer(isOpen = true, onClose = vi.fn()) {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return {
        onClose,
        qc,
        ...render(
            <LazyMotion features={domAnimation} strict>
                <QueryClientProvider client={qc}>
                    <AuthProvider initialAuthenticated>
                        <HouseholdProvider>
                            <SettingsProvider>
                                <PrivacyProvider>
                                    <BubbyChatDrawer
                                        isOpen={isOpen}
                                        onClose={onClose}
                                    />
                                </PrivacyProvider>
                            </SettingsProvider>
                        </HouseholdProvider>
                    </AuthProvider>
                </QueryClientProvider>
            </LazyMotion>,
        ),
    };
}

describe("BubbyChatDrawer", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("shows the Add Key empty state when no Gemini API key is configured", () => {
        renderDrawer(true);
        expect(screen.getByTestId("bubby-no-key-state")).toBeInTheDocument();
        expect(screen.getByText("Add Key")).toBeInTheDocument();
        expect(screen.getByTestId("bubby-setup-key-cta")).toBeInTheDocument();
    });

    it("executes read tools automatically and renders action confirmation cards for mutations", async () => {
        geminiClient.setGeminiApiKey("AIza-test-key");

        vi.spyOn(financeService, "getHouseholdOverview").mockResolvedValue({
            household: { id: "hh-1", name: "Demo Home", currency: "SGD" },
            members: [
                {
                    id: "mem-1",
                    household_id: "hh-1",
                    display_name: "Alex",
                    role: "owner",
                },
            ],
            totalAssets: 52000,
            trueNetWorth: 50000,
            settlementSummary: {
                netBalance: 0,
                debtorId: null,
                creditorId: null,
                settlementText: "All settled up",
                member1OwesMember2: 0,
                member2OwesMember1: 0,
            },
            activeGoals: [],
            upcomingBills: [],
        });
        vi.spyOn(financeService, "getCategories").mockResolvedValue([
            {
                id: "cat-food",
                household_id: "hh-1",
                name: "Food & Dining",
                color: "#f97316",
                icon: "Utensils",
                is_system: false,
            },
        ]);
        const addExpenseSpy = vi
            .spyOn(financeService, "addExpense")
            .mockResolvedValue({
                id: "exp-1",
                household_id: "hh-1",
                payer_id: "mem-1",
                category_id: "cat-food",
                date: "2026-11-22",
                item: "Ramen",
                amount: 14.5,
                is_shared: false,
                split_ratio: 0,
                settled: false,
            });

        const streamSpy = vi
            .spyOn(geminiClient, "streamGeminiTurn")
            .mockResolvedValueOnce({
                text: "",
                functionCalls: [
                    {
                        name: "proposeExpense",
                        args: {
                            item: "Ramen",
                            amount: 14.5,
                            categoryName: "Food & Dining",
                        },
                    },
                ],
            });

        renderDrawer(true);

        const input = screen.getByTestId("bubby-chat-input");
        fireEvent.change(input, { target: { value: "Log S$14.50 ramen" } });
        fireEvent.click(screen.getByTestId("bubby-chat-send-btn"));

        await waitFor(() => {
            expect(
                screen.getByTestId("action-card-proposeExpense"),
            ).toBeInTheDocument();
        });

        expect(streamSpy).toHaveBeenCalledTimes(1);
        expect(addExpenseSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId("action-confirm-btn"));

        await waitFor(() => {
            expect(addExpenseSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    item: "Ramen",
                    amount: 14.5,
                }),
            );
            expect(screen.getByText("Saved")).toBeInTheDocument();
        });
    });
});
