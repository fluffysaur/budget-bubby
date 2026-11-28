/**
 * Shared expense form fields used by both ExpenseFormModal and InboxCard.
 * Renders Amount, Budget | Goal funding + category/goal picker, Description,
 * Personal | Shared split, and a collapsed "More" section (date/time, payer,
 * partner split slider, currency/FX rate, notes, and #tags).
 */

import { useState, useMemo, useEffect } from "react";
import { Plus, Hash, Target, ChevronDown, ChevronUp } from "lucide-react";
import { useSgtClock } from "../../hooks/useBubby";
import { addDays } from "../../lib/bubby/dates";
import {
    formatDisplayDate,
    getCurrentSingaporeTime,
} from "../../lib/dateUtils";
import {
    filterCategoriesForMember,
    isLoggableCategory,
    isSpendableCategory,
} from "../../lib/financialFormulas";
import {
    SUPPORTED_CURRENCIES,
    convertToSGD,
} from "../../lib/currencyConverter";
import { guessCategoryId } from "../../lib/categoryGuess";
import {
    getStoredRecentTags,
    normalizeExpenseTag,
    type ExpenseFormDraft,
    type FundingSource,
} from "../../lib/expenseFormDraft";
import type {
    Category,
    HouseholdMember,
    SavingsGoal,
} from "../../types/finance";
import { FxRateField } from "./FxRateField";
import { CentsFirstAmountInput } from "./CentsFirstAmountInput";
import { RangeSlider } from "../ui/RangeSlider";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import {
    Select,
    categoryToSelectOption,
    type SelectOption,
} from "../ui/dropdown";
import { Input } from "../ui/Input";
import { FilterChip } from "../ui/FilterChip";
import { FIELD_LABEL_CLASS } from "../ui/fieldStyles";
import { TooltipPopover } from "../ui/TooltipPopover";
import { CurrencyText } from "../ui/CurrencyText";
import { MetaList } from "../ui/MetaList";

const GOAL_CHIP_LIMIT = 4;

export interface ExpenseFormFieldsProps {
    draft: ExpenseFormDraft;
    onChange: (patch: Partial<ExpenseFormDraft>) => void;
    categories: Category[];
    members: HouseholdMember[];
    goals: SavingsGoal[];
    onNavigateToGoals?: () => void;
    autoFocusAmount?: boolean;
    idPrefix?: string;
    initialShowMoreCategories?: boolean;
    /** Changing this resets local UI toggles (More accordion, tag input, etc.). */
    resetKey?: string | number;
    isEditMode?: boolean;
    activeMemberId?: string | null;
}

