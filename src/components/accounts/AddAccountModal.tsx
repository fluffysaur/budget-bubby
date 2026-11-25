/**
 * AddAccountModal Component
 * Ultra-minimal account creation modal:
 * - AnimatedModal wrapper
 * - Compact Singapore presets (popular chips + dropdown)
 * - Clean 1-glance form with optional fields behind "+ More details"
 */

import React, { useState, useEffect } from "react";
import {
    Plus,
    Landmark,
    AlertCircle,
    Sparkles,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import type {
    Account,
    AccountType,
    HouseholdMember,
} from "../../types/finance";
import { useCreateAccountMutation } from "../../hooks/finance/accounts";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import {
    Select,
    memberToSelectOption,
    type SelectOption,
} from "../ui/dropdown";
import { Button } from "../ui/Button";
import { feedback } from "../../lib/delight/feedback";
import { AccountOriginChoice } from "./AccountOriginChoice";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";

export interface AddAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    members: HouseholdMember[];
    defaultOwnerId?: string;
    isInitialSetup?: boolean;
    onAccountCreated?: (newAccount: Account) => void;
}

interface SingaporePreset {
    name: string;
    institution: string;
    type: AccountType;
}

const POPULAR_PRESETS: SingaporePreset[] = [
    { name: "DBS Multiplier", institution: "DBS", type: "Cash" },
    { name: "OCBC 360", institution: "OCBC", type: "Cash" },
    { name: "UOB One", institution: "UOB", type: "Cash" },
    { name: "IBKR", institution: "IBKR", type: "Investment" },
];

const ALL_PRESETS: SingaporePreset[] = [
    ...POPULAR_PRESETS,
    { name: "MariBank Savings", institution: "MariBank", type: "Cash" },
    { name: "Trust Bank Savings", institution: "Trust Bank", type: "Cash" },
    { name: "Endowus Portfolio", institution: "Endowus", type: "Investment" },
    { name: "Syfe Cash+/Equity", institution: "Syfe", type: "Investment" },
];

const ACCOUNT_TYPE_OPTIONS: SelectOption[] = [
    { value: "Cash", label: "Cash" },
    { value: "Investment", label: "Investment" },
    { value: "Other", label: "Other Asset" },
];

const PRESET_OPTIONS: SelectOption[] = ALL_PRESETS.map((p) => ({
    value: p.name,
    label: `${p.name} (${p.type})`,
}));

