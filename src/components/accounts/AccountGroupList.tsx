/**
 * AccountGroupList Component
 * Groups accounts by type:
 * - Cash Accounts
 * - Investment Portfolio
 * - CPF (OA, SA, MA)
 * - Other Assets
 * Supports:
 * - Compact brokerage-style row view (default) or Card view
 * - $ / % toggle for the 6-month change
 * - Edit mode: reorder within a group and open account settings
 * - Tap balance (or pencil) opens the Update Balance modal
 */

import { useState, useMemo, type ReactNode } from "react";
import {
    Wallet,
    TrendingUp,
    Landmark,
    Layers,
    PiggyBank,
    Pencil,
    LayoutGrid,
    List,
    Check,
    Plus,
} from "lucide-react";
import type { Account, AccountType } from "../../types/finance";
import { m, AnimatePresence } from "motion/react";
import { listItem } from "../../lib/motion";
import { EmptyStateCard, Button } from "../ui";
import { AccountCard } from "./AccountCard";
import { AccountRow } from "./AccountRow";
import { ReorderableAccounts } from "./ReorderableAccounts";
import { SegmentedToggle, ToolbarPill } from "./SegmentedToggle";
import { useAccountChangeMode } from "../../hooks/useAccountChangeMode";
import { getAmountColumn } from "../../lib/accountChange";
import { usePrivacy } from "../../context/PrivacyContext";
import { buildAccountTrends } from "../../lib/accountTrend";
import { getTodayDateString } from "../../lib/dateUtils";
import type { AccountSnapshot } from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";

export interface AccountGroupListProps {
    accounts: Account[];
    snapshots?: AccountSnapshot[];
    onUpdateBalance?: (account: Account) => void;
    onEditAccount?: (account: Account) => void;
    onAddAccount?: () => void;
    /** Saves a new order for the accounts of one type group. */
    onReorderAccounts?: (ids: string[]) => Promise<unknown>;
    className?: string;
}

interface GroupConfig {
    type: AccountType;
    title: string;
    description: string;
    icon: typeof Wallet;
    headerColor: string;
}

const GROUP_CONFIGS: GroupConfig[] = [
    {
        type: "Cash",
        title: "Cash",
        description:
            "Everyday checking, high-yield savings, and liquid emergency reserves",
        icon: Wallet,
        headerColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
        type: "Investment",
        title: "Investments",
        description:
            "Equities, ETFs, brokerages (SGX CDP, IBKR, Webull, Moomoo)",
        icon: TrendingUp,
        headerColor: "text-blue-600 dark:text-blue-400",
    },
    {
        type: "CPF",
        title: "CPF",
        description: "Ordinary Account, Special Account, and MediSave balances",
        icon: Landmark,
        headerColor: "text-purple-600 dark:text-purple-400",
    },
    {
        type: "Other",
        title: "Other Assets",
        description:
            "Miscellaneous stores of value, precious metals, and alternative assets",
        icon: Layers,
        headerColor: "text-amber-600 dark:text-amber-400",
    },
];

