import type {
    CaptureToken,
    CaptureTokensResult,
    CreateExpenseInput,
    InboxItemsResult,
    InboxItemStatus,
    InboxResolveStatus,
    InboxSummary,
    MerchantRule,
    UpsertMerchantRuleInput,
} from "../../types/finance";

/**
 * Capture Inbox reads and writes. Part of FinanceService.
 *
 * Before the migration is applied, reads report `available: false` and
 * writes throw InboxUnavailableError.
 */
export interface InboxService {
    /** Household-wide: both partners' items. */
    getInboxItems(status?: InboxItemStatus): Promise<InboxItemsResult>;
    /** Pending summary, for one member or (no id) the household. */
    getInboxSummary(memberId?: string): Promise<InboxSummary>;
    /** Saves the expense, resolves the item and checks in. Idempotent. Returns the expense id. */
    confirmInboxItem(itemId: string, expense: CreateExpenseInput): Promise<string>;
    /** `pending` undoes a discard. */
    resolveInboxItem(itemId: string, status: InboxResolveStatus): Promise<void>;
    getMerchantRules(): Promise<MerchantRule[]>;
    upsertMerchantRule(rule: UpsertMerchantRuleInput): Promise<MerchantRule>;
    deleteMerchantRule(id: string): Promise<void>;
    /** The signed-in member's active tokens. */
    listCaptureTokens(memberId?: string): Promise<CaptureTokensResult>;
    /** Returns the plaintext once; only its hash is stored. */
    createCaptureToken(
        label: string,
        memberId?: string,
    ): Promise<{ token: string; row: CaptureToken }>;
    revokeCaptureToken(id: string): Promise<void>;
}
