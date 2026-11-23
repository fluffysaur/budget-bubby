import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, domAnimation } from "motion/react";
import { HouseholdProvider } from "../../../context/HouseholdContext";
import { SettingsProvider } from "../../../context/SettingsContext";
import { PrivacyProvider } from "../../../context/PrivacyContext";
import { AuthProvider } from "../../../context/AuthContext";
import { BubbyChatDrawer } from "../BubbyChatDrawer";
import * as aiProviders from "../../../services/ai/providers";
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

    it("shows the Add Key empty state with neutral copy when no AI key is configured", () => {
        renderDrawer(true);
        const noKey = screen.getByTestId("bubby-no-key-state");
        expect(noKey).toBeInTheDocument();
        expect(screen.getByText("Add Key")).toBeInTheDocument();
        expect(noKey).not.toHaveTextContent(/gemini/i);
        expect(screen.getByTestId("bubby-setup-key-cta")).toBeInTheDocument();
    });

    it("executes read tools automatically and renders action confirmation cards for mutations", async () => {
        aiProviders.setActiveAiProvider("anthropic");
        aiProviders.setProviderApiKey("anthropic", "sk-ant-test-key");

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
            .spyOn(aiProviders, "streamAiTurn")
            .mockResolvedValueOnce({
                text: "",
                toolCalls: [
                    {
                        id: "tc-1",
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
        expect(streamSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "anthropic",
                apiKey: "sk-ant-test-key",
            }),
        );
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

    it("forces a final synthesis turn when max tool rounds are exhausted", async () => {
        aiProviders.setActiveAiProvider("openrouter");
        aiProviders.setProviderApiKey("openrouter", "sk-or-v1-test");

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

        const toolOnlyTurn = {
            text: "",
            toolCalls: [
                {
                    id: "tc-overview",
                    name: "getHouseholdOverview",
                    args: {},
                },
            ],
        };

        const streamSpy = vi
            .spyOn(aiProviders, "streamAiTurn")
            .mockResolvedValueOnce(toolOnlyTurn)
            .mockResolvedValueOnce(toolOnlyTurn)
            .mockResolvedValueOnce(toolOnlyTurn)
            .mockResolvedValueOnce(toolOnlyTurn)
            .mockResolvedValueOnce(toolOnlyTurn)
            .mockImplementationOnce(async (opts) => {
                opts.onTextDelta?.("Your net worth is S$50,000.00.");
                return {
                    text: "Your net worth is S$50,000.00.",
                    toolCalls: [],
                };
            });

        renderDrawer(true);

        const input = screen.getByTestId("bubby-chat-input");
        fireEvent.change(input, {
            target: { value: "Summarize my accounts & net worth" },
        });
        fireEvent.click(screen.getByTestId("bubby-chat-send-btn"));

        await waitFor(() => {
            expect(
                screen.getByText("Your net worth is S$50,000.00."),
            ).toBeInTheDocument();
        });

        expect(streamSpy).toHaveBeenCalledTimes(6);
        const finalCallOpts = streamSpy.mock.calls[5]?.[0];
        expect(finalCallOpts?.tools).toBeUndefined();
    });

    it("shows an error alert instead of 'Done.' when the AI returns an empty response", async () => {
        aiProviders.setActiveAiProvider("openrouter");
        aiProviders.setProviderApiKey("openrouter", "sk-or-v1-test");

        vi.spyOn(aiProviders, "streamAiTurn").mockResolvedValueOnce({
            text: "",
            toolCalls: [],
        });

        renderDrawer(true);

        const input = screen.getByTestId("bubby-chat-input");
        fireEvent.change(input, {
            target: { value: "Summarize my accounts & net worth" },
        });
        fireEvent.click(screen.getByTestId("bubby-chat-send-btn"));

        await waitFor(() => {
            expect(
                screen.getByText(/empty response/i),
            ).toBeInTheDocument();
        });
        expect(screen.queryByText("Done.")).not.toBeInTheDocument();
    });
});
