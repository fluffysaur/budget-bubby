import { test, expect, type Page } from '@playwright/test';

async function openAddExpense(page: Page, isMobile: boolean) {
  await page.goto('/');
  if (isMobile) {
    await page.getByRole('navigation', { name: 'Mobile Navigation' }).getByRole('button', { name: 'Quick Add' }).click();
  } else {
    await page.getByRole('button', { name: 'Quick Add' }).click();
  }
  const panel = page.getByRole('dialog').locator('> div').first();
  await expect(panel).toBeVisible();
  // Let the enter animation settle before measuring
  await page.waitForTimeout(400);
  return panel;
}

test.describe('Modal behaviour', () => {
  test('is a bottom sheet on phones and a centred dialog on desktop', async ({ page, isMobile }) => {
    const panel = await openAddExpense(page, isMobile);
    const box = (await panel.boundingBox())!;
    const viewport = page.viewportSize()!;

    if (isMobile) {
      // Anchored to the bottom edge
      expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(2);
    } else {
      // Centred both ways
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(2);
    }
  });

  test('skips the slide/scale animation when reduced motion is on', async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const panel = await openAddExpense(page, isMobile);
    const duration = await panel.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
  });
});
