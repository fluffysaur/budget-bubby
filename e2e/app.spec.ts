import { test, expect } from '@playwright/test';

test.describe('Budget Bubby App Smoke Test', () => {
  test('should load homepage and display title, header, and dashboard', async ({ page, isMobile }) => {
    await page.goto('/');
    
    // Page Title
    await expect(page).toHaveTitle(/Budget Bubby/i);

    // Header perspective switcher & branding
    if (isMobile) {
      await expect(page.getByRole('button', { name: 'Select Financial Perspective' })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Combined Household' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Yi Jia/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Rachel/i })).toBeVisible();
    }

    // Dashboard heading
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toBeVisible();
  });
});
