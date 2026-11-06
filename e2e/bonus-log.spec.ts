import { test, expect, type Page } from '@playwright/test';

// Mock data mode (see playwright.config.ts). Eligible joint goals in the seed:
// HDB Down Payment (gap 90k), Renovation (gap 90k), Baby Fund (gap 30k).
// A S$10,000 bonus at 20% CPF leaves S$8,000 net; Goals 40% = S$3,200.
// "By gap" gives Baby Fund the last share: S$457.16.
const BABY_FUND = 'goal-00000000-0505';

async function logRachelBonus(page: Page) {
  await page.goto('/plan?tab=bonus');
  await expect(page.getByText('No Bonuses')).toBeVisible();

  await page.getByRole('button', { name: 'Log Bonus' }).first().click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { level: 2, name: 'Log Bonus' })).toBeVisible();

  await modal.getByLabel('Recipient').selectOption({ label: 'Rachel' });
  await modal.getByRole('button', { name: 'Performance' }).click();
  await modal.getByLabel('Gross').fill('10000');
  await expect(modal.getByLabel('CPF')).toHaveValue('2000');
  await modal.getByRole('button', { name: 'Next' }).click();

  await expect(modal.getByTestId('bonus-split-goals')).toContainText('3,200.00');
  await modal.getByRole('button', { name: 'By gap' }).click();
  await expect(modal.getByText('Fully assigned')).toBeVisible();

  const submit = modal.getByRole('button', { name: 'Log Bonus' });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  await expect(page.getByTestId('bonus-celebration')).toBeVisible();
  await expect(modal).not.toBeVisible();
}

test.describe('Bonus Log', () => {
  test('logs, funds goals, shows outside caps, edits and deletes', async ({ page }) => {
    await logRachelBonus(page);

    // Row under the current year, YTD net includes the bonus
    await expect(page.getByTestId('bonus-row')).toHaveCount(1);
    await expect(page.getByTestId('bonus-row')).toContainText('Rachel');
    await expect(page.getByTestId('bonus-ytd-table')).toContainText('S$8,000');

    // Goals tab: funded goal increased
    await page.getByRole('tab', { name: /Goals/i }).click();
    await expect(page.getByTestId(`goal-card-${BABY_FUND}`).locator('[title="S$457.16"]')).toBeVisible();

    // Budget: Income Flow shows the bonus outside caps
    await page.goto('/spend?tab=budget');
    const strip = page.getByTestId('waterfall-bonus-strip');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('Outside caps');
    await expect(strip).toContainText('S$8,000.00');

    // Edit: change gross, rebalance goals, save
    await page.goto('/plan?tab=bonus');
    await page.getByRole('button', { name: 'Edit bonus' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByRole('heading', { level: 2, name: 'Edit Bonus' })).toBeVisible();
    await modal.getByLabel('Gross').fill('5000');
    await modal.getByRole('button', { name: 'Next' }).click();
    await expect(modal.getByText('Goal amounts no longer match the Goals share.')).toBeVisible();
    await modal.getByRole('button', { name: 'Rebalance' }).click();
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();

    // Delete: confirm, then goals are reverted
    await page.getByRole('button', { name: 'Delete bonus' }).click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText('Delete Bonus?');
    await expect(confirm).toContainText('from goals.');
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('No Bonuses')).toBeVisible();

    await page.getByRole('tab', { name: /Goals/i }).click();
    await expect(page.getByTestId(`goal-card-${BABY_FUND}`).locator('[title="S$0.00"]')).toBeVisible();
  });

  test('has no horizontal scroll on mobile and the modal footer is reachable', async ({ page, isMobile }) => {
    if (!isMobile) {
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await logRachelBonus(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Edit bonus' }).click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: 'Next' }).click();
    const save = modal.getByRole('button', { name: 'Save' });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
  });
});
