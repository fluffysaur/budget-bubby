/**
 * AccountsPage Component
 * Full page coordinating:
 * - Active perspective (Combined Household vs Yi Jia vs Rachel)
 * - Summary metric cards: True Net Worth, Total Assets, Total Liabilities / Loans
 * - Net Worth progression chart (NetWorthChart)
 * - Grouped account listings with Notion-style table/card view (AccountGroupList)
 * - 1-Click Month-End Check-In Bulk Update Modal (BulkBalanceUpdateModal)
 * - Quick individual balance update modal (UpdateBalanceModal)
 */

import { useState, useMemo } from "react";
import {
    Wallet,
    CreditCard,
    TrendingUp,
    CalendarCheck,
    Plus,
    ReceiptText,
} from "lucide-react";
import { useHousehold } from "../context/HouseholdContext";
import {
    PageHeader,
    Button,
    StatCard,
    SegmentedTabs,
    LoadingCard,
} from "../components/ui";
import { useAccountsQuery, useLoansQuery } from "../hooks/useFinanceQueries";
import { financeService } from "../services/financeService";
import { formatSGD } from "../lib/currency";
import { AccountGroupList } from "../components/accounts/AccountGroupList";
import { UpdateBalanceModal } from "../components/accounts/UpdateBalanceModal";
import { AddAccountModal } from "../components/accounts/AddAccountModal";
import { EditAccountModal } from "../components/accounts/EditAccountModal";
import { DeleteAccountModal } from "../components/accounts/DeleteAccountModal";
import { NetWorthChart } from "../components/accounts/NetWorthChart";
import { CreditCardTrackerSection } from "../components/accounts/CreditCardTrackerSection";
import type { Account } from "../types/finance";

export interface AccountsPageProps {
    className?: string;
    defaultTab?: "accounts" | "credit_cards";
}

