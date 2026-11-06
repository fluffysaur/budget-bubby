/**
 * BonusLogPanel Component (Plan › Bonus)
 * Dated bonus log for the household: YTD totals per person, entries grouped
 * by year, and Log / Edit / Delete. While the bonus tables are missing it
 * shows a setup Alert and the legacy calculator instead.
 */

import { useCallback, useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import {
    Alert,
    Button,
    Card,
    CollapsibleSection,
    ConfirmModal,
    CurrencyText,
    EmptyStateCard,
    Select,
    SkeletonCard,
    SkeletonStatCard,
    StatCard,
    TruncatedText,
} from "../ui";
import { BonusAllocationCollapsible } from "../budget/BonusAllocationCollapsible";
import { BonusRow } from "./BonusRow";
import { BonusFormModal, type BonusSavedInfo } from "./BonusFormModal";
import { BonusCelebration, type BonusCelebrationData } from "./BonusCelebration";
import { useHousehold } from "../../context/HouseholdContext";
import {
    useBaseProfilesQuery,
    useBonusEventsQuery,
    useGoalsQuery,
} from "../../hooks/useFinanceQueries";
import {
    BONUS_TYPE_LABELS,
    bonusGoalTotal,
    groupBonusesByYear,
    summarizeBonusesYtd,
} from "../../lib/bonusFormulas";
import { formatSGD } from "../../lib/currency";
import { getTodayDateString } from "../../lib/dateUtils";
import { financeService } from "../../services/financeService";
import type { BaseBudgetProfile, BonusEvent, SavingsGoal } from "../../types/finance";

const EMPTY_BONUSES: BonusEvent[] = [];
const EMPTY_GOALS: SavingsGoal[] = [];
const EMPTY_PROFILES: BaseBudgetProfile[] = [];

export interface BonusLogPanelProps {
    className?: string;
}

export function BonusLogPanel({ className = "" }: BonusLogPanelProps) {
    const { members, activeMember } = useHousehold();
    const { data: bonusData, isLoading } = useBonusEventsQuery();
    const { data: goalsData } = useGoalsQuery();
    const { data: profilesData } = useBaseProfilesQuery();

    const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
    const [editingEvent, setEditingEvent] = useState<BonusEvent | null>(null);
    const [deletingEvent, setDeletingEvent] = useState<BonusEvent | null>(null);
    const [celebration, setCelebration] = useState<BonusCelebrationData | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    const events = bonusData?.events ?? EMPTY_BONUSES;
    const goals = goalsData ?? EMPTY_GOALS;
    const profiles = profilesData ?? EMPTY_PROFILES;
    const available = bonusData?.available ?? true;

    const currentYear = Number(getTodayDateString().slice(0, 4));
    const groups = useMemo(() => groupBonusesByYear(events), [events]);
    const years = useMemo(() => {
        const set = new Set<number>(groups.map((g) => g.year));
        set.add(currentYear);
        return Array.from(set).sort((a, b) => b - a);
    }, [groups, currentYear]);
    const ytdYear = selectedYear ?? currentYear;
    const ytd = useMemo(
        () => summarizeBonusesYtd(events, ytdYear, members),
        [events, ytdYear, members],
    );
    const memberName = useCallback(
        (id: string) => members.find((m) => m.id === id)?.display_name ?? "Member",
        [members],
    );

    const handleCelebrationDone = useCallback(() => setCelebration(null), []);

    const openNew = () => {
        setEditingEvent(null);
        setIsFormOpen(true);
    };

    const openEdit = (event: BonusEvent) => {
        setEditingEvent(event);
        setIsFormOpen(true);
    };

    const handleSaved = (info: BonusSavedInfo) => {
        if (!info.created) return;
        setCelebration({
            id: `${info.event.id}-${Date.now()}`,
            net: info.event.net,
            goalTotal: info.goalTotal,
            reachedGoalTitle: info.reachedGoalTitle,
        });
    };

    const handleConfirmDelete = async () => {
        if (!deletingEvent) return;
        await financeService.deleteBonusEvent(deletingEvent.id);
        setDeletingEvent(null);
    };

    if (isLoading && !bonusData) {
        return (
            <div className={`space-y-4 ${className}`} data-testid="bonus-log-loading">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <SkeletonStatCard />
                    <SkeletonStatCard />
                    <SkeletonStatCard />
                </div>
                <SkeletonCard />
            </div>
        );
    }

    if (!available) {
        return (
            <div className={`space-y-4 ${className}`}>
                <Alert variant="info" title="Bonus log not set up">
                    Apply the bonus_events migration to log bonuses.
                </Alert>
                <BonusAllocationCollapsible defaultOpen={true} />
            </div>
        );
    }

    const avgCpfPct =
        ytd.household.gross > 0 ? Math.round((ytd.household.cpf / ytd.household.gross) * 100) : 0;
    const deletingGoalTotal = deletingEvent ? bonusGoalTotal(deletingEvent) : 0;

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-black font-display tracking-tight text-(--text-ink)">
                    Bonuses
                </h2>
                <Button
                    variant="primary"
                    leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
                    onClick={openNew}
                    className="w-full min-h-11 sm:w-auto"
                >
                    Log Bonus
                </Button>
            </div>

            {events.length === 0 ? (
                <EmptyStateCard
                    icon={<Sparkles className="h-5 w-5" />}
                    title="No Bonuses"
                    description="Log a bonus to track it and fund goals."
                    action={
                        <Button variant="primary" size="sm" onClick={openNew}>
                            Log Bonus
                        </Button>
                    }
                />
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <StatCard
                            title="Gross"
                            value={formatSGD(ytd.household.gross, { showCents: false })}
                            subtitle={`${ytd.household.count} ${ytd.household.count === 1 ? "bonus" : "bonuses"}`}
                        />
                        <StatCard
                            title="CPF"
                            value={formatSGD(ytd.household.cpf, { showCents: false })}
                            subtitle={`${avgCpfPct}% avg`}
                        />
                        <StatCard
                            title="Net"
                            value={formatSGD(ytd.household.net, { showCents: false })}
                            subtitle={`${ytdYear} YTD`}
                        />
                    </div>

                    <Card elevation="sm" padding="sm" data-testid="bonus-ytd-table">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                By person
                            </span>
                            {years.length > 1 && (
                                <div className="w-28 shrink-0">
                                    <Select
                                        aria-label="Year"
                                        id="bonus-ytd-year"
                                        sizeVariant="sm"
                                        value={String(ytdYear)}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        options={years.map((y) => ({ value: String(y), label: String(y) }))}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="divide-y divide-(--border-subtle) text-sm">
                            <div className="flex items-center gap-2 pb-1.5 text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                <span className="min-w-0 flex-1">Name</span>
                                <span className="w-20 shrink-0 text-right">Gross</span>
                                <span className="hidden w-20 shrink-0 text-right sm:block">CPF</span>
                                <span className="w-20 shrink-0 text-right">Net</span>
                            </div>
                            {[
                                ...ytd.members.map((m) => ({ key: m.memberId, name: m.name, totals: m, bold: false })),
                                { key: "household", name: "Household", totals: ytd.household, bold: true },
                            ].map((row) => (
                                <div
                                    key={row.key}
                                    className={`flex items-center gap-2 py-1.5 ${row.bold ? "font-black" : "font-bold"} text-(--text-ink)`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <TruncatedText text={row.name} />
                                    </div>
                                    <span className="w-20 shrink-0 text-right font-mono-num">
                                        <CurrencyText formatted={formatSGD(row.totals.gross, { showCents: false })} />
                                    </span>
                                    <span className="hidden w-20 shrink-0 text-right font-mono-num sm:block">
                                        <CurrencyText formatted={formatSGD(row.totals.cpf, { showCents: false })} />
                                    </span>
                                    <span className="w-20 shrink-0 text-right font-mono-num">
                                        <CurrencyText formatted={formatSGD(row.totals.net, { showCents: false })} />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <div className="space-y-3">
                        {groups.map((group) => (
                            <CollapsibleSection
                                key={group.year}
                                title={String(group.year)}
                                subtitle={`${formatSGD(group.totals.net, { showCents: false })} net · ${group.totals.count} ${group.totals.count === 1 ? "bonus" : "bonuses"}`}
                                icon={<Sparkles className="h-5 w-5 text-purple-700 dark:text-purple-300" />}
                                defaultOpen={group.year === currentYear || group.year === groups[0].year}
                            >
                                <div className="divide-y divide-(--border-subtle)">
                                    {group.events.map((event) => (
                                        <BonusRow
                                            key={event.id}
                                            event={event}
                                            recipientName={memberName(event.recipient_id)}
                                            onEdit={openEdit}
                                            onDelete={setDeletingEvent}
                                        />
                                    ))}
                                </div>
                            </CollapsibleSection>
                        ))}
                    </div>
                </>
            )}

            <BonusFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                members={members}
                goals={goals}
                baseProfiles={profiles}
                defaultRecipientId={activeMember?.id ?? members[0]?.id}
                editingEvent={editingEvent}
                canSaveDefault={available}
                onSaved={handleSaved}
            />

            <ConfirmModal
                isOpen={Boolean(deletingEvent)}
                onClose={() => setDeletingEvent(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Bonus?"
                variant="danger"
                confirmLabel="Delete"
            >
                {deletingEvent && (
                    <p className="text-sm text-(--text-ink)">
                        <CurrencyText amount={deletingEvent.gross} /> {BONUS_TYPE_LABELS[deletingEvent.type]} for{" "}
                        {memberName(deletingEvent.recipient_id)}.
                        {deletingGoalTotal > 0 && <> Removes <CurrencyText amount={deletingGoalTotal} /> from goals.</>}
                    </p>
                )}
            </ConfirmModal>

            <BonusCelebration celebration={celebration} onDone={handleCelebrationDone} />
        </div>
    );
}

export default BonusLogPanel;
