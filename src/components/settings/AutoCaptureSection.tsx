/**
 * Settings > Auto Capture: create and revoke the signed-in member's capture
 * tokens. A token is generated in the browser, shown once, and only its
 * SHA-256 hash is stored.
 */

import { useState } from "react";
import { Copy, KeyRound, Plus, Smartphone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
    financeService,
    isDemoModeActive,
} from "../../services/financeService";
import { isSupabaseConfigured } from "../../services/supabaseClient";
import {
    useCaptureTokensQuery,
    inboxQueryKeys,
} from "../../hooks/useInboxQueries";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import {
    getCaptureEndpointUrl,
    formatLastUsed,
} from "../../lib/capture/endpoint";
import { MAX_ACTIVE_CAPTURE_TOKENS } from "../../services/inbox/inboxErrors";
import type { CaptureToken } from "../../types/finance";
import {
    AnimatedModal,
    ModalBody,
    ModalFooter,
    ModalHeader,
} from "../ui/AnimatedModal";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Input } from "../ui/Input";
import { TruncatedText } from "../ui/TruncatedText";

export interface AutoCaptureSectionProps {
    memberId?: string;
}

const EMPTY_TOKENS: CaptureToken[] = [];

function CopyRow({
    label,
    value,
    testId,
}: {
    label: string;
    value: string;
    testId: string;
}) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard blocked: the value stays selectable
        }
    };
    return (
        <div>
            <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                {label}
            </span>
            <div className="mt-1 flex items-center gap-2">
                <code
                    data-testid={testId}
                    className="min-w-0 flex-1 select-all break-all rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) px-3 py-2 font-mono text-xs text-(--text-ink)"
                >
                    {value}
                </code>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={handleCopy}
                    leftIcon={
                        <Copy className="h-3.5 w-3.5" strokeWidth={2.5} />
                    }
                >
                    {copied ? "Copied" : "Copy"}
                </Button>
            </div>
        </div>
    );
}

function detectCapturePlatform(): "android" | "ios" {
    if (typeof navigator === "undefined") return "ios";
    return /android/i.test(navigator.userAgent || "") ? "android" : "ios";
}

function IosSetupSteps({ defaultOpen }: { defaultOpen: boolean }) {
    return (
        <CollapsibleSection title="iPhone Setup" defaultOpen={defaultOpen}>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-(--text-ink)">
                <li>
                    iPhone: Shortcuts › Automation › + › Transaction. Pick your
                    cards, Run Immediately.
                </li>
                <li>Add Get Contents of URL: the URL above, Method POST.</li>
                <li>Header Authorization: Bearer, a space, then your token.</li>
                <li>
                    JSON body: amount, merchant, card from Shortcut Input;
                    source = wallet.
                </li>
                <li>Pay S$1 with Apple Pay to test. It lands in Inbox.</li>
            </ol>
        </CollapsibleSection>
    );
}

function AndroidSetupSteps({ defaultOpen }: { defaultOpen: boolean }) {
    return (
        <CollapsibleSection title="Android Setup" defaultOpen={defaultOpen}>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-(--text-ink)">
                <li>
                    Android: install MacroDroid and allow Notification access.
                </li>
                <li>
                    Add a macro. Trigger: Notification Received, app Google
                    Wallet.
                </li>
                <li>
                    Action: HTTP Request, POST to the URL above, content type
                    JSON.
                </li>
                <li>Header Authorization: Bearer, a space, then your token.</li>
                <li>
                    Body: amount = notification text, merchant = notification
                    title, source = android.
                </li>
                <li>Pay S$1 with Google Wallet to test. It lands in Inbox.</li>
            </ol>
        </CollapsibleSection>
    );
}

function SetupSteps() {
    const platform = detectCapturePlatform();
    return (
        <div className="space-y-2" data-testid="auto-capture-setup-steps">
            {platform === "android" ? (
                <>
                    <AndroidSetupSteps
                        key="android-primary"
                        defaultOpen={true}
                    />
                    <IosSetupSteps key="ios-secondary" defaultOpen={false} />
                </>
            ) : (
                <>
                    <IosSetupSteps key="ios-primary" defaultOpen={true} />
                    <AndroidSetupSteps
                        key="android-secondary"
                        defaultOpen={false}
                    />
                </>
            )}
        </div>
    );
}

