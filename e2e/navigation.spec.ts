import { test, expect } from '@playwright/test';

test.describe('Navigation and Perspective Switching', () => {
  test('should switch perspectives between household, Yi Jia, and Rachel', async ({ page }) => {
    await page.goto('/');

    // Initially in Combined Household perspective
    await expect(page.getByRole('region', { name: 'Active Perspective Banner' })).toContainText('Combined Household');

    // Switch to Yi Jia
    await page.getByRole('button', { name: /Yi Jia/i }).first().click();
    await expect(page.getByRole('region', { name: 'Active Perspective Banner' })).toContainText("Yi Jia's Personal Perspective");

    // Switch to Rachel
    await page.getByRole('button', { name: /Rachel/i }).first().click();
    await expect(page.getByRole('region', { name: 'Active Perspective Banner' })).toContainText("Rachel's Personal Perspective");

    // Switch back to Combined Household
    await page.getByRole('button', { name: /Combined Household/i }).first().click();
    await expect(page.getByRole('region', { name: 'Active Perspective Banner' })).toContainText('Combined Household');
  });

  test('should navigate across all views via desktop sidebar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Sidebar navigation is only visible on desktop viewports');
    await page.goto('/');

    // Navigate to Budget
    await page.getByRole('button', { name: /^Budget/i }).click();
    await expect(page).toHaveURL(/\/budget/);
    await expect(page.getByRole('heading', { level: 1, name: /Monthly Budget/i })).toBeVisible();

    // Navigate to Expenses
    await page.getByRole('button', { name: /^Expenses/i }).click();
    await expect(page).toHaveURL(/\/expenses/);
    await expect(page.getByRole('heading', { level: 1, name: /^Expenses$/i })).toBeVisible();

    // Navigate to Accounts & Net Worth
    await page.getByRole('button', { name: /Accounts & Net Worth/i }).click();
    await expect(page).toHaveURL(/\/accounts/);
    await expect(page.getByRole('heading', { level: 1, name: /Accounts & Net Worth/i })).toBeVisible();

    // Navigate to Goals
    await page.getByRole('button', { name: /^Goals/i }).click();
    await expect(page).toHaveURL(/\/goals/);
    await expect(page.getByRole('heading', { level: 1, name: /Savings Goals & Milestones/i })).toBeVisible();

    // Navigate to Loans
    await page.getByRole('button', { name: /^Loans/i }).click();
    await expect(page).toHaveURL(/\/loans/);
    await expect(page.getByRole('heading', { level: 1, name: /Loans & Debt Freedom/i })).toBeVisible();

    // Navigate to Recurring & Policies
    await page.getByRole('button', { name: /Recurring & Policies/i }).click();
    await expect(page).toHaveURL(/\/recurring/);
    await expect(page.getByRole('heading', { level: 1, name: /Recurring Policies & Taxes/i })).toBeVisible();

    // Navigate back to Dashboard
    await page.getByRole('button', { name: /^Dashboard/i }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/);
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toBeVisible();
  });
});