export function AccountsPage({
    className = "",
    defaultTab = "accounts",
}: AccountsPageProps) {
    const {
        perspective,
        activeMember,
        members,
        refreshData: refreshHousehold,
    } = useHousehold();

    const [activeTab, setActiveTab] = useState<"accounts" | "credit_cards">(
        defaultTab,
    );

    // TanStack Query Cached Data Hooks
    const { data: accountsData, isLoading: accountsLoading } =
        useAccountsQuery(perspective);
    const { data: loansData } = useLoansQuery();

    const accounts = useMemo(() => accountsData || [], [accountsData]);
    const loans = useMemo(() => loansData || [], [loansData]);
    const isLoading = accountsLoading && !accountsData;

    // Modal States
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(
        null,
    );
    const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(
        null,
    );

    // Handlers for individual balance update modal
    const handleOpenUpdateModal = (account: Account) => {
        setSelectedAccount(account);
        setIsUpdateModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsUpdateModalOpen(false);
        setSelectedAccount(null);
    };

    const handleBalanceUpdated = async () => {
        await refreshHousehold();
    };

    // Handler for inline balance edit from AccountGroupList
    const handleInlineUpdateBalance = async (
        accountId: string,
        newBalance: number,
    ) => {
        try {
            await financeService.updateAccountBalance(accountId, newBalance);
            await refreshHousehold();
        } catch (err) {
            console.error("Failed to update inline balance:", err);
        }
    };

    // Metrics Calculations
    const totalAssets = useMemo(() => {
        const sum = accounts.reduce((acc, a) => acc + a.balance, 0);
        return Math.round(sum * 100) / 100;
    }, [accounts]);

    const activeLoans = useMemo(() => {
        return loans.filter((l) => {
            if (l.status !== "active") return false;
            if (perspective === "household") return true;
            return !l.borrower_id || l.borrower_id === activeMember?.id;
        });
    }, [loans, perspective, activeMember]);

    const totalLiabilities = useMemo(() => {
        const sum = activeLoans.reduce((acc, l) => {
            const remaining = l.principal - l.amount_paid;
            if (perspective !== "household" && !l.borrower_id) {
                return acc + remaining * 0.5; // 50% split for joint household loans
            }
            return acc + remaining;
        }, 0);
        return Math.round(sum * 100) / 100;
    }, [activeLoans, perspective]);

    const trueNetWorth = useMemo(() => {
        return Math.round((totalAssets - totalLiabilities) * 100) / 100;
    }, [totalAssets, totalLiabilities]);

    return (
        <div className={`space-y-5 pb-20 md:pb-12 ${className}`}>
            {/* Page Header */}
            <PageHeader title="Accounts & Net Worth" />

            {/* Sub-Tab Navigation Bar */}
            <SegmentedTabs
                tabs={[
                    {
                        id: "accounts",
                        label: "Accounts",
                        icon: <Wallet className="h-4 w-4" />,
                    },
                    {
                        id: "credit_cards",
                        label: "Credit Cards",
                        icon: <ReceiptText className="h-4 w-4" />,
                    },
                ]}
                activeTab={activeTab}
                onChange={(id) =>
                    setActiveTab(id as "accounts" | "credit_cards")
                }
            />

            {/* Embedded Sub-Tab Content */}
            <div className="pt-1">
                {activeTab === "credit_cards" ? (
                    <CreditCardTrackerSection
                        members={members}
                        perspective={perspective}
                        activeMemberId={activeMember?.id}
                    />
                ) : (
                    <div className="space-y-5">
                        {/* Action Buttons Row */}
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="secondary"
                                aria-label="Add Account"
                                className="flex-1 sm:flex-initial"
                                leftIcon={
                                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                                }
                                onClick={() => setIsAddModalOpen(true)}
                            >
                                Add Account
                            </Button>
                            <Button
                                variant="primary"
                                aria-label="Update Balances"
                                className="flex-1 sm:flex-initial"
                                leftIcon={
                                    <CalendarCheck className="h-4 w-4" strokeWidth={2.5} />
                                }
                                onClick={() => {
                                    setSelectedAccount(null);
                                    setIsUpdateModalOpen(true);
                                }}
                            >
                                Update Balances
                            </Button>
                        </div>
                        {/* High-Level Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            {/* Card 1: Net Worth */}
                            <StatCard
                                title="Net Worth"
                                value={formatSGD(trueNetWorth)}
                                tooltip="Calculated as Total Assets minus Outstanding Loans &amp; Liabilities."
                                icon={<TrendingUp className="h-4 w-4" />}
                                iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                            />

                            {/* Card 2: Total Assets */}
                            <StatCard
                                title="Total Assets"
                                value={formatSGD(totalAssets)}
                                subtitle={`${accounts.length} account${accounts.length === 1 ? "" : "s"}`}
                                icon={<Wallet className="h-4 w-4" />}
                                iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                            />

                            {/* Card 3: Total Liabilities / Loans */}
                            <StatCard
                                title="Total Liabilities / Loans"
                                value={formatSGD(totalLiabilities)}
                                subtitle={`${loans.length} active loan${loans.length === 1 ? "" : "s"}`}
                                icon={<CreditCard className="h-4 w-4" />}
                                iconBg="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                            />
                        </div>

                        {/* Loading Indicator */}
                        {isLoading ? (
                            <LoadingCard message="Loading account balances & net worth..." />
                        ) : (
                            <>
                                {/* Net Worth Progression Area Chart */}
                                <NetWorthChart accounts={accounts} loans={loans} />

                                {/* Grouped Accounts Listing with Table / Card view */}
                                <AccountGroupList
                                    accounts={accounts}
                                    onUpdateBalance={handleOpenUpdateModal}
                                    onQuickSaveBalance={handleInlineUpdateBalance}
                                    onEditAccount={(acc) => {
                                        setAccountToEdit(acc);
                                        setIsEditModalOpen(true);
                                    }}
                                    onDeleteAccount={(acc) => {
                                        setAccountToDelete(acc);
                                        setIsDeleteModalOpen(true);
                                    }}
                                    onAddAccount={() => setIsAddModalOpen(true)}
                                />
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Individual & Multi Account Balance Modal */}
            <UpdateBalanceModal
                isOpen={isUpdateModalOpen}
                account={selectedAccount}
                accounts={accounts}
                onClose={handleCloseModal}
                onBalanceUpdated={handleBalanceUpdated}
                onBalancesUpdated={handleBalanceUpdated}
                onOpenAddAccount={() => setIsAddModalOpen(true)}
            />

            {/* Add Account Modal */}
            <AddAccountModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                members={members}
                defaultOwnerId={activeMember?.id}
                isInitialSetup={accounts.length === 0}
                onAccountCreated={async () => {
                    await refreshHousehold();
                }}
            />

            {/* Edit Account Modal */}
            <EditAccountModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setAccountToEdit(null);
                }}
                account={accountToEdit}
                members={members}
                onAccountUpdated={async () => {
                    await refreshHousehold();
                }}
            />

            {/* Delete Account Confirmation Modal */}
            <DeleteAccountModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setAccountToDelete(null);
                }}
                account={accountToDelete}
                onAccountDeleted={async () => {
                    await refreshHousehold();
                }}
            />
        </div>
    );
}

export default AccountsPage;