export function ExpenseFormFields({
    draft,
    onChange,
    categories,
    members,
    goals,
    onNavigateToGoals,
    autoFocusAmount = false,
    idPrefix = "expense",
    initialShowMoreCategories = false,
    resetKey,
    isEditMode = false,
    activeMemberId = null,
}: ExpenseFormFieldsProps) {
    const [showMoreCategories, setShowMoreCategories] = useState<boolean>(
        initialShowMoreCategories,
    );
    const [showMoreGoals, setShowMoreGoals] = useState<boolean>(false);
    const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
    const [newTagInput, setNewTagInput] = useState<string>("");
    const [recentTagsList, setRecentTagsList] = useState<string[]>(() =>
        getStoredRecentTags(),
    );

    useEffect(() => {
        setShowMoreCategories(initialShowMoreCategories);
        setShowMoreGoals(false);
        setShowMoreOptions(false);
        setNewTagInput("");
        setRecentTagsList(getStoredRecentTags());
    }, [resetKey, initialShowMoreCategories]);

    const payerCategories = useMemo(
        () =>
            filterCategoriesForMember(
                categories,
                draft.payerId || activeMemberId,
            ),
        [categories, draft.payerId, activeMemberId],
    );
    const loggableCategories = useMemo(
        () => payerCategories.filter((c) => isLoggableCategory(c)),
        [payerCategories],
    );
    const partnerMember = useMemo(
        () => members.find((m) => m.id !== draft.payerId) ?? null,
        [members, draft.payerId],
    );
    const partnerLoggableCategories = useMemo(
        () =>
            filterCategoriesForMember(
                categories,
                activeMemberId && activeMemberId !== draft.payerId
                    ? activeMemberId
                    : partnerMember?.id,
            ).filter((c) => isLoggableCategory(c)),
        [categories, activeMemberId, draft.payerId, partnerMember?.id],
    );
    const partnerCategoryOptions = useMemo<SelectOption[]>(
        () => partnerLoggableCategories.map(categoryToSelectOption),
        [partnerLoggableCategories],
    );
    const isNonPayingPartnerEdit = Boolean(
        isEditMode &&
        draft.isShared &&
        !draft.isGoalSpend &&
        activeMemberId &&
        draft.payerId &&
        activeMemberId !== draft.payerId,
    );
    const spendableCategories = useMemo(
        () => loggableCategories.filter((c) => isSpendableCategory(c)),
        [loggableCategories],
    );
    const allocationCategories = useMemo(
        () => loggableCategories.filter((c) => !isSpendableCategory(c)),
        [loggableCategories],
    );

    const visibleCategories = showMoreCategories
        ? loggableCategories
        : spendableCategories.length > 0
          ? spendableCategories
          : loggableCategories;

    const selectedCurrency = useMemo(
        () =>
            SUPPORTED_CURRENCIES.find((c) => c.code === draft.currencyCode) ||
            SUPPORTED_CURRENCIES[0],
        [draft.currencyCode],
    );

    const currencyOptions = useMemo<SelectOption[]>(() => {
        const supported = SUPPORTED_CURRENCIES.map((c) => ({
            value: c.code,
            label: `${c.flag} ${c.code} (${c.symbol})`,
        }));
        // Keep an unrecognised code selectable so the field still shows it.
        return supported.some((o) => o.value === draft.currencyCode)
            ? supported
            : [
                  { value: draft.currencyCode, label: draft.currencyCode },
                  ...supported,
              ];
    }, [draft.currencyCode]);

    const handleItemTextChange = (text: string) => {
        const patch: Partial<ExpenseFormDraft> = { item: text };
        if (!draft.categoryManuallySelected) {
            const guessed = guessCategoryId(text, loggableCategories);
            if (guessed) patch.categoryId = guessed;
        }
        onChange(patch);
    };

    const handleAddTag = (rawTag: string) => {
        const clean = normalizeExpenseTag(rawTag);
        if (!clean) return;
        const alreadyTagged = draft.tags.some(
            (t) => normalizeExpenseTag(t).toLowerCase() === clean.toLowerCase(),
        );
        if (!alreadyTagged) {
            onChange({ tags: [...draft.tags, clean] });
        }
        setNewTagInput("");
    };

    const handleRemoveTag = (tagToRemove: string) => {
        onChange({ tags: draft.tags.filter((t) => t !== tagToRemove) });
    };

    const availableRecentTags = useMemo(() => {
        return recentTagsList
            .filter(
                (rTag) =>
                    !draft.tags.some(
                        (t) =>
                            normalizeExpenseTag(t).toLowerCase() ===
                            normalizeExpenseTag(rTag).toLowerCase(),
                    ),
            )
            .slice(0, 3);
    }, [recentTagsList, draft.tags]);

    const hasCustomSplit = draft.isShared && draft.splitRatio !== 0.5;

    const moreOptionsActiveCount =
        (draft.remarks.trim() ? 1 : 0) +
        (draft.tags.length > 0 ? 1 : 0) +
        (draft.currencyCode !== "SGD" ? 1 : 0) +
        (hasCustomSplit ? 1 : 0) +
        (draft.isShared && !draft.isGoalSpend && draft.partnerCategoryId
            ? 1
            : 0);

    const amountInSGD = convertToSGD(
        draft.amount,
        draft.currencyCode,
        draft.customExchangeRate,
    ).amountInSGD;

    const showFundingSwitch = goals.length > 0 || draft.isGoalSpend;

    const visibleGoals = useMemo(() => {
        if (showMoreGoals || goals.length <= GOAL_CHIP_LIMIT) return goals;
        const firstGoals = goals.slice(0, GOAL_CHIP_LIMIT);
        const selected = goals.find((g) => g.id === draft.selectedGoalId);
        return selected && !firstGoals.includes(selected)
            ? [...firstGoals, selected]
            : firstGoals;
    }, [goals, showMoreGoals, draft.selectedGoalId]);

    const handleFundingChange = (source: FundingSource) => {
        const toGoal = source === "goal";
        const patch: Partial<ExpenseFormDraft> = { isGoalSpend: toGoal };
        if (toGoal && !draft.selectedGoalId && goals.length === 1) {
            patch.selectedGoalId = goals[0].id;
        }
        onChange(patch);
    };

    const isAccordionExpanded = showMoreOptions || moreOptionsActiveCount > 0;

    const { today: todayStr } = useSgtClock();
    const yesterdayStr = useMemo(() => addDays(todayStr, -1), [todayStr]);
    const twoDaysAgoStr = useMemo(() => addDays(todayStr, -2), [todayStr]);

    const moreSummary = useMemo(() => {
        const dateLabel =
            draft.date === todayStr
                ? "Today"
                : draft.date === yesterdayStr
                  ? "Yesterday"
                  : draft.date === twoDaysAgoStr
                    ? "2d ago"
                    : formatDisplayDate(draft.date);
        const payerName = members.find(
            (m) => m.id === draft.payerId,
        )?.display_name;
        const splitLabel = !draft.isShared
            ? "Personal"
            : draft.splitRatio !== 0.5
              ? `Shared ${Math.round((1 - draft.splitRatio) * 100)}/${Math.round(draft.splitRatio * 100)}`
              : "Shared";
        return [
            dateLabel,
            payerName,
            splitLabel,
            draft.currencyCode !== "SGD" ? draft.currencyCode : null,
        ];
    }, [
        draft.date,
        todayStr,
        yesterdayStr,
        twoDaysAgoStr,
        members,
        draft.payerId,
        draft.isShared,
        draft.splitRatio,
        draft.currencyCode,
    ]);

    const amountId = `${idPrefix}-amount`;
    const itemId = `${idPrefix}-item`;
    const dateId = `${idPrefix}-date`;
    const timeId = `${idPrefix}-time`;
    const sharedToggleId = `${idPrefix}-shared-toggle`;
    const splitRatioId = `${idPrefix}-split-ratio`;
    const remarksId = `${idPrefix}-remarks`;
    const tagInputId = `${idPrefix}-tag-input`;

    return (
        <div className="space-y-4">
            {/* Amount Input */}
            <div>
                <div className="mb-1 flex items-center justify-between">
                    <label
                        htmlFor={amountId}
                        className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted)"
                    >
                        Amount
                    </label>
                </div>

                <CentsFirstAmountInput
                    id={amountId}
                    value={draft.amount}
                    onChange={(newAmt) => onChange({ amount: newAmt })}
                    currencySymbol={selectedCurrency.symbol}
                    currencyCode={draft.currencyCode}
                    autoFocus={autoFocusAmount}
                />
            </div>

            {/* Funding source (Budget | Goal) with its picker right below */}
            <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                    {showFundingSwitch ? (
                        <div className="flex min-w-0 items-center gap-1">
                            <SegmentedTabs<FundingSource>
                                size="sm"
                                ariaLabel="Funding Source"
                                activeTab={
                                    draft.isGoalSpend ? "goal" : "budget"
                                }
                                onChange={handleFundingChange}
                                tabs={[
                                    { id: "budget", label: "Budget" },
                                    {
                                        id: "goal",
                                        label: "Goal",
                                        icon: (
                                            <Target
                                                className="h-3.5 w-3.5"
                                                strokeWidth={2.5}
                                            />
                                        ),
                                    },
                                ]}
                            />
                            <TooltipPopover
                                title="Goal Funding"
                                ariaLabel="Goal funding info"
                                align="left"
                                className="shrink-0"
                            >
                                Paid from goal savings. Excluded from caps.
                            </TooltipPopover>
                        </div>
                    ) : (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                            Category
                        </span>
                    )}
                    <div className="shrink-0">
                        {draft.isGoalSpend
                            ? goals.length > GOAL_CHIP_LIMIT && (
                                  <button
                                      type="button"
                                      onClick={() =>
                                          setShowMoreGoals((prev) => !prev)
                                      }
                                      className="cursor-pointer text-[11px] font-bold text-(--text-muted) underline hover:text-(--text-ink)"
                                  >
                                      {showMoreGoals
                                          ? "Show less"
                                          : `+ More (${goals.length - GOAL_CHIP_LIMIT})`}
                                  </button>
                              )
                            : allocationCategories.length > 0 && (
                                  <button
                                      type="button"
                                      onClick={() =>
                                          setShowMoreCategories((prev) => !prev)
                                      }
                                      className="cursor-pointer text-[11px] font-bold text-(--text-muted) underline hover:text-(--text-ink)"
                                  >
                                      {showMoreCategories
                                          ? "Spendable only"
                                          : `+ More (${allocationCategories.length})`}
                                  </button>
                              )}
                    </div>
                </div>

                {draft.isGoalSpend ? (
                    <div
                        className="flex flex-wrap gap-1.5"
                        aria-label="Goal Selection"
                    >
                        {goals.length === 0 ? (
                            <div className="w-full py-2 text-center">
                                <p className="text-xs font-bold text-(--text-ink)">
                                    No Goals
                                </p>
                                <p className="mt-0.5 text-xs text-(--text-muted)">
                                    Create a goal to link this expense.
                                </p>
                                <a
                                    href="/goals"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onNavigateToGoals?.();
                                        if (typeof window !== "undefined") {
                                            window.location.href = "/goals";
                                        }
                                    }}
                                    className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-purple-700 hover:underline dark:text-purple-400"
                                >
                                    <Plus className="h-3 w-3 stroke-3" />
                                    <span>Add Goal</span>
                                </a>
                            </div>
                        ) : (
                            visibleGoals.map((g) => {
                                const isSelected =
                                    draft.selectedGoalId === g.id;
                                return (
                                    <button
                                        key={g.id}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() =>
                                            onChange({ selectedGoalId: g.id })
                                        }
                                        className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
                                            isSelected
                                                ? "border-2 border-(--border-ink) bg-(--pastel-lilac) font-bold text-(--text-on-pastel) shadow-cute-sm"
                                                : "border border-(--border-subtle) bg-(--bg-canvas) font-medium text-(--text-ink) hover:bg-(--pastel-butter-light)"
                                        }`}
                                    >
                                        <span
                                            role="img"
                                            aria-label={g.title}
                                            className="shrink-0 text-xs"
                                        >
                                            {g.emoji || "🎯"}
                                        </span>
                                        <span>{g.title}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div
                        className="flex flex-wrap gap-1.5"
                        aria-label="Category Selection"
                    >
                        {visibleCategories.map((cat) => {
                            const isSelected = draft.categoryId === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() =>
                                        onChange({
                                            categoryId: cat.id,
                                            categoryManuallySelected: true,
                                        })
                                    }
                                    className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
                                        isSelected
                                            ? "border-2 border-(--border-ink) bg-(--pastel-lilac) font-bold text-(--text-on-pastel) shadow-cute-sm"
                                            : "border border-(--border-subtle) bg-(--bg-canvas) font-medium text-(--text-ink) hover:bg-(--pastel-butter-light)"
                                    }`}
                                >
                                    <span
                                        className="h-2 w-2 rounded-full border border-black/20"
                                        style={{
                                            backgroundColor:
                                                cat.color || "#dfc2ff",
                                        }}
                                    />
                                    <span>{cat.name}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Non-paying partner editing a shared expense: prominent "My Category" picker */}
            {isNonPayingPartnerEdit && (
                <div>
                    <Select
                        id={`${idPrefix}-my-category`}
                        label="My Category"
                        value={draft.partnerCategoryId || ""}
                        onValueChange={(v) =>
                            onChange({ partnerCategoryId: v })
                        }
                        options={partnerCategoryOptions}
                        placeholder={`Same as payer (${
                            categories.find((c) => c.id === draft.categoryId)
                                ?.name || "Default"
                        })`}
                        clearable
                    />
                </div>
            )}

            {/* Description Input */}
            <Input
                id={itemId}
                label="Description"
                type="text"
                placeholder="e.g., FairPrice Groceries, Grab, Lunch"
                value={draft.item}
                onChange={(e) => handleItemTextChange(e.target.value)}
                required
            />

            {/* 2-Button Segmented Personal / Shared Toggle */}
            <div>
                <input
                    id={sharedToggleId}
                    type="checkbox"
                    aria-label="Shared"
                    checked={draft.isShared}
                    onChange={(e) => onChange({ isShared: e.target.checked })}
                    className="sr-only"
                />

                <div
                    role="group"
                    aria-label="Expense Split Type"
                    className="flex rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) p-1"
                >
                    <button
                        type="button"
                        aria-pressed={!draft.isShared}
                        onClick={() => onChange({ isShared: false })}
                        className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-colors ${
                            !draft.isShared
                                ? "border border-(--border-ink) bg-(--pastel-butter) text-(--text-on-pastel) shadow-cute-sm"
                                : "text-(--text-muted) hover:text-(--text-ink)"
                        }`}
                    >
                        <span>👤</span>
                        <span>Personal</span>
                    </button>
                    <button
                        type="button"
                        aria-pressed={draft.isShared}
                        onClick={() => onChange({ isShared: true })}
                        className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-colors ${
                            draft.isShared
                                ? "border border-(--border-ink) bg-(--pastel-lilac) text-(--text-on-pastel) shadow-cute-sm"
                                : "text-(--text-muted) hover:text-(--text-ink)"
                        }`}
                    >
                        <span>👥</span>
                        <span>Shared</span>
                    </button>
                </div>
            </div>

            {/* "More": secondary fields with their defaults summarised */}
            <div className="border-t border-(--border-subtle) pt-2">
                <button
                    type="button"
                    onClick={() => setShowMoreOptions((prev) => !prev)}
                    aria-expanded={isAccordionExpanded}
                    className="flex w-full cursor-pointer items-center justify-between py-2 text-xs font-bold text-(--text-muted) transition-colors hover:text-(--text-ink)"
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0">More</span>
                        <MetaList
                            data-testid="expense-more-summary"
                            className="font-semibold text-(--text-faint)"
                            items={moreSummary}
                            nowrap
                        />
                        {moreOptionsActiveCount > 0 && (
                            <span className="shrink-0 rounded-full border border-(--border-ink) bg-(--pastel-butter) px-2 py-0.5 text-2xs font-bold text-(--text-on-pastel)">
                                {moreOptionsActiveCount} active
                            </span>
                        )}
                    </div>
                    {isAccordionExpanded ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-(--text-muted)" />
                    ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-(--text-muted)" />
                    )}
                </button>

                <div
                    className={
                        isAccordionExpanded ? "space-y-4 pt-2" : "hidden"
                    }
                >
                    {/* 1-Tap Date Chips + Compact Date & Time Pickers */}
                    <div className="space-y-1.5">
                        <label htmlFor={dateId} className={FIELD_LABEL_CLASS}>
                            Date & Time
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <FilterChip
                                selected={draft.date === todayStr}
                                sizeVariant="sm"
                                onClick={() =>
                                    onChange({
                                        date: todayStr,
                                        time: getCurrentSingaporeTime(),
                                    })
                                }
                            >
                                Today
                            </FilterChip>
                            <FilterChip
                                selected={draft.date === yesterdayStr}
                                sizeVariant="sm"
                                onClick={() => onChange({ date: yesterdayStr })}
                            >
                                Yesterday
                            </FilterChip>
                            <FilterChip
                                selected={draft.date === twoDaysAgoStr}
                                sizeVariant="sm"
                                onClick={() =>
                                    onChange({ date: twoDaysAgoStr })
                                }
                            >
                                2d ago
                            </FilterChip>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <div className="min-w-32 flex-1">
                                <Input
                                    id={dateId}
                                    type="date"
                                    aria-label="Custom Date"
                                    sizeVariant="sm"
                                    value={draft.date}
                                    onChange={(e) =>
                                        onChange({ date: e.target.value })
                                    }
                                    required
                                    className="cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-36 shrink-0">
                                    <Input
                                        id={timeId}
                                        type="time"
                                        aria-label="Expense Time"
                                        sizeVariant="sm"
                                        value={draft.time}
                                        onChange={(e) =>
                                            onChange({ time: e.target.value })
                                        }
                                        className="cursor-pointer"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onChange({
                                            time: getCurrentSingaporeTime(),
                                        })
                                    }
                                    className="cursor-pointer rounded-lg border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs font-bold text-(--text-muted) transition-colors hover:bg-(--pastel-butter-light) hover:text-(--text-ink)"
                                    title="Reset to current time"
                                >
                                    Now
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Payer Selection & Partner's share slider */}
                    {(members.length > 0 || draft.isShared) && (
                        <div className="space-y-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-2.5 shadow-cute-sm">
                            {members.length > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <span className="text-[11px] font-bold text-(--text-muted)">
                                        Payer:
                                    </span>
                                    <div
                                        className="flex gap-1.5"
                                        aria-label="Payer Selection"
                                    >
                                        {members.map((member) => {
                                            const isSelected =
                                                draft.payerId === member.id;
                                            return (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    aria-pressed={isSelected}
                                                    onClick={() =>
                                                        onChange({
                                                            payerId: member.id,
                                                        })
                                                    }
                                                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                                                        isSelected
                                                            ? "border-2 border-(--border-ink) bg-(--pastel-butter) text-(--text-on-pastel) shadow-cute-sm"
                                                            : "border border-(--border-subtle) bg-(--bg-canvas) text-(--text-muted) hover:bg-(--pastel-butter-light)"
                                                    }`}
                                                >
                                                    <span>
                                                        {member.avatar_url ||
                                                            "👤"}
                                                    </span>
                                                    <span>
                                                        {member.display_name}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {draft.isShared && (
                                <div className="space-y-1 pt-1">
                                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-(--text-muted)">
                                        <label htmlFor={splitRatioId}>
                                            Partner's share
                                        </label>
                                        <span className="shrink-0 text-(--text-ink)">
                                            {Math.round(draft.splitRatio * 100)}
                                            % (
                                            <CurrencyText
                                                amount={
                                                    amountInSGD *
                                                    draft.splitRatio
                                                }
                                            />
                                            )
                                        </span>
                                    </div>
                                    <RangeSlider
                                        id={splitRatioId}
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={draft.splitRatio}
                                        onValueChange={(v) =>
                                            onChange({
                                                splitRatio: parseFloat(v),
                                            })
                                        }
                                        className="w-full cursor-pointer accent-(--pastel-lilac)"
                                    />
                                    <div className="flex justify-between text-2xs text-(--text-muted)">
                                        <span>0%</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onChange({ splitRatio: 0.5 })
                                            }
                                            className="cursor-pointer font-semibold text-(--text-ink) hover:underline"
                                        >
                                            50/50
                                        </button>
                                        <span>100%</span>
                                    </div>
                                </div>
                            )}

                            {draft.isShared &&
                                !isNonPayingPartnerEdit &&
                                !draft.isGoalSpend && (
                                    <div className="pt-1">
                                        <Select
                                            id={`${idPrefix}-partner-category`}
                                            label={`Partner's Category${partnerMember ? ` (${partnerMember.display_name})` : ""}`}
                                            value={
                                                draft.partnerCategoryId || ""
                                            }
                                            onValueChange={(v) =>
                                                onChange({
                                                    partnerCategoryId: v,
                                                })
                                            }
                                            options={partnerCategoryOptions}
                                            placeholder="Same as payer"
                                            clearable
                                        />
                                    </div>
                                )}
                        </div>
                    )}

                    {/* Currency */}
                    <div>
                        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                            Currency
                        </span>
                        <div className="w-fit max-w-full">
                            <Select
                                aria-label="Select currency"
                                sizeVariant="sm"
                                value={draft.currencyCode}
                                onValueChange={(v) =>
                                    onChange({
                                        currencyCode: v,
                                        customExchangeRate: undefined,
                                    })
                                }
                                options={currencyOptions}
                            />
                        </div>
                        {draft.currencyCode !== "SGD" && (
                            <FxRateField
                                currencyCode={draft.currencyCode}
                                foreignAmount={draft.amount}
                                customRate={draft.customExchangeRate}
                                onCustomRateChange={(rate) =>
                                    onChange({ customExchangeRate: rate })
                                }
                            />
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <Input
                            id={remarksId}
                            label="Notes"
                            type="text"
                            sizeVariant="sm"
                            placeholder="Optional notes or context..."
                            value={draft.remarks}
                            onChange={(e) =>
                                onChange({ remarks: e.target.value })
                            }
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label
                            htmlFor={tagInputId}
                            className={`mb-1 ${FIELD_LABEL_CLASS}`}
                        >
                            Tags
                        </label>

                        {draft.tags.length > 0 && (
                            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                {draft.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 rounded-full border border-(--border-ink) bg-(--pastel-lilac-light) px-2.5 py-0.5 text-[11px] font-bold text-(--text-ink)"
                                    >
                                        <span>#{normalizeExpenseTag(tag)}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(tag)}
                                            aria-label={`Remove tag ${tag}`}
                                            className="relative ml-0.5 after:absolute after:-inset-3 after:content-[''] cursor-pointer text-(--text-muted) hover:text-rose-600"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-1.5">
                            <div className="min-w-0 flex-1">
                                <Input
                                    id={tagInputId}
                                    type="text"
                                    sizeVariant="sm"
                                    leftIcon={<Hash className="h-3.5 w-3.5" />}
                                    placeholder="e.g. VietnamTrip, Reimbursable"
                                    value={newTagInput}
                                    onChange={(e) =>
                                        setNewTagInput(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddTag(newTagInput);
                                        }
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => handleAddTag(newTagInput)}
                                className="cursor-pointer rounded-xl border-2 border-(--border-ink) bg-(--bg-card) px-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-cute-sm transition-press hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5"
                            >
                                + Tag
                            </button>
                        </div>

                        {availableRecentTags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2">
                                <span className="text-2xs font-bold uppercase text-(--text-muted)">
                                    Recent:
                                </span>
                                {availableRecentTags.map((rTag) => (
                                    <button
                                        key={rTag}
                                        type="button"
                                        aria-label={`Add tag ${normalizeExpenseTag(rTag)}`}
                                        onClick={() => handleAddTag(rTag)}
                                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-(--border-subtle) bg-(--bg-canvas) px-2 py-0.5 text-[11px] font-bold text-(--text-ink) shadow-cute-sm transition-colors hover:border-(--border-ink) hover:bg-(--pastel-butter-light)"
                                    >
                                        <span>
                                            + #{normalizeExpenseTag(rTag)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
