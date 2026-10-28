/**
 * EditAccountModal Component
 * Allows editing account metadata (name, institution, type, owner, joint status, and notes)
 * without resetting historical balance snapshots.
 */

import React, { useState, useEffect } from "react";
import { Pencil, AlertCircle, Loader2, Check } from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { Select } from "../ui/Select";
import type { Account, AccountType, HouseholdMember } from "../../types/finance";
import { financeService } from "../../services/financeService";

export interface EditAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: Account | null;
    members: HouseholdMember[];
    onAccountUpdated?: (updatedAccount: Account) => void;
}

export function EditAccountModal({
    isOpen,
    onClose,
    account,
    members,
    onAccountUpdated,
}: EditAccountModalProps) {
    const [name, setName] = useState("");
    const [institution, setInstitution] = useState("");
    const [type, setType] = useState<AccountType>("Cash");
    const [ownerId, setOwnerId] = useState("");
    const [isJoint, setIsJoint] = useState(false);
    const [notes, setNotes] = useState("");
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
            setError(null);
            setIsSubmitting(false);
        }
    }, [isOpen, account]);

    if (!isOpen || !account) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Account name is required.");
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            const updated = await financeService.updateAccount(account.id, {
                name: name.trim(),
                institution: institution.trim() || null,
                type,
                owner_id: ownerId || account.owner_id,
                is_joint: type === "CPF" ? false : isJoint,
                notes: notes.trim() || null,
            });

            onAccountUpdated?.(updated);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to update account details");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    id="edit-account-title"
                    title="Edit Account Details"
                    subtitle="Update account name, category, or owner"
                    icon={<Pencil className="h-4.5 w-4.5 stroke-[2.5]" />}
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
                        <div>
                            <label
                                htmlFor="edit-account-name"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Account Name *
                            </label>
                            <input
                                id="edit-account-name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-sm text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="edit-account-institution"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Bank / Institution
                            </label>
                            <input
                                id="edit-account-institution"
                                type="text"
                                value={institution}
                                onChange={(e) => setInstitution(e.target.value)}
                                placeholder="e.g. DBS, OCBC"
                                className="w-full px-3 py-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-sm text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            />
                        </div>
                    </div>

                    {/* Category & Owner */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Select
                                id="edit-account-type"
                                label="Account Category *"
                                value={type}
                                onChange={(e) => setType(e.target.value as AccountType)}
                                className="bg-(--bg-canvas)"
                            >
                                <option value="Cash">Cash / Savings / Current</option>
                                <option value="Investment">Investment / Brokerage / SRS</option>
                                <option value="CPF">CPF (OA / SA / MA)</option>
                                <option value="Other">Other Asset</option>
                            </Select>
                        </div>

                        <div>
                            <Select
                                id="edit-account-owner"
                                label="Primary Owner *"
                                value={ownerId}
                                onChange={(e) => setOwnerId(e.target.value)}
                                className="bg-(--bg-canvas)"
                            >
                                {members.map((m) => (
                                    <option
                                        key={m.id}
                                        value={m.id}
                                    >
                                        {m.display_name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Joint Status */}
                    <div className="pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={isJoint}
                                onChange={(e) => setIsJoint(e.target.checked)}
                                disabled={type === "CPF"}
                                className="h-4 w-4 rounded-md border-2 border-(--border-ink) text-purple-600 focus:ring-purple-500 cursor-pointer disabled:opacity-40"
                            />
                            <span
                                className={`text-xs font-bold ${type === "CPF" ? "text-(--text-muted)" : "text-(--text-ink)"}`}
                            >
                                Joint Household Account
                            </span>
                        </label>
                        {type === "CPF" && (
                            <span className="text-[10px] text-(--text-muted) block mt-0.5">
                                CPF accounts cannot be joint in SG
                            </span>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label
                            htmlFor="edit-account-notes"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Notes / Remarks
                        </label>
                        <input
                            id="edit-account-notes"
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Salary credited here"
                            className="w-full px-3 py-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                    </div>
                </ModalBody>

                <ModalFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) px-5 py-2.5 text-xs font-black text-(--text-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default EditAccountModal;
