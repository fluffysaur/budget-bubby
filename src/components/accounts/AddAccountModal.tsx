/**
 * AddAccountModal Component
 * Compact account creation modal:
 * - AnimatedModal wrapper
 * - Main form: name, type, balance, owner + joint
 * - Bank and notes behind "More details"
 */

import React, { useState, useEffect } from "react";
import { Plus, Landmark, Sparkles } from "lucide-react";
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
import { Input } from "../ui/Input";
import { Select, memberToSelectOption } from "../ui/dropdown";
import { Textarea } from "../ui/Textarea";
import { CurrencyInput } from "../ui/CurrencyInput";
import { Switch } from "../ui/Switch";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FIELD_LABEL_CLASS } from "../ui/fieldStyles";
import { Alert } from "../ui/Alert";
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

type AddableAccountType = Extract<AccountType, "Cash" | "Investment" | "Other">;

const TYPE_TABS: { id: AddableAccountType; label: string }[] = [
    { id: "Cash", label: "Cash" },
    { id: "Investment", label: "Investment" },
    { id: "Other", label: "Other" },
];

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
            setError(null);
            setIsSubmitting(false);
        }
    }, [isOpen, initialOwnerId]);

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
                    <div className="space-y-3">
                        {/* Empty State Banner (if 0 accounts exist) */}
                        {isInitialSetup && (
                            <div className="p-3 rounded-2xl bg-(--pastel-butter-light) border-2 border-(--border-ink) shadow-cute-sm flex items-start gap-2.5">
                                <Sparkles className="h-4 w-4 stroke-3 text-(--text-ink) shrink-0 mt-0.5" />
                                <div className="text-xs text-(--text-ink) leading-relaxed">
                                    <span className="font-bold">
                                        No accounts found yet.
                                    </span>{" "}
                                    Add your bank or investment account to track
                                    balances. CPF OA, SA and MA are added for
                                    you.
                                </div>
                            </div>
                        )}

                        {error && <Alert variant="danger">{error}</Alert>}

                        {/* Name */}
                        <Input
                            id="account-name"
                            label="Account Name *"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. DBS Multiplier"
                        />

                        {/* Type */}
                        <div className="space-y-1.5">
                            <span className={FIELD_LABEL_CLASS}>Type *</span>
                            <SegmentedTabs
                                tabs={TYPE_TABS}
                                activeTab={type as AddableAccountType}
                                onChange={(t) => setType(t)}
                                size="sm"
                                ariaLabel="Account type"
                                layoutId="add-account-type"
                            />
                        </div>

                        {/* Balance */}
                        <CurrencyInput
                            id="initial-balance"
                            label="Balance *"
                            required
                            value={balance}
                            onChange={(e) => setBalance(e.target.value)}
                        />

                        {asksOrigin && (
                            <AccountOriginChoice
                                value={isNewAccount}
                                onChange={setIsNewAccount}
                            />
                        )}

                        {/* Owner & Joint */}
                        <div className="flex items-end gap-3">
                            <div className="min-w-0 flex-1">
                                <Select
                                    id="account-owner"
                                    label="Owner *"
                                    value={ownerId}
                                    onValueChange={setOwnerId}
                                    options={members.map(memberToSelectOption)}
                                    placeholder="Choose owner"
                                />
                            </div>
                            <div className="shrink-0">
                                <Switch
                                    id="account-joint"
                                    label="Joint"
                                    checked={isJoint}
                                    onChange={setIsJoint}
                                />
                            </div>
                        </div>

                        {/* More details: bank + notes */}
                        <CollapsibleSection title="More details">
                            <div className="space-y-3">
                                <Input
                                    id="account-institution"
                                    label="Bank"
                                    type="text"
                                    value={institution}
                                    onChange={(e) =>
                                        setInstitution(e.target.value)
                                    }
                                    placeholder="e.g. DBS"
                                />
                                <Textarea
                                    id="account-notes"
                                    label="Notes"
                                    rows={2}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="e.g. Salary account"
                                />
                            </div>
                        </CollapsibleSection>
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
