import { test, expect } from '@playwright/test';

test.describe('Mobile Viewport & Bottom Navigation', () => {
  test('should display bottom navigation bar and toggle Quick Add modal on mobile', async ({ page, isMobile }) => {
    // If running on desktop, adjust viewport to mobile dimensions
    if (!isMobile) {
      await page.setViewportSize({ width: 390, height: 844 });
    }

    await page.goto('/');

    // Desktop sidebar should be hidden
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeHidden();

    // Mobile bottom navigation should be visible
    const bottomNav = page.getByRole('navigation', { name: 'Mobile Navigation' });
    await expect(bottomNav).toBeVisible();

    // Centered Quick Add FAB should be visible
    const quickAddFab = bottomNav.getByRole('button', { name: 'Quick Add' });
    await expect(quickAddFab).toBeVisible();

    // Click Quick Add FAB to open modal
    await quickAddFab.click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { level: 2, name: /Quick Add Expense/i })).toBeVisible();

    // Close modal via Escape key or close button
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Navigate between tabs using Mobile Bottom Navigation
    await bottomNav.getByRole('button', { name: 'Budget' }).click();
    await expect(page).toHaveURL(/\/budget/);
    await expect(page.getByRole('heading', { level: 1, name: /Monthly Budget/i })).toBeVisible();

    await bottomNav.getByRole('button', { name: 'Expenses' }).click();
    await expect(page).toHaveURL(/\/expenses/);
    await expect(page.getByRole('heading', { level: 1, name: /^Expenses$/i })).toBeVisible();

    await bottomNav.getByRole('button', { name: 'Accounts' }).click();
    await expect(page).toHaveURL(/\/accounts/);
    await expect(page.getByRole('heading', { level: 1, name: /Accounts & Net Worth/i })).toBeVisible();

    await bottomNav.getByRole('button', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/);
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toBeVisible();
  });
});
