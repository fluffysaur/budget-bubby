/**
 * Bubby sheet (lazy): large Bubby, stage progress, today's check-ins for
 * both partners, couple streak, and the accessories grid (tap to equip).
 */

import { Check, Flame } from "lucide-react";
import { AnimatedModal, ModalBody, ModalHeader } from "../ui/AnimatedModal";
import { TooltipPopover } from "../ui/TooltipPopover";
import { Badge } from "../ui/Badge";
import { TruncatedText } from "../ui/TruncatedText";
import { useBubby } from "../../hooks/useBubby";
import { STAGES } from "../../lib/bubby/growth";
import {
    ACCESSORIES,
    lockedLabel,
    type AccessoryDef,
    type AccessorySlot,
} from "../../lib/bubby/accessories";
import { feedback } from "../../lib/delight/feedback";
import { Bubby } from "./Bubby";
import { AccessoryArt } from "./accessories/AccessoryArt";

export interface BubbySheetProps {
    isOpen: boolean;
    onClose: () => void;
    /** Accessory to highlight (e.g. from "Try it on"). */
    focusAccessoryId?: string;
}

const VIEWBOX: Record<AccessorySlot, string> = {
    head: "-135 -140 270 170",
    face: "-120 -60 240 100",
    neck: "-115 -40 230 150",
    hand: "-70 -80 140 130",
};

function viewBoxFor(def: AccessoryDef): string {
    return def.id === "balloon" ? "-70 -215 140 230" : VIEWBOX[def.slot];
}

export function BubbySheet({ isOpen, onClose, focusAccessoryId }: BubbySheetProps) {
    const { state, stage, stageDef, mood, reaction, equipped, unlocked, unlockInputs, me, partner, equip } =
        useBubby();

    const next = stage < STAGES.length - 1 ? STAGES[stage + 1] : null;
    const prevAt = stageDef.at;
    const progress = next
        ? Math.min(100, Math.round(((state.points - prevAt) / (next.at - prevAt)) * 100))
        : 100;

    const meLogged = Boolean(me && state.todayLoggedBy.has(me.id));
    const partnerLogged = Boolean(partner && state.todayLoggedBy.has(partner.id));

    const handleTap = (def: AccessoryDef) => {
        const isOn = equipped[def.slot] === def.id;
        equip(def.slot, isOn ? null : def.id);
        feedback.routine("equip");
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <ModalHeader title="Bubby" onClose={onClose} />
            <ModalBody className="space-y-5">
                {/* Bubby and stage progress */}
                <div className="flex flex-col items-center gap-2">
                    <Bubby stage={stage} mood={mood} reaction={reaction} equipped={equipped} size="lg" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-lg font-black font-display tracking-tight text-(--text-ink)">
                            {stageDef.name}
                        </span>
                        <TooltipPopover title="How Bubby grows" ariaLabel="How Bubby grows" align="center">
                            Each day someone logs earns 1 🐾. A day you both log earns 1 more, and
                            another once the household is on a 7-day roll. Missing a day never costs
                            🐾, and Bubby never shrinks.
                        </TooltipPopover>
                    </div>
                    <div className="w-full max-w-xs">
                        <div
                            role="progressbar"
                            aria-label="Growth"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress}
                            className="h-2.5 w-full overflow-hidden rounded-full border border-(--border-ink)/30 bg-(--bg-cream)"
                        >
                            <div
                                className="h-full rounded-full bg-(--pastel-lilac) transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="mt-1 text-center text-xs font-bold text-(--text-muted) font-mono-num">
                            {next ? `${next.at - state.points} 🐾 to ${next.name}` : `${state.points} 🐾 · Fully grown`}
                        </p>
                    </div>
                </div>

                {/* Today */}
                <section aria-label="Today">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">Today</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        {[
                            { member: me, logged: meLogged },
                            { member: partner, logged: partnerLogged },
                        ]
                            .filter((p) => p.member)
                            .map(({ member, logged }) => (
                                <Badge
                                    key={member!.id}
                                    variant={logged ? "mint" : "slate"}
                                    size="sm"
                                    icon={logged ? <Check className="h-3 w-3" strokeWidth={3} /> : undefined}
                                >
                                    <span className="inline-block max-w-24 align-bottom">
                                        <TruncatedText text={member!.display_name} />
                                    </span>
                                    {!logged && " ·"}
                                </Badge>
                            ))}
                        {state.isCoupleDayToday ? (
                            <Badge variant="butter" size="sm" icon={<Flame className="h-3 w-3" strokeWidth={2.5} />}>
                                Couple day ✓ · {state.coupleStreak}
                            </Badge>
                        ) : meLogged && partner && !partnerLogged ? (
                            <span className="text-xs font-semibold text-(--text-muted)">
                                Waiting on {partner.display_name}
                            </span>
                        ) : (
                            <Badge variant="butter" size="sm" icon={<Flame className="h-3 w-3" strokeWidth={2.5} />}>
                                {state.coupleStreak}
                            </Badge>
                        )}
                    </div>
                </section>

                {/* Accessories */}
                <section aria-label="Accessories">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">Accessories</h3>
                    <div className="mt-2 grid grid-cols-5 gap-2">
                        {ACCESSORIES.map((def) => {
                            const isUnlocked = unlocked.includes(def.id);
                            const isOn = equipped[def.slot] === def.id;
                            const hint = isUnlocked ? def.label : `Locked, ${lockedLabel(def, unlockInputs)}`;
                            return (
                                <button
                                    key={def.id}
                                    type="button"
                                    disabled={!isUnlocked}
                                    aria-pressed={isUnlocked ? isOn : undefined}
                                    aria-label={hint}
                                    title={hint}
                                    onClick={() => handleTap(def)}
                                    className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border-2 p-1.5 transition-all ${
                                        isOn
                                            ? "border-(--border-ink) bg-(--pastel-lilac-light) shadow-(--shadow-cute-sm)"
                                            : "border-(--border-subtle) bg-(--bg-cream)"
                                    } ${focusAccessoryId === def.id ? "ring-2 ring-(--border-ink) ring-offset-1" : ""} ${
                                        isUnlocked
                                            ? "cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                                            : "cursor-not-allowed"
                                    }`}
                                >
                                    <svg viewBox={viewBoxFor(def)} className="h-8 w-8" aria-hidden="true">
                                        <g style={isUnlocked ? undefined : { filter: "brightness(0)" }} opacity={isUnlocked ? 1 : 0.25}>
                                            <AccessoryArt id={def.id} />
                                        </g>
                                    </svg>
                                    <span className="w-full truncate text-center text-[10px] font-bold text-(--text-muted)">
                                        {isUnlocked ? def.label : lockedLabel(def, unlockInputs)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            </ModalBody>
        </AnimatedModal>
    );
}

export default BubbySheet;
