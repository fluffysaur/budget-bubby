/** Supabase queries for the cards domain. */

import type {
    CreditCard,
    CreateCreditCardInput,
    CreditCardStatement,
    UpsertCreditCardStatementInput,
} from "../../types/finance";

import type { SupabaseContext } from "./context";

export class CardsStore {
    constructor(private readonly ctx: SupabaseContext) {}

    // Credit Cards
    async getCreditCards(): Promise<CreditCard[]> {
        const client = this.ctx.getClient();
        const { data, error } = await client
            .from("credit_cards")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []) as CreditCard[];
    }

    async addCreditCard(input: CreateCreditCardInput): Promise<CreditCard> {
        const client = this.ctx.getClient();
        const householdId =
            input.household_id || (await this.ctx.getHouseholdId());
        const { data, error } = await client
            .from("credit_cards")
            .insert({
                household_id: householdId,
                owner_id: input.owner_id,
                name: input.name,
                bank: input.bank,
                last4: input.last4 || null,
                billing_day: input.billing_day,
                due_day: input.due_day,
                credit_limit: input.credit_limit || null,
                color: input.color || "#059669",
                is_active: true,
            })
            .select()
            .single();
        if (error) throw error;
        return data as CreditCard;
    }

    async updateCreditCard(
        id: string,
        updates: Partial<CreditCard>,
    ): Promise<CreditCard> {
        const client = this.ctx.getClient();
        const { data, error } = await client
            .from("credit_cards")
            .update(updates)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data as CreditCard;
    }

    async deleteCreditCard(id: string): Promise<void> {
        const client = this.ctx.getClient();
        const { error } = await client
            .from("credit_cards")
            .delete()
            .eq("id", id);
        if (error) throw error;
    }

    async getCreditCardStatements(
        month?: string,
    ): Promise<CreditCardStatement[]> {
        const client = this.ctx.getClient();
        let query = client
            .from("credit_card_statements")
            .select("*, card:credit_cards(*)");
        if (month) {
            query = query.eq("month", month);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as CreditCardStatement[];
    }

    async upsertCreditCardStatement(
        input: UpsertCreditCardStatementInput,
    ): Promise<CreditCardStatement> {
        const client = this.ctx.getClient();
        const householdId =
            input.household_id || (await this.ctx.getHouseholdId());
        const { data, error } = await client
            .from("credit_card_statements")
            .upsert(
                {
                    ...(input.id ? { id: input.id } : {}),
                    card_id: input.card_id,
                    household_id: householdId,
                    month: input.month,
                    statement_amount: input.statement_amount,
                    due_date: input.due_date,
                    is_paid: input.is_paid || false,
                    paid_at: input.paid_at || null,
                    ...(input.amount_paid !== undefined
                        ? { amount_paid: input.amount_paid }
                        : {}),
                    notes: input.notes || null,
                },
                { onConflict: "card_id,month" },
            )
            .select("*, card:credit_cards(*)")
            .single();
        if (error) throw error;
        return data as CreditCardStatement;
    }
}
