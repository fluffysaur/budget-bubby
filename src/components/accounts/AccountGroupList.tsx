/**
 * AccountGroupList Component
 * Groups accounts by type:
 * - Cash Accounts
 * - Investment Portfolio
 * - CPF (OA, SA, MA)
 * - Other Assets
 * Supports:
 * - Compact Notion-inspired row view (default) or Card view
 * - Tap balance (or pencil) opens the Update Balance modal
 */

import { useState, useMemo } from "react";
import {
    Wallet,
    TrendingUp,
    Landmark,
    Layers,
    PiggyBank,
    Pencil,
    LayoutGrid,
    List,
    Settings,
    Plus,
} from "lucide-react";
import type { Account, AccountType } from "../../types/finance";
import { m, AnimatePresence } from "motion/react";
import { listItem } from "../../lib/motion";
import { Card, EmptyStateCard, Button } from "../ui";
import { TruncatedText } from "../ui/TruncatedText";
import { AccountCard } from "./AccountCard";
import { AccountTrendSpark } from "./AccountTrendSpark";
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
    className = "",
}: AccountGroupListProps) {
    const [viewMode, setViewMode] = useState<"table" | "cards">("table");

    const trends = useMemo(
        () => buildAccountTrends(snapshots, getTodayDateString()),
        [snapshots],
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
        <div className={`space-y-5 ${className}`}>
            {/* View Mode Toolbar */}
            <Card
                variant="white"
                padding="none"
                className="p-2 sm:p-2.5 flex items-center justify-end gap-2"
            >
                <div className="flex items-center gap-1 bg-(--bg-cream) border-2 border-(--border-ink) p-1 rounded-xl shadow-cute-sm">
                    <button
                        type="button"
                        onClick={() => setViewMode("table")}
                        aria-label="Compact Table View"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-press cursor-pointer ${
                            viewMode === "table"
                                ? "bg-(--bg-card) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                : "text-(--text-muted) hover:text-(--text-ink)"
                        }`}
                    >
                        <List className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Compact</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("cards")}
                        aria-label="Cards View"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-press cursor-pointer ${
                            viewMode === "cards"
                                ? "bg-(--bg-card) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                : "text-(--text-muted) hover:text-(--text-ink)"
                        }`}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Cards</span>
                    </button>
                </div>
            </Card>

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

                            {viewMode === "cards" ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <AnimatePresence initial={false}>
                                        {group.accounts.map((account) => (
                                            <m.div
                                                key={account.id}
                                                {...listItem}
                                            >
                                                <AccountCard
                                                    account={account}
                                                    trend={trends.get(
                                                        account.id,
                                                    )}
                                                    onUpdateBalance={
                                                        onUpdateBalance
                                                    }
                                                    onEditAccount={
                                                        onEditAccount
                                                    }
                                                />
                                            </m.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                /* Notion-Style Compact Table List */
                                <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) divide-y-2 divide-(--border-ink) overflow-hidden shadow-cute">
                                    <AnimatePresence initial={false}>
                                        {group.accounts.map((account) => {
                                            return (
                                                <m.div
                                                    key={account.id}
                                                    {...listItem}
                                                    className="flex items-center justify-between gap-3 px-3.5 py-2 sm:py-2.5 hover:bg-(--bg-cream) transition-colors"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                            <div className="text-sm font-bold text-(--text-ink) min-w-0 max-w-40 sm:max-w-60">
                                                                <TruncatedText
                                                                    text={
                                                                        account.name
                                                                    }
                                                                />
                                                            </div>
                                                            {account.institution && (
                                                                <span className="rounded-md bg-(--bg-cream) px-1.5 py-0.5 text-2xs font-bold text-(--text-ink) border border-(--border-ink)">
                                                                    {
                                                                        account.institution
                                                                    }
                                                                </span>
                                                            )}
                                                            {account.is_joint && (
                                                                <span className="rounded-md bg-(--pastel-pink-light) px-1.5 py-0.5 text-2xs font-bold text-(--text-ink) border border-(--border-ink)">
                                                                    Joint
                                                                </span>
                                                            )}
                                                        </div>
                                                        {account.notes && (
                                                            <p className="text-[11px] text-slate-500 dark:text-(--text-faint) truncate mt-0.5">
                                                                {account.notes}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <AccountTrendSpark
                                                        trend={trends.get(
                                                            account.id,
                                                        )}
                                                        variant="row"
                                                        accountName={
                                                            account.name
                                                        }
                                                    />

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                onUpdateBalance?.(
                                                                    account,
                                                                )
                                                            }
                                                            aria-label={`Update balance for ${account.name}`}
                                                            title="Update balance"
                                                            className="inline-flex min-h-11 items-center gap-1.5 text-(--text-ink) font-display hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                                                        >
                                                            <CurrencyText
                                                                amount={
                                                                    account.balance
                                                                }
                                                                size="md"
                                                            />
                                                            <Pencil
                                                                className="h-3.5 w-3.5 shrink-0 text-(--text-muted) sm:hidden"
                                                                strokeWidth={
                                                                    2.5
                                                                }
                                                                aria-hidden="true"
                                                            />
                                                        </button>
                                                        {/* Desktop only: mobile uses the pencil beside the amount */}
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                onUpdateBalance?.(
                                                                    account,
                                                                )
                                                            }
                                                            aria-label={`Edit balance for ${account.name}`}
                                                            title="Update balance"
                                                            className="relative hidden min-h-11 min-w-11 items-center justify-center rounded-lg text-(--text-ink) hover:bg-(--pastel-butter-light) transition-colors cursor-pointer sm:inline-flex"
                                                        >
                                                            <span className="inline-flex rounded-lg border border-(--border-ink) bg-(--bg-cream) p-1.5 shadow-cute-sm">
                                                                <Pencil className="h-3 w-3" />
                                                            </span>
                                                        </button>
                                                        {onEditAccount && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    onEditAccount(
                                                                        account,
                                                                    )
                                                                }
                                                                aria-label={`Edit ${account.name}`}
                                                                title="Edit"
                                                                className="relative inline-flex items-center justify-center p-1.5 rounded-lg after:absolute after:-inset-2.5 after:content-[''] border border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm hover:bg-(--pastel-butter-light) cursor-pointer transition-colors"
                                                            >
                                                                <Settings className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </m.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                        </section>
                    );
                })
            )}
        </div>
    );
}

export default AccountGroupList;