export function AddAccountModal({
    isOpen,
    onClose,
    members,
    defaultOwnerId,
    isInitialSetup = false,
    onAccountCreated,
}: AddAccountModalProps) {
    const createAccountMutation = useCreateAccountMutation();
    const { me } = useLoggedInMember(members);
    const initialOwnerId = defaultOwnerId || me?.id || "";
    const [name, setName] = useState("");
    const [institution, setInstitution] = useState("");
    const [type, setType] = useState<AccountType>("Cash");
    const [ownerId, setOwnerId] = useState(initialOwnerId);
    const [isJoint, setIsJoint] = useState(false);
    const [balance, setBalance] = useState("");
    const [notes, setNotes] = useState("");
    const [showMoreDetails, setShowMoreDetails] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isNewAccount, setIsNewAccount] = useState<boolean | null>(null);

    // Onboarding adds accounts you already had, so it doesn't ask. A $0
    // opening is the same either way.
    const asksOrigin =
        !isInitialSetup && type !== "CPF" && parseFloat(balance) > 0;

    useEffect(() => {
        if (isOpen) {
            setIsNewAccount(null);
            setName("");
            setInstitution("");
            setType("Cash");
            setOwnerId(initialOwnerId);
            setIsJoint(false);
            setBalance("");
            setNotes("");
            setShowMoreDetails(false);
            setError(null);
            setIsSubmitting(false);
        }
    }, [isOpen, initialOwnerId]);

    const handleSelectPreset = (preset: SingaporePreset) => {
        setName(preset.name);
        setInstitution(preset.institution);
        setType(preset.type);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Please provide an account name.");
            return;
        }

        const parsedBalance = parseFloat(balance);
        if (isNaN(parsedBalance)) {
            setError("Please enter a valid numeric starting balance.");
            return;
        }

        if (asksOrigin && isNewAccount === null) {
            setError("Please choose where this money is from.");
            return;
        }

        const resolvedOwnerId = ownerId;
        if (!resolvedOwnerId) {
            setError("Please select an account owner.");
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            const targetMember = members.find((m) => m.id === resolvedOwnerId);

            const created = await createAccountMutation.mutateAsync({
                household_id: targetMember?.household_id,
                owner_id: resolvedOwnerId,
                name: name.trim(),
                institution: institution.trim() || null,
                type,
                balance: parsedBalance,
                is_joint: isJoint,
                notes: notes.trim() || null,
                currency: "SGD",
                ...(asksOrigin ? { is_new_account: isNewAccount } : {}),
            });

            feedback.routine("save");
            onAccountCreated?.(created);
            onClose();
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Failed to create account",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const ownerOptions = members.map(memberToSelectOption);

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col min-h-0 flex-1 overflow-hidden"
            >
                {/* Header */}
                <ModalHeader
                    id="add-account-title"
                    title="Add New Account"
                    icon={
                        <Landmark className="h-4.5 w-4.5" strokeWidth={2.5} />
                    }
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {/* Empty State Banner (if 0 accounts exist) */}
                    {isInitialSetup && (
                        <div className="p-3 rounded-2xl bg-(--pastel-butter-light) border-2 border-(--border-ink) shadow-cute-sm flex items-start gap-2.5">
                            <Sparkles className="h-4 w-4 stroke-3 text-(--text-ink) shrink-0 mt-0.5" />
                            <div className="text-xs text-(--text-ink) leading-relaxed">
                                <span className="font-bold">
                                    No accounts found yet.
                                </span>{" "}
                                Add your bank or investment account to track
                                balances. CPF OA, SA and MA are added for you.
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-medium">
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Quick Presets */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                                Quick Preset
                            </span>
                            <Select
                                variant="pill"
                                aria-label="More presets"
                                value=""
                                placeholder="More"
                                options={PRESET_OPTIONS}
                                onValueChange={(v) => {
                                    const found = ALL_PRESETS.find(
                                        (p) => p.name === v,
                                    );
                                    if (found) handleSelectPreset(found);
                                }}
                            />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {POPULAR_PRESETS.map((preset) => {
                                const isSelected = name === preset.name;
                                return (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() =>
                                            handleSelectPreset(preset)
                                        }
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-press cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                                            isSelected
                                                ? "bg-(--pastel-butter) text-(--text-ink) border-(--border-ink) shadow-cute-sm"
                                                : "bg-(--bg-canvas) text-(--text-ink) border-(--border-subtle) hover:border-(--border-ink)"
                                        }`}
                                    >
                                        {preset.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Account Name & Bank / Institution */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label
                                htmlFor="account-name"
                                className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                            >
                                Account Name *
                            </label>
                            <input
                                id="account-name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. DBS Multiplier"
                                className="w-full px-3 py-2 text-base sm:text-xs rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="account-institution"
                                className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                            >
                                Bank
                            </label>
                            <input
                                id="account-institution"
                                type="text"
                                value={institution}
                                onChange={(e) => setInstitution(e.target.value)}
                                placeholder="e.g. DBS, OCBC, UOB"
                                className="w-full px-3 py-2 text-base sm:text-xs rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            />
                        </div>
                    </div>

                    {/* Account Type & Starting Balance */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Select
                                id="account-type"
                                label="Type *"
                                labelClassName="text-[11px] mb-1"
                                value={type}
                                onValueChange={(v) => setType(v as AccountType)}
                                options={ACCOUNT_TYPE_OPTIONS}
                                sizeVariant="sm"
                                className="bg-(--bg-canvas)"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="initial-balance"
                                className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                            >
                                Balance *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-(--text-muted) select-none">
                                    S$
                                </span>
                                <input
                                    id="initial-balance"
                                    type="number"
                                    step="0.01"
                                    required
                                    value={balance}
                                    onChange={(e) => setBalance(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-9 pr-3 py-2 text-base sm:text-xs font-bold font-mono-num rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>
                        </div>
                    </div>

                    {asksOrigin && (
                        <AccountOriginChoice
                            value={isNewAccount}
                            onChange={setIsNewAccount}
                        />
                    )}

                    {/* Owner & Joint Status */}
                    <div className="grid grid-cols-2 gap-3 items-center">
                        <div>
                            <Select
                                id="account-owner"
                                label="Owner *"
                                labelClassName="text-[11px] mb-1"
                                value={ownerId}
                                onValueChange={setOwnerId}
                                options={ownerOptions}
                                placeholder="Choose owner"
                                sizeVariant="sm"
                                className="bg-(--bg-canvas)"
                            />
                        </div>

                        <div className="flex items-center pt-5">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={isJoint}
                                    onChange={(e) =>
                                        setIsJoint(e.target.checked)
                                    }
                                    className="h-4 w-4 rounded-md border-(--border-ink) text-(--text-ink) accent-(--text-ink) cursor-pointer"
                                />
                                <span className="text-xs font-bold text-(--text-ink)">
                                    Joint Account
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Collapsible More Details (Institution + Notes) */}
                    <div className="rounded-xl border border-(--border-subtle) bg-(--bg-canvas) p-3">
                        <button
                            type="button"
                            onClick={() => setShowMoreDetails((prev) => !prev)}
                            className="w-full flex items-center justify-between text-xs font-bold text-(--text-ink) cursor-pointer"
                        >
                            <span>
                                {showMoreDetails
                                    ? "Hide extra details"
                                    : "+ More details (Bank, Notes)"}
                            </span>
                            {showMoreDetails ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                            )}
                        </button>

                        {showMoreDetails && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5 pt-2.5 border-t border-(--border-subtle)">
                                <div>
                                    <label
                                        htmlFor="account-institution-extra"
                                        className="block text-2xs font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                                    >
                                        Institution
                                    </label>
                                    <input
                                        id="account-institution-extra"
                                        type="text"
                                        value={institution}
                                        onChange={(e) =>
                                            setInstitution(e.target.value)
                                        }
                                        placeholder="e.g. DBS, OCBC"
                                        className="w-full px-2.5 py-1.5 text-base sm:text-xs rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-card) text-(--text-ink)"
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="account-notes"
                                        className="block text-2xs font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                                    >
                                        Notes
                                    </label>
                                    <input
                                        id="account-notes"
                                        type="text"
                                        value={notes}
                                        onChange={(e) =>
                                            setNotes(e.target.value)
                                        }
                                        placeholder="e.g. Salary account"
                                        className="w-full px-2.5 py-1.5 text-base sm:text-xs rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-card) text-(--text-ink)"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </ModalBody>

                {/* Action Buttons Footer */}
                <ModalFooter>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        isLoading={isSubmitting}
                        disabled={isSubmitting}
                        leftIcon={
                            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        }
                    >
                        Create Account
                    </Button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default AddAccountModal;
