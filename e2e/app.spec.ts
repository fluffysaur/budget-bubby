import { test, expect } from '@playwright/test';

test.describe('Budget Buddy App Smoke Test', () => {
  test('should load homepage and display title, header, and dashboard', async ({ page }) => {
    await page.goto('/');
    
    // Page Title
    await expect(page).toHaveTitle(/Budget Buddy/i);

    // Header perspective switcher & branding
    await expect(page.getByRole('button', { name: /Combined Household/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Yi Jia/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Rachel/i })).toBeVisible();

    // Dashboard heading
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toBeVisible();
  });
});
