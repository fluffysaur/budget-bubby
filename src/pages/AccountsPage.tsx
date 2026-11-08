/**
 * AccountsPage Component
 * Full page coordinating:
 * - Active perspective (Combined Household vs Yi Jia vs Rachel)
 * - Net worth summary card (total of all account balances)
 * - Net Worth progression chart (NetWorthChart)
 * - Grouped account listings with Notion-style table/card view (AccountGroupList)
 * - 1-Click Month-End Check-In Bulk Update Modal (BulkBalanceUpdateModal)
 * - Quick individual balance update modal (UpdateBalanceModal)
 */

import { useState, useMemo } from "react";
import {
    Wallet,
    TrendingUp,
    CalendarCheck,
    Plus,
    ReceiptText,
} from "lucide-react";
import { m } from "motion/react";
import { fadeRise } from "../lib/motion";
import { useHousehold } from "../context/HouseholdContext";
import {
    PageHeader,
    Button,
    StatCard,
    SegmentedTabs,
    AccountsContentSkeleton,
} from "../components/ui";
import {
    useAccountsQuery,
    useAccountSnapshotsQuery,
    useCreditCardStatementsQuery,
    useInvalidateFinance,
    useUpdateAccountBalanceMutation,
} from "../hooks/useFinanceQueries";
import { useCurrentMonth } from "../hooks/useCurrentMonth";
import { formatSGD } from "../lib/currency";
import {
    calculateCardDebt,
    filterStatementsForPerspective,
} from "../lib/financialFormulas";
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
    const { perspective, activeMember, members } = useHousehold();
    const { invalidateAccounts } = useInvalidateFinance();

    const [activeTab, setActiveTab] = useState<"accounts" | "credit_cards">(
        defaultTab,
    );
    const currentMonth = useCurrentMonth();

    // TanStack Query Cached Data Hooks
    const { data: accountsData, isLoading: accountsLoading } =
        useAccountsQuery(perspective);
    const { data: snapshots } = useAccountSnapshotsQuery(perspective);
    const { data: statementsData } = useCreditCardStatementsQuery();

    const accounts = useMemo(() => accountsData || [], [accountsData]);
    const statements = useMemo(
        () =>
            filterStatementsForPerspective(
                statementsData || [],
                perspective,
                activeMember?.id,
            ),
        [statementsData, perspective, activeMember?.id],
    );
    const isLoading = accountsLoading && !accountsData;
    const updateBalanceMutation = useUpdateAccountBalanceMutation();

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
        invalidateAccounts();
    };

    // Handler for inline balance edit from AccountGroupList
    const handleInlineUpdateBalance = async (
        accountId: string,
        newBalance: number,
    ) => {
        try {
            await updateBalanceMutation.mutateAsync({ accountId, newBalance });
        } catch (err) {
            console.error("Failed to update inline balance:", err);
        }
    };

    // Metrics Calculations
    const totalAssets = useMemo(() => {
        const sum = accounts.reduce((acc, a) => acc + a.balance, 0);
        return Math.round(sum * 100) / 100;
    }, [accounts]);

    const cardDebt = useMemo(
        () => calculateCardDebt(statements, currentMonth),
        [statements, currentMonth],
    );

    const netWorth = useMemo(
        () => Math.round((totalAssets - cardDebt) * 100) / 100,
        [totalAssets, cardDebt],
    );

    return (
        <div className={`space-y-5 pb-20 md:pb-12 ${className}`}>
            {/* Page Header */}
            <PageHeader title="Accounts" />

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

            {/* Embedded Sub-Tab Content with fadeRise animation */}
            <m.div key={activeTab} {...fadeRise} className="pt-1">
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
                                    <Plus
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
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
                                    <CalendarCheck
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                                onClick={() => {
                                    setSelectedAccount(null);
                                    setIsUpdateModalOpen(true);
                                }}
                            >
                                Update Balances
                            </Button>
                        </div>
                        {/* Net Worth */}
                        <StatCard
                            title="Net Worth"
                            loading={isLoading}
                            value={formatSGD(netWorth)}
                            subtitle={
                                cardDebt > 0
                                    ? `${formatSGD(cardDebt)} card debt`
                                    : `${accounts.length} account${accounts.length === 1 ? "" : "s"}`
                            }
                            tooltip="Account balances minus unpaid card statements."
                            icon={<TrendingUp className="h-4 w-4" />}
                            iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                        />

                        {/* Loading Indicator */}
                        {isLoading ? (
                            <AccountsContentSkeleton />
                        ) : (
                            <>
                                {/* Net Worth Progression Area Chart */}
                                <NetWorthChart
                                    accounts={accounts}
                                    snapshots={snapshots}
                                    statements={statements}
                                    onUpdateBalances={() => {
                                        setSelectedAccount(null);
                                        setIsUpdateModalOpen(true);
                                    }}
                                />

                                {/* Grouped Accounts Listing with Table / Card view */}
                                <AccountGroupList
                                    accounts={accounts}
                                    onUpdateBalance={handleOpenUpdateModal}
                                    onQuickSaveBalance={
                                        handleInlineUpdateBalance
                                    }
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
            </m.div>

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
                    invalidateAccounts();
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
                    invalidateAccounts();
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
                    invalidateAccounts();
                }}
            />
        </div>
    );
}

export default AccountsPage;
