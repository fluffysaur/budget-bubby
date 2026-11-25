import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { Button } from "../ui/Button";
import { BubbyIcon } from "../ui/BubbyIcon";
import { MONTH_NAMES_SHORT } from "../../lib/dateUtils";
import type { ReleaseNote, ReleaseNoteTag } from "../../lib/releaseNotes";

const TAG_LABEL: Record<ReleaseNoteTag, string> = {
    new: "New",
    better: "Better",
    fixed: "Fixed",
};

const TAG_VARIANT: Record<ReleaseNoteTag, BadgeVariant> = {
    new: "lilac",
    better: "mint",
    fixed: "butter",
};

const TAG_ICON_BG: Record<ReleaseNoteTag, string> = {
    new: "bg-(--pastel-lilac-light)",
    better: "bg-(--pastel-mint-light)",
    fixed: "bg-(--pastel-butter-light)",
};

function formatNoteDate(iso: string): string {
    const [year, month, day] = iso.split("-").map(Number);
    if (!year || !month || !day) return iso;
    return `${day} ${MONTH_NAMES_SHORT[month - 1]} ${year}`;
}

export interface WhatsNewModalProps {
    isOpen: boolean;
    onClose: () => void;
    notes: ReleaseNote[];
    /** Called after a "Try it" link navigates, e.g. to also close Settings. */
    onNavigate?: () => void;
}

export function WhatsNewModal({
    isOpen,
    onClose,
    notes,
    onNavigate,
}: WhatsNewModalProps) {
    const navigate = useNavigate();

    const handleTryIt = (to: string) => {
        onClose();
        onNavigate?.();
        navigate(to);
    };

    return (
        <AnimatedModal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-md"
            ariaLabelledBy="whats-new-title"
            data-testid="whats-new-modal"
        >
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    id="whats-new-title"
                    title="What's New"
                    icon={<BubbyIcon className="h-7 w-7" />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody scrollFade className="space-y-6">
                    {notes.map((note) => (
                        <section
                            key={note.version}
                            aria-labelledby={`whats-new-${note.version}`}
                            data-testid={`whats-new-version-${note.version}`}
                            className="space-y-3"
                        >
                            <div className="flex items-baseline justify-between gap-3">
                                <h3
                                    id={`whats-new-${note.version}`}
                                    className="min-w-0 flex-1 text-base font-black font-display text-(--text-ink)"
                                >
                                    {note.headline ?? `v${note.version}`}
                                </h3>
                                <span className="shrink-0 text-xs font-bold text-(--text-muted) font-mono-num">
                                    v{note.version} ·{" "}
                                    {formatNoteDate(note.date)}
                                </span>
                            </div>

                            <ul className="space-y-2">
                                {note.items.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <li
                                            key={item.text}
                                            className="flex items-start gap-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-cute-sm"
                                        >
                                            <span
                                                className={`shrink-0 rounded-xl border-2 border-(--border-ink) p-1.5 text-(--text-ink) ${TAG_ICON_BG[item.tag]}`}
                                            >
                                                <Icon
                                                    className="h-4 w-4"
                                                    strokeWidth={2.5}
                                                    aria-hidden="true"
                                                />
                                            </span>
                                            <div className="min-w-0 flex-1 space-y-1.5">
                                                <Badge
                                                    variant={
                                                        TAG_VARIANT[item.tag]
                                                    }
                                                    size="sm"
                                                >
                                                    {TAG_LABEL[item.tag]}
                                                </Badge>
                                                <p className="text-sm font-semibold text-(--text-ink) wrap-break-word">
                                                    {item.text}
                                                </p>
                                                {item.to && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleTryIt(
                                                                item.to!,
                                                            )
                                                        }
                                                        className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-(--text-muted) underline decoration-(--pastel-lilac) decoration-2 underline-offset-2 hover:text-(--text-ink) transition-colors cursor-pointer"
                                                    >
                                                        Try it
                                                        <ArrowRight
                                                            className="h-3.5 w-3.5"
                                                            strokeWidth={2.5}
                                                            aria-hidden="true"
                                                        />
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </ModalBody>

                <ModalFooter className="border-t-2 border-(--border-subtle) px-4 py-3">
                    <Button
                        variant="primary"
                        size="md"
                        onClick={onClose}
                        className="w-full"
                    >
                        Got it
                    </Button>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
}

export default WhatsNewModal;
