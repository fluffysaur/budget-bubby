/** In-memory mock of the cards domain. */

import type {
    CreditCard,
    CreateCreditCardInput,
    CreditCardStatement,
    UpsertCreditCardStatementInput,
} from "../../types/finance";
import { cloneDeep } from "./context";
import type { MockContext } from "./context";

export class CardsStore {
    constructor(private readonly ctx: MockContext) {}

    // Credit Cards
    async getCreditCards(): Promise<CreditCard[]> {
        return cloneDeep(this.ctx.state.creditCards || []);
    }

    async addCreditCard(input: CreateCreditCardInput): Promise<CreditCard> {
        const newCard: CreditCard = {
            id: `cc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            household_id: input.household_id || this.ctx.state.household.id,
            owner_id: input.owner_id,
            name: input.name,
            bank: input.bank,
            last4: input.last4 || null,
            billing_day: input.billing_day,
            due_day: input.due_day,
            credit_limit: input.credit_limit || null,
            color: input.color || "#059669",
            is_active: true,
            created_at: new Date().toISOString(),
        };

        if (!this.ctx.state.creditCards) this.ctx.state.creditCards = [];
        this.ctx.state.creditCards.push(newCard);
        this.ctx.persist();
        return cloneDeep(newCard);
    }

    async updateCreditCard(
        id: string,
        updates: Partial<CreditCard>,
    ): Promise<CreditCard> {
        const card = this.ctx.state.creditCards?.find((c) => c.id === id);
        if (!card) throw new Error(`Credit card with id "${id}" not found`);
        Object.assign(card, updates);
        this.ctx.persist();
        return cloneDeep(card);
    }

    async deleteCreditCard(id: string): Promise<void> {
        if (this.ctx.state.creditCards) {
            this.ctx.state.creditCards = this.ctx.state.creditCards.filter(
                (c) => c.id !== id,
            );
        }
        if (this.ctx.state.creditCardStatements) {
            this.ctx.state.creditCardStatements =
                this.ctx.state.creditCardStatements.filter(
                    (s) => s.card_id !== id,
                );
        }
        this.ctx.persist();
    }

    async getCreditCardStatements(
        month?: string,
    ): Promise<CreditCardStatement[]> {
        let statements = cloneDeep(this.ctx.state.creditCardStatements || []);
        if (month) {
            statements = statements.filter((s) => s.month === month);
        }
        for (const stmt of statements) {
            stmt.card = this.ctx.state.creditCards?.find(
                (c) => c.id === stmt.card_id,
            );
        }
        return statements;
    }

    async upsertCreditCardStatement(
        input: UpsertCreditCardStatementInput,
    ): Promise<CreditCardStatement> {
        if (!this.ctx.state.creditCardStatements)
            this.ctx.state.creditCardStatements = [];

        const existingIdx = this.ctx.state.creditCardStatements.findIndex(
            (s) => s.card_id === input.card_id && s.month === input.month,
        );

        let statement: CreditCardStatement;
        if (existingIdx >= 0) {
            statement = this.ctx.state.creditCardStatements[existingIdx];
            statement.statement_amount = input.statement_amount;
            statement.due_date = input.due_date;
            if (input.is_paid !== undefined) statement.is_paid = input.is_paid;
            if (input.paid_at !== undefined) statement.paid_at = input.paid_at;
            if (input.amount_paid !== undefined)
                statement.amount_paid = input.amount_paid;
            if (input.notes !== undefined) statement.notes = input.notes;
        } else {
            statement = {
                id:
                    input.id ||
                    `ccs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                card_id: input.card_id,
                household_id: input.household_id || this.ctx.state.household.id,
                month: input.month,
                statement_amount: input.statement_amount,
                due_date: input.due_date,
                is_paid: input.is_paid || false,
                paid_at: input.paid_at || null,
                amount_paid: input.amount_paid ?? null,
                notes: input.notes || null,
            };
            this.ctx.state.creditCardStatements.push(statement);
        }

        this.ctx.persist();
        statement.card = this.ctx.state.creditCards?.find(
            (c) => c.id === statement.card_id,
        );
        return cloneDeep(statement);
    }
}
