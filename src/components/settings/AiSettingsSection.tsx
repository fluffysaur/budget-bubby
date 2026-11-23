/**
 * Settings > Bubby AI: Provider-agnostic Bring-Your-Own-Key (BYOK) AI configuration.
 * API keys and model preferences are stored per provider in browser localStorage.
 */

import { useState } from "react";
import {
    Sparkles,
    Eye,
    EyeOff,
    Check,
    Trash2,
    Plug,
} from "lucide-react";
import {
    AI_CONFIG_CHANGED_EVENT,
    AI_PROVIDER_LIST,
    AI_PROVIDER_META,
    clearProviderApiKey,
    getActiveAiProvider,
    getAiReasoningEffort,
    getProviderApiKey,
    getProviderModel,
    setActiveAiProvider,
    setAiReasoningEffort,
    setProviderApiKey,
    setProviderModel,
    testAiConnection,
    type AiProviderId,
    type AiReasoningEffort,
} from "../../services/ai/providers";
import { pushGeminiSettings } from "../../services/ai/aiSettingsSync";
import { financeService } from "../../services/financeService";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { feedback as delightFeedback } from "../../lib/delight/feedback";

const CUSTOM_MODEL_SENTINEL = "__custom__";

function notifyAiConfigChanged() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(AI_CONFIG_CHANGED_EVENT));
    }
}

function isCuratedModel(provider: AiProviderId, model: string): boolean {
    return AI_PROVIDER_META[provider].curatedModels.some(
        (m) => m.value === model,
    );
}

