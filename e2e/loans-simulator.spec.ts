import { test, expect } from '@playwright/test';

test.describe('Loans & Prepayment Simulator Flow', () => {
  test('should display HDB loan and dynamically calculate prepayment interest savings', async ({ page }) => {
    await page.goto('/loans');

    // Verify page heading
    await expect(page.getByRole('heading', { level: 1, name: /Loans & Debt Freedom/i })).toBeVisible();

    // Verify HDB loan card displays interest rate 2.60%
    await expect(page.getByText('2.60%')).toBeVisible();

    // Prepayment Simulator section
    await expect(page.getByRole('heading', { level: 3, name: /Prepayment Simulator/i })).toBeVisible();

    // Initially 0 prepayment means S$0.00 saved
    const interestSaved = page.getByTestId('interest-saved');
    await expect(interestSaved).toContainText('S$0.00');

    // Click preset button for +$500 extra monthly or fill input
    const preset500 = page.getByRole('button', { name: /500/i }).first();
    if (await preset500.isVisible()) {
      await preset500.click();
    } else {
      const extraMonthlyInput = page.getByTestId('extra-monthly-input');
      await extraMonthlyInput.fill('500');
    }

    // Now Interest Saved should be greater than S$0.00
    await expect(interestSaved).not.toContainText('S$0.00');
    await expect(interestSaved).toContainText('S$');

    // Time shaved off should also reflect months/years saved
    const timeSaved = page.getByTestId('time-saved');
    await expect(timeSaved).not.toContainText('0 months');
  });
});
