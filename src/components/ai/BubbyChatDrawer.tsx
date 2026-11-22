/**
 * Conversational AI assistant drawer ("Bubby AI") with provider-agnostic streaming.
 * Supports automatic read-only budget queries with streaming responses and
 * safe user-confirmed action cards for financial mutations.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Sparkles,
    X,
    Send,
    Settings,
    Trash2,
    Loader2,
} from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import {
    DURATION,
    EASE_IN_FAST,
    EASE_OUT_SOFT,
    fadeRise,
} from "../../lib/motion";
import { useHousehold } from "../../context/HouseholdContext";
import { useSettings } from "../../context/SettingsContext";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import { useSafeQueryClient } from "../../hooks/useFinanceQueries";
import { generateUuid } from "../../lib/uuid";
import {
    AI_CONFIG_CHANGED_EVENT,
    AI_PROVIDER_META,
    getActiveAiConfig,
    streamAiTurn,
    type AiMessage,
    type AiProviderId,
    type AiToolResult,
} from "../../services/ai/providers";
import {
    BUBBY_TOOLS,
    buildBubbySystemInstruction,
    buildProposedAction,
    executeProposedAction,
    executeReadTool,
    isProposalTool,
    isReadTool,
    type ProposedAction,
} from "../../services/ai/aiTools";
import { ActionConfirmationCard } from "./ActionConfirmationCard";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    proposedActions?: ProposedAction[];
    isStreaming?: boolean;
    activeToolLabel?: string;
    error?: string;
}

export interface BubbyChatDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const STARTER_PROMPTS = [
    "How much budget is left this month?",
    "Summarize my accounts & net worth",
    "Top expenses this month",
    "Log S$8.50 lunch today",
] as const;

const TOOL_LABELS: Record<string, string> = {
    getHouseholdOverview: "Checking overview...",
    getAccounts: "Checking accounts...",
    getExpenses: "Checking expenses...",
    getMonthlyBudget: "Checking budget...",
    getGoals: "Checking goals...",
    proposeExpense: "Preparing expense...",
    proposeBalanceUpdate: "Preparing balance update...",
    proposeBudgetAdjustment: "Preparing budget adjustment...",
};

const MAX_TOOL_ROUNDS = 5;

export function BubbyChatDrawer({ isOpen, onClose }: BubbyChatDrawerProps) {
    const { perspective, activeMember } = useHousehold();
    const { openSettings } = useSettings();
    const { me } = useLoggedInMember();
    const queryClient = useSafeQueryClient();

    const [hasApiKey, setHasApiKey] = useState<boolean>(
        () => getActiveAiConfig().apiKey.length > 0,
    );
    const [activeProvider, setActiveProvider] = useState<AiProviderId>(
        () => getActiveAiConfig().provider,
    );
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isSending, setIsSending] = useState(false);

    const historyRef = useRef<AiMessage[]>([]);
    const abortRef = useRef<AbortController | null>(null);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    const refreshKeyStatus = useCallback(() => {
        const config = getActiveAiConfig();
        setHasApiKey(config.apiKey.length > 0);
        setActiveProvider(config.provider);
    }, []);

    useEffect(() => {
        if (isOpen) {
            refreshKeyStatus();
        }
    }, [isOpen, refreshKeyStatus]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.addEventListener(AI_CONFIG_CHANGED_EVENT, refreshKeyStatus);
        return () => {
            window.removeEventListener(
                AI_CONFIG_CHANGED_EVENT,
                refreshKeyStatus,
            );
        };
    }, [refreshKeyStatus]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (scrollEndRef.current?.scrollIntoView) {
            scrollEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    const handleClearChat = () => {
        abortRef.current?.abort();
        setIsSending(false);
        setMessages([]);
        historyRef.current = [];
    };

    const handleConfirmAction = useCallback(
        async (messageId: string, action: ProposedAction) => {
            try {
                await executeProposedAction(action, queryClient);
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === messageId
                            ? {
                                  ...msg,
                                  proposedActions: msg.proposedActions?.map(
                                      (a) =>
                                          a.id === action.id
                                              ? {
                                                    ...a,
                                                    status: "confirmed",
                                                    errorMessage: undefined,
                                                }
                                              : a,
                                  ),
                              }
                            : msg,
                    ),
                );
            } catch (err) {
                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : "Failed to save changes.";
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === messageId
                            ? {
                                  ...msg,
                                  proposedActions: msg.proposedActions?.map(
                                      (a) =>
                                          a.id === action.id
                                              ? {
                                                    ...a,
                                                    status: "error",
                                                    errorMessage,
                                                }
                                              : a,
                                  ),
                              }
                            : msg,
                    ),
                );
            }
        },
        [queryClient],
    );

    const handleCancelAction = useCallback(
        (messageId: string, actionId: string) => {
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === messageId
                        ? {
                              ...msg,
                              proposedActions: msg.proposedActions?.map((a) =>
                                  a.id === actionId
                                      ? { ...a, status: "cancelled" }
                                      : a,
                              ),
                          }
                        : msg,
                ),
            );
        },
        [],
    );

    const handleSend = useCallback(
        async (rawText?: string) => {
            const text = (rawText ?? inputValue).trim();
            if (!text || isSending) return;

            const { provider, apiKey, model } = getActiveAiConfig();
            if (!apiKey) {
                setHasApiKey(false);
                return;
            }

            setInputValue("");
            setIsSending(true);

            const userMessageId = generateUuid();
            const assistantMessageId = generateUuid();

            setMessages((prev) => [
                ...prev,
                { id: userMessageId, role: "user", content: text },
                {
                    id: assistantMessageId,
                    role: "assistant",
                    content: "",
                    isStreaming: true,
                },
            ]);

            const nextMessages: AiMessage[] = [
                ...historyRef.current,
                { role: "user", text },
            ];

            const controller = new AbortController();
            abortRef.current = controller;

            const toolContext = {
                perspective,
                activeMemberId: activeMember?.id ?? me?.id,
            };
            const systemInstruction = buildBubbySystemInstruction(toolContext);

            try {
                let accumulatedText = "";
                const collectedProposals: ProposedAction[] = [];

                for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
                    const turnResult = await streamAiTurn({
                        provider,
                        apiKey,
                        model,
                        messages: nextMessages,
                        systemInstruction,
                        tools: BUBBY_TOOLS,
                        signal: controller.signal,
                        onTextDelta: (delta) => {
                            accumulatedText += delta;
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === assistantMessageId
                                        ? {
                                              ...msg,
                                              content: accumulatedText,
                                              activeToolLabel: undefined,
                                          }
                                        : msg,
                                ),
                            );
                        },
                    });

                    if (turnResult.text || turnResult.toolCalls.length > 0) {
                        nextMessages.push({
                            role: "assistant",
                            text: turnResult.text || undefined,
                            toolCalls:
                                turnResult.toolCalls.length > 0
                                    ? turnResult.toolCalls
                                    : undefined,
                        });
                    }

                    if (turnResult.toolCalls.length === 0) {
                        break;
                    }

                    const readCalls = turnResult.toolCalls.filter((tc) =>
                        isReadTool(tc.name),
                    );
                    const proposalCalls = turnResult.toolCalls.filter((tc) =>
                        isProposalTool(tc.name),
                    );

                    const toolResults: AiToolResult[] = [];

                    for (const call of readCalls) {
                        if (!isReadTool(call.name)) continue;
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === assistantMessageId
                                    ? {
                                          ...msg,
                                          activeToolLabel:
                                              TOOL_LABELS[call.name] ??
                                              "Looking up data...",
                                      }
                                    : msg,
                            ),
                        );
                        try {
                            const result = await executeReadTool(
                                call.name,
                                call.args,
                                toolContext,
                            );
                            toolResults.push({
                                toolCallId: call.id,
                                name: call.name,
                                result,
                            });
                        } catch (err) {
                            toolResults.push({
                                toolCallId: call.id,
                                name: call.name,
                                result: {
                                    error:
                                        err instanceof Error
                                            ? err.message
                                            : "Tool execution failed",
                                },
                            });
                        }
                    }

                    for (const call of proposalCalls) {
                        if (!isProposalTool(call.name)) continue;
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === assistantMessageId
                                    ? {
                                          ...msg,
                                          activeToolLabel:
                                              TOOL_LABELS[call.name] ??
                                              "Preparing action...",
                                      }
                                    : msg,
                            ),
                        );
                        const proposal = await buildProposedAction(
                            call.name,
                            call.args,
                            toolContext,
                        );
                        collectedProposals.push(proposal);
                        toolResults.push({
                            toolCallId: call.id,
                            name: call.name,
                            result: {
                                status: "awaiting_user_confirmation",
                                actionId: proposal.id,
                            },
                        });
                    }

                    if (toolResults.length > 0) {
                        nextMessages.push({
                            role: "tool",
                            results: toolResults,
                        });
                    }

                    // If proposals were generated, show them right away for user confirmation
                    if (proposalCalls.length > 0 && readCalls.length === 0) {
                        break;
                    }
                }

                historyRef.current = nextMessages;

                const finalText =
                    accumulatedText.trim() ||
                    (collectedProposals.length > 0
                        ? "Review and confirm below."
                        : "Done.");

                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === assistantMessageId
                            ? {
                                  ...msg,
                                  content: finalText,
                                  proposedActions:
                                      collectedProposals.length > 0
                                          ? collectedProposals
                                          : undefined,
                                  isStreaming: false,
                                  activeToolLabel: undefined,
                              }
                            : msg,
                    ),
                );
            } catch (err) {
                if (
                    err instanceof DOMException &&
                    err.name === "AbortError"
                ) {
                    return;
                }
                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : "Something went wrong talking to the AI provider.";
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === assistantMessageId
                            ? {
                                  ...msg,
                                  isStreaming: false,
                                  activeToolLabel: undefined,
                                  error: errorMessage,
                              }
                            : msg,
                    ),
                );
            } finally {
                setIsSending(false);
            }
        },
        [activeMember?.id, inputValue, isSending, me?.id, perspective],
    );

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void handleSend();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex justify-end"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Bubby AI Assistant"
                    data-testid="bubby-chat-drawer"
                >
                    {/* Backdrop */}
                    <m.div
                        key="bubby-drawer-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: DURATION.fast }}
                        onClick={onClose}
                        className="fixed inset-0 bg-(--text-ink)/30 backdrop-blur-[2px]"
                    />

                    {/* Drawer Panel */}
                    <m.aside
                        key="bubby-drawer-panel"
                        initial={{ x: "100%", opacity: 0.8 }}
                        animate={{
                            x: 0,
                            opacity: 1,
                            transition: {
                                duration: DURATION.base,
                                ease: EASE_OUT_SOFT,
                            },
                        }}
                        exit={{
                            x: "100%",
                            opacity: 0.8,
                            transition: {
                                duration: DURATION.fast,
                                ease: EASE_IN_FAST,
                            },
                        }}
                        className="relative z-10 flex h-dvh w-full max-w-md flex-col border-l-2 border-(--border-ink) bg-(--bg-canvas) shadow-cute-lg"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 border-b-2 border-(--border-ink) bg-(--bg-card) px-4 py-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) text-(--text-ink) shadow-cute-sm">
                                    <Sparkles
                                        className="h-4.5 w-4.5"
                                        strokeWidth={2.5}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-black font-display text-(--text-ink) truncate">
                                        Bubby AI
                                    </h2>
                                    <p className="text-[11px] font-semibold text-(--text-muted) truncate">
                                        {hasApiKey
                                            ? AI_PROVIDER_META[activeProvider]
                                                  .label
                                            : "Budget assistant"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                {messages.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={handleClearChat}
                                        aria-label="Clear chat"
                                        title="Clear chat"
                                        data-testid="bubby-clear-chat-btn"
                                    >
                                        <Trash2
                                            className="h-4 w-4"
                                            strokeWidth={2.5}
                                        />
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                        onClose();
                                        openSettings();
                                    }}
                                    aria-label="AI Settings"
                                    title="AI Settings"
                                    data-testid="bubby-open-settings-btn"
                                >
                                    <Settings
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={onClose}
                                    aria-label="Close Bubby AI"
                                    data-testid="bubby-close-drawer-btn"
                                >
                                    <X
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                </Button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                            {!hasApiKey ? (
                                <div
                                    className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-3"
                                    data-testid="bubby-no-key-state"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-(--border-ink) bg-(--pastel-lilac-light) shadow-cute-sm">
                                        <Sparkles
                                            className="h-6 w-6 text-(--text-ink)"
                                            strokeWidth={2.5}
                                        />
                                    </div>
                                    <h3 className="text-base font-black font-display text-(--text-ink)">
                                        Add Key
                                    </h3>
                                    <p className="text-xs font-medium text-(--text-muted) max-w-65">
                                        Add an AI API key in Settings to chat
                                        with Bubby.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            onClose();
                                            openSettings();
                                        }}
                                        data-testid="bubby-setup-key-cta"
                                        leftIcon={
                                            <Settings
                                                className="h-4 w-4"
                                                strokeWidth={2.5}
                                            />
                                        }
                                    >
                                        Open Settings
                                    </Button>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center py-10 px-2 space-y-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-(--border-ink) bg-(--pastel-butter-light) shadow-cute-sm">
                                        <Sparkles
                                            className="h-6 w-6 text-(--text-ink)"
                                            strokeWidth={2.5}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-black font-display text-(--text-ink)">
                                            Ask Bubby
                                        </h3>
                                        <p className="text-xs font-medium text-(--text-muted) max-w-65">
                                            Ask about your spending, budget, or
                                            propose an expense.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                                        {STARTER_PROMPTS.map((prompt) => (
                                            <button
                                                key={prompt}
                                                type="button"
                                                onClick={() =>
                                                    void handleSend(prompt)
                                                }
                                                className="min-h-11 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) px-3 py-2 text-xs font-bold text-(--text-ink) shadow-cute-sm hover:bg-(--bg-cream) transition-press active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <m.div
                                        key={msg.id}
                                        {...fadeRise}
                                        className={`flex flex-col gap-2 ${
                                            msg.role === "user"
                                                ? "items-end"
                                                : "items-start"
                                        }`}
                                    >
                                        <div
                                            className={`max-w-[88%] rounded-2xl border-2 border-(--border-ink) px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word shadow-cute-sm ${
                                                msg.role === "user"
                                                    ? "bg-(--pastel-lilac) text-(--text-ink) font-semibold"
                                                    : "bg-(--bg-card) text-(--text-ink) font-medium"
                                            }`}
                                        >
                                            {msg.content}
                                            {msg.isStreaming &&
                                                !msg.content && (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-(--text-muted)">
                                                        <Loader2
                                                            className="h-3.5 w-3.5 animate-spin"
                                                            strokeWidth={2.5}
                                                        />
                                                        {msg.activeToolLabel ??
                                                            "Thinking..."}
                                                    </span>
                                                )}
                                            {msg.isStreaming &&
                                                msg.content &&
                                                msg.activeToolLabel && (
                                                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-(--text-muted)">
                                                        <Loader2
                                                            className="h-3 w-3 animate-spin"
                                                            strokeWidth={2.5}
                                                        />
                                                        {msg.activeToolLabel}
                                                    </div>
                                                )}
                                        </div>

                                        {msg.error && (
                                            <div className="w-full max-w-[92%]">
                                                <Alert variant="danger">
                                                    {msg.error}
                                                </Alert>
                                            </div>
                                        )}

                                        {msg.proposedActions &&
                                            msg.proposedActions.length > 0 && (
                                                <div className="w-full max-w-[92%] space-y-2">
                                                    {msg.proposedActions.map(
                                                        (action) => (
                                                            <ActionConfirmationCard
                                                                key={action.id}
                                                                action={action}
                                                                onConfirm={(
                                                                    act,
                                                                ) =>
                                                                    handleConfirmAction(
                                                                        msg.id,
                                                                        act,
                                                                    )
                                                                }
                                                                onCancel={(
                                                                    actId,
                                                                ) =>
                                                                    handleCancelAction(
                                                                        msg.id,
                                                                        actId,
                                                                    )
                                                                }
                                                            />
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                    </m.div>
                                ))
                            )}
                            <div ref={scrollEndRef} />
                        </div>

                        {/* Composer */}
                        <form
                            onSubmit={handleFormSubmit}
                            className="border-t-2 border-(--border-ink) bg-(--bg-card) px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                        >
                            <div className="flex items-center gap-2">
                                <Input
                                    value={inputValue}
                                    onChange={(e) =>
                                        setInputValue(e.target.value)
                                    }
                                    placeholder={
                                        hasApiKey
                                            ? "Ask Bubby..."
                                            : "Add API key in Settings"
                                    }
                                    disabled={!hasApiKey || isSending}
                                    aria-label="Message Bubby AI"
                                    data-testid="bubby-chat-input"
                                />
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="icon-md"
                                    disabled={
                                        !hasApiKey ||
                                        isSending ||
                                        !inputValue.trim()
                                    }
                                    aria-label="Send message"
                                    data-testid="bubby-chat-send-btn"
                                >
                                    <Send
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                </Button>
                            </div>
                        </form>
                    </m.aside>
                </div>
            )}
        </AnimatePresence>
    );
}

export default BubbyChatDrawer;
