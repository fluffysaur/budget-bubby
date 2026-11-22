/**
 * Settings > Bubby AI: Bring-Your-Own-Key (BYOK) Gemini API configuration.
 * API key and model preference are stored locally in browser localStorage.
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
    getGeminiApiKey,
    setGeminiApiKey,
    clearGeminiApiKey,
    getGeminiModel,
    setGeminiModel,
    testGeminiConnection,
    GEMINI_MODEL_OPTIONS,
} from "../../services/ai/geminiClient";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { feedback as delightFeedback } from "../../lib/delight/feedback";

function notifyAiConfigChanged() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(AI_CONFIG_CHANGED_EVENT));
    }
}

export function AiSettingsSection() {
    const [savedKey, setSavedKey] = useState<string>(() => getGeminiApiKey());
    const [apiKeyDraft, setApiKeyDraft] = useState<string>(() =>
        getGeminiApiKey(),
    );
    const [model, setModel] = useState<string>(() => getGeminiModel());
    const [showKey, setShowKey] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [feedback, setFeedback] = useState<{
        variant: "success" | "danger" | "info";
        message: string;
    } | null>(null);

    const isConfigured = savedKey.length > 0;
    const isDirty = apiKeyDraft.trim() !== savedKey;

    const handleSave = () => {
        const trimmed = apiKeyDraft.trim();
        setGeminiApiKey(trimmed);
        setGeminiModel(model);
        setSavedKey(trimmed);
        setApiKeyDraft(trimmed);
        notifyAiConfigChanged();
        delightFeedback.routine("save");
        setFeedback({
            variant: trimmed ? "success" : "info",
            message: trimmed
                ? "Gemini API key saved locally."
                : "Gemini API key removed.",
        });
    };

    const handleClear = () => {
        clearGeminiApiKey();
        setSavedKey("");
        setApiKeyDraft("");
        notifyAiConfigChanged();
        delightFeedback.routine("delete");
        setFeedback({
            variant: "info",
            message: "Gemini API key cleared from this device.",
        });
    };

    const handleModelChange = (nextModel: string) => {
        setModel(nextModel);
        setGeminiModel(nextModel);
        notifyAiConfigChanged();
    };

    const handleTestConnection = async () => {
        const candidateKey = apiKeyDraft.trim() || savedKey;
        if (!candidateKey) {
            setFeedback({
                variant: "danger",
                message: "Enter a Gemini API key first.",
            });
            return;
        }
        setIsTesting(true);
        setFeedback(null);
        try {
            const result = await testGeminiConnection(candidateKey, model);
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

    return (
        <CollapsibleSection
            title="Bubby AI"
            subtitle="Gemini API key stored locally"
            badge={isConfigured ? "Connected" : "Not Set"}
            badgeVariant={isConfigured ? "mint" : "slate"}
            icon={<Sparkles className="h-4 w-4" strokeWidth={2.5} />}
        >
            <div className="space-y-4">
                <p className="text-xs text-(--text-muted) leading-relaxed">
                    Bring your own Google Gemini API key. Your key stays in this
                    browser&apos;s local storage and is never sent to Budget
                    Bubby servers.
                </p>

                <Input
                    id="gemini-api-key-input"
                    label="Gemini API Key"
                    type={showKey ? "text" : "password"}
                    value={apiKeyDraft}
                    onChange={(e) => {
                        setApiKeyDraft(e.target.value);
                        if (feedback) setFeedback(null);
                    }}
                    placeholder="AIza..."
                    autoComplete="off"
                    spellCheck={false}
                    data-testid="gemini-api-key-input"
                    rightElement={
                        <button
                            type="button"
                            onClick={() => setShowKey((prev) => !prev)}
                            aria-label={
                                showKey ? "Hide API key" : "Show API key"
                            }
                            data-testid="toggle-gemini-key-visibility"
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
                    id="gemini-model-select"
                    label="Model"
                    sizeVariant="sm"
                    value={model}
                    onChange={(e) => handleModelChange(e.target.value)}
                    data-testid="gemini-model-select"
                    options={GEMINI_MODEL_OPTIONS.map((opt) => ({
                        value: opt.value,
                        label: opt.label,
                    }))}
                />

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleSave}
                        disabled={!isDirty && isConfigured}
                        data-testid="save-gemini-key-btn"
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
                        data-testid="test-gemini-connection-btn"
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
                            data-testid="clear-gemini-key-btn"
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
                        <span data-testid="gemini-settings-feedback">
                            {feedback.message}
                        </span>
                    </Alert>
                )}
            </div>
        </CollapsibleSection>
    );
}

export default AiSettingsSection;