export function AutoCaptureSection({ memberId }: AutoCaptureSectionProps) {
    const queryClient = useQueryClient();
    const { me } = useLoggedInMember();
    const targetMemberId = memberId || me?.id;
    const { data, isLoading } = useCaptureTokensQuery(targetMemberId);
    const available = data?.available ?? true;
    const tokens = data?.tokens ?? EMPTY_TOKENS;

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [label, setLabel] = useState("iPhone");
    const [newToken, setNewToken] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [revokeTarget, setRevokeTarget] = useState<CaptureToken | null>(null);
    const [isRevoking, setIsRevoking] = useState(false);

    const endpoint = getCaptureEndpointUrl();
    const isDemo = isDemoModeActive() || !isSupabaseConfigured();
    const atLimit = tokens.length >= MAX_ACTIVE_CAPTURE_TOKENS;

    const refresh = () =>
        queryClient.invalidateQueries({ queryKey: inboxQueryKeys.all });

    const openCreate = () => {
        setLabel("iPhone");
        setNewToken(null);
        setCreateError(null);
        setIsCreateOpen(true);
    };

    const closeCreate = () => {
        // Drop the plaintext from memory
        setNewToken(null);
        setIsCreateOpen(false);
    };

    const handleCreate = async () => {
        setCreateError(null);
        setIsCreating(true);
        try {
            const { token } = await financeService.createCaptureToken(
                label,
                targetMemberId,
            );
            setNewToken(token);
            await refresh();
        } catch (err) {
            setCreateError(
                err instanceof Error
                    ? err.message
                    : "Couldn't create the token.",
            );
        } finally {
            setIsCreating(false);
        }
    };

    const handleRevoke = async () => {
        if (!revokeTarget) return;
        setIsRevoking(true);
        try {
            await financeService.revokeCaptureToken(revokeTarget.id);
            await refresh();
            setRevokeTarget(null);
        } finally {
            setIsRevoking(false);
        }
    };

    return (
        <div data-testid="auto-capture-section">
            <h4 className="mb-3 font-display text-xs font-black uppercase tracking-wider text-(--text-muted)">
                Auto Capture
            </h4>

            <div className="space-y-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-3.5 shadow-cute-sm">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--pastel-mint-light) shadow-cute-sm">
                        <Smartphone
                            className="h-4 w-4 text-(--text-ink)"
                            strokeWidth={2.5}
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-(--text-ink)">
                            Phone Tokens
                        </span>
                        <p className="mt-0.5 text-[11px] font-medium text-(--text-muted)">
                            Card taps land in Inbox to sort
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="shrink-0"
                        onClick={openCreate}
                        disabled={!available || atLimit || isLoading}
                        leftIcon={
                            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        }
                    >
                        New Token
                    </Button>
                </div>

                {!available && (
                    <Alert variant="info" title="Not available">
                        Needs backend update.
                    </Alert>
                )}
                {available && isDemo && (
                    <Alert variant="info" title="Not available">
                        Needs backend update.
                    </Alert>
                )}

                {tokens.length > 0 && (
                    <ul className="space-y-2" aria-label="Capture tokens">
                        {tokens.map((t) => (
                            <li
                                key={t.id}
                                className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) px-3 py-2"
                            >
                                <KeyRound
                                    className="h-4 w-4 shrink-0 text-(--text-muted)"
                                    strokeWidth={2.5}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-(--text-ink)">
                                        <TruncatedText
                                            text={t.label}
                                            className="min-w-0"
                                        />
                                        <span className="shrink-0 font-mono text-(--text-muted)">
                                            •••• {t.token_hint}
                                        </span>
                                    </div>
                                    <p className="text-xs text-(--text-muted)">
                                        {formatLastUsed(t.last_used_at)}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => setRevokeTarget(t)}
                                    aria-label={`Revoke ${t.label} token`}
                                >
                                    Revoke
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}

                {!newToken && <SetupSteps />}
            </div>

            <AnimatedModal
                isOpen={isCreateOpen}
                onClose={closeCreate}
                maxWidth="max-w-md"
            >
                <ModalHeader
                    title="New Token"
                    icon={
                        <KeyRound className="h-4.5 w-4.5" strokeWidth={2.5} />
                    }
                    iconBgColor="bg-(--pastel-mint-light)"
                    onClose={closeCreate}
                />
                <ModalBody>
                    {createError && (
                        <Alert variant="danger" title="Couldn't create">
                            {createError}
                        </Alert>
                    )}
                    {newToken ? (
                        <>
                            <Alert variant="warning" title="Shown once">
                                Copy it now.
                            </Alert>
                            <CopyRow
                                label="Token"
                                value={newToken}
                                testId="new-capture-token"
                            />
                            {endpoint && (
                                <CopyRow
                                    label="Endpoint"
                                    value={endpoint}
                                    testId="capture-endpoint"
                                />
                            )}
                            <SetupSteps />
                        </>
                    ) : (
                        <Input
                            label="Device"
                            value={label}
                            maxLength={40}
                            onChange={(e) => setLabel(e.target.value)}
                        />
                    )}
                </ModalBody>
                <ModalFooter>
                    {newToken ? (
                        <Button
                            type="button"
                            variant="primary"
                            onClick={closeCreate}
                        >
                            Done
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={closeCreate}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={handleCreate}
                                isLoading={isCreating}
                                disabled={!label.trim()}
                            >
                                Create
                            </Button>
                        </>
                    )}
                </ModalFooter>
            </AnimatedModal>

            <ConfirmModal
                isOpen={Boolean(revokeTarget)}
                onClose={() => setRevokeTarget(null)}
                onConfirm={handleRevoke}
                title="Revoke Token?"
                confirmLabel="Revoke"
                variant="danger"
                isLoading={isRevoking}
            >
                The Shortcut using •••• {revokeTarget?.token_hint} stops
                working.
            </ConfirmModal>
        </div>
    );
}

export default AutoCaptureSection;