export function AccountGroupList({
    accounts,
    snapshots,
    onUpdateBalance,
    onEditAccount,
    onAddAccount,
    onReorderAccounts,
    className = "",
}: AccountGroupListProps) {
    const [viewMode, setViewMode] = useState<"table" | "cards">("table");
    const [editing, setEditing] = useState(false);
    const [announcement, setAnnouncement] = useState("");
    const { changeMode, setChangeMode } = useAccountChangeMode();
    const { isPrivacyMode } = usePrivacy();

    const trends = useMemo(
        () => buildAccountTrends(snapshots, getTodayDateString()),
        [snapshots],
    );

    const amountColumn = useMemo(
        () => getAmountColumn(accounts, trends, isPrivacyMode),
        [accounts, trends, isPrivacyMode],
    );

    // Accounts arrive already filtered by the shared account type filter
    const filteredAccounts = accounts;

    // Total assets across all visible accounts
    const totalAssets = useMemo(() => {
        return (
            Math.round(
                filteredAccounts.reduce((sum, a) => sum + a.balance, 0) * 100,
            ) / 100
        );
    }, [filteredAccounts]);

    // Group accounts by type
    const groupedData = useMemo(() => {
        return GROUP_CONFIGS.map((config) => {
            const groupAccounts = filteredAccounts.filter(
                (a) => a.type === config.type,
            );
            const subtotal =
                Math.round(
                    groupAccounts.reduce((sum, a) => sum + a.balance, 0) * 100,
                ) / 100;
            const sharePercentage =
                totalAssets > 0 ? (subtotal / totalAssets) * 100 : 0;

            return {
                ...config,
                accounts: groupAccounts,
                subtotal,
                sharePercentage,
            };
        }).filter((g) => g.accounts.length > 0);
    }, [filteredAccounts, totalAssets]);

    const renderCard = (account: Account, dragHandle?: ReactNode) => (
        <AccountCard
            account={account}
            trend={trends.get(account.id)}
            changeMode={changeMode}
            editing={editing}
            dragHandle={dragHandle}
            onUpdateBalance={onUpdateBalance}
            onEditAccount={onEditAccount}
        />
    );

    const renderRow = (account: Account, dragHandle?: ReactNode) => (
        <AccountRow
            account={account}
            trend={trends.get(account.id)}
            changeMode={changeMode}
            amountSize={amountColumn.size}
            editing={editing}
            dragHandle={dragHandle}
            onUpdateBalance={onUpdateBalance}
            onEditAccount={onEditAccount}
        />
    );

    const renderAccounts = (groupAccounts: Account[]) => {
        const isCards = viewMode === "cards";
        const render = isCards ? renderCard : renderRow;
        const listClass = isCards
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) divide-y-2 divide-(--border-ink) shadow-cute";

        if (editing && onReorderAccounts) {
            return (
                <ReorderableAccounts
                    accounts={groupAccounts}
                    onReorder={onReorderAccounts}
                    onAnnounce={setAnnouncement}
                    // One column while editing: dragging sorts along one axis
                    className={isCards ? "flex flex-col gap-4" : listClass}
                    itemClassName={
                        isCards
                            ? "rounded-2xl"
                            : "bg-(--bg-card) first:rounded-t-xl last:rounded-b-xl"
                    }
                >
                    {render}
                </ReorderableAccounts>
            );
        }

        return (
            <div className={`${listClass} ${isCards ? "" : "overflow-hidden"}`}>
                <AnimatePresence initial={false}>
                    {groupAccounts.map((account) => (
                        <m.div
                            key={account.id}
                            {...listItem}
                            className={
                                isCards
                                    ? undefined
                                    : "transition-colors hover:bg-(--bg-cream)"
                            }
                        >
                            {render(account)}
                        </m.div>
                    ))}
                </AnimatePresence>
            </div>
        );
    };

    // Empty state if no accounts
    if (accounts.length === 0) {
        return (
            <EmptyStateCard
                icon={<PiggyBank className="h-6 w-6" />}
                title="No Accounts"
                description="Add an account to start tracking balances."
                action={
                    onAddAccount && (
                        <Button
                            variant="primary"
                            onClick={onAddAccount}
                            leftIcon={
                                <Plus className="h-4 w-4" strokeWidth={2.5} />
                            }
                        >
                            Add Account
                        </Button>
                    )
                }
                className={className}
            />
        );
    }

    return (
        <div
            className={`space-y-5 ${className}`}
            style={
                {
                    // `ch` less the money type's tight letter spacing
                    "--acct-amount-plain": `calc(${amountColumn.ch} * (1ch - 0.025em) + 2px)`,
                    // Balance plus the pencil beside it
                    "--acct-amount": `calc(${amountColumn.ch} * (1ch - 0.025em) + 1.125rem + 2px)`,
                } as React.CSSProperties
            }
        >
            {/* List header: label, change mode, view mode, Edit */}
            <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                    Holdings
                </p>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    {/* Hidden while editing, keeping its width so nothing shifts */}
                    <div
                        aria-hidden={editing || undefined}
                        inert={editing}
                        className={`transition-opacity ${editing ? "opacity-0" : "opacity-100"}`}
                    >
                        <SegmentedToggle
                            label="Change shown as"
                            value={changeMode}
                            onChange={setChangeMode}
                            options={[
                                {
                                    value: "amount",
                                    label: "Show change in dollars",
                                    content: "$",
                                },
                                {
                                    value: "percent",
                                    label: "Show change in percent",
                                    content: "%",
                                },
                            ]}
                        />
                    </div>
                    <SegmentedToggle
                        label="View"
                        value={viewMode}
                        onChange={setViewMode}
                        options={[
                            {
                                value: "table",
                                label: "Compact Table View",
                                content: (
                                    <>
                                        <List className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">
                                            Compact
                                        </span>
                                    </>
                                ),
                            },
                            {
                                value: "cards",
                                label: "Cards View",
                                content: (
                                    <>
                                        <LayoutGrid className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">
                                            Cards
                                        </span>
                                    </>
                                ),
                            },
                        ]}
                    />
                    {(onReorderAccounts || onEditAccount) && (
                        <ToolbarPill
                            active={editing}
                            onClick={() => setEditing((value) => !value)}
                        >
                            {editing ? (
                                <Check className="h-3.5 w-3.5" />
                            ) : (
                                <Pencil className="h-3.5 w-3.5" />
                            )}
                            {editing ? "Done" : "Edit"}
                        </ToolbarPill>
                    )}
                </div>
            </div>

            <p className="sr-only" aria-live="polite">
                {announcement}
            </p>

            {/* Grouped Account Sections */}
            {filteredAccounts.length === 0 ? (
                <EmptyStateCard
                    icon={<Landmark className="h-6 w-6" />}
                    title="No Accounts"
                    description="Add an account to start tracking balances."
                    action={
                        onAddAccount && (
                            <Button
                                variant="primary"
                                onClick={onAddAccount}
                                leftIcon={
                                    <Plus
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                            >
                                Add Account
                            </Button>
                        )
                    }
                />
            ) : (
                groupedData.map((group) => {
                    const Icon = group.icon;
                    return (
                        <section key={group.type} className="space-y-3">
                            {/* Group Header & Subtotals */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b-2 border-(--border-ink) gap-2">
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className={`p-2 rounded-xl bg-(--bg-card) border-2 border-(--border-ink) shadow-cute-sm ${group.headerColor}`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-base sm:text-lg font-bold text-(--text-ink) font-display tracking-tight">
                                                {group.title}
                                            </h2>
                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-(--bg-cream) text-(--text-ink) border border-(--border-ink) shadow-cute-sm">
                                                {group.accounts.length} account
                                                {group.accounts.length === 1
                                                    ? ""
                                                    : "s"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-(--text-muted) hidden sm:block">
                                            {group.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Subtotal and Asset Share Percentage */}
                                <div className="flex items-baseline gap-2 sm:text-right">
                                    <span className="text-(--text-ink) font-display">
                                        <CurrencyText
                                            amount={group.subtotal}
                                            size="md"
                                        />
                                    </span>
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono-num">
                                        {group.sharePercentage.toFixed(1)}% of
                                        assets
                                    </span>
                                </div>
                            </div>

                            {renderAccounts(group.accounts)}
                        </section>
                    );
                })
            )}
        </div>
    );
}

export default AccountGroupList;