export function AiSettingsSection() {
    const [provider, setProvider] = useState<AiProviderId>(() =>
        getActiveAiProvider(),
    );
    const [savedKey, setSavedKey] = useState<string>(() =>
        getProviderApiKey(getActiveAiProvider()),
    );
    const [apiKeyDraft, setApiKeyDraft] = useState<string>(() =>
        getProviderApiKey(getActiveAiProvider()),
    );
    const [model, setModel] = useState<string>(() =>
        getProviderModel(getActiveAiProvider()),
    );
    const [useCustomModel, setUseCustomModel] = useState<boolean>(() => {
        const initialProvider = getActiveAiProvider();
        const initialModel = getProviderModel(initialProvider);
        return !isCuratedModel(initialProvider, initialModel);
    });
    const [reasoningEffort, setReasoningEffort] = useState<AiReasoningEffort>(
        () => getAiReasoningEffort(),
    );
    const [showKey, setShowKey] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [feedback, setFeedback] = useState<{
        variant: "success" | "danger" | "info";
        message: string;
    } | null>(null);

    const providerMeta = AI_PROVIDER_META[provider];
    const isConfigured = savedKey.length > 0;
    const isDirty = apiKeyDraft.trim() !== savedKey;

    const handleProviderChange = (nextProvider: AiProviderId) => {
        setActiveAiProvider(nextProvider);
        const nextKey = getProviderApiKey(nextProvider);
        const nextModel = getProviderModel(nextProvider);
        setProvider(nextProvider);
        setSavedKey(nextKey);
        setApiKeyDraft(nextKey);
        setModel(nextModel);
        setUseCustomModel(!isCuratedModel(nextProvider, nextModel));
        setShowKey(false);
        setFeedback(null);
        notifyAiConfigChanged();
    };

    const syncGemini = (targetProvider: AiProviderId) => {
        if (targetProvider === "gemini") {
            void pushGeminiSettings(financeService);
        }
    };

    const handleSave = () => {
        const trimmedKey = apiKeyDraft.trim();
        const effectiveModel = model.trim() || providerMeta.defaultModel;
        setProviderApiKey(provider, trimmedKey);
        setProviderModel(provider, effectiveModel);
        setSavedKey(trimmedKey);
        setApiKeyDraft(trimmedKey);
        setModel(effectiveModel);
        syncGemini(provider);
        notifyAiConfigChanged();
        delightFeedback.routine("save");
        setFeedback({
            variant: trimmedKey ? "success" : "info",
            message: trimmedKey
                ? provider === "gemini"
                    ? `${providerMeta.label} API key saved and synced.`
                    : `${providerMeta.label} API key saved locally.`
                : `${providerMeta.label} API key removed.`,
        });
    };

    const handleClear = () => {
        clearProviderApiKey(provider);
        setSavedKey("");
        setApiKeyDraft("");
        syncGemini(provider);
        notifyAiConfigChanged();
        delightFeedback.routine("delete");
        setFeedback({
            variant: "info",
            message: `${providerMeta.label} API key cleared from this device.`,
        });
    };

    const handleModelSelectChange = (selectedValue: string) => {
        if (selectedValue === CUSTOM_MODEL_SENTINEL) {
            setUseCustomModel(true);
            return;
        }
        setUseCustomModel(false);
        setModel(selectedValue);
        setProviderModel(provider, selectedValue);
        syncGemini(provider);
        notifyAiConfigChanged();
    };

    const handleCustomModelChange = (nextModel: string) => {
        setModel(nextModel);
        const trimmed = nextModel.trim();
        if (trimmed) {
            setProviderModel(provider, trimmed);
            notifyAiConfigChanged();
        }
    };

    const handleReasoningEffortChange = (nextEffort: AiReasoningEffort) => {
        setReasoningEffort(nextEffort);
        setAiReasoningEffort(nextEffort);
        notifyAiConfigChanged();
    };

    const handleTestConnection = async () => {
        const candidateKey = apiKeyDraft.trim() || savedKey;
        if (!candidateKey) {
            setFeedback({
                variant: "danger",
                message: `Enter a ${providerMeta.label} API key first.`,
            });
            return;
        }
        const effectiveModel = model.trim() || providerMeta.defaultModel;
        setIsTesting(true);
        setFeedback(null);
        try {
            const result = await testAiConnection(
                provider,
                candidateKey,
                effectiveModel,
            );
            if (result.ok) {
                setFeedback({
                    variant: "success",
                    message: "Connection verified. Bubby AI is ready.",
                });
            } else {
                setFeedback({
                    variant: "danger",
                    message: result.error || "Connection test failed.",
                });
            }
        } finally {
            setIsTesting(false);
        }
    };

    const selectValue =
        useCustomModel || !isCuratedModel(provider, model)
            ? CUSTOM_MODEL_SENTINEL
            : model;

    return (
        <CollapsibleSection
            title="Bubby AI"
            subtitle={
                isConfigured
                    ? `${providerMeta.label} · ${
                          provider === "gemini" ? "Synced" : "Stored locally"
                      }`
                    : "Bring your own key"
            }
            badge={isConfigured ? providerMeta.label : "Not Set"}
            badgeVariant={isConfigured ? "mint" : "slate"}
            icon={<Sparkles className="h-4 w-4" strokeWidth={2.5} />}
        >
            <div className="space-y-4">
                <p className="text-xs text-(--text-muted) leading-relaxed">
                    Bring your own AI API key. Your Gemini key syncs to your
                    private account so it works on every device. Other
                    providers stay on this device.
                </p>

                <Select
                    id="ai-provider-select"
                    label="Provider"
                    sizeVariant="sm"
                    value={provider}
                    onChange={(e) =>
                        handleProviderChange(e.target.value as AiProviderId)
                    }
                    data-testid="ai-provider-select"
                    options={AI_PROVIDER_LIST.map((p) => ({
                        value: p.id,
                        label: p.label,
                    }))}
                />

                <Input
                    id="ai-api-key-input"
                    label={providerMeta.keyLabel}
                    type={showKey ? "text" : "password"}
                    value={apiKeyDraft}
                    onChange={(e) => {
                        setApiKeyDraft(e.target.value);
                        if (feedback) setFeedback(null);
                    }}
                    placeholder={providerMeta.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    data-testid="ai-api-key-input"
                    rightElement={
                        <button
                            type="button"
                            onClick={() => setShowKey((prev) => !prev)}
                            aria-label={
                                showKey ? "Hide API key" : "Show API key"
                            }
                            data-testid="toggle-ai-key-visibility"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-(--text-muted) hover:text-(--text-ink) transition-colors cursor-pointer"
                        >
                            {showKey ? (
                                <EyeOff
                                    className="h-4 w-4"
                                    strokeWidth={2.5}
                                />
                            ) : (
                                <Eye className="h-4 w-4" strokeWidth={2.5} />
                            )}
                        </button>
                    }
                />

                <Select
                    id="ai-model-select"
                    label="Model"
                    sizeVariant="sm"
                    value={selectValue}
                    onChange={(e) => handleModelSelectChange(e.target.value)}
                    data-testid="ai-model-select"
                    options={[
                        ...providerMeta.curatedModels.map((opt) => ({
                            value: opt.value,
                            label: opt.label,
                        })),
                        {
                            value: CUSTOM_MODEL_SENTINEL,
                            label: "Custom model ID...",
                        },
                    ]}
                />

                {(useCustomModel || selectValue === CUSTOM_MODEL_SENTINEL) && (
                    <Input
                        id="ai-custom-model-input"
                        label="Custom Model ID"
                        value={model}
                        onChange={(e) =>
                            handleCustomModelChange(e.target.value)
                        }
                        onBlur={() => syncGemini(provider)}
                        placeholder={providerMeta.defaultModel}
                        autoComplete="off"
                        spellCheck={false}
                        data-testid="ai-custom-model-input"
                    />
                )}

                <Select
                    id="ai-reasoning-effort-select"
                    label="Reasoning Effort"
                    sizeVariant="sm"
                    value={reasoningEffort}
                    onChange={(e) =>
                        handleReasoningEffortChange(
                            e.target.value as AiReasoningEffort,
                        )
                    }
                    data-testid="ai-reasoning-effort-select"
                    options={[
                        { value: "low", label: "Low (Recommended)" },
                        { value: "medium", label: "Medium" },
                        { value: "high", label: "High" },
                    ]}
                />

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleSave}
                        disabled={!isDirty && isConfigured}
                        data-testid="save-ai-key-btn"
                        leftIcon={<Check className="h-3.5 w-3.5 stroke-3" />}
                    >
                        Save Key
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleTestConnection}
                        isLoading={isTesting}
                        disabled={!apiKeyDraft.trim() && !savedKey}
                        data-testid="test-ai-connection-btn"
                        leftIcon={
                            <Plug className="h-3.5 w-3.5" strokeWidth={2.5} />
                        }
                    >
                        Test
                    </Button>

                    {isConfigured && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            data-testid="clear-ai-key-btn"
                            leftIcon={
                                <Trash2
                                    className="h-3.5 w-3.5"
                                    strokeWidth={2.5}
                                />
                            }
                        >
                            Clear
                        </Button>
                    )}
                </div>

                {feedback && (
                    <Alert
                        variant={feedback.variant}
                        onClose={() => setFeedback(null)}
                    >
                        <span data-testid="ai-settings-feedback">
                            {feedback.message}
                        </span>
                    </Alert>
                )}
            </div>
        </CollapsibleSection>
    );
}

export default AiSettingsSection;
