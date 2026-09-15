import { test, expect } from '@playwright/test';

test.describe('Budget Buddy App Smoke Test', () => {
  test('should load homepage and display title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Budget Buddy');
  });
});
