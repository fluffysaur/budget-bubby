/**
 * EditAccountModal Component
 * Allows editing account metadata (name, institution, type, owner, joint status, and notes)
 * without resetting historical balance snapshots.
 */

import React, { useState, useEffect } from "react";
import { Pencil, AlertCircle, Check, Trash2 } from "lucide-react";
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
import { Input } from "../ui/Input";
import { Switch } from "../ui/Switch";
import { Button } from "../ui/Button";
import type {
    Account,
    AccountType,
    CpfKind,
    HouseholdMember,
} from "../../types/finance";
import { CPF_KINDS } from "../../lib/cpfAccounts";
import { useUpdateAccountMutation } from "../../hooks/finance/accounts";
import { feedback } from "../../lib/delight/feedback";
import { AccountOriginChoice } from "./AccountOriginChoice";

const ACCOUNT_TYPE_OPTIONS: SelectOption[] = [
    { value: "Cash", label: "Cash" },
    { value: "Investment", label: "Investment" },
    { value: "Other", label: "Other Asset" },
];

const CPF_KIND_OPTIONS: SelectOption[] = CPF_KINDS.map((kind) => ({
    value: kind,
    label: kind,
}));

export interface EditAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: Account | null;
    members: HouseholdMember[];
    onAccountUpdated?: (updatedAccount: Account) => void;
    /** Called when the user chooses Delete; the parent owns the confirmation. */
    onDelete?: (account: Account) => void;
}

export function EditAccountModal({
    isOpen,
    onClose,
    account,
    members,
    onAccountUpdated,
    onDelete,
}: EditAccountModalProps) {
    const updateAccountMutation = useUpdateAccountMutation();
    const [name, setName] = useState("");
    const [institution, setInstitution] = useState("");
    const [type, setType] = useState<AccountType>("Cash");
    const [ownerId, setOwnerId] = useState("");
    const [isJoint, setIsJoint] = useState(false);
    const [notes, setNotes] = useState("");
    const [cpfKind, setCpfKind] = useState<CpfKind | "">("");
    // Legacy null reads as "Existing account", which is how it's treated.
    const [isNewAccount, setIsNewAccount] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && account) {
            setName(account.name);
            setInstitution(account.institution || "");
            setType(account.type);
            setOwnerId(account.owner_id);
            setIsJoint(account.is_joint);
            setNotes(account.notes || "");
            setCpfKind(account.cpf_kind ?? "");
            setIsNewAccount(account.is_new_account === true);
            setError(null);
            setIsSubmitting(false);
        }
    }, [isOpen, account]);

    if (!isOpen || !account) return null;

    // CPF accounts are fixed: one OA, SA and MA per member. Only an
    // unmatched legacy account can pick its kind (or be deleted).
    const isCpf = account.type === "CPF";
    const isMatchedCpf = isCpf && Boolean(account.cpf_kind);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Account name is required.");
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            const updated = await updateAccountMutation.mutateAsync({
                id: account.id,
                updates: {
                    name: name.trim(),
                    institution: institution.trim() || null,
                    type: isCpf ? "CPF" : type,
                    owner_id: isMatchedCpf
                        ? account.owner_id
                        : ownerId || account.owner_id,
                    is_joint: isCpf ? false : isJoint,
                    notes: notes.trim() || null,
                    ...(isCpf && !isMatchedCpf && cpfKind
                        ? { cpf_kind: cpfKind }
                        : {}),
                    // Only sent when changed, so other edits never touch it.
                    ...(!isCpf &&
                    isNewAccount !== (account.is_new_account === true)
                        ? { is_new_account: isNewAccount }
                        : {}),
                },
            });

            feedback.routine("save");
            onAccountUpdated?.(updated);
            onClose();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to update account details",
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
                <ModalHeader
                    id="edit-account-title"
                    title="Edit Account"
                    icon={<Pencil className="h-4.5 w-4.5" strokeWidth={2.5} />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Account Name & Institution */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                            id="edit-account-name"
                            label="Account Name *"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />

                        <Input
                            id="edit-account-institution"
                            label="Bank"
                            type="text"
                            value={institution}
                            onChange={(e) => setInstitution(e.target.value)}
                            placeholder="e.g. DBS, OCBC"
                        />
                    </div>

                    {/* Category & Owner */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            {isCpf ? (
                                <Select
                                    id="edit-account-cpf-kind"
                                    label="CPF account"
                                    value={cpfKind}
                                    onValueChange={(v) =>
                                        setCpfKind(v as CpfKind)
                                    }
                                    options={CPF_KIND_OPTIONS}
                                    placeholder="Pick one"
                                    disabled={isMatchedCpf}
                                />
                            ) : (
                                <Select
                                    id="edit-account-type"
                                    label="Type"
                                    value={type}
                                    onValueChange={(v) =>
                                        setType(v as AccountType)
                                    }
                                    options={ACCOUNT_TYPE_OPTIONS}
                                />
                            )}
                        </div>

                        <div>
                            <Select
                                id="edit-account-owner"
                                label="Primary Owner *"
                                value={ownerId}
                                onValueChange={setOwnerId}
                                options={members.map(memberToSelectOption)}
                                disabled={isMatchedCpf}
                            />
                        </div>
                    </div>

                    {/* Joint Status */}
                    <div className="pt-1">
                        <Switch
                            label="Joint"
                            checked={isJoint}
                            onChange={setIsJoint}
                            disabled={type === "CPF"}
                            hint={
                                type === "CPF"
                                    ? "CPF accounts cannot be joint in SG"
                                    : undefined
                            }
                        />
                    </div>

                    {!isCpf && (
                        <AccountOriginChoice
                            value={isNewAccount}
                            onChange={setIsNewAccount}
                            labelClassName="text-xs"
                        />
                    )}

                    {/* Notes */}
                    <Input
                        id="edit-account-notes"
                        label="Notes"
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Salary credited here"
                    />
                </ModalBody>

                <ModalFooter>
                    {onDelete && account && !isMatchedCpf && (
                        <Button
                            variant="danger"
                            size="sm"
                            className="mr-auto"
                            onClick={() => onDelete(account)}
                            disabled={isSubmitting}
                            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                            Delete
                        </Button>
                    )}
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
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        }
                    >
                        Save Changes
                    </Button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default EditAccountModal;
