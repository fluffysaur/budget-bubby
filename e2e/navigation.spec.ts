import { test, expect, type Page } from '@playwright/test';

// Desktop shows a segmented switcher (aria-pressed); phones show a dropdown whose button shows the active label.
async function expectActivePerspective(page: Page, isMobile: boolean, name: RegExp) {
  if (isMobile) {
    await expect(page.getByRole('button', { name: 'Select Financial Perspective' })).toContainText(name);
  } else {
    await expect(
      page.getByRole('navigation', { name: 'Perspective Switcher' }).getByRole('button', { name, pressed: true }),
    ).toBeVisible();
  }
}

async function selectPerspective(page: Page, isMobile: boolean, name: RegExp) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Select Financial Perspective' }).click();
    await page.getByRole('option', { name }).click();
  } else {
    await page.getByRole('navigation', { name: 'Perspective Switcher' }).getByRole('button', { name }).click();
  }
}

test.describe('Navigation and Perspective Switching', () => {
  test('should switch perspectives between household, Yi Jia, and Rachel', async ({ page, isMobile }) => {
    await page.goto('/');

    await expectActivePerspective(page, isMobile, /Combined/i);

    await selectPerspective(page, isMobile, /Yi Jia/i);
    await expectActivePerspective(page, isMobile, /Yi Jia/i);

    await selectPerspective(page, isMobile, /Rachel/i);
    await expectActivePerspective(page, isMobile, /Rachel/i);

    await selectPerspective(page, isMobile, /Combined/i);
    await expectActivePerspective(page, isMobile, /Combined/i);
  });

  test('should navigate across all views via desktop sidebar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Sidebar navigation is only visible on desktop viewports');
    await page.goto('/');
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' });

    // Spend: Expenses and Budget sub-tabs
    await sidebar.getByRole('button', { name: /^Spend/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Spend$/i })).toBeVisible();
    await page.getByRole('tab', { name: /Budget/i }).click();
    await expect(page.getByRole('tab', { name: /Budget/i })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /Expenses/i }).click();
    await expect(page.getByRole('tab', { name: /Expenses/i })).toHaveAttribute('aria-selected', 'true');

    // Accounts
    await sidebar.getByRole('button', { name: /^Accounts/i }).click();
    await expect(page).toHaveURL(/\/accounts/);
    await expect(page.getByRole('heading', { level: 1, name: /^Accounts$/i })).toBeVisible();

    // Plan: Goals, Loans and Recurring sub-tabs
    await sidebar.getByRole('button', { name: /^Plan/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Plan$/i })).toBeVisible();
    for (const name of ['Goals', 'Loans', 'Recurring']) {
      const tab = page.getByRole('tab', { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    }

    // Back to Home
    await sidebar.getByRole('button', { name: /^Home/i }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/);
    await expect(page.getByRole('heading', { level: 1, name: /^Home$/i })).toBeVisible();
  });
});
