import { test, expect } from '@playwright/test';

test.describe('Quick Add Expense Flow', () => {
  test('should open modal, add shared expense, and see it in ledger', async ({ page }) => {
    await page.goto('/expenses');

    // Click "+ Add Expense" button on Expenses page
    await page.getByRole('button', { name: /Add Expense/i }).first().click();

    // Verify modal is visible
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { level: 2, name: /Quick Add Expense/i })).toBeVisible();

    // Fill amount
    const amountInput = modal.locator('input[placeholder="0.00"]');
    await amountInput.fill('88.50');

    // Fill item / description
    const itemInput = modal.locator('#expense-item');
    await itemInput.fill('FairPrice Groceries');

    // Select category inside modal
    const foodCategory = modal.getByRole('button', { name: /Food & Dining/i }).first();
    if (await foodCategory.isVisible()) {
      await foodCategory.click();
    }

    // Select payer Yi Jia
    const yiJiaPayer = modal.getByRole('button', { name: /Yi Jia/i }).first();
    if (await yiJiaPayer.isVisible()) {
      await yiJiaPayer.click();
    }

    // Submit the form
    await modal.getByRole('button', { name: /^Add Expense$/i }).click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Expense should now appear in the ledger
    await expect(page.getByText('FairPrice Groceries').first()).toBeVisible();
    await expect(page.getByText('S$88.50').first()).toBeVisible();
  });
});
